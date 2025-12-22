
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppData, PlantProductionPlan, SlittingJob, SlittingCoil } from '../../types';
import { updatePlantPlan, saveSlittingJob } from '../../services/storageService';
import { Factory, Search, Ruler, Scale, ChevronLeft, ChevronRight, CheckCircle, RotateCcw, ArrowRightLeft, FileText, X, Info, Scissors, GitMerge, List, LayoutGrid, CheckSquare, Square } from 'lucide-react';

interface Props {
  data: AppData;
}

const PROD_DENSITY = 0.00276;

export const PlantQueueView: React.FC<Props> = ({ data }) => {
  const [viewMode, setViewMode] = useState<'CARD' | 'LIST'>('CARD');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Selection & Merge State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSizer, setMergeSizer] = useState('');
  const [mergeRollLength, setMergeRollLength] = useState('2000');

  const touchStartX = useRef<number | null>(null);

  const filteredPlans = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return data.plantProductionPlans.filter(p => 
      p.partyCode.toLowerCase().includes(s) || p.size.toLowerCase().includes(s)
    ).sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [data.plantProductionPlans, searchTerm]);

  useEffect(() => setCurrentIndex(0), [searchTerm]);

  const plan = filteredPlans[currentIndex];

  const masterJob = useMemo(() => {
    if (!plan) return null;
    return data.slittingJobs.find(job => 
        job.jobCode === plan.partyCode && 
        job.planMicron === plan.micron && 
        job.coils.some(c => c.size === plan.size)
    );
  }, [plan, data.slittingJobs]);

  // Merge Calculation Logic
  const mergeCalcs = useMemo(() => {
    if (!isMergeModalOpen || selectedIds.length === 0) return null;
    const selectedPlans = data.plantProductionPlans.filter(p => selectedIds.includes(p.id));
    const firstMicron = selectedPlans[0].micron;
    const totalQty = selectedPlans.reduce((sum, p) => sum + p.qty, 0);
    const coilSizes = selectedPlans.map(p => parseFloat(p.size) || 0);
    const slittingSize = coilSizes.reduce((a, b) => a + b, 0);
    
    const sizerSize = parseFloat(mergeSizer) || slittingSize;
    const slitLen = parseFloat(mergeRollLength) || 2000;

    // Production Formulas
    const tube1mtrWeight = sizerSize * firstMicron * PROD_DENSITY;
    const tubeRollLength = slitLen / 2;
    const oneRollWeight = (tube1mtrWeight / 1000) * tubeRollLength;
    const totalRolls = totalQty / oneRollWeight;
    const totalTubeQty = (totalQty / slittingSize) * sizerSize;

    // Slitting Formulas (Per Coil)
    const coils = selectedPlans.map(p => {
        const s = parseFloat(p.size) || 0;
        const coilRollWeight = (s * firstMicron * PROD_DENSITY / 2 * slitLen) / 1000;
        const coilTotalQty = (totalQty / slittingSize) * s;
        return { size: p.size, rollWeight: coilRollWeight, totalQty: coilTotalQty, rolls: totalRolls };
    });

    return { totalQty, tube1mtrWeight, tubeRollLength, oneRollWeight, totalRolls, totalTubeQty, coils, slittingSize };
  }, [isMergeModalOpen, selectedIds, data.plantProductionPlans, mergeSizer, mergeRollLength]);

  const handleNext = () => currentIndex < filteredPlans.length - 1 && setCurrentIndex(prev => prev + 1);
  const handlePrev = () => currentIndex > 0 && setCurrentIndex(prev => prev - 1);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleOpenMerge = () => {
    const selectedPlans = data.plantProductionPlans.filter(p => selectedIds.includes(p.id));
    if (selectedPlans.length < 2) return alert("Select at least 2 plans to merge");
    
    // Check compatibility
    const firstParty = selectedPlans[0].partyCode;
    const firstMicron = selectedPlans[0].micron;
    const isCompatible = selectedPlans.every(p => p.partyCode === firstParty && p.micron === firstMicron);
    
    if (!isCompatible) return alert("Selected plans must have the same Party and Micron for a valid merge.");
    
    const slittingSize = selectedPlans.reduce((sum, p) => sum + (parseFloat(p.size) || 0), 0);
    setMergeSizer(slittingSize.toString());
    setIsMergeModalOpen(true);
  };

  const handleConfirmMerge = async () => {
    if (!mergeCalcs) return;
    const selectedPlans = data.plantProductionPlans.filter(p => selectedIds.includes(p.id));
    const jobNo = `M-${Date.now().toString().slice(-4)}`;
    
    const slittingCoils: SlittingCoil[] = selectedPlans.map((p, idx) => ({
        id: `coil-${Date.now()}-${idx}`,
        number: idx + 1, 
        size: p.size, 
        rolls: Math.ceil(mergeCalcs.totalRolls), 
        producedBundles: 0
    }));

    await saveSlittingJob({
        id: `slit-master-${Date.now()}`, 
        date: new Date().toISOString().split('T')[0],
        jobNo, 
        jobCode: selectedPlans[0].partyCode, 
        coils: slittingCoils,
        planMicron: selectedPlans[0].micron, 
        planQty: mergeCalcs.totalQty,
        planRollLength: parseFloat(mergeRollLength), 
        rows: [], 
        status: 'PENDING',
        createdAt: new Date().toISOString(), 
        updatedAt: new Date().toISOString()
    });

    for (const p of selectedPlans) await updatePlantPlan({ id: p.id, status: 'COMPLETED' });
    
    setIsMergeModalOpen(false);
    setSelectedIds([]);
    setViewMode('CARD');
    alert(`Industrial Job Card #${jobNo} Created!`);
  };

  const handleStatusToggle = async (p: PlantProductionPlan) => {
    if (isUpdating) return;
    setIsUpdating(true);
    const newStatus = p.status === 'PENDING' ? 'COMPLETED' : 'PENDING';
    try { await updatePlantPlan({ id: p.id, status: newStatus }); } 
    finally { setIsUpdating(false); }
  };

  const handleTouchStart = (e: React.TouchEvent) => touchStartX.current = e.touches[0].clientX;
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50 && viewMode === 'CARD') diff > 0 ? handleNext() : handlePrev();
    touchStartX.current = null;
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-10 max-w-2xl mx-auto px-1">
        
        {/* MERGE MODAL */}
        {isMergeModalOpen && mergeCalcs && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border-[2px] border-slate-900 animate-in zoom-in duration-200">
                    <div className="bg-slate-900 p-4 flex justify-between items-center text-white">
                        <h3 className="font-black uppercase tracking-tighter flex items-center gap-2">
                           <GitMerge size={18} className="text-amber-400" /> Plan Merge Setup
                        </h3>
                        <button onClick={() => setIsMergeModalOpen(false)}><X size={24}/></button>
                    </div>
                    <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-50 border border-slate-900 p-2 rounded">
                                <label className="text-[9px] font-black text-slate-400 uppercase">Tube Sizer</label>
                                <input type="number" value={mergeSizer} onChange={e => setMergeSizer(e.target.value)} className="w-full bg-transparent text-lg font-black text-slate-900 outline-none" />
                            </div>
                            <div className="bg-slate-50 border border-slate-900 p-2 rounded">
                                <label className="text-[9px] font-black text-slate-400 uppercase">Roll Length</label>
                                <input type="number" value={mergeRollLength} onChange={e => setMergeRollLength(e.target.value)} className="w-full bg-transparent text-lg font-black text-slate-900 outline-none" />
                            </div>
                        </div>

                        <div className="border border-slate-900 rounded-lg overflow-hidden">
                            <div className="bg-slate-900 px-3 py-1.5 text-[9px] font-black uppercase text-white flex items-center gap-2"><Scissors size={10}/> Coil Breakdown</div>
                            <div className="divide-y divide-slate-100">
                                {mergeCalcs.coils.map((c, i) => (
                                    <div key={i} className="p-2.5 flex justify-between items-center hover:bg-slate-50">
                                        <div><div className="text-xs font-black text-slate-900">{c.size} MM</div><div className="text-[8px] font-bold text-slate-400">LABEL SIZE</div></div>
                                        <div className="text-right">
                                            <div className="text-sm font-black text-emerald-600">{c.totalQty.toFixed(2)} KG</div>
                                            <div className="text-[8px] font-bold text-slate-400 italic">RW: {c.rollWeight.toFixed(3)} kg</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-indigo-50 p-2.5 flex justify-between items-center border-t border-slate-200">
                                <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest">Total Estimated Rolls:</span>
                                <span className="text-lg font-black text-indigo-900">{Math.ceil(mergeCalcs.totalRolls)} PCS</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={handleConfirmMerge} className="w-full bg-slate-900 text-white font-black py-4 uppercase text-xs tracking-[0.3em] active:bg-black transition-all">Confirm & Generate Card</button>
                </div>
            </div>
        )}

        {/* HEADER CONTROLS */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg"><Factory size={18} /></div>
                    <h2 className="font-black text-slate-800 uppercase tracking-tighter">Plant Operations</h2>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setViewMode('CARD')} className={`p-2 rounded-md transition-all ${viewMode === 'CARD' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Card View"><LayoutGrid size={18} /></button>
                    <button onClick={() => setViewMode('LIST')} className={`p-2 rounded-md transition-all ${viewMode === 'LIST' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="List Mode"><List size={18} /></button>
                </div>
            </div>
            
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input type="text" placeholder="Search orders..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-bold outline-none" />
                </div>
                {viewMode === 'LIST' && selectedIds.length >= 2 && (
                    <button onClick={handleOpenMerge} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg animate-in zoom-in">
                        <GitMerge size={14} /> Merge ({selectedIds.length})
                    </button>
                )}
            </div>

            {viewMode === 'CARD' && filteredPlans.length > 0 && (
                <div className="flex items-center justify-between px-1 pt-1">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Queue Status</div>
                    <div className="flex items-center gap-2">
                        <button onClick={handlePrev} disabled={currentIndex === 0} className={`p-1.5 rounded-lg transition-all ${currentIndex === 0 ? 'opacity-10' : 'bg-slate-100 text-slate-800 active:scale-90'}`}><ChevronLeft size={16} /></button>
                        <div className="text-[10px] font-black bg-slate-900 text-white px-3 py-1 rounded-full">{currentIndex + 1} / {filteredPlans.length}</div>
                        <button onClick={handleNext} disabled={currentIndex === filteredPlans.length - 1} className={`p-1.5 rounded-lg transition-all ${currentIndex === filteredPlans.length - 1 ? 'opacity-10' : 'bg-slate-100 text-slate-800 active:scale-90'}`}><ChevronRight size={16} /></button>
                    </div>
                </div>
            )}
        </div>

        {/* CONTENT VIEWPORT */}
        <div className="min-h-[500px]" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            {viewMode === 'CARD' ? (
                plan ? (
                    <div key={plan.id} className={`bg-white border-[2px] border-slate-900 transition-all duration-300 relative overflow-hidden group rounded-xl shadow-xl animate-in slide-in-from-bottom-4 ${plan.status === 'COMPLETED' ? 'opacity-60 grayscale bg-slate-50' : ''}`}>
                        <div className="bg-slate-900 p-4 flex justify-between items-center text-white relative">
                            <div className="absolute top-0 left-0 w-full h-full opacity-5 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
                            <div className="relative z-10">
                                <div className="text-[9px] font-black uppercase text-indigo-400 tracking-[0.2em] mb-1">Production Target</div>
                                <h4 className="text-xl font-black truncate max-w-[250px] leading-none uppercase">{plan.partyCode}</h4>
                            </div>
                            <div className="relative z-10 text-right">
                                <div className="text-2xl font-black font-mono leading-none">#{currentIndex + 1}</div>
                                <div className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Order #</div>
                            </div>
                        </div>

                        <div className="p-6 grid grid-cols-2 gap-4 border-b-[2px] border-slate-900">
                             <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                                 <div className="text-[9px] font-black text-slate-400 uppercase mb-1">Entry Date</div>
                                 <div className="text-sm font-black font-mono">{plan.date.split('-').reverse().join('/')}</div>
                             </div>
                             <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                                 <div className="text-[9px] font-black text-slate-400 uppercase mb-1">Order Status</div>
                                 <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded inline-block ${plan.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{plan.status}</div>
                             </div>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-3"><Ruler size={24} className="text-indigo-500" /><div className="text-[10px] font-black text-slate-400 uppercase">Tube Size</div></div>
                                <div className="text-right text-3xl font-black font-mono leading-none">{plan.size} <span className="text-xs font-normal">MM</span></div>
                            </div>
                            <div className="grid grid-cols-2 border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-3"><div className="w-6 h-6 rounded-full border-[2px] border-amber-500 flex items-center justify-center text-xs font-black">μ</div><div className="text-[10px] font-black text-slate-400 uppercase">Micron</div></div>
                                <div className="text-right text-3xl font-black font-mono leading-none">{plan.micron} <span className="text-xs font-normal italic font-serif">μm</span></div>
                            </div>
                            <div className="grid grid-cols-2 border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-3"><Scale size={24} className="text-emerald-500" /><div className="text-[10px] font-black text-slate-400 uppercase">Target Qty</div></div>
                                <div className="text-right text-3xl font-black font-mono leading-none text-emerald-600">{plan.qty.toFixed(3)} <span className="text-xs font-normal text-slate-400">KG</span></div>
                            </div>
                        </div>

                        {masterJob && (
                             <div className="mx-6 mb-6 p-4 bg-amber-50 border-[2px] border-amber-200 rounded-xl flex justify-between items-center shadow-inner group-hover:bg-amber-100 transition-colors">
                                <div className="flex items-center gap-3 text-amber-900">
                                    <GitMerge size={18} className="animate-pulse" />
                                    <div><div className="text-[9px] font-black uppercase leading-none">Industrial Card Linked</div><div className="text-sm font-black mt-0.5">#{masterJob.jobNo}</div></div>
                                </div>
                                <button onClick={() => setShowDetailModal(true)} className="bg-slate-900 text-white px-5 py-2 rounded-lg text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all">Show Details</button>
                             </div>
                        )}

                        <div className="p-0">
                            <button onClick={() => handleStatusToggle(plan)} disabled={isUpdating} className={`w-full py-7 font-black uppercase text-sm tracking-[0.4em] flex items-center justify-center gap-4 transition-all active:scale-[0.98] ${plan.status === 'COMPLETED' ? 'bg-slate-200 text-slate-500' : 'bg-emerald-600 text-white shadow-[0_-8px_30px_rgb(16,185,129,0.2)]'}`}>
                                {plan.status === 'COMPLETED' ? <><RotateCcw size={24} /> Undo Complete</> : <><CheckCircle size={24} /> Finish Order</>}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-32 bg-slate-50 border-[2px] border-dashed border-slate-200 rounded-3xl"><Factory size={48} className="text-slate-300 mb-4" /><p className="text-xs font-black uppercase tracking-widest text-slate-400">Queue is Clear</p></div>
                )
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl animate-in fade-in zoom-in">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                            <thead className="bg-slate-900 text-white font-black uppercase tracking-widest sticky top-0">
                                <tr>
                                    <th className="px-4 py-4 w-12 text-center">Select</th>
                                    <th className="px-2 py-4">Date</th>
                                    <th className="px-2 py-4">Party</th>
                                    <th className="px-2 py-4 text-center">Size</th>
                                    <th className="px-2 py-4 text-center">Mic</th>
                                    <th className="px-2 py-4 text-right">Target</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredPlans.map(p => {
                                    const isSelected = selectedIds.includes(p.id);
                                    return (
                                        <tr key={p.id} className={`hover:bg-slate-50 transition-all cursor-pointer ${isSelected ? 'bg-indigo-50/50' : ''} ${p.status === 'COMPLETED' ? 'opacity-40' : ''}`} onClick={() => p.status === 'PENDING' && toggleSelection(p.id)}>
                                            <td className="px-4 py-3 text-center">
                                                <button className={`transition-colors ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`}>
                                                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                                </button>
                                            </td>
                                            <td className="px-2 py-3 font-bold text-slate-500 font-mono whitespace-nowrap">{p.date.substring(5).split('-').reverse().join('/')}</td>
                                            <td className="px-2 py-3 font-black text-slate-800 uppercase truncate max-w-[120px]">{p.partyCode}</td>
                                            <td className="px-2 py-3 text-center font-black text-slate-700">{p.size} MM</td>
                                            <td className="px-2 py-3 text-center font-bold text-slate-400">{p.micron}</td>
                                            <td className="px-2 py-3 text-right font-black text-emerald-600">{p.qty.toFixed(2)} KG</td>
                                        </tr>
                                    );
                                })}
                                {filteredPlans.length === 0 && (
                                    <tr><td colSpan={6} className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest italic">No matching orders</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
        <div className="text-center text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-2">RDMS Plant Operations Dashboard</div>
    </div>
  );
};
