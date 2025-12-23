
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppData, DispatchEntry, DispatchStatus, DispatchRow, ProductionPlan } from '../../types';
import { saveDispatch, deleteDispatch, ensurePartyExists, updateProductionPlan } from '../../services/storageService';
import { Layers, ArrowRightCircle, CheckCircle2, BellRing, GitMerge, Share2, CheckSquare, Square } from 'lucide-react';

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

  // Row Entry State
  const [rowSize, setRowSize] = useState('');
  const [rowType, setRowType] = useState('');
  const [rowMicron, setRowMicron] = useState('');
  const [rowWeight, setRowWeight] = useState('');
  const [rowPcs, setRowPcs] = useState('');
  const [rowBundle, setRowBundle] = useState('');
  const [rowPlanId, setRowPlanId] = useState<string | null>(null); // Link to Plan

  // List View State
  const [searchJob, setSearchJob] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  
  // Selection for WhatsApp Share (Line items)
  const [selectedRowsForShare, setSelectedRowsForShare] = useState<Record<string, string[]>>({});

  // Notification State
  const [newPlanNotification, setNewPlanNotification] = useState(false);
  const prevPlanCountRef = useRef<number | null>(null);

  // --- EFFECTS ---

  // Auto-generate Dispatch Number if not editing
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

  // Notification Logic for New Plans
  useEffect(() => {
      const pendingCount = data.productionPlans.filter(p => p.status === 'PENDING').length;
      if (prevPlanCountRef.current === null) {
          prevPlanCountRef.current = pendingCount;
          return;
      }
      if (pendingCount > prevPlanCountRef.current) {
          setNewPlanNotification(true);
          const timer = setTimeout(() => setNewPlanNotification(false), 4000);
          return () => clearTimeout(timer);
      }
      prevPlanCountRef.current = pendingCount;
  }, [data.productionPlans]);

  // --- HELPERS ---

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
              if (d.status === 'PENDING') return 1;
              if (d.status === 'COMPLETED') return 2;
              if (d.status === 'DISPATCHED') return 3;
              return 4;
          };
          const pA = getPriority(a);
          const pB = getPriority(b);
          if (pA !== pB) return pA - pB;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [data.dispatches, data.parties, searchJob]);

  // --- SHARE ROW SELECTION LOGIC ---
  const toggleRowSelectionForShare = (dispatchId: string, rowId: string) => {
      setSelectedRowsForShare(prev => {
          const current = prev[dispatchId] || [];
          const updated = current.includes(rowId) 
            ? current.filter(id => id !== rowId) 
            : [...current, rowId];
          return { ...prev, [dispatchId]: updated };
      });
  };

  const toggleAllRowsForShare = (d: DispatchEntry) => {
      const current = selectedRowsForShare[d.id] || [];
      if (current.length === d.rows.length) {
          setSelectedRowsForShare(prev => ({ ...prev, [d.id]: [] }));
      } else {
          setSelectedRowsForShare(prev => ({ ...prev, [d.id]: d.rows.map(r => r.id) }));
      }
  };

  // --- ACTIONS ---

  const mapPlanType = (type: string) => {
      const upperType = type.toUpperCase();
      return SIZE_TYPES.find(t => t === upperType) || 
             (type === 'St. Seal' ? 'ST.SEAL' : 
              type === 'Printing' ? 'PRINTING' : 
              type === 'Intas' ? 'INTAS' : 
              type === 'Round' ? 'ROUND' : 
              type === 'Open' ? 'OPEN' : 
              type === 'Roll' ? 'ROLL' : 
              type === 'Winder' ? 'WINDER' : '');
  };

  const handleImportPlan = (plan: ProductionPlan) => {
    setPartyInput(plan.partyName);
    setActiveDispatch(prev => ({ ...prev, date: plan.date }));
    let displaySize = plan.cuttingSize > 0 ? `${plan.size} x ${plan.cuttingSize}` : plan.size;
    if (plan.printName) displaySize = `${displaySize} (${plan.printName})`;
    setRowSize(displaySize);
    setRowType(mapPlanType(plan.type));
    setRowMicron(plan.micron ? plan.micron.toString() : '');
    setRowWeight(''); 
    setRowPcs('');
    setRowBundle('');
    setRowPlanId(plan.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMergePlans = (plans: ProductionPlan[]) => {
      if (plans.length === 0) return;
      const first = plans[0];
      setPartyInput(first.partyName);
      setActiveDispatch(prev => ({ ...prev, date: first.date }));

      const newRows: DispatchRow[] = plans.map(plan => {
          let displaySize = plan.cuttingSize > 0 ? `${plan.size} x ${plan.cuttingSize}` : plan.size;
          if (plan.printName) displaySize = `${displaySize} (${plan.printName})`;
          return {
              id: `r-${Date.now()}-${Math.random()}`,
              planId: plan.id,
              size: displaySize,
              sizeType: mapPlanType(plan.type),
              micron: plan.micron || 0,
              weight: 0,
              productionWeight: 0,
              wastage: 0,
              pcs: 0,
              bundle: 0,
              status: DispatchStatus.PENDING,
              isCompleted: false,
              isLoaded: false
          };
      });
      setActiveDispatch(prev => ({
          ...prev,
          rows: [...(prev.rows || []), ...newRows]
      }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- FORM HANDLERS ---

  const addRow = () => {
      if (!rowSize) return alert("Size is required");
      const newRow: DispatchRow = {
          id: `r-${Date.now()}-${Math.random()}`,
          planId: rowPlanId || undefined,
          size: rowSize,
          sizeType: rowType,
          micron: parseFloat(rowMicron) || 0,
          weight: parseFloat(rowWeight) || 0,
          productionWeight: 0, 
          wastage: 0,
          pcs: parseFloat(rowPcs) || 0,
          bundle: parseFloat(rowBundle) || 0,
          status: DispatchStatus.PENDING,
          isCompleted: false,
          isLoaded: false
      };
      setActiveDispatch(prev => ({
          ...prev,
          rows: [newRow, ...(prev.rows || [])]
      }));
      setRowSize(''); setRowType(''); setRowMicron(''); setRowWeight(''); setRowPcs(''); setRowBundle('');
      setRowPlanId(null);
  };

  const removeFormRow = (index: number) => {
      setActiveDispatch(prev => {
          const newRows = [...(prev.rows || [])];
          newRows.splice(index, 1);
          return { ...prev, rows: newRows };
      });
  };

  const resetForm = () => {
      setPartyInput('');
      setActiveDispatch({
          date: new Date().toISOString().split('T')[0],
          dispatchNo: '',
          rows: [],
          status: DispatchStatus.PENDING
      });
      setIsEditingId(null);
      setRowPlanId(null);
  };

  const handleSave = async () => {
      if (!partyInput) return alert("Party Name Required");
      if (!activeDispatch.rows || activeDispatch.rows.length === 0) return alert("Add at least one item");
      const partyId = await ensurePartyExists(data.parties, partyInput);
      const totalWeight = activeDispatch.rows.reduce((sum, r) => sum + r.weight, 0);
      const totalPcs = activeDispatch.rows.reduce((sum, r) => sum + r.pcs, 0);
      const dispatch: DispatchEntry = {
          id: activeDispatch.id || `d-${Date.now()}`,
          dispatchNo: activeDispatch.dispatchNo || 'AUTO',
          date: activeDispatch.date!,
          partyId,
          status: activeDispatch.status || DispatchStatus.PENDING,
          rows: activeDispatch.rows,
          totalWeight,
          totalPcs,
          isTodayDispatch: activeDispatch.isTodayDispatch || false,
          createdAt: activeDispatch.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
      };
      await saveDispatch(dispatch);
      for (const row of dispatch.rows) {
          if (row.planId) {
              await updateProductionPlan({ id: row.planId, status: 'COMPLETED' });
          }
      }
      resetForm();
  };

  // --- JOB ACTIONS ---

  const handleEdit = (d: DispatchEntry) => {
      const p = data.parties.find(p => p.id === d.partyId);
      setPartyInput(p ? p.name : '');
      setActiveDispatch({ ...d });
      setIsEditingId(d.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRepeatOrder = (d: DispatchEntry) => {
      const p = data.parties.find(p => p.id === d.partyId);
      setPartyInput(p ? p.name : '');
      const clonedRows = d.rows.map(r => ({ 
          ...r, 
          id: `r-${Date.now()}-${Math.random()}`, 
          planId: undefined, 
          status: DispatchStatus.PENDING,
          productionWeight: 0, 
          weight: 0,
          wastage: 0
      }));
      setActiveDispatch({
          date: new Date().toISOString().split('T')[0],
          dispatchNo: '', 
          rows: clonedRows,
          status: DispatchStatus.PENDING,
          isTodayDispatch: true
      });
      setIsEditingId(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMergeJobs = async () => {
      if (selectedJobIds.length < 2) return;
      if (!confirm(`Merge ${selectedJobIds.length} selected jobs into one? Original jobs will be deleted.`)) return;
      const jobsToMerge = data.dispatches.filter(d => selectedJobIds.includes(d.id));
      if (jobsToMerge.length === 0) return;
      const primaryJob = jobsToMerge[0];
      const mergedRows = jobsToMerge.flatMap(j => j.rows);
      const totalWeight = mergedRows.reduce((s, r) => s + r.weight, 0);
      const totalPcs = mergedRows.reduce((s, r) => s + r.pcs, 0);
      const mergedDispatch: DispatchEntry = {
          id: `d-${Date.now()}`,
          dispatchNo: primaryJob.dispatchNo, 
          date: primaryJob.date,
          partyId: primaryJob.partyId,
          status: DispatchStatus.PENDING,
          rows: mergedRows,
          totalWeight,
          totalPcs,
          isTodayDispatch: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
      };
      await saveDispatch(mergedDispatch);
      for (const id of selectedJobIds) {
          await deleteDispatch(id);
      }
      setSelectedJobIds([]);
  };

  const toggleJobSelection = (id: string) => {
      setSelectedJobIds(prev => 
          prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
  };

  const handleJobStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>, d: DispatchEntry) => {
      e.stopPropagation();
      const newStatus = e.target.value as DispatchStatus;
      await saveDispatch({ ...d, status: newStatus, updatedAt: new Date().toISOString() });
  };

  const toggleToday = async (e: React.MouseEvent, d: DispatchEntry) => {
      e.stopPropagation();
      await saveDispatch({ ...d, isTodayDispatch: !d.isTodayDispatch, updatedAt: new Date().toISOString() });
  };

  const handleRowUpdate = async (d: DispatchEntry, rowId: string, field: keyof DispatchRow, value: any) => {
      const newRows = d.rows.map(r => {
          if (r.id === rowId) {
              const updatedRow = { ...r, [field]: value };
              if (field === 'productionWeight' || field === 'weight') {
                  const pWt = field === 'productionWeight' ? parseFloat(value) : (r.productionWeight || 0);
                  const dWt = field === 'weight' ? parseFloat(value) : r.weight;
                  if (pWt > 0 && dWt > 0) {
                      updatedRow.wastage = pWt - dWt;
                  }
              }
              return updatedRow;
          }
          return r;
      });
      const totalWeight = newRows.reduce((s, r) => s + r.weight, 0);
      const totalPcs = newRows.reduce((s, r) => s + r.pcs, 0);
      await saveDispatch({ ...d, rows: newRows, totalWeight, totalPcs, updatedAt: new Date().toISOString() });
  };

  const shareJobImage = async (d: DispatchEntry) => {
      const party = data.parties.find(p => p.id === d.partyId)?.name || 'Unknown';
      
      // Filter rows based on "Marked" status
      const markedIds = selectedRowsForShare[d.id] || [];
      const rowsToShare = markedIds.length > 0 
          ? d.rows.filter(r => markedIds.includes(r.id))
          : d.rows;

      const totalBundles = rowsToShare.reduce((acc, r) => acc + (Number(r.bundle) || 0), 0);
      const totalWeight = rowsToShare.reduce((acc, r) => acc + (Number(r.weight) || 0), 0);
      const totalPcs = rowsToShare.reduce((acc, r) => acc + (Number(r.pcs) || 0), 0);
      
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

      const rowsHtml = rowsToShare.map((r, i) => `
        <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f0f9ff'}; border-bottom: 2px solid #e0f2fe;">
            <td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e;">${r.size}</td>
            <td style="padding: 16px 12px; font-size: 20px; color: #0284c7; text-align: center; font-weight: bold;">${r.sizeType || '-'}</td>
            <td style="padding: 16px 12px; font-size: 20px; color: #64748b; text-align: center; font-weight: bold;">${r.micron || '-'}</td>
            <td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e; text-align: right;">${r.weight > 0 ? r.weight.toFixed(3) : '-'}</td>
            <td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e; text-align: right;">${r.pcs || '-'}</td>
            <td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e; text-align: right;">${r.bundle || '-'}</td>
        </tr>
      `).join('');

      container.innerHTML = `
        <div style="font-family: 'Inter', sans-serif; border: 4px solid #0c4a6e; background: #fff;">
            <div style="background: linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%); padding: 32px; color: white;">
                <div style="font-size: 18px; text-transform: uppercase; letter-spacing: 3px; color: #bae6fd; font-weight: bold;">Job Card ${markedIds.length > 0 ? '(Partial)' : ''}</div>
                <div style="font-size: 40px; font-weight: bold; margin-top: 8px; line-height: 1.1;">${party}</div>
                <div style="margin-top: 24px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #7dd3fc; padding-top: 20px;">
                    <span style="font-size: 28px; background: rgba(255,255,255,0.2); padding: 8px 20px; rounded: 10px; font-weight: bold; border: 1px solid #7dd3fc;">#${d.dispatchNo}</span>
                    <span style="font-size: 24px; color: #e0f2fe; font-weight: bold;">${d.date.split('-').reverse().join('/')}</span>
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
                        <td colspan="3" style="padding: 24px 12px; font-size: 24px;">TOTAL</td>
                        <td style="padding: 24px 12px; text-align: right; font-size: 28px;">${totalWeight.toFixed(3)}</td>
                        <td style="padding: 24px 12px; text-align: right; font-size: 28px;">${totalPcs}</td>
                        <td style="padding: 24px 12px; text-align: right; font-size: 28px;">${totalBundles}</td>
                    </tr>
                </tfoot>
            </table>
            <div style="padding: 16px; text-align: center; background: #f0f9ff; color: #0c4a6e; font-size: 16px; font-weight: bold; letter-spacing: 1px; border-top: 1px solid #e0f2fe;">
                RDMS DISPATCH
            </div>
        </div>
      `;

      try {
          // Cast window to any for html2canvas
          if (!(window as any).html2canvas) throw new Error("Library not loaded");
          const canvas = await (window as any).html2canvas(container, { scale: 2, backgroundColor: null });
          canvas.toBlob(async (blob: Blob) => {
              if (!blob) throw new Error("Blob generation failed");
              const file = new File([blob], `Job_${d.dispatchNo}.png`, { type: 'image/png' });
              if (navigator.canShare && navigator.canShare({ files: [file] })) {
                  try {
                      await navigator.share({
                          files: [file],
                          title: `Job ${d.dispatchNo}`,
                          text: `Job Card for ${party}`
                      });
                  } catch (e) { console.log("Share dismissed", e); }
              } else {
                  const link = document.createElement('a');
                  link.download = `Job_${d.dispatchNo}.png`;
                  link.href = URL.createObjectURL(blob);
                  link.click();
                  alert("Image downloaded. You can share it manually on WhatsApp.");
              }
              if (document.body.contains(container!)) document.body.removeChild(container!);
          }, 'image/png');
      } catch (err) {
          console.error(err);
          alert("Failed to generate image.");
          if (document.body.contains(container!)) document.body.removeChild(container!);
      }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
        
        {/* --- NOTIFICATION --- */}
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
                    <Layers size={14} /> Production Queue (Tap to Create Job)
                </h3>
                <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2">
                    {pendingPlans.map(plan => {
                        const displaySize = plan.cuttingSize > 0 ? `${plan.size} x ${plan.cuttingSize}` : plan.size;
                        const samePartyPlans = plansByParty[plan.partyName] || [];
                        const hasMergeOptions = samePartyPlans.length > 1;

                        return (
                            <div 
                                key={plan.id} 
                                className="min-w-[240px] bg-white border border-slate-200 rounded-xl p-3 hover:border-indigo-400 hover:shadow-md transition-all relative group flex flex-col gap-2"
                            >
                                <div onClick={() => handleImportPlan(plan)} className="cursor-pointer">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-[9px] font-bold text-slate-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded">{plan.date.split('-').reverse().join('/')}</span>
                                        <span className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 uppercase">{plan.type}</span>
                                    </div>
                                    <div className="font-bold text-slate-800 text-xs line-clamp-1" title={plan.partyName}>{plan.partyName}</div>
                                    <div className="bg-slate-50 rounded p-1.5 border border-slate-100 space-y-1">
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-slate-500 font-semibold">Size:</span>
                                            <span className="font-bold text-slate-700">{displaySize}</span>
                                        </div>
                                        {plan.printName && (
                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-slate-500 font-semibold">Print:</span>
                                                <span className="font-bold text-purple-600">{plan.printName}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-slate-500 font-semibold">Micron:</span>
                                            <span className="font-bold text-slate-700">{plan.micron}</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1 text-center mt-1">
                                        <div className="bg-indigo-50/50 rounded p-1 border border-indigo-50">
                                            <div className="text-[8px] text-indigo-400 uppercase font-bold">Weight</div>
                                            <div className="text-[10px] font-bold text-indigo-700">{plan.weight}</div>
                                        </div>
                                        <div className="bg-blue-50/50 rounded p-1 border border-blue-50">
                                            <div className="text-[8px] text-blue-400 uppercase font-bold">Meter</div>
                                            <div className="text-[10px] font-bold text-blue-700">{plan.meter}</div>
                                        </div>
                                        <div className="bg-emerald-50/50 rounded p-1 border border-emerald-50">
                                            <div className="text-[8px] text-emerald-400 uppercase font-bold">Pcs</div>
                                            <div className="text-[10px] font-bold text-emerald-700">{plan.pcs}</div>
                                        </div>
                                    </div>
                                    {plan.notes && (
                                        <div className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded truncate italic mt-1">
                                            NB: {plan.notes}
                                        </div>
                                    )}
                                </div>
                                {hasMergeOptions && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleMergePlans(samePartyPlans); }}
                                        className="mt-1 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 shadow-sm transition-colors"
                                    >
                                        <GitMerge size={12} /> Merge All ({samePartyPlans.length})
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {/* --- FORM SECTION --- */}
        <div className={`bg-white rounded-2xl shadow-sm border ${isEditingId ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'} overflow-hidden transition-all`}>
            <div className={`px-6 py-4 flex justify-between items-center ${isEditingId ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                    {isEditingId ? <span className="animate-pulse">✏️ Edit Job</span> : <span>🚚 New Job Entry</span>}
                </h3>
                <div className="text-xs font-bold text-white/80">{activeDispatch.rows?.length} Items</div>
            </div>
            
            <div className="p-6 space-y-5">
                <div className="flex gap-4">
                    <div className="w-28">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Job #</label>
                        <input value={activeDispatch.dispatchNo} onChange={e => setActiveDispatch({...activeDispatch, dispatchNo: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-center outline-none focus:border-indigo-500" placeholder="Auto" />
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Date</label>
                        <input type="date" value={activeDispatch.date} onChange={e => setActiveDispatch({...activeDispatch, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500" />
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500"
                        placeholder="Search Party..."
                    />
                    {showPartyDropdown && partyInput && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                            {partySuggestions.map(p => (
                                <div key={p.id} className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-bold text-slate-700 border-b border-slate-50" onClick={() => { setPartyInput(p.name); setShowPartyDropdown(false); }}>
                                    {p.name} <span className="text-[10px] text-slate-400 ml-2">{p.code}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className={`bg-slate-50 p-4 rounded-xl border transition-all shadow-inner ${rowPlanId ? 'border-indigo-300 ring-2 ring-indigo-50' : 'border-slate-200'}`}>
                    {rowPlanId && (
                        <div className="flex items-center gap-2 mb-3 text-indigo-600 bg-indigo-50 w-fit px-2 py-1 rounded text-[10px] font-bold border border-indigo-100 animate-in fade-in">
                            <CheckCircle2 size={12} /> Auto-Filling from Plan
                        </div>
                    )}
                    <div className="grid grid-cols-12 gap-3 mb-3 items-end">
                        <div className="col-span-12 md:col-span-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Size / Item</label>
                            <input value={rowSize} onChange={e => setRowSize(e.target.value)} placeholder="Description" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500" />
                        </div>
                        <div className="col-span-6 md:col-span-2">
                             <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Type</label>
                             <select value={rowType} onChange={e => setRowType(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold outline-none focus:border-indigo-500">
                                 {SIZE_TYPES.map(t => <option key={t} value={t}>{t || '-'}</option>)}
                             </select>
                        </div>
                        <div className="col-span-6 md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Mic</label>
                            <input type="number" value={rowMicron} onChange={e => setRowMicron(e.target.value)} placeholder="0" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm font-bold text-center outline-none focus:border-indigo-500" />
                        </div>
                        <div className="col-span-4 md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Wt</label>
                            <input type="number" value={rowWeight} onChange={e => setRowWeight(e.target.value)} placeholder="0.000" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm font-bold text-center outline-none focus:border-indigo-500" />
                        </div>
                        <div className="col-span-4 md:col-span-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Pcs</label>
                            <input type="number" value={rowPcs} onChange={e => setRowPcs(e.target.value)} placeholder="0" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm font-bold text-center outline-none focus:border-indigo-500" />
                        </div>
                        <div className="col-span-4 md:col-span-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Box</label>
                            <input type="number" value={rowBundle} onChange={e => setRowBundle(e.target.value)} placeholder="0" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm font-bold text-center outline-none focus:border-indigo-500" />
                        </div>
                    </div>
                    <button onClick={addRow} className={`w-full border rounded-lg py-2.5 text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1 ${rowPlanId ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700' : 'bg-white border-slate-300 text-slate-600 hover:text-indigo-600 hover:border-indigo-300'}`}>
                        <span>+</span> Add Line Item {rowPlanId ? '(Completes Plan)' : ''}
                    </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {activeDispatch.rows?.map((r, i) => (
                        <div key={i} className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 text-xs hover:border-indigo-200 transition-colors">
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-800">{r.size} <span className="text-slate-400 font-normal">{r.sizeType ? `(${r.sizeType})` : ''}</span></span>
                                <div className="flex gap-2 text-[10px] text-slate-500 font-bold mt-0.5">
                                    {r.micron > 0 && <span>{r.micron}m</span>}
                                    {r.weight > 0 && <span>{r.weight.toFixed(3)}kg</span>}
                                    {r.pcs > 0 && <span>{r.pcs}pcs</span>}
                                    {r.planId && <span className="text-indigo-600 bg-indigo-50 px-1 rounded">Linked Plan</span>}
                                </div>
                            </div>
                            <button onClick={() => removeFormRow(i)} className="text-slate-400 hover:text-red-500 px-2 py-1 font-bold text-lg">×</button>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                    {isEditingId && <button onClick={resetForm} className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl text-sm hover:bg-slate-200 transition-colors">Cancel</button>}
                    <button onClick={handleSave} className={`flex-[2] text-white font-bold py-3 rounded-xl text-sm shadow-lg transition-transform active:scale-[0.98] ${isEditingId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-900 hover:bg-black'}`}>
                        {isEditingId ? 'Update Job' : 'Save Job Card'}
                    </button>
                </div>
            </div>
        </div>

        {/* --- LIST SECTION --- */}
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="text-xl">📋</span> Recent Jobs
                    </h3>
                    {selectedJobIds.length > 1 && (
                        <button onClick={handleMergeJobs} className="bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1 animate-in fade-in zoom-in">
                            <span>⚡ Merge {selectedJobIds.length} Jobs</span>
                        </button>
                    )}
                </div>
                {/* Corrected setSearchTerm to setSearchJob */}
                <input placeholder="Search Job..." value={searchJob} onChange={e => setSearchJob(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 outline-none w-full sm:w-48 focus:ring-2 focus:ring-indigo-100" />
            </div>

            {/* --- MOBILE LIST VIEW (< md) --- */}
            <div className="space-y-3 md:hidden">
                {filteredDispatches.map(d => {
                    const p = data.parties.find(p => p.id === d.partyId);
                    const partyName = p ? (p.code ? `${p.name} [${p.code}]` : p.name) : 'Unknown';
                    const isExpanded = expandedId === d.id;
                    const isSelected = selectedJobIds.includes(d.id);
                    const isToday = d.isTodayDispatch;

                    let statusBadge = 'bg-slate-100 text-slate-500 border-slate-200';
                    let statusStripe = 'bg-slate-300';

                    if (d.status === 'SLITTING') { statusBadge = 'bg-amber-100 text-amber-700 border-amber-200 animate-pulse'; statusStripe = 'bg-amber-500'; }
                    else if (d.status === 'COMPLETED') { statusBadge = 'bg-emerald-100 text-emerald-700 border-emerald-200'; statusStripe = 'bg-emerald-500'; }
                    else if (d.status === 'DISPATCHED') { statusBadge = 'bg-purple-100 text-purple-600 border-purple-200'; statusStripe = 'bg-purple-500'; }
                    else if (d.status === 'PRINTING') { statusBadge = 'bg-indigo-100 text-indigo-700 border-indigo-200'; statusStripe = 'bg-indigo-500'; }
                    else if (d.status === 'CUTTING') { statusBadge = 'bg-blue-100 text-blue-700 border-blue-200'; statusStripe = 'bg-blue-500'; }
                    if (d.status === 'PENDING' && isToday) statusStripe = 'bg-indigo-500';

                    return (
                        <div key={d.id} className={`relative rounded-xl border shadow-sm bg-white overflow-hidden transition-all ${isSelected ? 'ring-2 ring-indigo-500' : 'border-slate-200'}`}>
                           <div className={`absolute top-0 left-0 w-1.5 h-full ${statusStripe}`}></div>
                           <div className="relative">
                               <div className="absolute top-3 right-3 z-10">
                                   <input type="checkbox" checked={isSelected} onChange={() => toggleJobSelection(d.id)} onClick={(e) => e.stopPropagation()} className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"/>
                               </div>
                               <div onClick={() => setExpandedId(isExpanded ? null : d.id)} className="p-4 pl-5 cursor-pointer">
                                 <div className="flex flex-col gap-3">
                                    <div className="pr-8">
                                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                                         <span className="text-[10px] font-bold text-slate-400 tracking-wider font-mono">{d.date.substring(5).split('-').reverse().join('/')}</span>
                                         <span className="text-[10px] font-extrabold text-slate-500 font-mono">#{d.dispatchNo}</span>
                                         {isToday && <span className="bg-indigo-500 text-white px-1.5 py-0.5 rounded text-[9px] font-bold shadow-sm">TODAY</span>}
                                         <select value={d.status || DispatchStatus.PENDING} onClick={e => e.stopPropagation()} onChange={(e) => handleJobStatusChange(e, d)} className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border outline-none ${statusBadge}`}>
                                            {Object.values(DispatchStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                         </select>
                                      </div>
                                      <div className="bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-100 inline-block max-w-full shadow-sm">
                                          <h4 className="text-sm font-bold text-indigo-900 leading-tight break-words">{partyName}</h4>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4 border-t border-slate-100 pt-3">
                                       <div><span className="text-[9px] font-bold text-slate-400 uppercase block">Box</span><span className="text-sm font-bold text-slate-700">{d.rows.reduce((a,r)=>a+(Number(r.bundle)||0),0) || '-'}</span></div>
                                       <div><span className="text-[9px] font-bold text-slate-400 uppercase block">Weight</span><span className="text-sm font-bold text-slate-900">{d.totalWeight > 0 ? d.totalWeight.toFixed(3) : '-'}</span></div>
                                    </div>
                                 </div>
                               </div>
                           </div>
                           
                           {isExpanded && (
                             <div className="bg-slate-50 border-t border-slate-100 p-3 pl-5 animate-in slide-in-from-top-2">
                                <div className="flex justify-between items-center mb-3">
                                    <button onClick={() => handleRepeatOrder(d)} className="bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded text-xs font-bold shadow-sm">Repeat</button>
                                    <button onClick={(e) => toggleToday(e, d)} className="bg-white border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded text-xs font-bold shadow-sm">{d.isTodayDispatch ? 'Unmark Today' : 'Mark Today'}</button>
                                    <button onClick={() => shareJobImage(d)} className="bg-emerald-600 text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm flex items-center gap-1"><Share2 size={12}/> Share</button>
                                </div>
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Mark Items to Share:</span>
                                    <button onClick={() => toggleAllRowsForShare(d)} className="text-[10px] font-bold text-indigo-600">Select All</button>
                                </div>
                                <div className="space-y-3">
                                    {d.rows.map(row => {
                                        const isMarked = (selectedRowsForShare[d.id] || []).includes(row.id);
                                        return (
                                            <div key={row.id} className={`bg-white rounded-lg border p-3 shadow-sm transition-all ${isMarked ? 'border-indigo-500 ring-1 ring-indigo-50 bg-indigo-50/20' : 'border-slate-200'}`}>
                                                <div className="flex justify-between items-start mb-2 border-b border-slate-50 pb-2">
                                                    <div className="flex items-start gap-2 w-[85%]">
                                                        <button onClick={() => toggleRowSelectionForShare(d.id, row.id)} className={`mt-1 transition-colors ${isMarked ? 'text-indigo-600' : 'text-slate-300 hover:text-slate-400'}`}>
                                                            {isMarked ? <CheckSquare size={18} /> : <Square size={18} />}
                                                        </button>
                                                        <div className="flex flex-col flex-1">
                                                            <input value={row.size} onChange={(e) => handleRowUpdate(d, row.id, 'size', e.target.value)} className="font-bold text-slate-800 text-sm bg-transparent border-b border-transparent focus:border-indigo-300 outline-none w-full" placeholder="Size" />
                                                            <div className="flex gap-2 mt-1">
                                                                <select value={row.sizeType || ''} onChange={(e) => handleRowUpdate(d, row.id, 'sizeType', e.target.value)} className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded px-1">
                                                                    {SIZE_TYPES.map(t => <option key={t} value={t}>{t || 'Type'}</option>)}
                                                                </select>
                                                                <input type="number" value={row.micron || ''} onChange={(e) => handleRowUpdate(d, row.id, 'micron', parseFloat(e.target.value))} className="w-12 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded px-1 text-center" placeholder="Mic" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => { if(confirm("Delete item?")) { const newRows = d.rows.filter(r => r.id !== row.id); const updatedDispatch = { ...d, rows: newRows, totalWeight: newRows.reduce((a,r)=>a+r.weight,0), totalPcs: newRows.reduce((a,r)=>a+r.pcs,0), updatedAt: new Date().toISOString() }; saveDispatch(updatedDispatch); }}} className="text-slate-300 hover:text-red-500 px-1 pt-1">🗑️</button>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                                                    <div className="bg-slate-50 p-1.5 rounded text-center">
                                                        <div className="text-[8px] text-slate-400 uppercase font-bold">Disp Wt</div>
                                                        <input type="number" value={row.weight === 0 ? '' : row.weight} onChange={(e)=>handleRowUpdate(d, row.id, 'weight', parseFloat(e.target.value))} className="w-full bg-transparent text-center font-bold outline-none border-b border-transparent focus:border-indigo-300" placeholder="-" />
                                                    </div>
                                                    <div className="bg-indigo-50 p-1.5 rounded text-center border border-indigo-100">
                                                        <div className="text-[8px] text-indigo-400 uppercase font-bold">Prod Wt</div>
                                                        <input type="number" value={row.productionWeight === 0 ? '' : row.productionWeight} onChange={(e)=>handleRowUpdate(d, row.id, 'productionWeight', parseFloat(e.target.value))} className="w-full bg-transparent text-center font-bold text-indigo-700 outline-none border-b border-transparent focus:border-indigo-300" placeholder="-" />
                                                    </div>
                                                    <div className="bg-red-50 p-1.5 rounded text-center border border-red-100">
                                                        <div className="text-[8px] text-red-400 uppercase font-bold">Wastage</div>
                                                        <div className="font-bold text-red-500 py-0.5">{row.wastage && row.wastage > 0 ? row.wastage.toFixed(3) : '-'}</div>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 text-xs">
                                                    <div className="bg-slate-50 p-1.5 rounded text-center">
                                                        <div className="text-[8px] text-slate-400 uppercase font-bold">Pcs</div>
                                                        <input type="number" value={row.pcs === 0 ? '' : row.pcs} onChange={(e)=>handleRowUpdate(d, row.id, 'pcs', parseFloat(e.target.value))} className="w-full bg-transparent text-center font-bold outline-none border-b border-transparent focus:border-indigo-300" placeholder="-" />
                                                    </div>
                                                    <div className="bg-slate-50 p-1.5 rounded text-center">
                                                        <div className="text-[8px] text-slate-400 uppercase font-bold">Bundles</div>
                                                        <input type="number" value={row.bundle === 0 ? '' : row.bundle} onChange={(e)=>handleRowUpdate(d, row.id, 'bundle', parseFloat(e.target.value))} className="w-full bg-transparent text-center font-bold outline-none border-b border-transparent focus:border-indigo-300" placeholder="-" />
                                                    </div>
                                                    <div className="flex items-end">
                                                        <select value={row.status || DispatchStatus.PENDING} onChange={(e) => handleRowUpdate(d, row.id, 'status', e.target.value)} className="w-full text-[10px] font-bold py-1.5 px-1 rounded border border-slate-200 bg-white outline-none h-full">
                                                            {Object.values(DispatchStatus).map(s => <option key={s} value={s}>{s.substring(0,8)}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-4 flex gap-2 border-t border-slate-200 pt-3">
                                    <button onClick={() => handleEdit(d)} className="flex-1 bg-white border border-indigo-200 text-indigo-600 py-2.5 rounded-lg font-bold text-xs shadow-sm">Edit Header</button>
                                    <button onClick={() => { if(confirm("Delete Job?")) deleteDispatch(d.id); }} className="flex-1 bg-white border border-red-200 text-red-500 py-2.5 rounded-lg font-bold text-xs shadow-sm">Delete Job</button>
                                </div>
                             </div>
                           )}
                        </div>
                    );
                })}
            </div>

            {/* --- DESKTOP TABLE VIEW (>= md) --- */}
            <div className="hidden md:block bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <tr>
                            <th className="px-4 py-4 w-10 text-center">
                                <input type="checkbox" onChange={(e) => setSelectedJobIds(e.target.checked ? filteredDispatches.map(d => d.id) : [])} checked={selectedJobIds.length === filteredDispatches.length && filteredDispatches.length > 0} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            </th>
                            <th className="px-2 py-4 w-32">Date / Job</th>
                            <th className="px-2 py-4 w-[35%]">Party Name</th>
                            <th className="px-2 py-4 text-center w-32">Status</th>
                            <th className="px-2 py-4 text-right w-24">Weight</th>
                            <th className="px-2 py-4 text-center w-20">Box</th>
                            <th className="px-2 py-4 text-center w-24">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredDispatches.map(d => {
                            const p = data.parties.find(p => p.id === d.partyId);
                            const partyName = p ? (p.code ? `${p.name} [${p.code}]` : p.name) : 'Unknown';
                            const isExpanded = expandedId === d.id;
                            const isSelected = selectedJobIds.includes(d.id);
                            const markedCount = (selectedRowsForShare[d.id] || []).length;
                            
                            let statusColor = 'bg-slate-100 text-slate-500';
                            if (d.status === 'COMPLETED') statusColor = 'bg-emerald-100 text-emerald-700';
                            else if (d.status === 'SLITTING') statusColor = 'bg-amber-100 text-amber-700 animate-pulse';
                            else if (d.status === 'DISPATCHED') statusColor = 'bg-purple-100 text-purple-700';

                            return (
                                <React.Fragment key={d.id}>
                                    <tr onClick={() => setExpandedId(isExpanded ? null : d.id)} className={`cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/30' : 'hover:bg-slate-50'} ${isSelected ? 'bg-indigo-50' : ''}`}>
                                        <td className="px-4 py-4 text-center" onClick={e => e.stopPropagation()}>
                                            <input type="checkbox" checked={isSelected} onChange={() => toggleJobSelection(d.id)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                        </td>
                                        <td className="px-2 py-4">
                                            <div className="font-bold text-slate-800 text-sm">{d.date.split('-').reverse().join('/')}</div>
                                            <div className="text-xs font-mono text-slate-500 font-bold">#{d.dispatchNo}</div>
                                        </td>
                                        <td className="px-2 py-4">
                                            <div className="inline-block bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5 shadow-sm">
                                                <div className="font-bold text-indigo-900 text-sm">{partyName}</div>
                                            </div>
                                            {d.isTodayDispatch && <span className="ml-2 text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">TODAY</span>}
                                        </td>
                                        <td className="px-2 py-4 text-center" onClick={e => e.stopPropagation()}>
                                            <select value={d.status || DispatchStatus.PENDING} onChange={(e) => handleJobStatusChange(e, d)} className={`text-[10px] font-bold py-1.5 px-2 rounded-lg border-0 outline-none cursor-pointer transition-colors hover:opacity-80 uppercase w-full text-center ${statusColor}`}>
                                                {Object.values(DispatchStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-2 py-4 text-right">
                                            <div className="font-bold text-slate-900">{d.totalWeight > 0 ? d.totalWeight.toFixed(3) : '-'}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">kg</div>
                                        </td>
                                        <td className="px-2 py-4 text-center">
                                            <div className="font-bold text-slate-700">{d.rows.reduce((a,r)=>a+(Number(r.bundle)||0),0) || '-'}</div>
                                        </td>
                                        <td className="px-2 py-4 text-center">
                                            <div className="flex justify-center items-center gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); handleEdit(d); }} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-indigo-600 transition-all" title="Edit">✏️</button>
                                                <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete Job?')) deleteDispatch(d.id); }} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-red-200 text-red-500 transition-all" title="Delete">🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                    
                                    {isExpanded && (
                                        <tr>
                                            <td colSpan={7} className="p-0 border-b border-slate-200">
                                                <div className="bg-slate-50 p-6 shadow-inner animate-in slide-in-from-top-2 duration-200">
                                                    <div className="flex justify-between items-center mb-4">
                                                        <div className="flex gap-2">
                                                            <button onClick={() => handleRepeatOrder(d)} className="bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-2">
                                                                <span>🔄 Repeat Order</span>
                                                            </button>
                                                            <button onClick={() => shareJobImage(d)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-colors flex items-center gap-2">
                                                                <Share2 size={14}/> <span>Share {markedCount > 0 ? `Marked (${markedCount})` : 'All'} Card</span>
                                                            </button>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <button onClick={() => toggleAllRowsForShare(d)} className="text-xs font-bold text-indigo-600 hover:underline">Select All Items</button>
                                                            <button onClick={(e) => toggleToday(e, d)} className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${d.isTodayDispatch ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                                                                {d.isTodayDispatch ? '★ Marked for Today' : 'Mark for Today'}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                                            <thead className="bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wide">
                                                                <tr>
                                                                    <th className="px-4 py-2 w-8 text-center">Share</th>
                                                                    <th className="px-1 py-2 w-[15%]">Size</th>
                                                                    <th className="px-1 py-2 w-[10%]">Type</th>
                                                                    <th className="px-1 py-2 w-12 text-center">Mic</th>
                                                                    <th className="px-1 py-2 text-right w-16 text-slate-800">D.Wt</th>
                                                                    <th className="px-1 py-2 text-right w-16 text-indigo-600">P.Wt</th>
                                                                    <th className="px-1 py-2 text-right w-12 text-red-500">Wst</th>
                                                                    <th className="px-1 py-2 text-right w-14">Pcs</th>
                                                                    <th className="px-1 py-2 text-center w-14">Bdl</th>
                                                                    <th className="px-1 py-2 text-center w-24">Status</th>
                                                                    <th className="px-1 py-2 w-8"></th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {d.rows.map(row => {
                                                                    const isMarked = (selectedRowsForShare[d.id] || []).includes(row.id);
                                                                    let rowStatusColor = 'bg-white border-slate-200 text-slate-500';
                                                                    if(row.status === DispatchStatus.COMPLETED) rowStatusColor = 'bg-emerald-50 border-emerald-200 text-emerald-700';
                                                                    
                                                                    return (
                                                                        <tr key={row.id} className={`hover:bg-slate-50 transition-colors ${isMarked ? 'bg-indigo-50/50' : ''}`}>
                                                                            <td className="px-4 py-1 text-center">
                                                                                <button onClick={() => toggleRowSelectionForShare(d.id, row.id)} className={`transition-colors ${isMarked ? 'text-indigo-600' : 'text-slate-300 hover:text-indigo-400'}`}>
                                                                                    {isMarked ? <CheckSquare size={16} /> : <Square size={16} />}
                                                                                </button>
                                                                            </td>
                                                                            <td className="px-1 py-1">
                                                                                <input value={row.size} onChange={(e) => handleRowUpdate(d, row.id, 'size', e.target.value)} className="w-full font-bold text-slate-800 bg-transparent outline-none border-b border-transparent focus:border-indigo-300" />
                                                                            </td>
                                                                            <td className="px-1 py-1">
                                                                                <select value={row.sizeType || ''} onChange={(e) => handleRowUpdate(d, row.id, 'sizeType', e.target.value)} className="w-full bg-transparent text-[10px] font-bold text-slate-600 outline-none focus:text-indigo-600 py-1">
                                                                                    {SIZE_TYPES.map(t => <option key={t} value={t}>{t || '-'}</option>)}
                                                                                </select>
                                                                            </td>
                                                                            <td className="px-1 py-1">
                                                                                <input type="number" value={row.micron || ''} onChange={(e) => handleRowUpdate(d, row.id, 'micron', parseFloat(e.target.value)||0)} className="w-full text-center bg-transparent text-xs font-bold text-slate-500 outline-none border-b border-transparent focus:border-indigo-300" placeholder="-" />
                                                                            </td>
                                                                            <td className="px-1 py-1 text-right">
                                                                                <input type="number" value={row.weight === 0 ? '' : row.weight} onChange={(e) => handleRowUpdate(d, row.id, 'weight', parseFloat(e.target.value)||0)} className="w-full text-right font-mono font-bold text-slate-800 bg-transparent outline-none border-b border-transparent focus:border-indigo-300" placeholder="-" />
                                                                            </td>
                                                                            <td className="px-1 py-1 text-right">
                                                                                <input type="number" value={row.productionWeight === 0 ? '' : row.productionWeight} onChange={(e) => handleRowUpdate(d, row.id, 'productionWeight', parseFloat(e.target.value)||0)} className="w-full text-right font-mono font-bold text-indigo-600 bg-transparent outline-none border-b border-transparent focus:border-indigo-300" placeholder="-" />
                                                                            </td>
                                                                            <td className="px-1 py-1 text-right text-xs font-mono font-bold text-red-500">
                                                                                {row.wastage ? row.wastage.toFixed(3) : '-'}
                                                                            </td>
                                                                            <td className="px-1 py-1 text-right">
                                                                                <input type="number" value={row.pcs === 0 ? '' : row.pcs} onChange={(e) => handleRowUpdate(d, row.id, 'pcs', parseFloat(e.target.value)||0)} className="w-full text-right font-mono font-bold text-slate-700 bg-transparent outline-none border-b border-transparent focus:border-indigo-300" placeholder="-" />
                                                                            </td>
                                                                            <td className="px-1 py-1 text-center">
                                                                                <input type="number" value={row.bundle === 0 ? '' : row.bundle} onChange={(e) => handleRowUpdate(d, row.id, 'bundle', parseFloat(e.target.value)||0)} className="w-full text-center font-bold text-slate-700 bg-transparent outline-none border-b border-transparent focus:border-indigo-300" placeholder="-" />
                                                                            </td>
                                                                            <td className="px-1 py-1 text-center">
                                                                                <select value={row.status || DispatchStatus.PENDING} onChange={(e) => handleRowUpdate(d, row.id, 'status', e.target.value)} className={`w-full bg-transparent text-[9px] font-bold outline-none border-b border-transparent focus:border-indigo-500 py-1 cursor-pointer text-center ${rowStatusColor}`}>
                                                                                    {Object.values(DispatchStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                                                                </select>
                                                                            </td>
                                                                            <td className="px-1 py-1 text-center">
                                                                                <button onClick={() => { if(confirm("Delete this item row?")) { const newRows = d.rows.filter(r => r.id !== row.id); const updatedDispatch = { ...d, rows: newRows, totalWeight: newRows.reduce((a,r)=>a+r.weight,0), totalPcs: newRows.reduce((a,r)=>a+r.pcs,0), updatedAt: new Date().toISOString() }; saveDispatch(updatedDispatch); } }} className="text-slate-300 hover:text-red-500 transition-colors p-1" title="Delete Item">🗑️</button>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        {filteredDispatches.length === 0 && (
                            <tr><td colSpan={7} className="text-center py-10 text-slate-400 font-bold">No jobs found matching your search.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};
