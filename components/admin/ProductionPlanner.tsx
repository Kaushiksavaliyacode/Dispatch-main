import React, { useState, useEffect } from 'react';
import { AppData, ProductionPlan } from '../../types';
import { saveProductionPlan, deleteProductionPlan, updateProductionPlan } from '../../services/storageService';
import { SlittingManager } from './SlittingManager';

interface Props {
  data: AppData;
}

const PLAN_TYPES = ["Printing", "Roll", "Winder", "St. Seal", "Round", "Open", "Intas"];

export const ProductionPlanner: React.FC<Props> = ({ data }) => {
  const [activeMode, setActiveMode] = useState<'printing' | 'slitting'>('printing');

  // Printing/Cutting Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [partyName, setPartyName] = useState('');
  const [size, setSize] = useState('');
  const [planType, setPlanType] = useState('Printing');
  const [printName, setPrintName] = useState(''); // NEW STATE
  const [weight, setWeight] = useState('');
  const [micron, setMicron] = useState('');
  const [cuttingSize, setCuttingSize] = useState('');
  const [notes, setNotes] = useState('');
  
  // Calculated Fields
  const [calcMeter, setCalcMeter] = useState(0);
  const [calcPcs, setCalcPcs] = useState(0);

  // Search Party Suggestions
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);

  // Auto Calculate Formula
  useEffect(() => {
    const w = parseFloat(weight) || 0;
    const m = parseFloat(micron) || 0;
    const s = parseFloat(size) || 0;
    const cut = parseFloat(cuttingSize) || 0;

    // Meter = (Weight / Micron / 0.00280 / Size) * 1000
    // Remove numbers after decimal point (Math.floor or Math.round)
    let meter = 0;
    if (w > 0 && m > 0 && s > 0) {
        const rawMeter = (w / m / 0.00280 / s) * 1000;
        meter = Math.trunc(rawMeter); 
    }
    setCalcMeter(meter);

    // Pcs = (Meter / Cutting Size) * 1000
    let pcs = 0;
    if (meter > 0 && cut > 0) {
        const rawPcs = (meter / cut) * 1000;
        pcs = Math.trunc(rawPcs);
    }
    setCalcPcs(pcs);

  }, [weight, micron, size, cuttingSize]);

  const handleEdit = (plan: ProductionPlan) => {
      setEditingId(plan.id);
      setDate(plan.date);
      setPartyName(plan.partyName);
      setSize(plan.size);
      setPlanType(plan.type);
      setPrintName(plan.printName || '');
      setWeight(plan.weight.toString());
      setMicron(plan.micron.toString());
      setCuttingSize(plan.cuttingSize > 0 ? plan.cuttingSize.toString() : '');
      setNotes(plan.notes || '');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSavePlan = async () => {
    if (!partyName || !size || !weight) return alert("Please fill Party, Size and Weight");

    // Construct Payload safely
    const basePayload = {
        date,
        partyName,
        size,
        type: planType,
        printName: planType === 'Printing' ? printName : "", // Send empty string instead of undefined
        weight: parseFloat(weight) || 0,
        micron: parseFloat(micron) || 0,
        meter: calcMeter,
        cuttingSize: parseFloat(cuttingSize) || 0,
        pcs: calcPcs,
        notes,
    };

    if (editingId) {
        // UPDATE EXISTING
        await updateProductionPlan({
            id: editingId,
            ...basePayload
        });
        alert("Plan Updated Successfully");
        setEditingId(null);
    } else {
        // CREATE NEW
        const newPlan: ProductionPlan = {
            id: `plan-${Date.now()}`,
            ...basePayload,
            status: 'PENDING',
            createdAt: new Date().toISOString()
        };
        await saveProductionPlan(newPlan);
        alert("Plan Saved Successfully");
    }

    // Reset specific fields
    setPartyName(''); setSize(''); setWeight(''); setMicron(''); setCuttingSize(''); setNotes(''); setPrintName('');
    setPlanType('Printing');
  };

  const handleCancelEdit = () => {
      setEditingId(null);
      setPartyName(''); setSize(''); setWeight(''); setMicron(''); setCuttingSize(''); setNotes(''); setPrintName('');
      setPlanType('Printing');
  };

  const handleDelete = async (id: string) => {
      if(confirm("Delete this plan?")) {
          await deleteProductionPlan(id);
          if (editingId === id) handleCancelEdit();
      }
  };

  const partySuggestions = data.parties.filter(p => 
    p.name.toLowerCase().includes(partyName.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Toggle Mode */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-full max-w-md mx-auto mb-6">
           <button onClick={() => setActiveMode('printing')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeMode==='printing'?'bg-white text-indigo-600 shadow-sm':'text-slate-500'}`}>Printing / Cutting</button>
           <button onClick={() => setActiveMode('slitting')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeMode==='slitting'?'bg-white text-indigo-600 shadow-sm':'text-slate-500'}`}>Slitting</button>
        </div>

        {activeMode === 'slitting' ? (
            <SlittingManager data={data} />
        ) : (
            <div className="space-y-6">
                {/* Planning Form */}
                <div className={`bg-white rounded-2xl shadow-lg border ${editingId ? 'border-amber-300 ring-2 ring-amber-100' : 'border-indigo-100'} overflow-hidden max-w-3xl mx-auto transition-all`}>
                    <div className={`${editingId ? 'bg-amber-500' : 'bg-indigo-600'} px-6 py-4 flex items-center justify-between`}>
                        <div className="flex items-center gap-3">
                            <span className="text-2xl text-white">{editingId ? '✏️' : '📝'}</span>
                            <h3 className="text-white font-bold text-lg">{editingId ? 'Edit Job Plan' : 'Create Job Plan'}</h3>
                        </div>
                        {editingId && <button onClick={handleCancelEdit} className="text-white text-xs font-bold border border-white/30 px-3 py-1 rounded hover:bg-white/20">Cancel Edit</button>}
                    </div>
                    
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Date</label>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-bold" />
                            </div>
                            <div className="relative">
                                <label className="text-xs font-bold text-slate-500 block mb-1">Party Name</label>
                                <input 
                                    type="text" 
                                    value={partyName} 
                                    onChange={e => { setPartyName(e.target.value); setShowPartyDropdown(true); }}
                                    onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)}
                                    placeholder="Enter Party" 
                                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-bold" 
                                />
                                {showPartyDropdown && partyName && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                        {partySuggestions.map(p => (
                                            <div key={p.id} className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-bold text-slate-800" onClick={() => { setPartyName(p.name); setShowPartyDropdown(false); }}>{p.name}</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Size (mm)</label>
                                <input type="number" value={size} onChange={e => setSize(e.target.value)} placeholder="0" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-center" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Type</label>
                                <select value={planType} onChange={e => setPlanType(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-bold outline-none">
                                    {PLAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Weight (kg)</label>
                                <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="0" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-center" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Micron</label>
                                <input type="number" value={micron} onChange={e => setMicron(e.target.value)} placeholder="0" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-center" />
                            </div>
                        </div>
                        
                        {/* Printing Specific Field */}
                        {planType === 'Printing' && (
                            <div className="animate-in fade-in duration-300">
                                <label className="text-xs font-bold text-indigo-600 block mb-1">Which Print Name?</label>
                                <input 
                                    type="text" 
                                    value={printName} 
                                    onChange={e => setPrintName(e.target.value)} 
                                    placeholder="e.g. Rose Pattern, Blue Line..." 
                                    className="w-full border-2 border-indigo-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-indigo-500" 
                                />
                            </div>
                        )}

                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">Cutting Size (Optional)</label>
                            <input type="number" value={cuttingSize} onChange={e => setCuttingSize(e.target.value)} placeholder="0" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-center" />
                        </div>

                        {/* Calculations Display */}
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-2 gap-4">
                            <div className="text-center">
                                <div className="text-xs font-bold text-slate-400 uppercase">Calculated Meter</div>
                                <div className="text-xl font-bold text-indigo-600">{calcMeter} <span className="text-xs text-slate-400">m</span></div>
                            </div>
                            <div className="text-center border-l border-slate-200">
                                <div className="text-xs font-bold text-slate-400 uppercase">Calculated Pcs</div>
                                <div className="text-xl font-bold text-indigo-600">{calcPcs} <span className="text-xs text-slate-400">pcs</span></div>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">Note (Optional)</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-sm font-medium h-20 resize-none" placeholder="Special instructions..."></textarea>
                        </div>

                        <button 
                            onClick={handleSavePlan} 
                            className={`w-full text-white font-bold py-3.5 rounded-xl shadow-lg transition-transform active:scale-[0.99] ${editingId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                        >
                            {editingId ? 'Update Plan' : 'Save Plan'}
                        </button>
                    </div>
                </div>

                {/* Active Plans List */}
                <div className="max-w-4xl mx-auto">
                    <h3 className="text-lg font-bold text-slate-700 mb-4 px-2">Active Plans</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {data.productionPlans.filter(p => p.status === 'PENDING').map(plan => (
                            <div key={plan.id} className={`bg-white rounded-xl shadow-sm border p-4 relative group hover:shadow-md transition-all ${editingId === plan.id ? 'border-amber-400 ring-2 ring-amber-50' : 'border-slate-200'}`}>
                                <div className="absolute top-2 right-2 flex gap-1">
                                    <button onClick={() => handleEdit(plan)} className="text-slate-400 hover:text-indigo-600 font-bold p-1 transition-colors" title="Edit">✏️</button>
                                    <button onClick={() => handleDelete(plan.id)} className="text-slate-400 hover:text-red-500 font-bold p-1 transition-colors" title="Delete">✕</button>
                                </div>
                                <div className="flex justify-between items-start mb-2 pr-14">
                                    <div className="font-bold text-slate-800 text-lg">{plan.partyName}</div>
                                    <div className="flex flex-col items-end">
                                        <div className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded border border-indigo-100">{plan.date}</div>
                                        <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{plan.type}</div>
                                    </div>
                                </div>
                                {plan.type === 'Printing' && plan.printName && (
                                    <div className="mb-2 text-xs font-bold text-white bg-indigo-500 px-2 py-1 rounded inline-block">
                                        Print: {plan.printName}
                                    </div>
                                )}
                                <div className="grid grid-cols-3 gap-2 text-xs mb-3 border-b border-slate-50 pb-2">
                                    <div><span className="text-slate-400 block text-[10px] uppercase">Size</span><span className="font-bold text-slate-700">{plan.size}</span></div>
                                    <div><span className="text-slate-400 block text-[10px] uppercase">Micron</span><span className="font-bold text-slate-700">{plan.micron}</span></div>
                                    <div><span className="text-slate-400 block text-[10px] uppercase">Weight</span><span className="font-bold text-slate-700">{plan.weight}</span></div>
                                </div>
                                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                                    <div className="text-center">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase">Meter</div>
                                        <div className="font-mono font-bold text-slate-800">{plan.meter}</div>
                                    </div>
                                    <div className="w-px h-6 bg-slate-200"></div>
                                    <div className="text-center">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase">Cut Size</div>
                                        <div className="font-mono font-bold text-slate-800">{plan.cuttingSize}</div>
                                    </div>
                                    <div className="w-px h-6 bg-slate-200"></div>
                                    <div className="text-center">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase">Pcs</div>
                                        <div className="font-mono font-bold text-emerald-600">{plan.pcs}</div>
                                    </div>
                                </div>
                                {plan.notes && (
                                    <div className="mt-2 text-xs text-slate-500 italic bg-amber-50 p-2 rounded border border-amber-100">
                                        "{plan.notes}"
                                    </div>
                                )}
                            </div>
                        ))}
                         {data.productionPlans.filter(p => p.status === 'PENDING').length === 0 && (
                             <div className="col-span-full text-center py-8 text-slate-400 text-sm">No Pending Plans</div>
                         )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};