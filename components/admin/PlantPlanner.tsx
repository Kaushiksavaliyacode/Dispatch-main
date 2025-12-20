
import React, { useState } from 'react';
import { AppData, PlantProductionPlan } from '../../types';
import { savePlantPlan, deletePlantPlan } from '../../services/storageService';
import { Factory, Plus, Trash2, CheckCircle, Search, Copy, Edit2 } from 'lucide-react';

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
    <div className="flex flex-col xl:flex-row gap-6 items-start">
      <div className={`w-full xl:w-[400px] bg-white rounded-2xl shadow-xl border border-slate-100 p-6 xl:sticky xl:top-24 z-30 ${editingId ? 'ring-2 ring-emerald-500' : ''}`}>
        <div className="flex justify-between items-center mb-6 border-b border-slate-50 pb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Factory className="text-emerald-600" />
                {editingId ? 'Edit Plant Plan' : 'New Plant Plan'}
            </h3>
            {editingId && <button onClick={resetForm} className="text-xs font-bold text-slate-400 hover:text-red-500">Cancel</button>}
        </div>

        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500 transition-all" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sizer</label>
                    <input 
                      type="text" 
                      value={sizer} 
                      onChange={e => setSizer(e.target.value)} 
                      placeholder="e.g. 500" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500 transition-all" 
                    />
                </div>
            </div>

            <div className="relative space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Party Code / Name</label>
                <input 
                    type="text" 
                    value={partyCode} 
                    onChange={e => { setPartyCode(e.target.value); setShowPartyDropdown(true); }}
                    onFocus={() => setShowPartyDropdown(true)}
                    onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)}
                    placeholder="Search Party..." 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-emerald-500 transition-all" 
                />
                {showPartyDropdown && partyCode && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar p-1">
                        {partySuggestions.map(p => (
                            <div key={p.id} className="px-3 py-2 hover:bg-emerald-50 rounded-lg cursor-pointer text-xs font-bold text-slate-700" onClick={() => { setPartyCode(p.code || p.name); setShowPartyDropdown(false); }}>
                                {p.name} <span className="text-[10px] text-slate-400 ml-1">[{p.code}]</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tube Size (mm)</label>
                    <input type="text" value={size} onChange={e => setSize(e.target.value)} placeholder="e.g. 655" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-emerald-500 transition-all" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Micron</label>
                    <input type="number" value={micron} onChange={e => setMicron(e.target.value)} placeholder="0" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-emerald-500 transition-all" />
                </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Slitting Sizes (mm)</label>
                    <button onClick={addCoil} className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 flex items-center gap-1 hover:bg-emerald-100 transition-all">
                        <Plus size={10} /> Add
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {coils.map((c, i) => (
                        <div key={i} className="relative group">
                            <input 
                                value={c} 
                                onChange={e => updateCoil(i, e.target.value)} 
                                placeholder={`Size ${i+1}`} 
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:border-emerald-500" 
                            />
                            {coils.length > 1 && (
                                <button onClick={() => removeCoil(i)} className="absolute -top-1.5 -right-1.5 bg-white border border-slate-200 text-red-500 rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">✕</button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quantity (kg)</label>
                <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0.00" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 transition-all shadow-sm" />
            </div>

            <button onClick={handleSave} className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3.5 rounded-xl shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 mt-4">
                <CheckCircle size={18} />
                {editingId ? 'Update Plant Plan' : 'Save Production Plan'}
            </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 w-full">
          <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200 gap-3">
              <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                    <Factory size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 leading-none">Plant Queue</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">Industrial Production Logs</p>
                  </div>
              </div>
              <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text" 
                    placeholder="Search plans..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-100"
                  />
              </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden min-h-[500px]">
              <div className="overflow-x-auto custom-scrollbar h-[600px]">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead className="sticky top-0 z-20 bg-slate-900 text-white text-[10px] uppercase tracking-wider">
                          <tr>
                              <th className="px-4 py-4 font-bold">Date</th>
                              <th className="px-4 py-4 font-bold">Party</th>
                              <th className="px-4 py-4 font-bold">Sizer</th>
                              <th className="px-4 py-4 font-bold">Tube Size</th>
                              <th className="px-4 py-4 font-bold">Micron</th>
                              <th className="px-4 py-4 font-bold">Coils</th>
                              <th className="px-4 py-4 font-bold text-right">Qty</th>
                              <th className="px-4 py-4 font-bold text-center">Status</th>
                              <th className="px-4 py-4 font-bold text-center">Action</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {filteredPlans.map(plan => (
                              <tr key={plan.id} className={`hover:bg-emerald-50/30 transition-all ${plan.status === 'COMPLETED' ? 'opacity-60 grayscale bg-slate-50' : ''}`}>
                                  <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-slate-500 font-mono">{plan.date.split('-').reverse().join('/')}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-slate-800">{plan.partyCode}</td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                      <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-tight">{plan.sizer}</span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-slate-700">{plan.size}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-slate-500">{plan.micron}</td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                      <div className="flex flex-wrap gap-1">
                                          {plan.coils.map((c, i) => <span key={i} className="text-[9px] font-bold bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">{c}</span>)}
                                      </div>
                                  </td>
                                  <td className="px-4 py-3 text-right whitespace-nowrap text-xs font-bold text-emerald-600">{plan.qty} <span className="text-[9px] text-slate-400 uppercase">kg</span></td>
                                  <td className="px-4 py-3 text-center">
                                      {plan.status === 'COMPLETED' ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold border border-emerald-200">✓ Completed</span>
                                      ) : (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[9px] font-bold border border-amber-200">• Pending</span>
                                      )}
                                  </td>
                                  <td className="px-4 py-3">
                                      <div className="flex justify-center gap-2">
                                          <button onClick={() => handleDuplicate(plan)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded shadow-sm border border-blue-100 transition-colors" title="Duplicate"><Copy size={12} /></button>
                                          <button onClick={() => handleEdit(plan)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded shadow-sm border border-indigo-100 transition-colors"><Edit2 size={12} /></button>
                                          <button onClick={() => { if(confirm("Delete this plant plan?")) deletePlantPlan(plan.id); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded shadow-sm border border-red-100 transition-colors"><Trash2 size={12} /></button>
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
