import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppData, DispatchEntry, DispatchStatus, DispatchRow, ProductionPlan } from '../../types';
import { saveDispatch, deleteDispatch, ensurePartyExists, updateProductionPlan } from '../../services/storageService';
import { Layers, ArrowRightCircle, CheckCircle2, BellRing, GitMerge, Share2, CheckSquare, Square, X, MessageCircle } from 'lucide-react';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

const SIZE_TYPES = ["", "INTAS", "OPEN", "ROUND", "ST.SEAL", "LABEL", "ROLL", "WINDER", "PRINTING", "PLAIN"];

export const DispatchManager: React.FC<Props> = ({ data, onUpdate }) => {
  // --- STATE MANAGEMENT ---
  const [activeDispatch, setActiveDispatch] = useState<Partial<DispatchEntry>>({
    date: new Date().toISOString().split('T')[0],
    dispatchNo: '',
    rows: [],
    status: DispatchStatus.PENDING
  });
  
  const [partyInput, setPartyInput] = useState('');
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);

  // Share Form State
  const [shareFormData, setShareFormData] = useState<{
      dispatch: DispatchEntry;
      rows: { id: string; size: string; pcs: string; bundle: string }[];
  } | null>(null);

  // Row Entry State
  const [rowSize, setRowSize] = useState('');
  const [rowType, setRowType] = useState('');
  const [rowMicron, setRowMicron] = useState('');
  const [rowWeight, setRowWeight] = useState('');
  const [rowPcs, setRowPcs] = useState('');
  const [rowBundle, setRowBundle] = useState('');
  const [rowPlanId, setRowPlanId] = useState<string | null>(null);

  // List View State
  const [searchJob, setSearchJob] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [selectedRowsForShare, setSelectedRowsForShare] = useState<Record<string, string[]>>({});

  // Notification State
  const [newPlanNotification, setNewPlanNotification] = useState(false);
  const prevPlanCountRef = useRef<number | null>(null);

  // Auto-generate Dispatch Number
  useEffect(() => {
    if (!isEditingId && !activeDispatch.dispatchNo) {
        const maxNo = data.dispatches.reduce((max, d) => {
            const num = parseInt(d.dispatchNo);
            return !isNaN(num) && num > max ? num : max;
        }, 0);
        const nextNo = maxNo === 0 ? '1001' : (maxNo + 1).toString();
        setActiveDispatch(prev => ({ ...prev, dispatchNo: nextNo }));
    }
  }, [data.dispatches, isEditingId]);

  // Notification Logic
  useEffect(() => {
      const pendingCount = data.productionPlans.filter(p => p.status === 'PENDING').length;
      if (prevPlanCountRef.current === null) {
          prevPlanCountRef.current = pendingCount;
          return;
      }
      if (pendingCount > prevPlanCountRef.current) {
          setNewPlanNotification(true);
          setTimeout(() => setNewPlanNotification(false), 4000);
      }
      prevPlanCountRef.current = pendingCount;
  }, [data.productionPlans]);

  const partySuggestions = data.parties.filter(p => {
    const search = partyInput.toLowerCase();
    return p.name.toLowerCase().includes(search) || (p.code && p.code.toLowerCase().includes(search));
  });

  const pendingPlans = useMemo(() => 
    data.productionPlans
        .filter(p => p.status === 'PENDING')
        .sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()), 
  [data.productionPlans]);

  const plansByParty = useMemo(() => {
      const groups: Record<string, ProductionPlan[]> = {};
      pendingPlans.forEach(p => {
          if (!groups[p.partyName]) groups[p.partyName] = [];
          groups[p.partyName].push(p);
      });
      return groups;
  }, [pendingPlans]);

  const filteredDispatches = useMemo(() => {
      const search = searchJob.toLowerCase();
      return data.dispatches.filter(d => {
          const p = data.parties.find(p => p.id === d.partyId);
          const pName = p ? p.name.toLowerCase() : '';
          const pCode = p?.code ? p.code.toLowerCase() : '';
          return d.dispatchNo.includes(search) || pName.includes(search) || pCode.includes(search) || d.rows.some(r => r.size.toLowerCase().includes(search));
      }).sort((a, b) => {
          const getPriority = (d: DispatchEntry) => {
              if (d.isTodayDispatch) return 0;
              if (['CUTTING', 'PRINTING', 'SLITTING'].includes(d.status)) return 0;
              return d.status === 'PENDING' ? 1 : d.status === 'COMPLETED' ? 2 : 3;
          };
          const pA = getPriority(a);
          const pB = getPriority(b);
          if (pA !== pB) return pA - pB;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [data.dispatches, data.parties, searchJob]);

  const toggleRowSelectionForShare = (dispatchId: string, rowId: string) => {
      setSelectedRowsForShare(prev => {
          const current = prev[dispatchId] || [];
          const updated = current.includes(rowId) ? current.filter(id => id !== rowId) : [...current, rowId];
          return { ...prev, [dispatchId]: updated };
      });
  };

  const toggleAllRowsForShare = (d: DispatchEntry) => {
      const current = selectedRowsForShare[d.id] || [];
      setSelectedRowsForShare(prev => ({ ...prev, [d.id]: current.length === d.rows.length ? [] : d.rows.map(r => r.id) }));
  };

  const mapPlanType = (type: string) => {
      const upperType = type.toUpperCase();
      return SIZE_TYPES.find(t => t === upperType) || (type === 'St. Seal' ? 'ST.SEAL' : type === 'Printing' ? 'PRINTING' : '');
  };

  const handleImportPlan = (plan: ProductionPlan) => {
    setPartyInput(plan.partyName);
    setActiveDispatch(prev => ({ ...prev, date: plan.date }));
    let displaySize = plan.cuttingSize > 0 ? `${plan.size} x ${plan.cuttingSize}` : plan.size;
    if (plan.printName) displaySize = `${displaySize} (${plan.printName})`;
    setRowSize(displaySize);
    setRowType(mapPlanType(plan.type));
    setRowMicron(plan.micron ? plan.micron.toString() : '');
    setRowPlanId(plan.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMergePlans = (plans: ProductionPlan[]) => {
      if (plans.length === 0) return;
      const first = plans[0];
      setPartyInput(first.partyName);
      setActiveDispatch(prev => ({ ...prev, date: first.date }));
      const newRows: DispatchRow[] = plans.map(plan => ({
          id: `r-${Date.now()}-${Math.random()}`,
          planId: plan.id,
          size: plan.printName ? `${plan.cuttingSize > 0 ? `${plan.size}x${plan.cuttingSize}` : plan.size} (${plan.printName})` : (plan.cuttingSize > 0 ? `${plan.size}x${plan.cuttingSize}` : plan.size),
          sizeType: mapPlanType(plan.type),
          micron: plan.micron || 0,
          weight: 0, productionWeight: 0, wastage: 0, pcs: 0, bundle: 0,
          status: DispatchStatus.PENDING, isCompleted: false, isLoaded: false
      }));
      setActiveDispatch(prev => ({ ...prev, rows: [...(prev.rows || []), ...newRows] }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addRow = () => {
      if (!rowSize) return alert("Size is required");
      const newRow: DispatchRow = {
          id: `r-${Date.now()}-${Math.random()}`,
          planId: rowPlanId || undefined,
          size: rowSize, sizeType: rowType, micron: parseFloat(rowMicron) || 0,
          weight: parseFloat(rowWeight) || 0, productionWeight: 0, wastage: 0,
          pcs: parseFloat(rowPcs) || 0, bundle: parseFloat(rowBundle) || 0,
          status: DispatchStatus.PENDING, isCompleted: false, isLoaded: false
      };
      setActiveDispatch(prev => ({ ...prev, rows: [newRow, ...(prev.rows || [])] }));
      setRowSize(''); setRowType(''); setRowMicron(''); setRowWeight(''); setRowPcs(''); setRowBundle(''); setRowPlanId(null);
  };

  const resetForm = () => {
      setPartyInput('');
      setActiveDispatch({ date: new Date().toISOString().split('T')[0], dispatchNo: '', rows: [], status: DispatchStatus.PENDING });
      setIsEditingId(null);
  };

  const handleSave = async () => {
      if (!partyInput) return alert("Party Name Required");
      if (!activeDispatch.rows || activeDispatch.rows.length === 0) return alert("Add at least one item");
      const partyId = await ensurePartyExists(data.parties, partyInput);
      const dispatch: DispatchEntry = {
          id: activeDispatch.id || `d-${Date.now()}`,
          dispatchNo: activeDispatch.dispatchNo || 'AUTO',
          date: activeDispatch.date!,
          partyId, status: activeDispatch.status || DispatchStatus.PENDING,
          rows: activeDispatch.rows,
          totalWeight: activeDispatch.rows.reduce((sum, r) => sum + r.weight, 0),
          totalPcs: activeDispatch.rows.reduce((sum, r) => sum + r.pcs, 0),
          isTodayDispatch: activeDispatch.isTodayDispatch || false,
          createdAt: activeDispatch.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
      };
      await saveDispatch(dispatch);
      for (const row of dispatch.rows) { if (row.planId) await updateProductionPlan({ id: row.planId, status: 'COMPLETED' }); }
      resetForm();
  };

  const handleEdit = (d: DispatchEntry) => {
      setPartyInput(data.parties.find(p => p.id === d.partyId)?.name || '');
      setActiveDispatch({ ...d });
      setIsEditingId(d.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRowUpdate = async (d: DispatchEntry, rowId: string, field: keyof DispatchRow, value: any) => {
      const newRows = d.rows.map(r => r.id === rowId ? { ...r, [field]: value } : r);
      await saveDispatch({ ...d, rows: newRows, totalWeight: newRows.reduce((s, r) => s + r.weight, 0), totalPcs: newRows.reduce((s, r) => s + r.pcs, 0), updatedAt: new Date().toISOString() });
  };

  // --- WHATSAPP SHARE LOGIC ---
  const initiateShare = (d: DispatchEntry) => {
      const markedIds = selectedRowsForShare[d.id] || [];
      const rowsToProcess = markedIds.length > 0 ? d.rows.filter(r => markedIds.includes(r.id)) : d.rows;
      setShareFormData({
          dispatch: d,
          rows: rowsToProcess.map(r => ({ id: r.id, size: r.size, pcs: r.pcs.toString(), bundle: r.bundle.toString() }))
      });
  };

  const executeShare = async () => {
      if (!shareFormData) return;
      const { dispatch, rows } = shareFormData;
      const party = data.parties.find(p => p.id === dispatch.partyId)?.name || 'Unknown';
      
      const totalPcs = rows.reduce((acc, r) => acc + (Number(r.pcs) || 0), 0);
      const totalBundles = rows.reduce((acc, r) => acc + (Number(r.bundle) || 0), 0);
      
      // 1. Format Text Message
      let textMessage = `*Job Card: ${party}*\n#${dispatch.dispatchNo} - ${dispatch.date.split('-').reverse().join('/')}\n\n`;
      rows.forEach(r => {
          textMessage += `${r.size} ${r.pcs} Pcs ${r.bundle} Bdl\n`;
      });
      textMessage += `\n*Total: ${totalPcs} Pcs | ${totalBundles} 📦*\n`;
      textMessage += `_RDMS Industrial Dispatch_`;

      // 2. Generate Image (Re-using logic from original)
      const containerId = 'share-job-gen-user';
      let container = document.getElementById(containerId);
      if (container) document.body.removeChild(container);
      container = document.createElement('div');
      container.id = containerId;
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0px';
      container.style.width = '900px'; 
      container.style.background = '#fff';
      container.style.zIndex = '-1';
      document.body.appendChild(container);

      // We use original Dispatch Rows for the image, or filtered if marked
      const markedIds = selectedRowsForShare[dispatch.id] || [];
      const imageRows = markedIds.length > 0 ? dispatch.rows.filter(r => markedIds.includes(r.id)) : dispatch.rows;

      const rowsHtml = imageRows.map((r, i) => {
          const formDataRow = rows.find(fr => fr.id === r.id);
          return `
            <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f0f9ff'}; border-bottom: 2px solid #e0f2fe;">
                <td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e;">${r.size}</td>
                <td style="padding: 16px 12px; font-size: 20px; color: #0284c7; text-align: center; font-weight: bold;">${r.sizeType || '-'}</td>
                <td style="padding: 16px 12px; font-size: 20px; color: #64748b; text-align: center; font-weight: bold;">${r.micron || '-'}</td>
                <td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e; text-align: right;">${r.weight > 0 ? r.weight.toFixed(3) : '-'}</td>
                <td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e; text-align: right;">${formDataRow?.pcs || r.pcs}</td>
                <td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e; text-align: right;">${formDataRow?.bundle || r.bundle}</td>
            </tr>
          `;
      }).join('');

      container.innerHTML = `
        <div style="font-family: 'Inter', sans-serif; border: 4px solid #0c4a6e; background: #fff;">
            <div style="background: linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%); padding: 32px; color: white;">
                <div style="font-size: 18px; text-transform: uppercase; letter-spacing: 3px; color: #bae6fd; font-weight: bold;">Job Card</div>
                <div style="font-size: 40px; font-weight: bold; margin-top: 8px; line-height: 1.1;">${party}</div>
                <div style="margin-top: 24px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #7dd3fc; padding-top: 20px;">
                    <span style="font-size: 28px; background: rgba(255,255,255,0.2); padding: 8px 20px; rounded: 10px; font-weight: bold; border: 1px solid #7dd3fc;">#${dispatch.dispatchNo}</span>
                    <span style="font-size: 24px; color: #e0f2fe; font-weight: bold;">${dispatch.date.split('-').reverse().join('/')}</span>
                </div>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #e0f2fe; color: #0c4a6e; font-size: 18px; text-transform: uppercase; border-bottom: 3px solid #0284c7;">
                        <th style="padding: 16px 12px; text-align: left;">Size</th>
                        <th style="padding: 16px 12px; text-align: center;">Type</th>
                        <th style="padding: 16px 12px; text-align: center;">Mic</th>
                        <th style="padding: 16px 12px; text-align: right;">Weight</th>
                        <th style="padding: 16px 12px; text-align: right;">Pcs</th>
                        <th style="padding: 16px 12px; text-align: right;">Box</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
                <tfoot>
                    <tr style="background: #0c4a6e; color: white; font-weight: bold;">
                        <td colspan="4" style="padding: 24px 12px; font-size: 24px;">TOTAL</td>
                        <td style="padding: 24px 12px; text-align: right; font-size: 28px;">${totalPcs}</td>
                        <td style="padding: 24px 12px; text-align: right; font-size: 28px;">${totalBundles}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
      `;

      try {
          if (!(window as any).html2canvas) throw new Error("Library not loaded");
          const canvas = await (window as any).html2canvas(container, { scale: 2 });
          canvas.toBlob(async (blob: Blob) => {
              if (blob) {
                  const file = new File([blob], `Job_${dispatch.dispatchNo}.png`, { type: 'image/png' });
                  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                      await navigator.share({ files: [file], title: `Job ${dispatch.dispatchNo}`, text: textMessage });
                  } else {
                      const link = document.createElement('a');
                      link.download = `Job_${dispatch.dispatchNo}.png`;
                      link.href = URL.createObjectURL(blob);
                      link.click();
                      alert("Image downloaded. You can share this text manually:\n\n" + textMessage);
                  }
              }
              if (document.body.contains(container!)) document.body.removeChild(container!);
              setShareFormData(null);
          });
      } catch (err) {
          console.error(err);
          alert("Failed to generate image.");
      }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
        
        {/* --- SHARE FORM POPUP --- */}
        {shareFormData && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
                    <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white">
                        <div className="flex items-center gap-2">
                            <MessageCircle size={20} />
                            <h3 className="font-bold uppercase tracking-widest text-sm">WhatsApp Dispatch Form</h3>
                        </div>
                        <button onClick={() => setShareFormData(null)}><X size={20} /></button>
                    </div>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-2">Review Pcs/Box for Shared Card</p>
                        {shareFormData.rows.map((row, idx) => (
                            <div key={row.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                                <div className="text-xs font-black text-indigo-700 uppercase">{row.size}</div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Total Pcs</label>
                                        <input 
                                            type="number" 
                                            value={row.pcs} 
                                            onChange={e => {
                                                const updated = [...shareFormData.rows];
                                                updated[idx].pcs = e.target.value;
                                                setShareFormData({ ...shareFormData, rows: updated });
                                            }}
                                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500" 
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Bundle/Box</label>
                                        <input 
                                            type="number" 
                                            value={row.bundle} 
                                            onChange={e => {
                                                const updated = [...shareFormData.rows];
                                                updated[idx].bundle = e.target.value;
                                                setShareFormData({ ...shareFormData, rows: updated });
                                            }}
                                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500" 
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-6 bg-slate-50 border-t border-slate-200">
                        <button 
                            onClick={executeShare}
                            className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 uppercase tracking-widest text-sm hover:bg-indigo-700 active:scale-[0.98] transition-all"
                        >
                            <Share2 size={18} /> Confirm & Share to WhatsApp
                        </button>
                    </div>
                </div>
            </div>
        )}

        {newPlanNotification && (
            <div className="fixed top-20 right-4 z-50 bg-indigo-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300">
                <BellRing size={20} className="animate-pulse" />
                <div>
                    <div className="font-bold text-sm">New Production Plan!</div>
                    <div className="text-xs opacity-90">Admin just added a job.</div>
                </div>
            </div>
        )}

        {/* --- PENDING PLANS SECTION --- */}
        {pendingPlans.length > 0 && !isEditingId && (
            <div className="bg-gradient-to-r from-slate-50 to-indigo-50/30 rounded-2xl p-4 border border-indigo-100 shadow-inner">
                <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Layers size={14} /> Production Queue
                </h3>
                <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2">
                    {pendingPlans.map(plan => (
                        <div key={plan.id} className="min-w-[240px] bg-white border border-slate-200 rounded-xl p-3 hover:border-indigo-400 hover:shadow-md transition-all relative flex flex-col gap-2">
                            <div onClick={() => handleImportPlan(plan)} className="cursor-pointer">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-[9px] font-bold text-slate-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded">{plan.date.split('-').reverse().join('/')}</span>
                                    <span className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 uppercase">{plan.type}</span>
                                </div>
                                <div className="font-bold text-slate-800 text-xs line-clamp-1">{plan.partyName}</div>
                                <div className="bg-slate-50 rounded p-1.5 border border-slate-100 space-y-1">
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-slate-500 font-semibold">Size:</span>
                                        <span className="font-bold text-slate-700">{plan.cuttingSize > 0 ? `${plan.size}x${plan.cuttingSize}` : plan.size}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-slate-500 font-semibold">Mic:</span>
                                        <span className="font-bold text-slate-700">{plan.micron}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* --- FORM SECTION --- */}
        <div className={`bg-white rounded-2xl shadow-sm border ${isEditingId ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'} overflow-hidden`}>
            <div className={`px-6 py-4 flex justify-between items-center ${isEditingId ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                <h3 className="text-base font-bold text-white tracking-wide">
                    {isEditingId ? '✏️ Edit Job' : '🚚 New Job Entry'}
                </h3>
            </div>
            
            <div className="p-6 space-y-5">
                <div className="flex gap-4">
                    <div className="w-28">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Job #</label>
                        <input value={activeDispatch.dispatchNo} onChange={e => setActiveDispatch({...activeDispatch, dispatchNo: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-center outline-none" placeholder="Auto" />
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Date</label>
                        <input type="date" value={activeDispatch.date} onChange={e => setActiveDispatch({...activeDispatch, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold outline-none" />
                    </div>
                </div>

                <div className="relative">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Party Name</label>
                    <input 
                        type="text" 
                        value={partyInput} 
                        onChange={e => { setPartyInput(e.target.value); setShowPartyDropdown(true); }}
                        onFocus={() => setShowPartyDropdown(true)}
                        onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-bold outline-none"
                        placeholder="Search Party..."
                    />
                    {showPartyDropdown && partyInput && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                            {partySuggestions.map(p => (
                                <div key={p.id} className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-bold border-b border-slate-50" onClick={() => { setPartyInput(p.name); setShowPartyDropdown(false); }}>
                                    {p.name}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className={`bg-slate-50 p-4 rounded-xl border ${rowPlanId ? 'border-indigo-300' : 'border-slate-200'}`}>
                    <div className="grid grid-cols-12 gap-3 mb-3 items-end">
                        <div className="col-span-12 md:col-span-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Size / Item</label>
                            <input value={rowSize} onChange={e => setRowSize(e.target.value)} placeholder="Description" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold outline-none" />
                        </div>
                        <div className="col-span-4 md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Wt</label>
                            <input type="number" value={rowWeight} onChange={e => setRowWeight(e.target.value)} placeholder="0.000" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-center outline-none" />
                        </div>
                        <div className="col-span-4 md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Pcs</label>
                            <input type="number" value={rowPcs} onChange={e => setRowPcs(e.target.value)} placeholder="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-center outline-none" />
                        </div>
                        <div className="col-span-4 md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Box</label>
                            <input type="number" value={rowBundle} onChange={e => setRowBundle(e.target.value)} placeholder="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-center outline-none" />
                        </div>
                    </div>
                    <button onClick={addRow} className="w-full bg-white border border-slate-300 rounded-lg py-2.5 text-xs font-bold hover:text-indigo-600 transition-colors">+ Add Line Item</button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {activeDispatch.rows?.map((r, i) => (
                        <div key={i} className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 text-xs">
                            <span className="font-bold">{r.size} • {r.weight.toFixed(3)}kg • {r.pcs}pcs</span>
                            <button onClick={() => { const updated = [...(activeDispatch.rows || [])]; updated.splice(i,1); setActiveDispatch({...activeDispatch, rows: updated}); }} className="text-red-500">×</button>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2 pt-2">
                    {isEditingId && <button onClick={resetForm} className="flex-1 bg-slate-100 py-3 rounded-xl font-bold">Cancel</button>}
                    <button onClick={handleSave} className="flex-[2] bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg">{isEditingId ? 'Update Job' : 'Save Job Card'}</button>
                </div>
            </div>
        </div>

        {/* --- LIST SECTION --- */}
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-800">📋 Recent Jobs</h3>
                <input placeholder="Search Job..." value={searchJob} onChange={e => setSearchJob(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none w-full sm:w-48 focus:ring-2 focus:ring-indigo-100" />
            </div>

            <div className="space-y-3">
                {filteredDispatches.map(d => {
                    const isExpanded = expandedId === d.id;
                    const isSelected = selectedJobIds.includes(d.id);
                    const markedCount = (selectedRowsForShare[d.id] || []).length;
                    
                    return (
                        <div key={d.id} className={`rounded-xl border shadow-sm bg-white overflow-hidden transition-all ${isSelected ? 'ring-2 ring-indigo-500' : 'border-slate-200'}`}>
                           <div onClick={() => setExpandedId(isExpanded ? null : d.id)} className="p-4 cursor-pointer">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 font-mono">#{d.dispatchNo} • {d.date}</span>
                                        <h4 className="text-sm font-bold text-indigo-900">{data.parties.find(p => p.id === d.partyId)?.name}</h4>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-bold text-slate-900">{d.totalWeight.toFixed(3)} kg</span>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase">{d.status}</div>
                                    </div>
                                </div>
                           </div>
                           
                           {isExpanded && (
                             <div className="bg-slate-50 border-t border-slate-100 p-4 animate-in slide-in-from-top-2">
                                <div className="flex justify-between items-center mb-4">
                                    <button onClick={() => initiateShare(d)} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg">
                                        <Share2 size={14}/> Share {markedCount > 0 ? `Marked (${markedCount})` : 'Full'} Card
                                    </button>
                                    <button onClick={() => toggleAllRowsForShare(d)} className="text-[10px] font-bold text-indigo-600">Select All Items</button>
                                </div>
                                <div className="space-y-2">
                                    {d.rows.map(row => {
                                        const isMarked = (selectedRowsForShare[d.id] || []).includes(row.id);
                                        return (
                                            <div key={row.id} className={`bg-white rounded-lg border p-3 flex justify-between items-center ${isMarked ? 'border-indigo-400 bg-indigo-50/20' : 'border-slate-200'}`}>
                                                <div className="flex items-center gap-3">
                                                    <button onClick={() => toggleRowSelectionForShare(d.id, row.id)} className={isMarked ? 'text-indigo-600' : 'text-slate-300'}>
                                                        {isMarked ? <CheckSquare size={18} /> : <Square size={18} />}
                                                    </button>
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-800">{row.size}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold">{row.pcs} pcs • {row.bundle} box</div>
                                                    </div>
                                                </div>
                                                <div className="text-right font-mono font-bold text-xs text-slate-600">{row.weight.toFixed(3)}kg</div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-4 flex gap-2 pt-3 border-t border-slate-200">
                                    <button onClick={() => handleEdit(d)} className="flex-1 bg-white border border-indigo-200 text-indigo-600 py-2 rounded-lg font-bold text-xs">Edit</button>
                                    <button onClick={() => { if(confirm("Delete Job?")) deleteDispatch(d.id); }} className="flex-1 bg-white border border-red-200 text-red-500 py-2 rounded-lg font-bold text-xs">Delete</button>
                                </div>
                             </div>
                           )}
                        </div>
                    );
                })}
            </div>
        </div>
    </div>
  );
};
