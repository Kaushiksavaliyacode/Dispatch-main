
import React, { useState, useEffect, useRef } from 'react';
import { AppData, PlantProductionPlan } from '../../types';
import { Factory, Calendar, Search, Clock, Hash, Ruler, Scale, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  data: AppData;
}

export const PlantQueueView: React.FC<Props> = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSizer, setFilterSizer] = useState('ALL');
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const filteredPlans = data.plantProductionPlans.filter(p => {
    const s = searchTerm.toLowerCase();
    const matchesSearch = p.partyCode.toLowerCase().includes(s) || p.size.toLowerCase().includes(s);
    const matchesSizer = filterSizer === 'ALL' || p.sizer === filterSizer;
    return matchesSearch && matchesSizer;
  }).sort((a, b) => {
    if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
    if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  // Reset index when filters change
  useEffect(() => {
    setCurrentIndex(0);
  }, [searchTerm, filterSizer]);

  const uniqueSizers = Array.from(new Set(data.plantProductionPlans.map(p => p.sizer).filter(Boolean))).sort();

  const handleNext = () => {
    if (currentIndex < filteredPlans.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    const threshold = 50; // Minimum distance to trigger swipe

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        // Swiped Left -> Show Next
        handleNext();
      } else {
        // Swiped Right -> Show Prev
        handlePrev();
      }
    }
    
    touchStartX.current = null;
  };

  const plan = filteredPlans[currentIndex];

  return (
    <div className="space-y-3 animate-in fade-in duration-500 pb-4 max-w-2xl mx-auto px-1">
        {/* Compact Header Controls */}
        <div className="bg-white p-2 rounded-xl border border-slate-200 flex flex-col gap-2 shadow-none">
            <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center">
                        <Factory size={16} />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-800 leading-none tracking-tight">Queue</h2>
                    </div>
                </div>
                {/* Embedded Navigation */}
                {filteredPlans.length > 0 && (
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={handlePrev} 
                            disabled={currentIndex === 0}
                            className={`p-1.5 rounded-lg transition-all ${currentIndex === 0 ? 'opacity-10' : 'bg-slate-100 text-slate-800 active:scale-90'}`}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <div className="text-[10px] font-black uppercase tracking-widest bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg">
                            <span className="text-slate-900">{currentIndex + 1}</span>
                            <span className="text-slate-300 mx-0.5">/</span>
                            <span className="text-slate-500">{filteredPlans.length}</span>
                        </div>
                        <button 
                            onClick={handleNext} 
                            disabled={currentIndex === filteredPlans.length - 1}
                            className={`p-1.5 rounded-lg transition-all ${currentIndex === filteredPlans.length - 1 ? 'opacity-10' : 'bg-slate-100 text-slate-800 active:scale-90'}`}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </div>
            <div className="flex gap-2 w-full">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 text-[11px] font-bold outline-none focus:ring-2 focus:ring-slate-100 transition-all shadow-none"
                    />
                </div>
                <select 
                    value={filterSizer}
                    onChange={e => setFilterSizer(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-bold outline-none cursor-pointer shadow-none"
                >
                    <option value="ALL">All Sizers</option>
                    {uniqueSizers.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
        </div>

        {/* Focused Single Production Card - Compacted with Swipe Support and Removed Shadows */}
        <div 
          className="min-h-[400px] touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
            {plan ? (
                <div 
                    key={plan.id} 
                    className={`bg-white border-[2px] border-slate-900 transition-all duration-300 relative overflow-hidden group rounded-lg shadow-none ${
                        plan.status === 'COMPLETED' ? 'opacity-50 grayscale bg-slate-50 border-slate-400' : ''
                    } animate-in slide-in-from-right-2`}
                >
                    {/* Status Stamp */}
                    <div className={`absolute top-2 right-2 z-20 transform rotate-12 px-2 py-0.5 border-[2px] text-[8px] font-black uppercase tracking-widest ${plan.status === 'COMPLETED' ? 'border-emerald-500 text-emerald-600' : 'border-amber-500 text-amber-600'}`}>
                        {plan.status}
                    </div>

                    {/* CARD HEADER */}
                    <div className="grid grid-cols-12 border-b-[2px] border-slate-900">
                         <div className="col-span-4 border-r-[2px] border-slate-900 p-2 bg-slate-100 flex items-center justify-center">
                             <div className="text-center">
                                 <div className="text-[8px] font-black uppercase leading-none mb-0.5 text-slate-500">Queue</div>
                                 <div className="text-3xl font-black font-mono text-slate-900">{(currentIndex + 1).toString().padStart(2, '0')}</div>
                             </div>
                         </div>
                         <div className="col-span-8 p-2 flex items-center justify-center bg-white relative overflow-hidden">
                             <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none flex items-center justify-center select-none text-6xl font-black italic">PRODUCTION</div>
                             <div className="text-3xl font-black uppercase tracking-tighter text-slate-900 text-center">SLITTING</div>
                         </div>
                    </div>

                    {/* PRIMARY INFO BAR */}
                    <div className="grid grid-cols-3 border-b-[2px] border-slate-900 bg-slate-50">
                         <div className="border-r-[1.5px] border-slate-900 p-1.5 flex flex-col items-center justify-center text-center">
                             <span className="text-[7px] font-black uppercase text-slate-400 leading-none mb-1">Date</span>
                             <span className="text-[10px] font-black font-mono leading-none">{plan.date.split('-').reverse().join('/')}</span>
                         </div>
                         <div className="border-r-[1.5px] border-slate-900 p-1.5 flex flex-col items-center justify-center text-center">
                             <span className="text-[7px] font-black uppercase text-slate-400 leading-none mb-1">Party</span>
                             <span className="text-[10px] font-black font-mono truncate max-w-full uppercase leading-none">{plan.partyCode}</span>
                         </div>
                         <div className="p-1.5 flex flex-col items-center justify-center text-center">
                             <span className="text-[7px] font-black uppercase text-slate-400 leading-none mb-1">Sizer</span>
                             <span className="text-sm font-black font-mono uppercase leading-none">{plan.sizer}</span>
                         </div>
                    </div>

                    {/* TECHNICAL SPECIFICATIONS */}
                    <div className="flex flex-col">
                          <div className="grid grid-cols-2 border-b-[1.5px] border-slate-900">
                              <div className="p-2 border-r-[1.5px] border-slate-900 text-[9px] font-black uppercase bg-white flex items-center gap-1 justify-center">
                                  <Ruler size={10} className="text-indigo-500" /> Tube :-
                              </div>
                              <div className="p-2 text-xl font-black font-mono text-center flex items-center justify-center gap-1 bg-white leading-none">
                                  {plan.size} <span className="text-[8px] text-slate-400 font-normal">MM</span>
                              </div>
                          </div>
                          <div className="grid grid-cols-2 border-b-[1.5px] border-slate-900">
                              <div className="p-2 border-r-[1.5px] border-slate-900 text-[9px] font-black uppercase bg-white flex items-center gap-1 justify-center">
                                  <div className="w-3 h-3 rounded-full border border-amber-500 flex items-center justify-center text-[7px] font-bold">μ</div> Micron :-
                              </div>
                              <div className="p-2 text-xl font-black font-mono text-center flex items-center justify-center gap-1 bg-white leading-none">
                                  {plan.micron} <span className="text-[8px] text-slate-400 font-normal italic font-serif">μm</span>
                              </div>
                          </div>
                          <div className="grid grid-cols-2 border-b-[1.5px] border-slate-900">
                              <div className="p-2 border-r-[1.5px] border-slate-900 text-[9px] font-black uppercase bg-white flex items-center gap-1 justify-center">
                                  <Scale size={10} className="text-emerald-500" /> Target :-
                              </div>
                              <div className="p-2 text-xl font-black font-mono text-center flex items-center justify-center gap-1 bg-white text-emerald-600 leading-none">
                                  {plan.qty} <span className="text-[8px] text-slate-400 font-normal">KGS</span>
                              </div>
                          </div>
                          
                          {/* SIZES SUB-GRID */}
                          <div className="grid grid-cols-12 min-h-[80px] bg-slate-50">
                               <div className="col-span-2 bg-amber-400 border-r-[1.5px] border-slate-900 p-1 flex items-center justify-center">
                                   <div className="text-[10px] font-black uppercase -rotate-90 tracking-tighter text-slate-900 whitespace-nowrap">SIZES</div>
                               </div>
                               <div className="col-span-10 p-1.5 flex items-center">
                                    <div className="grid grid-cols-4 gap-1.5 w-full">
                                        {plan.coils.map((c, i) => (
                                            <div key={i} className="bg-white border border-slate-900 p-1.5 flex flex-col items-center justify-center rounded shadow-none">
                                                <span className="text-[6px] font-black text-slate-400 uppercase leading-none mb-0.5">S{i+1}</span>
                                                <span className="text-sm font-black font-mono text-slate-900 leading-none">{c}</span>
                                            </div>
                                        ))}
                                        {/* Minimal Filler */}
                                        {plan.coils.length < 4 && Array.from({ length: 4 - plan.coils.length }).map((_, i) => (
                                            <div key={`empty-${i}`} className="bg-slate-100/30 border border-dashed border-slate-200 rounded"></div>
                                        ))}
                                    </div>
                               </div>
                          </div>
                    </div>
                </div>
            ) : (
                <div className="py-20 bg-slate-50 border-[2px] border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 rounded-2xl mx-2 shadow-none">
                    <Factory size={48} className="mb-4 opacity-10 animate-bounce" />
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-300">Queue Clear</p>
                </div>
            )}
        </div>
        <div className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2 sm:hidden">
            ← Swipe to Navigate →
        </div>
    </div>
  );
};
