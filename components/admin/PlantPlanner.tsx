
import React, { useState } from 'react';
import { AppData, PlantProductionPlan } from '../../types';
import { savePlantPlan, deletePlantPlan } from '../../services/storageService';
import { Factory, Plus, Trash2, CheckCircle, Search, Copy, Edit2, Ruler, Scale, Calendar, Hash, X } from 'lucide-react';

interface Props {
  data: AppData;
}

export const PlantPlanner: React.FC<Props> = ({ data }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [partyCode, setPartyCode] = useState('');
  const [sizer, setSizer] = useState(''); 
  const [size, setSize] = useState('');
  const [coils, setCoils] = useState<string[]>(['']);
  const [micron, setMicron] = useState('');
  const [qty, setQty] = useState('');
  
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const partySuggestions = data.parties.filter(p => 
    p.name.toLowerCase().includes(partyCode.toLowerCase()) || 
    (p.code && p.code.toLowerCase().includes(partyCode.toLowerCase()))
  );

  const addCoil = () => setCoils([...coils, '']);
  const removeCoil = (index: number) => {
    if (coils.length > 1) {
      setCoils(coils.filter((_, i) => i !== index));
    }
  };
  const updateCoil = (index: number, val: string) => {
    const updated = [...coils];
    updated[index] = val;
    setCoils(updated);
  };

  const handleSave = async () => {
    if (!partyCode || !size || !qty || !sizer) return alert("Fill Party, Sizer, Size and Qty");
    
    const plan: PlantProductionPlan = {
      id: editingId || `plant-plan-${Date.now()}`,
      date,
      partyCode,
      sizer, 
      size,
      coils: coils.filter(c => c.trim() !== ''),
      micron: parseFloat(micron) || 0,
      qty: parseFloat(qty) || 0,
      status: editingId ? (data.plantProductionPlans.find(p => p.id === editingId)?.status || 'PENDING') : 'PENDING',
      createdAt: editingId ? (data.plantProductionPlans.find(p => p.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
    };

    await savePlantPlan(plan);
    resetForm();
    alert("Plant Plan Saved!");
  };

  const handleEdit = (plan: PlantProductionPlan) => {
    setEditingId(plan.id);
    setDate(plan.date);
    setPartyCode(plan.partyCode);
    setSizer(plan.sizer);
    setSize(plan.size);
    setCoils(plan.coils.length > 0 ? [...plan.coils] : ['']);
    setMicron(plan.micron.toString());
    setQty(plan.qty.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDuplicate = (plan: PlantProductionPlan) => {
    setDate(new Date().toISOString().split('T')[0]);
    setPartyCode(plan.partyCode);
    setSizer(plan.sizer);
    setSize(plan.size);
    setCoils([...plan.coils]);
    setMicron(plan.micron.toString());
    setQty(plan.qty.toString());
    setEditingId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingId(null);
    setDate(new Date().toISOString().split('T')[0]);
    setPartyCode('');
    setSizer('');
    setSize('');
    setCoils(['']);
    setMicron('');
    setQty('');
  };

  const filteredPlans = data.plantProductionPlans.filter(p => {
    const s = searchTerm.toLowerCase();
    return p.partyCode.toLowerCase().includes(s) || p.size.toLowerCase().includes(s) || (p.sizer && p.sizer.toLowerCase().includes(s));
  });

  return (
    <div className="flex flex-col xl:flex-row gap-8 items-start max-w-7xl mx-auto">
      
      {/* Redesigned Admin Form matching User Card style */}
      <div className="w-full xl:w-[480px] xl:sticky xl:top-24 z-30">
        <div className={`bg-white border-[2px] border-slate-900 overflow-hidden transition-all duration-300 ${editingId ? 'ring-4 ring-amber-100' : ''}`}>
          
          {/* HEADER SECTION */}
          <div className="grid grid-cols-12 border-b-[2px] border-slate-900">
            <div className="col-span-4 border-r-[2px] border-slate-900 p-2 bg-slate-100 flex items-center justify-center">
              <div className="text-center">
                <div className="text-[8px] font-black uppercase leading-none mb-0.5 text-slate-500">Mode</div>
                <div className="text-3xl font-black font-mono text-slate-900">{editingId ? 'EDIT' : 'NEW'}</div>
              </div>
            </div>
            <div className="col-span-8 p-2 flex items-center justify-center bg-white relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none flex items-center justify-center select-none text-6xl font-black italic">PLANNER</div>
               <div className="text-2xl font-black uppercase tracking-tighter text-slate-900 text-center">PLANT SCHEDULE</div>
            </div>
          </div>

          {/* PRIMARY INFO INPUTS */}
          <div className="grid grid-cols-3 border-b-[2px] border-slate-900 bg-slate-50">
            <div className="border-r-[1.5px] border-slate-900 p-1.5 flex flex-col">
              <label className="text-[7px] font-black uppercase text-slate-400 leading-none mb-1 flex items-center gap-1">
                <Calendar size={8} /> Date
              </label>
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)} 
                className="bg-transparent text-[10px] font-black font-mono leading-none w-full outline-none focus:text-indigo-600"
              />
            </div>
            <div className="border-r-[1.5px] border-slate-900 p-1.5 flex flex-col relative">
              <label className="text-[7px] font-black uppercase text-slate-400 leading-none mb-1 flex items-center gap-1">
                <Hash size={8} /> Party
              </label>
              <input 
                type="text" 
                value={partyCode} 
                onChange={e => { setPartyCode(e.target.value); setShowPartyDropdown(true); }}
                onFocus={() => setShowPartyDropdown(true)}
                onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)}
                placeholder="Search..."
                className="bg-transparent text-[10px] font-black font-mono truncate w-full uppercase leading-none outline-none focus:text-indigo-600"
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
            <div className="p-1.5 flex flex-col">
              <label className="text-[7px] font-black uppercase text-slate-400 leading-none mb-1">Sizer</label>
              <input 
                type="text" 
                value={sizer} 
                onChange={e => setSizer(e.target.value)} 
                placeholder="e.g. 500"
                className="bg-transparent text-[11px] font-black font-mono leading-none w-full uppercase outline-none focus:text-indigo-600"
              />
            </div>
          </div>

          {/* TECH SPECS INPUTS */}
          <div className="flex flex-col">
            <div className="grid grid-cols-2 border-b-[1.5px] border-slate-900">
              <div className="p-2 border-r-[1.5px] border-slate-900 text-[9px] font-black uppercase bg-white flex items-center gap-1 justify-center">
                <Ruler size={10} className="text-indigo-500" /> Tube :-
              </div>
              <div className="p-2 bg-white flex items-center justify-center gap-1">
                <input 
                  type="text" 
                  value={size} 
                  onChange={e => setSize(e.target.value)} 
                  placeholder="000"
                  className="w-16 text-xl font-black font-mono text-center outline-none focus:text-indigo-600 leading-none bg-transparent"
                />
                <span className="text-[8px] text-slate-400 font-normal">MM</span>
              </div>
            </div>
            <div className="grid grid-cols-2 border-b-[1.5px] border-slate-900">
              <div className="p-2 border-r-[1.5px] border-slate-900 text-[9px] font-black uppercase bg-white flex items-center gap-1 justify-center">
                <div className="w-3 h-3 rounded-full border border-amber-500 flex items-center justify-center text-[7px] font-bold">μ</div> Micron :-
              </div>
              <div className="p-2 bg-white flex items-center justify-center gap-1">
                <input 
                  type="number" 
                  value={micron} 
                  onChange={e => setMicron(e.target.value)} 
                  placeholder="00"
                  className="w-16 text-xl font-black font-mono text-center outline-none focus:text-amber-600 leading-none bg-transparent"
                />
                <span className="text-[8px] text-slate-400 font-normal italic font-serif">μm</span>
              </div>
            </div>
            <div className="grid grid-cols-2 border-b-[1.5px] border-slate-900">
              <div className="p-2 border-r-[1.5px] border-slate-900 text-[9px] font-black uppercase bg-white flex items-center gap-1 justify-center">
                <Scale size={10} className="text-emerald-500" /> Target :-
              </div>
              <div className="p-2 bg-white flex items-center justify-center gap-1">
                <input 
                  type="number" 
                  value={qty} 
                  onChange={e => setQty(e.target.value)} 
                  placeholder="0.00"
                  className="w-16 text-xl font-black font-mono text-center outline-none focus:text-emerald-600 leading-none bg-transparent"
                />
                <span className="text-[8px] text-slate-400 font-normal">KGS</span>
              </div>
            </div>

            {/* SIZES INPUT SUB-GRID */}
            <div className="grid grid-cols-12 min-h-[100px] bg-slate-50 border-b-[1.5px] border-slate-900">
              <div className="col-span-2 bg-amber-400 border-r-[1.5px] border-slate-900 p-1 flex items-center justify-center">
                <div className="text-[10px] font-black uppercase -rotate-90 tracking-tighter text-slate-900 whitespace-nowrap">SIZES</div>
              </div>
              <div className="col-span-10 p-2">
                <div className="grid grid-cols-4 gap-2">
                  {coils.map((c, i) => (
                    <div key={i} className="relative bg-white border border-slate-900 p-1 flex flex-col items-center justify-center rounded">
                      <span className="text-[6px] font-black text-slate-400 uppercase leading-none mb-1">S{i + 1}</span>
                      <input 
                        value={c} 
                        onChange={e => updateCoil(i, e.target.value)} 
                        className="w-full text-center text-[10px] font-black font-mono outline-none bg-transparent"
                        placeholder="000"
                      />
                      {coils.length > 1 && (
                        <button onClick={() => removeCoil(i)} className="absolute -top-1 -right-1 text-red-500 bg-white border border-slate-900 rounded-full w-3 h-3 flex items-center justify-center text-[8px] font-bold">×</button>
                      )}
                    </div>
                  ))}
                  <button 
                    onClick={addCoil}
                    className="border border-dashed border-slate-400 rounded flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-400 transition-colors bg-white/50"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="grid grid-cols-2">
            {editingId && (
              <button 
                onClick={resetForm}
                className="bg-slate-200 text-slate-600 font-black text-[10px] uppercase py-3 border-r-[2px] border-slate-900 hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            )}
            <button 
              onClick={handleSave}
              className={`font-black text-[11px] uppercase py-3 flex items-center justify-center gap-2 transition-all active:scale-95 ${editingId ? 'bg-amber-500 text-white col-span-1' : 'bg-slate-900 text-white col-span-2 hover:bg-black'}`}
            >
              <CheckCircle size={14} />
              {editingId ? 'Update Entry' : 'Post Production Schedule'}
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
                    <h3 className="text-lg font-bold text-slate-800 leading-none">Plant Queue</h3>
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
                              <th className="px-4 py-4">Date</th>
                              <th className="px-4 py-4">Party</th>
                              <th className="px-4 py-4">Sizer</th>
                              <th className="px-4 py-4">Tube</th>
                              <th className="px-4 py-4 text-center">μ</th>
                              <th className="px-4 py-4">Slits</th>
                              <th className="px-4 py-4 text-right">Target</th>
                              <th className="px-4 py-4 text-center">Status</th>
                              <th className="px-4 py-4 text-center">Action</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {filteredPlans.map(plan => (
                              <tr key={plan.id} className={`hover:bg-indigo-50/50 transition-all ${plan.status === 'COMPLETED' ? 'opacity-50 grayscale bg-slate-50' : ''}`}>
                                  <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-slate-500 font-mono">{plan.date.split('-').reverse().join('/')}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-xs font-black text-slate-800 uppercase">{plan.partyCode}</td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                      <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 border-[1.5px] border-slate-300 rounded uppercase tracking-tight font-mono">{plan.sizer}</span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-xs font-black text-slate-700 font-mono">{plan.size} MM</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-slate-500 text-center">{plan.micron}</td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                      <div className="flex flex-wrap gap-1">
                                          {plan.coils.map((c, i) => <span key={i} className="text-[9px] font-black bg-white border border-slate-900 px-1.5 py-0.5 rounded shadow-sm font-mono">{c}</span>)}
                                      </div>
                                  </td>
                                  <td className="px-4 py-3 text-right whitespace-nowrap text-xs font-black text-emerald-600">{plan.qty} <span className="text-[9px] text-slate-400">KG</span></td>
                                  <td className="px-4 py-3 text-center">
                                      {plan.status === 'COMPLETED' ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-emerald-500 text-emerald-600 text-[9px] font-black uppercase bg-emerald-50">DONE</span>
                                      ) : (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-amber-500 text-amber-600 text-[9px] font-black uppercase bg-amber-50">WAIT</span>
                                      )}
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
