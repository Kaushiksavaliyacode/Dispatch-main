
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppData, DispatchEntry, DispatchStatus, DispatchRow, ProductionPlan } from '../../types';
import { saveDispatch, deleteDispatch, ensurePartyExists, updateProductionPlan } from '../../services/storageService';
import { Layers, CheckCircle2, BellRing, GitMerge, Share2, CheckSquare, Square, Package, UserCheck } from 'lucide-react';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

const SIZE_TYPES = ["", "INTAS", "OPEN", "ROUND", "ST.SEAL", "LABEL", "ROLL", "WINDER", "PRINTING", "PLAIN"];

export const DispatchManager: React.FC<Props> = ({ data, onUpdate }) => {
  const [activeDispatch, setActiveDispatch] = useState<Partial<DispatchEntry>>({ date: new Date().toISOString().split('T')[0], dispatchNo: '', rows: [], status: DispatchStatus.PENDING });
  const [partyInput, setPartyInput] = useState('');
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [rowSize, setRowSize] = useState('');
  const [rowType, setRowType] = useState('');
  const [rowSizer, setRowSizer] = useState(''); 
  const [rowMicron, setRowMicron] = useState('');
  const [rowWeight, setRowWeight] = useState('');
  const [rowPcs, setRowPcs] = useState('');
  const [rowBundle, setRowBundle] = useState('');
  const [rowPlanId, setRowPlanId] = useState<string | null>(null); 
  const [searchJob, setSearchJob] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [selectedRowsForShare, setSelectedRowsForShare] = useState<Record<string, string[]>>({});
  const [newPlanNotification, setNewPlanNotification] = useState(false);
  const prevPlanCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isEditingId && !activeDispatch.dispatchNo) {
        const maxNo = data.dispatches.reduce((max, d) => { const num = parseInt(d.dispatchNo); return !isNaN(num) && num > max ? num : max; }, 0);
        const nextNo = maxNo === 0 ? '1001' : (maxNo + 1).toString();
        setActiveDispatch(prev => ({ ...prev, dispatchNo: nextNo }));
    }
  }, [data.dispatches, isEditingId]);

  useEffect(() => {
      const pendingCount = data.productionPlans.filter(p => p.status === 'PENDING').length;
      if (prevPlanCountRef.current === null) { prevPlanCountRef.current = pendingCount; return; }
      if (pendingCount > prevPlanCountRef.current) {
          setNewPlanNotification(true);
          const timer = setTimeout(() => setNewPlanNotification(false), 4000);
          return () => clearTimeout(timer);
      }
      prevPlanCountRef.current = pendingCount;
  }, [data.productionPlans]);

  const pendingPlans = useMemo(() => data.productionPlans.filter(p => p.status === 'PENDING').sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()), [data.productionPlans]);
  const plansByParty = useMemo(() => { const groups: Record<string, ProductionPlan[]> = {}; pendingPlans.forEach(p => { if (!groups[p.partyName]) groups[p.partyName] = []; groups[p.partyName].push(p); }); return groups; }, [pendingPlans]);

  // Fix: Added missing partySuggestions useMemo hook
  const partySuggestions = useMemo(() => {
      const search = partyInput.toLowerCase();
      return data.parties.filter(p => p.name.toLowerCase().includes(search) || (p.code && p.code.toLowerCase().includes(search)));
  }, [data.parties, partyInput]);

  const filteredDispatches = useMemo(() => {
      const search = searchJob.toLowerCase();
      return data.dispatches.filter(d => {
          const p = data.parties.find(p => p.id === d.partyId);
          return d.dispatchNo.includes(search) || p?.name.toLowerCase().includes(search) || p?.code?.toLowerCase().includes(search) || d.rows.some(r => r.size.toLowerCase().includes(search));
      }).sort((a, b) => {
          const getPriority = (d: DispatchEntry) => { if (d.isTodayDispatch) return 0; if (['CUTTING', 'PRINTING', 'SLITTING'].includes(d.status)) return 0; if (d.status === 'PENDING') return 1; if (d.status === 'COMPLETED') return 2; return 3; };
          const pA = getPriority(a); const pB = getPriority(b);
          if (pA !== pB) return pA - pB; return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [data.dispatches, data.parties, searchJob]);

  const mapPlanType = (type: string) => { const upperType = type.toUpperCase(); return SIZE_TYPES.find(t => t === upperType) || (type === 'St. Seal' ? 'ST.SEAL' : type === 'Printing' ? 'PRINTING' : type === 'Intas' ? 'INTAS' : type === 'Round' ? 'ROUND' : type === 'Open' ? 'OPEN' : type === 'Roll' ? 'ROLL' : type === 'Winder' ? 'WINDER' : ''); };

  const handleImportPlan = (plan: ProductionPlan) => {
    setPartyInput(plan.partyName);
    setActiveDispatch(prev => ({ ...prev, date: plan.date }));
    let displaySize = plan.cuttingSize > 0 ? `${plan.size} x ${plan.cuttingSize}` : plan.size;
    if (plan.printName) displaySize = `${displaySize} (${plan.printName})`;
    setRowSize(displaySize); setRowType(mapPlanType(plan.type)); setRowSizer(plan.sizer || ''); setRowMicron(plan.micron ? plan.micron.toString() : '');
    setRowWeight(plan.weight ? plan.weight.toString() : ''); setRowPcs(plan.pcs ? plan.pcs.toString() : ''); setRowPlanId(plan.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
      if (!partyInput || !activeDispatch.rows?.length) return alert("Fill required fields");
      const partyId = await ensurePartyExists(data.parties, partyInput);
      const totalWeight = activeDispatch.rows.reduce((sum, r) => sum + r.weight, 0);
      const totalPcs = activeDispatch.rows.reduce((sum, r) => sum + r.pcs, 0);
      const dispatch: DispatchEntry = { id: activeDispatch.id || `d-${Date.now()}`, dispatchNo: activeDispatch.dispatchNo || 'AUTO', date: activeDispatch.date!, partyId, status: activeDispatch.status || DispatchStatus.PENDING, rows: activeDispatch.rows, totalWeight, totalPcs, isTodayDispatch: activeDispatch.isTodayDispatch || false, createdAt: activeDispatch.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
      await saveDispatch(dispatch);
      for (const row of dispatch.rows) { if (row.planId) { await updateProductionPlan({ id: row.planId, status: 'COMPLETED' }); } }
      resetForm();
  };

  const resetForm = () => { setPartyInput(''); setActiveDispatch({ date: new Date().toISOString().split('T')[0], dispatchNo: '', rows: [], status: DispatchStatus.PENDING }); setIsEditingId(null); setRowPlanId(null); setRowSizer(''); };

  const shareJobImage = async (d: DispatchEntry) => {
      const party = data.parties.find(p => p.id === d.partyId)?.name || 'Unknown';
      const markedIds = selectedRowsForShare[d.id] || [];
      const rowsToShare = markedIds.length > 0 ? d.rows.filter(r => markedIds.includes(r.id)) : d.rows;
      const totalBundles = rowsToShare.reduce((acc, r) => acc + (Number(r.bundle) || 0), 0);
      const totalWeight = rowsToShare.reduce((acc, r) => acc + (Number(r.weight) || 0), 0);
      const totalPcs = rowsToShare.reduce((acc, r) => acc + (Number(r.pcs) || 0), 0);
      const container = document.createElement('div');
      container.style.position = 'absolute'; container.style.left = '-9999px'; container.style.width = '900px'; container.style.background = '#fff'; document.body.appendChild(container);
      const rowsHtml = rowsToShare.map((r, i) => `<tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f0f9ff'}; border-bottom: 2px solid #e0f2fe;"><td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e;">${r.size}</td><td style="padding: 16px 12px; font-size: 20px; color: #0284c7; text-align: center; font-weight: bold;">${r.sizeType || '-'}</td><td style="padding: 16px 12px; font-size: 20px; color: #64748b; text-align: center; font-weight: bold;">${r.micron || '-'}</td><td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e; text-align: right;">${r.weight.toFixed(3)}</td><td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e; text-align: right;">${r.pcs || '-'}</td><td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e; text-align: right;">${r.bundle || '-'}</td></tr>`).join('');
      container.innerHTML = `<div style="font-family: 'Inter', sans-serif; border: 4px solid #0c4a6e; background: #fff;"><div style="background: linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%); padding: 32px; color: white;"><div style="font-size: 18px; text-transform: uppercase; letter-spacing: 3px; color: #bae6fd; font-weight: bold;">Job Card</div><div style="font-size: 40px; font-weight: bold; margin-top: 8px;">${party}</div><div style="margin-top: 24px; display: flex; justify-content: space-between; border-top: 1px solid #7dd3fc; padding-top: 20px;"><span style="font-size: 28px; background: rgba(255,255,255,0.2); padding: 8px 20px; border: 1px solid #7dd3fc;">#${d.dispatchNo}</span><span style="font-size: 24px;">${d.date.split('-').reverse().join('/')}</span></div></div><table style="width: 100%; border-collapse: collapse;"><thead><tr style="background: #e0f2fe; color: #0c4a6e; font-size: 18px; text-transform: uppercase; border-bottom: 3px solid #0284c7;"><th style="padding: 16px 12px; text-align: left;">Size</th><th style="padding: 16px 12px; text-align: center;">Type</th><th style="padding: 16px 12px; text-align: center;">Mic</th><th style="padding: 16px 12px; text-align: right;">Weight</th><th style="padding: 16px 12px; text-align: right;">Pcs</th><th style="padding: 16px 12px; text-align: right;">Box</th></tr></thead><tbody>${rowsHtml}</tbody><tfoot><tr style="background: #0c4a6e; color: white; font-weight: bold;"><td colspan="3" style="padding: 24px 12px; font-size: 24px;">TOTAL</td><td style="padding: 24px 12px; text-align: right; font-size: 28px;">${totalWeight.toFixed(3)}</td><td style="padding: 24px 12px; text-align: right; font-size: 28px;">${totalPcs}</td><td style="padding: 24px 12px; text-align: right; font-size: 28px;">${totalBundles}</td></tr></tfoot></table></div>`;
      if ((window as any).html2canvas) { const canvas = await (window as any).html2canvas(container, { scale: 2 }); canvas.toBlob(async (blob: any) => { const file = new File([blob], `Job_${d.dispatchNo}.png`, { type: 'image/png' }); if (navigator.share) await navigator.share({ files: [file], title: `Job ${d.dispatchNo}` }); else { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `Job_${d.dispatchNo}.png`; link.click(); } document.body.removeChild(container); }); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
        {newPlanNotification && (<div className="fixed top-20 right-4 z-50 bg-indigo-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300"><BellRing size={20} className="animate-pulse" /><div><div className="font-bold text-sm">New Plan Added!</div></div></div>)}

        {pendingPlans.length > 0 && !isEditingId && (
            <div className="bg-gradient-to-r from-slate-50 to-indigo-50/30 rounded-2xl p-4 border border-indigo-100 shadow-inner">
                <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-3 flex items-center gap-2"><Layers size={14} /> Production Queue</h3>
                <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2">
                    {pendingPlans.map(plan => (
                        <div key={plan.id} onClick={() => handleImportPlan(plan)} className="min-w-[260px] bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-400 cursor-pointer transition-all relative flex flex-col gap-2">
                            <div className="flex justify-between items-start mb-1"><span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{plan.date.split('-').reverse().join('/')}</span><span className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border uppercase">{plan.type}</span></div>
                            <div className="font-bold text-slate-800 text-xs truncate">{plan.partyName}</div>
                            <div className="bg-slate-50 rounded p-2 border border-slate-100 space-y-1">
                                <div className="flex justify-between text-[10px]"><span className="text-slate-500 font-semibold flex items-center gap-1"><Package size={10}/> Size:</span><span className="font-bold text-slate-700">{plan.cuttingSize > 0 ? `${plan.size} x ${plan.cuttingSize}` : plan.size}</span></div>
                                {plan.sizer && <div className="flex justify-between text-[10px]"><span className="text-indigo-500 font-semibold flex items-center gap-1"><UserCheck size={10}/> Sizer:</span><span className="font-bold text-indigo-700 uppercase">{plan.sizer}</span></div>}
                                {plan.printName && <div className="flex justify-between text-[10px]"><span className="text-purple-500 font-semibold">Print:</span><span className="font-bold text-purple-600">{plan.printName}</span></div>}
                                <div className="flex justify-between text-[10px]"><span className="text-slate-500 font-semibold">Micron:</span><span className="font-bold text-slate-700">{plan.micron}</span></div>
                            </div>
                            <div className="grid grid-cols-3 gap-1 text-center mt-1">
                                <div className="bg-indigo-50/50 rounded p-1 border border-indigo-50"><div className="text-[8px] text-indigo-400 font-bold">Weight</div><div className="text-[10px] font-bold text-indigo-700">{plan.weight}</div></div>
                                <div className="bg-blue-50/50 rounded p-1 border border-blue-50"><div className="text-[8px] text-blue-400 font-bold">Meter</div><div className="text-[10px] font-bold text-blue-700">{plan.meter}</div></div>
                                <div className="bg-emerald-50/50 rounded p-1 border border-emerald-50"><div className="text-[8px] text-emerald-400 font-bold">Pcs</div><div className="text-[10px] font-bold text-emerald-700">{plan.pcs}</div></div>
                            </div>
                            {plan.notes && <div className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded truncate italic mt-1">Note: {plan.notes}</div>}
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div className={`bg-white rounded-2xl shadow-sm border ${isEditingId ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'} overflow-hidden`}>
            <div className={`px-6 py-4 flex justify-between items-center ${isEditingId ? 'bg-indigo-600' : 'bg-slate-800'}`}><h3 className="text-base font-bold text-white tracking-wide">{isEditingId ? '✏️ Edit Job' : '🚚 New Job Entry'}</h3><div className="text-xs font-bold text-white/80">{activeDispatch.rows?.length} Items</div></div>
            <div className="p-6 space-y-5">
                <div className="flex gap-4"><div className="w-28"><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Job #</label><input value={activeDispatch.dispatchNo} onChange={e => setActiveDispatch({...activeDispatch, dispatchNo: e.target.value})} className="w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm font-bold text-center" placeholder="Auto" /></div><div className="flex-1"><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Date</label><input type="date" value={activeDispatch.date} onChange={e => setActiveDispatch({...activeDispatch, date: e.target.value})} className="w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm font-bold" /></div></div>
                <div className="relative"><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Party Name</label><input type="text" value={partyInput} onChange={e => { setPartyInput(e.target.value); setShowPartyDropdown(true); }} onFocus={() => setShowPartyDropdown(true)} onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)} className="w-full bg-slate-50 border rounded-lg px-4 py-2.5 text-sm font-bold" placeholder="Search Party..." />{showPartyDropdown && partyInput && (<div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">{partySuggestions.map(p => (<div key={p.id} className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-bold text-slate-700 border-b border-slate-50" onClick={() => { setPartyInput(p.name); setShowPartyDropdown(false); }}>{p.name} <span className="text-[10px] text-slate-400 ml-2">{p.code}</span></div>))}</div>)}</div>
                <div className={`bg-slate-50 p-4 rounded-xl border ${rowPlanId ? 'border-indigo-300 ring-2 ring-indigo-50' : 'border-slate-200'}`}>{rowPlanId && (<div className="flex items-center gap-2 mb-3 text-indigo-600 bg-indigo-50 w-fit px-2 py-1 rounded text-[10px] font-bold border border-indigo-100"><CheckCircle2 size={12} /> Auto-Filled from Plan</div>)}<div className="grid grid-cols-12 gap-3 mb-3 items-end"><div className="col-span-12 md:col-span-4"><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Size / Item</label><input value={rowSize} onChange={e => setRowSize(e.target.value)} placeholder="Description" className="w-full bg-white border rounded-lg px-3 py-2 text-sm font-bold" /></div><div className="col-span-6 md:col-span-3"><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Type</label><select value={rowType} onChange={e => setRowType(e.target.value)} className="w-full bg-white border rounded-lg px-2 py-2 text-xs font-bold">{SIZE_TYPES.map(t => <option key={t} value={t}>{t || '-'}</option>)}</select></div><div className="col-span-6 md:col-span-2"><label className="text-[10px] font-bold text-indigo-400 uppercase block mb-1">Sizer</label><input value={rowSizer} onChange={e => setRowSizer(e.target.value)} placeholder="Assign" className="w-full bg-white border rounded-lg px-2 py-2 text-sm font-bold text-center" /></div><div className="col-span-4 md:col-span-1"><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Mic</label><input type="number" value={rowMicron} onChange={e => setRowMicron(e.target.value)} placeholder="0" className="w-full bg-white border rounded-lg px-1 py-2 text-sm font-bold text-center" /></div><div className="col-span-4 md:col-span-2"><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Wt</label><input type="number" value={rowWeight} onChange={e => setRowWeight(e.target.value)} placeholder="0.000" className="w-full bg-white border rounded-lg px-1 py-2 text-sm font-bold text-center" /></div></div><button onClick={() => { if(!rowSize) return alert("Size is required"); const newRow = { id: `r-${Date.now()}-${Math.random()}`, planId: rowPlanId || undefined, size: rowSize, sizeType: rowType, sizer: rowSizer, micron: parseFloat(rowMicron) || 0, weight: parseFloat(rowWeight) || 0, productionWeight: 0, wastage: 0, pcs: parseFloat(rowPcs) || 0, bundle: parseFloat(rowBundle) || 0, status: DispatchStatus.PENDING, isCompleted: false, isLoaded: false }; setActiveDispatch(prev => ({ ...prev, rows: [newRow, ...(prev.rows || [])] })); setRowSize(''); setRowType(''); setRowMicron(''); setRowWeight(''); setRowPcs(''); setRowBundle(''); setRowSizer(''); setRowPlanId(null); }} className={`w-full border rounded-lg py-2.5 text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1 ${rowPlanId ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-300 text-slate-600'}`}>+ Add Line Item</button></div>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">{activeDispatch.rows?.map((r, i) => (<div key={i} className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 text-xs hover:border-indigo-200 transition-colors"><div className="flex flex-col"><span className="font-bold text-slate-800">{r.size} <span className="text-slate-400 font-normal">{r.sizeType ? `(${r.sizeType})` : ''}</span></span><div className="flex gap-2 text-[10px] text-slate-500 font-bold mt-0.5">{r.sizer && <span className="text-indigo-600 uppercase">Sizer: {r.sizer}</span>}{r.weight > 0 && <span>{r.weight.toFixed(3)}kg</span>}</div></div><button onClick={() => { setActiveDispatch(prev => { const newRows = [...(prev.rows || [])]; newRows.splice(i, 1); return { ...prev, rows: newRows }; }); }} className="text-slate-400 hover:text-red-500 px-2 py-1 font-bold text-lg">×</button></div>))}</div>
                <div className="flex gap-2 pt-2 border-t border-slate-100">{isEditingId && <button onClick={resetForm} className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl text-sm">Cancel</button>}<button onClick={handleSave} className={`flex-[2] text-white font-bold py-3 rounded-xl text-sm shadow-lg ${isEditingId ? 'bg-indigo-600' : 'bg-slate-900'}`}>{isEditingId ? 'Update Job' : 'Save Job Card'}</button></div>
            </div>
        </div>

        <div className="space-y-4">
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">📋 Recent Jobs</h3><input placeholder="Search Job..." value={searchJob} onChange={e => setSearchJob(e.target.value)} className="bg-white border rounded-lg px-3 py-2 text-xs font-bold outline-none sm:w-48" /></div>
            <div className="space-y-3">
                {filteredDispatches.map(d => {
                    const p = data.parties.find(p => p.id === d.partyId);
                    const partyName = p ? (p.code ? `${p.name} [${p.code}]` : p.name) : 'Unknown';
                    const isExpanded = expandedId === d.id;
                    const isSelected = selectedJobIds.includes(d.id);
                    return (
                        <div key={d.id} className={`relative rounded-xl border shadow-sm bg-white overflow-hidden transition-all ${isSelected ? 'ring-2 ring-indigo-500' : 'border-slate-200'}`}>
                           <div className={`absolute top-0 left-0 w-1.5 h-full ${d.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                           <div onClick={() => setExpandedId(isExpanded ? null : d.id)} className="p-4 pl-5 cursor-pointer">
                                <div className="flex justify-between items-start">
                                    <div><div className="text-[10px] font-bold text-slate-400 font-mono mb-1">{d.date.substring(5).split('-').reverse().join('/')} • #{d.dispatchNo}</div><h4 className="text-sm font-bold text-indigo-900 leading-tight">{partyName}</h4></div>
                                    <div className="text-right"><div className="text-sm font-bold text-slate-900">{d.totalWeight.toFixed(1)} kg</div><span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${d.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50'}`}>{d.status}</span></div>
                                </div>
                           </div>
                           {isExpanded && (<div className="bg-slate-50 border-t p-3 pl-5 animate-in slide-in-from-top-2"><div className="flex justify-between items-center mb-3"><button onClick={() => shareJobImage(d)} className="bg-emerald-600 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1"><Share2 size={12}/> Share Card</button></div><div className="space-y-2">{d.rows.map(row => (<div key={row.id} className="bg-white rounded-lg border p-2 text-xs"><div className="flex justify-between font-bold text-slate-800"><span>{row.size}</span><span>{row.weight.toFixed(3)} kg</span></div>{row.sizer && <div className="text-[9px] text-indigo-600 uppercase font-bold mt-1">Sizer: {row.sizer}</div>}</div>))}</div></div>)}
                        </div>
                    );
                })}
            </div>
        </div>
    </div>
  );
};
