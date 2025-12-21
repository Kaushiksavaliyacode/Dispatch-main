
import React, { useState, useEffect } from 'react';
import { AppData, PlantProductionPlan } from '../../types';
import { savePlantPlan, deletePlantPlan, updatePlantPlan } from '../../services/storageService';
import { Factory, Trash2, CheckCircle, Search, Copy, Edit2, Ruler, Scale, Calendar, Hash, ArrowRightLeft } from 'lucide-react';

interface Props {
  data: AppData;
}

const FACTOR = 0.00138;

export const PlantPlanner: React.FC<Props> = ({ data }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [partyCode, setPartyCode] = useState('');
  const [size, setSize] = useState('');
  const [micron, setMicron] = useState('');
  const [qty, setQty] = useState('');
  const [meter, setMeter] = useState('');
  const [lastEdited, setLastEdited] = useState<'qty' | 'meter'>('qty');
  
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const partySuggestions = data.parties.filter(p => 
    p.name.toLowerCase().includes(partyCode.toLowerCase()) || 
    (p.code && p.code.toLowerCase().includes(partyCode.toLowerCase()))
  );

  // Auto-calculation logic
  useEffect(() => {
    const s = parseFloat(size) || 0;
    const m = parseFloat(micron) || 0;

    if (s > 0 && m > 0) {
      if (lastEdited === 'qty') {
        const q = parseFloat(qty) || 0;
        // Formula: Meter = Qty / Micron / 0.00138 / Size
        const calcMeter = q / (m * FACTOR * (s/1000)); 
        setMeter(calcMeter > 0 ? Math.round(calcMeter).toString() : '');
      } else if (lastEdited === 'meter') {
        const mtr = parseFloat(meter) || 0;
        // Formula: Qty = Size * 0.00138 * Meter * Micron
        const calcQty = (s/1000) * FACTOR * mtr * m;
        setQty(calcQty > 0 ? calcQty.toFixed(3) : '');
      }
    }
  }, [size, micron, qty, meter, lastEdited]);

  const handleQtyChange = (val: string) => {
    setQty(val);
    setLastEdited('qty');
  };

  const handleMeterChange = (val: string) => {
    setMeter(val);
    setLastEdited('meter');
  };

  const handleSave = async () => {
    if (!partyCode || !size || !qty) return alert("Fill Party, Size and Qty");
    
    const plan: PlantProductionPlan = {
      id: editingId || `plant-plan-${Date.now()}`,
      date,
      partyCode,
      sizer: 'LABEL', // Default internal sizer
      size,
      coils: [], // Removed coils from UI
      micron: parseFloat(micron) || 0,
      qty: parseFloat(qty) || 0,
      meter: parseFloat(meter) || 0,
      status: editingId ? (data.plantProductionPlans.find(p => p.id === editingId)?.status || 'PENDING') : 'PENDING',
      createdAt: editingId ? (data.plantProductionPlans.find(p => p.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
    };

    await savePlantPlan(plan);
    resetForm();
    alert("Order Saved!");
  };

  const handleEdit = (plan: PlantProductionPlan) => {
    setEditingId(plan.id);
    setDate(plan.date);
    setPartyCode(plan.partyCode);
    setSize(plan.size);
    setMicron(plan.micron.toString());
    setQty(plan.qty.toString());
    setMeter(plan.meter?.toString() || '');
    setLastEdited('qty');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDuplicate = (plan: PlantProductionPlan) => {
    setDate(new Date().toISOString().split('T')[0]);
    setPartyCode(plan.partyCode);
    setSize(plan.size);
    setMicron(plan.micron.toString());
    setQty(plan.qty.toString());
    setMeter(plan.meter?.toString() || '');
    setEditingId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStatusToggle = async (plan: PlantProductionPlan) => {
      const newStatus = plan.status === 'PENDING' ? 'COMPLETED' : 'PENDING';
      await updatePlantPlan({ id: plan.id, status: newStatus });
  };

  const resetForm = () => {
    setEditingId(null);
    setDate(new Date().toISOString().split('T')[0]);
    setPartyCode('');
    setSize('');
    setMicron('');
    setQty('');
    setMeter('');
    setLastEdited('qty');
  };

  const filteredPlans = data.plantProductionPlans.filter(p => {
    const s = searchTerm.toLowerCase();
    return p.partyCode.toLowerCase().includes(s) || p.size.toLowerCase().includes(s);
  });

  return (
    <div className="flex flex-col xl:flex-row gap-8 items-start max-w-7xl mx-auto">
      
      {/* Redesigned Admin Form matching User Card style */}
      <div className="w-full xl:w-[480px] xl:sticky xl:top-24 z-30">
        <div className={`bg-white border-[2px] border-slate-900 overflow-hidden transition-all duration-300 ${editingId ? 'ring-4 ring-amber-100' : ''}`}>
          
          {/* HEADER SECTION */}
          <div className="grid grid-cols-12 border-b-[2px] border-slate-900">
            <div className="col-span-12 p-4 flex items-center justify-center bg-white relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none flex items-center justify-center select-none text-7xl font-black italic">LABEL</div>
               <div className="text-3xl font-black uppercase tracking-tighter text-slate-900 text-center">LABEL ORDER</div>
            </div>
          </div>

          {/* PRIMARY INFO INPUTS */}
          <div className="grid grid-cols-2 border-b-[2px] border-slate-900 bg-slate-50">
            <div className="border-r-[1.5px] border-slate-900 p-2 flex flex-col">
              <label className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1 flex items-center gap-1">
                <Calendar size={10} /> Date
              </label>
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)} 
                className="bg-transparent text-xs font-black font-mono leading-none w-full outline-none focus:text-indigo-600"
              />
            </div>
            <div className="p-2 flex flex-col relative">
              <label className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1 flex items-center gap-1">
                <Hash size={10} /> Party
              </label>
              <input 
                type="text" 
                value={partyCode} 
                onChange={e => { setPartyCode(e.target.value); setShowPartyDropdown(true); }}
                onFocus={() => setShowPartyDropdown(true)}
                onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)}
                placeholder="Search..."
                className="bg-transparent text-xs font-black font-mono truncate w-full uppercase leading-none outline-none focus:text-indigo-600"
              />
              {showPartyDropdown && partyCode && (
                <div className="absolute z-50 left-0 right-0 top-full mt-0 bg-white border-[2px] border-slate-900 shadow-xl max-h-32 overflow-y-auto p-1">
                  {partySuggestions.map(p => (
                    <div key={p.id} className="px-2 py-1 hover:bg-slate-100 cursor-pointer text-[9px] font-bold border-b border-slate-100 last:border-0" onClick={() => { setPartyCode(p.code || p.name); setShowPartyDropdown(false); }}>
                      {p.name} <span className="text-[7px] text-slate-400">[{p.code}]</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* TECH SPECS INPUTS */}
          <div className="flex flex-col">
            <div className="grid grid-cols-2 border-b-[1.5px] border-slate-900">
              <div className="p-2 border-r-[1.5px] border-slate-900 text-[9px] font-black uppercase bg-white flex items-center gap-1 justify-center">
                <Ruler size={12} className="text-indigo-500" /> Tube :-
              </div>
              <div className="p-2 bg-white flex items-center justify-center gap-1">
                <input 
                  type="number" 
                  value={size} 
                  onChange={e => setSize(e.target.value)} 
                  placeholder="000"
                  className="w-24 text-2xl font-black font-mono text-center outline-none focus:text-indigo-600 leading-none bg-transparent"
                />
                <span className="text-[10px] text-slate-400 font-normal">MM</span>
              </div>
            </div>
            <div className="grid grid-cols-2 border-b-[1.5px] border-slate-900">
              <div className="p-2 border-r-[1.5px] border-slate-900 text-[9px] font-black uppercase bg-white flex items-center gap-1 justify-center">
                <div className="w-4 h-4 rounded-full border border-amber-500 flex items-center justify-center text-[8px] font-bold">μ</div> Micron :-
              </div>
              <div className="p-2 bg-white flex items-center justify-center gap-1">
                <input 
                  type="number" 
                  value={micron} 
                  onChange={e => setMicron(e.target.value)} 
                  placeholder="00"
                  className="w-24 text-2xl font-black font-mono text-center outline-none focus:text-amber-600 leading-none bg-transparent"
                />
                <span className="text-[10px] text-slate-400 font-normal italic font-serif">μm</span>
              </div>
            </div>

            {/* WEIGHT & METER GRID */}
            <div className="grid grid-cols-2 border-b-[2px] border-slate-900 bg-slate-50">
               <div className="p-3 border-r-[1.5px] border-slate-900 flex flex-col items-center justify-center transition-all">
                  <label className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1 flex items-center gap-1">
                    <Scale size={10} className="text-emerald-500" /> Target Wt
                  </label>
                  <div className="flex items-center">
                    <input 
                        type="number" 
                        value={qty} 
                        onChange={e => handleQtyChange(e.target.value)}
                        className={`w-full text-xl font-black font-mono text-center outline-none bg-transparent ${lastEdited === 'qty' ? 'text-emerald-600' : 'text-slate-500'}`}
                        placeholder="0.00"
                    />
                    <span className="text-[8px] text-slate-400 font-normal">KG</span>
                  </div>
               </div>
               <div className="p-3 flex flex-col items-center justify-center transition-all">
                  <label className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1 flex items-center gap-1">
                    <ArrowRightLeft size={10} className="text-indigo-500" /> Meter
                  </label>
                  <div className="flex items-center">
                    <input 
                        type="number" 
                        value={meter} 
                        onChange={e => handleMeterChange(e.target.value)}
                        className={`w-full text-xl font-black font-mono text-center outline-none bg-transparent ${lastEdited === 'meter' ? 'text-indigo-600' : 'text-slate-500'}`}
                        placeholder="000"
                    />
                    <span className="text-[8px] text-slate-400 font-normal">M</span>
                  </div>
               </div>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="grid grid-cols-2">
            {editingId && (
              <button 
                onClick={resetForm}
                className="bg-slate-200 text-slate-600 font-black text-[10px] uppercase py-4 border-r-[2px] border-slate-900 hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            )}
            <button 
              onClick={handleSave}
              className={`font-black text-xs uppercase py-4 flex items-center justify-center gap-2 transition-all active:scale-95 ${editingId ? 'bg-amber-500 text-white col-span-1' : 'bg-slate-900 text-white col-span-2 hover:bg-black'}`}
            >
              <CheckCircle size={16} />
              {editingId ? 'Update Entry' : 'Post Label Order'}
            </button>
          </div>
        </div>
      </div>

      {/* PLAN LIST SECTION */}
      <div className="flex-1 space-y-4 w-full">
          <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200 gap-3">
              <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
                    <Factory size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 leading-none">Order Queue</h3>
                    <p className="text-xs text-slate-500 font-black uppercase tracking-widest mt-1">Live Feed</p>
                  </div>
              </div>
              <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text" 
                    placeholder="Filter..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-bold outline-none focus:ring-4 focus:ring-slate-100 shadow-inner"
                  />
              </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden min-h-[500px]">
              <div className="overflow-x-auto custom-scrollbar h-[600px]">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead className="sticky top-0 z-20 bg-slate-900 text-white text-[10px] uppercase tracking-wider font-black">
                          <tr>
                              <th className="px-4 py-4 text-center">Date</th>
                              <th className="px-4 py-4">Party</th>
                              <th className="px-4 py-4 text-center">Tube</th>
                              <th className="px-4 py-4 text-center">Mic</th>
                              <th className="px-4 py-4 text-right">Target</th>
                              <th className="px-4 py-4 text-right">Meter</th>
                              <th className="px-4 py-4 text-center">Status</th>
                              <th className="px-4 py-4 text-center">Action</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {filteredPlans.map(plan => (
                              <tr key={plan.id} className={`hover:bg-indigo-50/50 transition-all ${plan.status === 'COMPLETED' ? 'opacity-50 grayscale bg-slate-50' : ''}`}>
                                  <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-slate-500 font-mono text-center">{plan.date.split('-').reverse().join('/')}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-xs font-black text-slate-800 uppercase">{plan.partyCode}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-xs font-black text-slate-700 font-mono text-center">{plan.size} MM</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-slate-500 text-center">{plan.micron}</td>
                                  <td className="px-4 py-3 text-right whitespace-nowrap text-xs font-black text-emerald-600">{plan.qty.toFixed(3)} <span className="text-[9px] text-slate-400">KG</span></td>
                                  <td className="px-4 py-3 text-right whitespace-nowrap text-xs font-black text-indigo-600">{plan.meter || '-'} <span className="text-[9px] text-slate-400">M</span></td>
                                  <td className="px-4 py-3 text-center">
                                      <button 
                                        onClick={() => handleStatusToggle(plan)}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[9px] font-black uppercase rounded transition-colors ${
                                            plan.status === 'COMPLETED' 
                                            ? 'border-emerald-500 text-emerald-600 bg-emerald-50 hover:bg-emerald-100' 
                                            : 'border-amber-500 text-amber-600 bg-amber-50 hover:bg-amber-100'
                                        }`}
                                      >
                                          {plan.status === 'COMPLETED' ? 'DONE' : 'WAIT'}
                                      </button>
                                  </td>
                                  <td className="px-4 py-3">
                                      <div className="flex justify-center gap-2">
                                          <button onClick={() => handleDuplicate(plan)} className="p-1.5 text-blue-600 hover:bg-white border border-transparent hover:border-blue-200 rounded transition-colors" title="Duplicate"><Copy size={12} /></button>
                                          <button onClick={() => handleEdit(plan)} className="p-1.5 text-indigo-600 hover:bg-white border border-transparent hover:border-indigo-200 rounded transition-colors"><Edit2 size={12} /></button>
                                          <button onClick={() => { if(confirm("Delete entry?")) deletePlantPlan(plan.id); }} className="p-1.5 text-red-500 hover:bg-white border border-transparent hover:border-red-200 rounded transition-colors"><Trash2 size={12} /></button>
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>
    </div>
  );
};
