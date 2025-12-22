
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppData, PlantProductionPlan, SlittingJob } from '../../types';
import { updatePlantPlan } from '../../services/storageService';
import { Factory, Search, Ruler, Scale, ChevronLeft, ChevronRight, CheckCircle, RotateCcw, ArrowRightLeft, FileText, X, Info, Scissors, GitMerge } from 'lucide-react';

interface Props {
  data: AppData;
}

const PROD_DENSITY = 0.00276;

export const PlantQueueView: React.FC<Props> = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const filteredPlans = data.plantProductionPlans.filter(p => {
    const s = searchTerm.toLowerCase();
    const matchesSearch = p.partyCode.toLowerCase().includes(s) || p.size.toLowerCase().includes(s);
    return matchesSearch;
  }).sort((a, b) => {
    if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
    if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

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

  // Derived calculations for display in the detailed view
  const detailedSpecs = useMemo(() => {
      if (!masterJob) return null;
      const mic = masterJob.planMicron;
      const slitLen = masterJob.planRollLength;
      const combinedQty = masterJob.planQty;
      const labelCoilSizes = masterJob.coils.map(c => parseFloat(c.size) || 0);
      const totalSlittingSize = labelCoilSizes.reduce((a, b) => a + b, 0);

      const coilsBreakdown = masterJob.coils.map(c => {
          const s = parseFloat(c.size) || 0;
          // Size weight = (size 1 * micron * 0.00276 / 2 * slitting roll length / 1000)
          const coilRollWeight = (s * mic * PROD_DENSITY / 2 * slitLen) / 1000;
          // Each size qty = (target qty / slitting size * slitting coil size)
          const coilTotalQty = (combinedQty / totalSlittingSize) * s;
          return { size: c.size, rollWeight: coilRollWeight, totalQty: coilTotalQty, rolls: c.rolls };
      });

      return { totalSlittingSize, coilsBreakdown, tubeRollLength: slitLen / 2 };
  }, [masterJob]);

  const handleNext = () => currentIndex < filteredPlans.length - 1 && setCurrentIndex(prev => prev + 1);
  const handlePrev = () => currentIndex > 0 && setCurrentIndex(prev => prev - 1);

  const handleStatusToggle = async (plan: PlantProductionPlan) => {
    if (isUpdating) return;
    setIsUpdating(true);
    const newStatus = plan.status === 'PENDING' ? 'COMPLETED' : 'PENDING';
    try { await updatePlantPlan({ id: plan.id, status: newStatus }); } 
    finally { setIsUpdating(false); }
  };

  const handleTouchStart = (e: React.TouchEvent) => touchStartX.current = e.touches[0].clientX;
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? handleNext() : handlePrev();
    touchStartX.current = null;
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-500 pb-4 max-w-2xl mx-auto px-1">
        {/* Detail Modal for Industrial Job Card View */}
        {showDetailModal && plan && masterJob && detailedSpecs && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border-[2px] border-slate-900 animate-in zoom-in duration-200">
                    <div className="bg-slate-900 p-4 flex justify-between items-center text-white border-b-[2px] border-slate-900">
                        <h3 className="font-black uppercase tracking-tighter flex items-center gap-2">
                           <FileText size={18} className="text-amber-400" /> Industrial Job Card
                        </h3>
                        <button onClick={() => setShowDetailModal(false)}><X size={24}/></button>
                    </div>
                    <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                                <span className="text-[9px] font-black text-slate-400 block uppercase">Serial No</span>
                                <span className="text-sm font-black text-slate-900">#{masterJob.jobNo}</span>
                            </div>
                            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                                <span className="text-[9px] font-black text-slate-400 block uppercase">Job Date</span>
                                <span className="text-sm font-black text-slate-900">{masterJob.date.split('-').reverse().join('/')}</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                             {/* Production (Tube) Details */}
                             <div className="border border-slate-900 rounded-lg overflow-hidden">
                                <div className="bg-slate-900 px-3 py-1.5 text-[10px] font-black uppercase text-white flex items-center gap-2">
                                   <Factory size={12}/> Production (Tube Size)
                                </div>
                                <div className="p-3 bg-white grid grid-cols-2 gap-4">
                                    <div className="text-center border-r border-slate-100">
                                        <div className="text-[9px] font-black text-slate-400 uppercase">Roll Length</div>
                                        <div className="text-sm font-black text-slate-800">{detailedSpecs.tubeRollLength} <span className="text-[10px]">M</span></div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-[9px] font-black text-slate-400 uppercase">Micron</div>
                                        <div className="text-sm font-black text-slate-800">{masterJob.planMicron} <span className="text-[10px]">μ</span></div>
                                    </div>
                                </div>
                             </div>

                             {/* Slitting (Coil) Breakdown */}
                             <div className="border border-slate-900 rounded-lg overflow-hidden shadow-lg">
                                <div className="bg-slate-900 px-3 py-1.5 text-[10px] font-black uppercase text-white flex items-center gap-2">
                                   <Scissors size={12}/> Slitting Breakdown (Per Coil)
                                </div>
                                <div className="bg-slate-100 px-3 py-1 text-[9px] font-bold text-slate-600 border-b border-slate-200 flex justify-between">
                                   <span>Slit Size: {detailedSpecs.totalSlittingSize} MM</span>
                                   <span>Slit Length: {masterJob.planRollLength} M</span>
                                </div>
                                <div className="divide-y divide-slate-100 bg-white">
                                    {detailedSpecs.coilsBreakdown.map((c, i) => (
                                        <div key={i} className="p-3 grid grid-cols-12 gap-2 items-center hover:bg-indigo-50/30 transition-colors">
                                            <div className="col-span-1 text-[10px] font-black text-slate-300">#{i+1}</div>
                                            <div className="col-span-3">
                                                <div className="text-xs font-black text-slate-900">{c.size} MM</div>
                                                <div className="text-[8px] font-bold text-slate-400">SIZE</div>
                                            </div>
                                            <div className="col-span-4 text-center">
                                                <div className="text-xs font-black text-indigo-600">{c.rollWeight.toFixed(3)} KG</div>
                                                <div className="text-[8px] font-bold text-slate-400 uppercase">Per Roll Wt</div>
                                            </div>
                                            <div className="col-span-4 text-right">
                                                <div className="text-xs font-black text-emerald-600">{c.totalQty.toFixed(2)} KG</div>
                                                <div className="text-[8px] font-bold text-slate-400 uppercase">Each Size Qty</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-slate-50 p-3 flex justify-between items-center border-t border-slate-200">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Total Rolls Calculation:</span>
                                    <span className="text-lg font-black text-slate-900">{Math.ceil(masterJob.coils[0].rolls)} PCS</span>
                                </div>
                             </div>
                        </div>
                    </div>
                    <button onClick={() => setShowDetailModal(false)} className="w-full bg-indigo-600 text-white font-black py-5 uppercase text-xs tracking-[0.2em] shadow-xl border-t border-white/10 active:bg-indigo-700">Close Detailed View</button>
                </div>
            </div>
        )}

        {/* COMPACT UI NAV */}
        <div className="bg-white p-2 rounded-xl border border-slate-200 flex flex-col gap-2 shadow-none">
            <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center"><Factory size={16} /></div>
                    <div><h2 className="text-sm font-bold text-slate-800 leading-none tracking-tight">Plant Queue</h2></div>
                </div>
                {filteredPlans.length > 0 && (
                    <div className="flex items-center gap-1">
                        <button onClick={handlePrev} disabled={currentIndex === 0} className={`p-1.5 rounded-lg transition-all ${currentIndex === 0 ? 'opacity-10' : 'bg-slate-100 text-slate-800 active:scale-90'}`}><ChevronLeft size={16} /></button>
                        <div className="text-[10px] font-black uppercase tracking-widest bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg"><span className="text-slate-900">{currentIndex + 1}</span><span className="text-slate-300 mx-0.5">/</span><span className="text-slate-500">{filteredPlans.length}</span></div>
                        <button onClick={handleNext} disabled={currentIndex === filteredPlans.length - 1} className={`p-1.5 rounded-lg transition-all ${currentIndex === filteredPlans.length - 1 ? 'opacity-10' : 'bg-slate-100 text-slate-800 active:scale-90'}`}><ChevronRight size={16} /></button>
                    </div>
                )}
            </div>
            <div className="relative flex-1"><Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} /><input type="text" placeholder="Search Party or Size..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 text-[11px] font-bold outline-none shadow-none" /></div>
        </div>

        {/* ORDER CARD */}
        <div className="min-h-[400px] touch-pan-y" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            {plan ? (
                <div key={plan.id} className={`bg-white border-[2px] border-slate-900 transition-all duration-300 relative overflow-hidden group rounded-lg shadow-none ${plan.status === 'COMPLETED' ? 'opacity-50 grayscale bg-slate-50 border-slate-400' : ''} animate-in slide-in-from-right-2`}>
                    <div className={`absolute top-2 right-2 z-20 transform rotate-12 px-2 py-0.5 border-[2px] text-[8px] font-black uppercase tracking-widest ${plan.status === 'COMPLETED' ? 'border-emerald-500 text-emerald-600' : 'border-amber-500 text-amber-600'}`}>{plan.status}</div>
                    
                    <div className="grid grid-cols-12 border-b-[2px] border-slate-900">
                         <div className="col-span-4 border-r-[2px] border-slate-900 p-2 bg-slate-100 flex items-center justify-center">
                             <div className="text-center"><div className="text-[8px] font-black uppercase leading-none mb-0.5 text-slate-500">Queue #</div><div className="text-3xl font-black font-mono text-slate-900">{(currentIndex + 1).toString().padStart(2, '0')}</div></div>
                         </div>
                         <div className="col-span-8 p-2 flex items-center justify-center bg-white relative overflow-hidden">
                             <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none flex items-center justify-center select-none text-6xl font-black italic">RDMS</div>
                             <div className="text-3xl font-black uppercase tracking-tighter text-slate-900 text-center">LABEL ORDER</div>
                         </div>
                    </div>

                    <div className="grid grid-cols-2 border-b-[2px] border-slate-900 bg-slate-50">
                         <div className="border-r-[1.5px] border-slate-900 p-2 flex flex-col items-center justify-center">
                             <span className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Date</span>
                             <span className="text-sm font-black font-mono leading-none">{plan.date.split('-').reverse().join('/')}</span>
                         </div>
                         <div className="p-2 flex flex-col items-center justify-center">
                             <span className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Party</span>
                             <span className="text-sm font-black font-mono truncate max-w-full uppercase leading-none">{plan.partyCode}</span>
                         </div>
                    </div>

                    <div className="flex flex-col">
                          <div className="grid grid-cols-2 border-b-[1.5px] border-slate-900">
                              <div className="p-3 border-r-[1.5px] border-slate-900 text-[9px] font-black uppercase bg-white flex items-center gap-1 justify-center"><Ruler size={10} className="text-indigo-500" /> Size :-</div>
                              <div className="p-3 text-2xl font-black font-mono text-center flex items-center justify-center gap-1 bg-white leading-none">{plan.size} <span className="text-[10px] text-slate-400 font-normal">MM</span></div>
                          </div>
                          <div className="grid grid-cols-2 border-b-[1.5px] border-slate-900">
                              <div className="p-3 border-r-[1.5px] border-slate-900 text-[9px] font-black uppercase bg-white flex items-center gap-1 justify-center"><div className="w-3 h-3 rounded-full border border-amber-500 flex items-center justify-center text-[7px] font-bold">μ</div> Micron :-</div>
                              <div className="p-3 text-2xl font-black font-mono text-center flex items-center justify-center gap-1 bg-white leading-none">{plan.micron} <span className="text-[10px] text-slate-400 font-normal italic font-serif">μm</span></div>
                          </div>
                          <div className="grid grid-cols-2 border-b-[1.5px] border-slate-900">
                              <div className="p-3 border-r-[1.5px] border-slate-900 text-[9px] font-black uppercase bg-white flex items-center gap-1 justify-center"><Scale size={10} className="text-emerald-500" /> Target Qty :-</div>
                              <div className="p-3 text-2xl font-black font-mono text-center flex items-center justify-center gap-1 bg-white text-emerald-600 leading-none">{plan.qty.toFixed(3)} <span className="text-[10px] text-slate-400 font-normal">KGS</span></div>
                          </div>
                          
                          {/* Industrial Master Job Breakdown - Direct Access */}
                          {masterJob && (
                              <div className="p-3 bg-amber-50 border-b-[1.5px] border-slate-900 flex justify-between items-center shadow-inner group-hover:bg-amber-100 transition-colors">
                                  <div className="flex items-center gap-2 text-amber-800">
                                      <GitMerge size={16} className="animate-pulse" />
                                      <div className="flex flex-col">
                                          <span className="text-[10px] font-black uppercase leading-none">Job Card Linked</span>
                                          <span className="text-[9px] font-bold text-amber-600">ID: #{masterJob.jobNo}</span>
                                      </div>
                                  </div>
                                  <button onClick={() => setShowDetailModal(true)} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all flex items-center gap-1">
                                      <FileText size={12}/> View Card
                                  </button>
                              </div>
                          )}

                          <div className="p-0">
                              <button onClick={() => handleStatusToggle(plan)} disabled={isUpdating} className={`w-full py-7 font-black uppercase text-sm tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${plan.status === 'COMPLETED' ? 'bg-slate-200 text-slate-500 hover:bg-slate-300' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg'}`}>
                                {plan.status === 'COMPLETED' ? <><RotateCcw size={20} /> Mark as Pending</> : <><CheckCircle size={20} /> Production Complete</>}
                              </button>
                          </div>
                    </div>
                </div>
            ) : (
                <div className="py-20 bg-slate-50 border-[2px] border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 rounded-2xl mx-2 shadow-none"><Factory size={48} className="mb-4 opacity-10 animate-bounce" /><p className="text-sm font-black uppercase tracking-[0.2em] text-slate-300">No Orders in Queue</p></div>
            )}
        </div>
        <div className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2 sm:hidden">← Swipe Left/Right to Navigate →</div>
    </div>
  );
};
