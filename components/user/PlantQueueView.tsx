
import React, { useState } from 'react';
import { AppData, PlantProductionPlan } from '../../types';
import { updatePlantPlan } from '../../services/storageService';
import { Factory, Calendar, Search, Filter, CheckCircle, Clock, Info } from 'lucide-react';

interface Props {
  data: AppData;
}

export const PlantQueueView: React.FC<Props> = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSizer, setFilterSizer] = useState('ALL');

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

  // Dynamically generate unique sizers from the data
  const uniqueSizers = Array.from(new Set(data.plantProductionPlans.map(p => p.sizer).filter(Boolean))).sort();

  const handleToggleStatus = async (plan: PlantProductionPlan) => {
      const newStatus = plan.status === 'PENDING' ? 'COMPLETED' : 'PENDING';
      if (confirm(`Mark plan as ${newStatus}?`)) {
          await updatePlantPlan({ id: plan.id, status: newStatus });
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-200 gap-4">
            <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Factory className="text-emerald-600" size={24} />
                    Plant Production Queue
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-1">Live status of extrusion plans</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                        type="text" 
                        placeholder="Search queue..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-100 shadow-inner"
                    />
                </div>
                <select 
                    value={filterSizer}
                    onChange={e => setFilterSizer(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-100 shadow-sm min-w-[120px]"
                >
                    <option value="ALL">All Sizers</option>
                    {uniqueSizers.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlans.map(plan => {
                const isCompleted = plan.status === 'COMPLETED';
                return (
                    <div 
                        key={plan.id} 
                        className={`bg-white rounded-2xl border transition-all duration-300 relative overflow-hidden group hover:shadow-lg ${
                            isCompleted ? 'border-emerald-100 opacity-60 bg-slate-50' : 'border-slate-200 shadow-sm'
                        }`}
                    >
                        <div className={`absolute top-0 left-0 w-1.5 h-full ${isCompleted ? 'bg-emerald-400' : 'bg-amber-400'}`}></div>
                        
                        <div className="p-5">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                        <Calendar size={10} /> {plan.date.split('-').reverse().join('/')}
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-900 leading-tight">{plan.partyCode}</h4>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    isCompleted ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                }`}>
                                    {plan.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="space-y-1">
                                    <span className="block text-[9px] font-bold text-slate-400 uppercase">Size / Sizer</span>
                                    <div className="text-xs font-bold text-slate-800">{plan.size} <span className="text-indigo-600">[{plan.sizer}]</span></div>
                                </div>
                                <div className="space-y-1 text-right">
                                    <span className="block text-[9px] font-bold text-slate-400 uppercase">Quantity</span>
                                    <div className="text-xs font-bold text-emerald-600">{plan.qty.toFixed(1)} kg</div>
                                </div>
                            </div>

                            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 mb-4">
                                <span className="block text-[9px] font-bold text-slate-400 uppercase mb-2">Coil Sizes</span>
                                <div className="flex flex-wrap gap-2">
                                    {plan.coils.map((c, i) => (
                                        <span key={i} className="bg-white border border-slate-200 text-[10px] font-bold px-2 py-1 rounded-md shadow-sm text-slate-600">
                                            {c}
                                        </span>
                                    ))}
                                    {plan.coils.length === 0 && <span className="text-[10px] text-slate-400 italic font-bold">Standard</span>}
                                </div>
                            </div>

                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                    <Clock size={12} /> Mic: {plan.micron}m
                                </div>
                                <button 
                                    onClick={() => handleToggleStatus(plan)}
                                    className={`text-[10px] font-bold px-4 py-2 rounded-lg transition-all shadow-sm flex items-center gap-1.5 ${
                                        isCompleted 
                                        ? 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600' 
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    }`}
                                >
                                    {isCompleted ? <><Clock size={12} /> Re-open</> : <><CheckCircle size={12} /> Mark Finished</>}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
            {filteredPlans.length === 0 && (
                <div className="col-span-full py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-400">
                    <Factory size={48} className="mb-4 opacity-20" />
                    <p className="text-sm font-bold">Queue is currently clear</p>
                    <p className="text-[10px] mt-1 font-medium">New extrusion plans will appear here</p>
                </div>
            )}
        </div>
    </div>
  );
};
