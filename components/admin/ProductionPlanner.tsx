import React, { useState, useEffect, useRef } from 'react';
import { AppData, ProductionPlan } from '../../types';
import { saveProductionPlan, deleteProductionPlan, updateProductionPlan, saveDispatch } from '../../services/storageService';
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
  const [printName, setPrintName] = useState(''); 
  const [weight, setWeight] = useState('');
  const [micron, setMicron] = useState('');
  const [cuttingSize, setCuttingSize] = useState('');
  const [pcs, setPcs] = useState(''); // Changed to string input for cross-calc
  const [notes, setNotes] = useState('');
  
  // Calculated Fields
  const [calcMeter, setCalcMeter] = useState(0);
  
  // Calculation Mode to determine direction
  const [lastEdited, setLastEdited] = useState<'weight' | 'pcs'>('weight');

  // Search Party Suggestions
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);

  // --- FORMULA HELPERS ---
  const getAllowance = (type: string) => {
      const t = type.toLowerCase();
      if (t.includes('seal')) return 5;
      if (t.includes('round')) return 15;
      return 0;
  };

  const getExtraMeter = (type: string) => {
      return type === 'Printing' ? 200 : 0;
  };

  // --- CALCULATION LOGIC ---
  const calculate = () => {
      const s = parseFloat(size) || 0;
      const m = parseFloat(micron) || 0;
      const cut = parseFloat(cuttingSize) || 0;
      
      // Constants
      const DENSITY = 0.00280;
      const allowance = getAllowance(planType);
      const extraMeter = getExtraMeter(planType);
      const effectiveCutSize = cut + allowance; // mm

      if (s > 0 && m > 0) {
          if (lastEdited === 'weight') {
              // DRIVE: Weight -> Pcs
              const w = parseFloat(weight) || 0;
              
              // 1. Calculate Total Meter from Weight
              // Formula: Weight = Meter * Size * Micron * 0.00280 / 1000
              // => Meter = (Weight * 1000) / (Size * Micron * 0.00280)
              const totalMeter = (w * 1000) / (s * m * DENSITY);
              
              setCalcMeter(Math.floor(totalMeter));

              // 2. Calculate Pcs from Available Meter
              // Total Meter = (EffectiveCutSize * Pcs / 1000) + ExtraMeter
              // => Pcs = (TotalMeter - ExtraMeter) * 1000 / EffectiveCutSize
              if (effectiveCutSize > 0) {
                  const availableMeter = totalMeter - extraMeter;
                  const calculatedPcs = (availableMeter * 1000) / effectiveCutSize;
                  setPcs(calculatedPcs > 0 ? Math.floor(calculatedPcs).toString() : '0');
              } else {
                  setPcs('0');
              }

          } else {
              // DRIVE: Pcs -> Weight
              const p = parseFloat(pcs) || 0;

              // 1. Calculate Required Meter from Pcs
              // Meter for Cutting = EffectiveCutSize * Pcs / 1000
              const cuttingMeter = (effectiveCutSize * p) / 1000;
              const totalMeter = cuttingMeter + extraMeter;

              setCalcMeter(Math.ceil(totalMeter));

              // 2. Calculate Weight from Total Meter
              // Weight = TotalMeter * Size * Micron * 0.00280 / 1000
              const calculatedWeight = (totalMeter * s * m * DENSITY) / 1000;
              setWeight(calculatedWeight > 0 ? calculatedWeight.toFixed(2) : '0');
          }
      }
  };

  // Trigger calculation when dependencies change
  useEffect(() => {
      calculate();
  }, [size, micron, cuttingSize, planType, lastEdited === 'weight' ? weight : pcs]); 
  // Note: We don't include the other variable in dependency to avoid loop, handled by 'lastEdited' check inside.

  const handleWeightChange = (val: string) => {
      setWeight(val);
      setLastEdited('weight');
  };

  const handlePcsChange = (val: string) => {
      setPcs(val);
      setLastEdited('pcs');
  };

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
      setPcs(plan.pcs.toString()); // Load Pcs
      setLastEdited('weight'); // Default to weight priority on edit, or could be 'pcs'
      setNotes(plan.notes || '');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSavePlan = async () => {
    if (!partyName || !size || !weight) return alert("Please fill Party, Size and Weight");

    const w = parseFloat(weight) || 0;
    const p = parseFloat(pcs) || 0;
    const cut = parseFloat(cuttingSize) || 0;

    // Construct Payload safely
    const basePayload = {
        date,
        partyName,
        size,
        type: planType,
        printName: planType === 'Printing' ? printName : "",
        weight: w,
        micron: parseFloat(micron) || 0,
        meter: calcMeter,
        cuttingSize: cut,
        pcs: p,
        notes,
    };

    if (editingId) {
        // 1. UPDATE PLAN RECORD
        await updateProductionPlan({
            id: editingId,
            ...basePayload
        });

        // 2. CASCADE UPDATE TO LINKED JOB CARDS
        const linkedDispatches = data.dispatches.filter(d => 
            d.rows.some(r => r.planId === editingId)
        );

        if (linkedDispatches.length > 0) {
            console.log(`Cascading update to ${linkedDispatches.length} jobs...`);
            for (const d of linkedDispatches) {
                let modified = false;
                const newRows = d.rows.map(r => {
                    if (r.planId === editingId) {
                        modified = true;
                        
                        let mappedType = "";
                        const upper = planType.toUpperCase();
                        if(upper.includes("SEAL")) mappedType = "ST.SEAL";
                        else if(upper.includes("ROUND")) mappedType = "ROUND";
                        else if(upper.includes("OPEN")) mappedType = "OPEN";
                        else if(upper.includes("INTAS")) mappedType = "INTAS";
                        else if(upper.includes("LABEL")) mappedType = "LABEL";
                        else if(upper.includes("ROLL")) mappedType = "ROLL";

                        let displaySize = cut > 0 ? `${size}x${cut}` : size;
                        if (planType === 'Printing' && printName) {
                            displaySize = `${displaySize} (${printName})`;
                        }

                        const currentDispWt = r.weight || 0;
                        const newWastage = w > 0 ? w - currentDispWt : 0;

                        return {
                            ...r,
                            size: displaySize,
                            sizeType: mappedType,
                            micron: parseFloat(micron) || 0,
                            productionWeight: w,
                            wastage: newWastage,
                            // Note: We do NOT auto-update pcs in dispatch as that's actual packing count
                        };
                    }
                    return r;
                });

                if (modified) {
                    await saveDispatch({
                        ...d,
                        rows: newRows,
                        updatedAt: new Date().toISOString()
                    });
                }
            }
            alert("Plan Updated & Synced to Active Jobs Successfully");
        } else {
            alert("Plan Updated Successfully");
        }
        
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

    // Reset
    setPartyName(''); setSize(''); setWeight(''); setMicron(''); setCuttingSize(''); setNotes(''); setPrintName(''); setPcs('');
    setPlanType('Printing');
    setLastEdited('weight');
  };

  const handleCancelEdit = () => {
      setEditingId(null);
      setPartyName(''); setSize(''); setWeight(''); setMicron(''); setCuttingSize(''); setNotes(''); setPrintName(''); setPcs('');
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

  // Sort plans: Pending first, then by date descending
  const sortedPlans = [...data.productionPlans].sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
        
        {/* Toggle Mode */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-full max-w-md mx-auto">
           <button onClick={() => setActiveMode('printing')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeMode==='printing'?'bg-white text-indigo-600 shadow-sm':'text-slate-500'}`}>Printing / Cutting</button>
           <button onClick={() => setActiveMode('slitting')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeMode==='slitting'?'bg-white text-indigo-600 shadow-sm':'text-slate-500'}`}>Slitting</button>
        </div>

        {activeMode === 'slitting' ? (
            <SlittingManager data={data} />
        ) : (
            <div className="flex flex-col lg:flex-row gap-8 items-start">
                
                {/* 1. Form Section - Redesigned */}
                <div className={`w-full lg:w-1/3 bg-white rounded-3xl shadow-sm border ${editingId ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'} p-6 transition-all sticky top-24`}>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <span className="text-xl">{editingId ? '✏️' : '✨'}</span>
                            {editingId ? 'Edit Plan' : 'Create Plan'}
                        </h3>
                        {editingId && <button onClick={handleCancelEdit} className="text-xs font-bold text-slate-400 hover:text-slate-600">Cancel</button>}
                    </div>

                    <div className="space-y-5">
                        {/* Group 1: Basics */}
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Date & Party</label>
                                <div className="flex gap-2">
                                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-1/3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                                    <div className="relative flex-1">
                                        <input 
                                            type="text" 
                                            value={partyName} 
                                            onChange={e => { setPartyName(e.target.value); setShowPartyDropdown(true); }}
                                            onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)}
                                            placeholder="Party Name" 
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" 
                                        />
                                        {showPartyDropdown && partyName && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                {partySuggestions.map(p => (
                                                    <div key={p.id} className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-xs font-bold text-slate-700" onClick={() => { setPartyName(p.name); setShowPartyDropdown(false); }}>{p.name}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Job Type</label>
                                <select value={planType} onChange={e => setPlanType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500">
                                    {PLAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Group 2: Specs */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Specifications</label>
                            <div className="grid grid-cols-3 gap-2">
                                <input type="number" value={size} onChange={e => setSize(e.target.value)} placeholder="Size" className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500 text-center" />
                                <input type="number" value={micron} onChange={e => setMicron(e.target.value)} placeholder="Mic" className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500 text-center" />
                                <input type="number" value={cuttingSize} onChange={e => setCuttingSize(e.target.value)} placeholder="Cut" className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500 text-center" />
                            </div>
                        </div>

                        {planType === 'Printing' && (
                            <div className="animate-in fade-in slide-in-from-top-1">
                                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">Print Name</label>
                                <input 
                                    type="text" 
                                    value={printName} 
                                    onChange={e => setPrintName(e.target.value)} 
                                    placeholder="Design Name" 
                                    className="w-full bg-indigo-50/50 border border-indigo-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500 text-indigo-700" 
                                />
                            </div>
                        )}

                        {/* Group 3: Calculator */}
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-slate-300"></div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 pl-2">Production Calculator</label>
                            
                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <label className="text-[9px] font-bold text-indigo-600 mb-1 block">Weight (kg)</label>
                                    <input 
                                        type="number" 
                                        value={weight} 
                                        onChange={e => handleWeightChange(e.target.value)} 
                                        placeholder="0" 
                                        className={`w-full border rounded-xl p-2 text-sm font-bold text-center outline-none transition-all ${lastEdited === 'weight' ? 'border-indigo-500 shadow-sm ring-1 ring-indigo-200 bg-white' : 'border-slate-200 bg-slate-100'}`} 
                                    />
                                </div>
                                <div className="text-slate-300">↔</div>
                                <div className="flex-1">
                                    <label className="text-[9px] font-bold text-emerald-600 mb-1 block">Pieces</label>
                                    <input 
                                        type="number" 
                                        value={pcs} 
                                        onChange={e => handlePcsChange(e.target.value)} 
                                        placeholder="0" 
                                        className={`w-full border rounded-xl p-2 text-sm font-bold text-center outline-none transition-all ${lastEdited === 'pcs' ? 'border-emerald-500 shadow-sm ring-1 ring-emerald-200 bg-white' : 'border-slate-200 bg-slate-100'}`} 
                                    />
                                </div>
                            </div>
                            
                            <div className="mt-3 flex justify-between items-center text-[10px] font-mono text-slate-500 border-t border-slate-200 pt-2">
                                <span>Meter: <b className="text-slate-700">{calcMeter}</b></span>
                                {(planType === 'Printing' || getAllowance(planType) > 0) && (
                                    <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                                        Waste Incl.
                                    </span>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Notes</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium h-16 resize-none outline-none focus:border-indigo-500" placeholder="Optional notes..."></textarea>
                        </div>

                        <button 
                            onClick={handleSavePlan} 
                            className={`w-full text-white font-bold py-3 rounded-xl shadow-lg transition-transform active:scale-[0.98] ${editingId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-900 hover:bg-black'}`}
                        >
                            {editingId ? 'Update Plan' : 'Add to Queue'}
                        </button>
                    </div>
                </div>

                {/* 2. List Section - Redesigned as Table */}
                <div className="w-full lg:w-2/3 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-slate-800">Production Queue</h3>
                            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full">{sortedPlans.length}</span>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Party / Job</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Dimensions</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Metrics</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Target</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sortedPlans.map(plan => {
                                        const isCompleted = plan.status === 'COMPLETED';
                                        const sizeDisplay = plan.cuttingSize > 0 ? `${plan.size} x ${plan.cuttingSize}` : plan.size;
                                        
                                        return (
                                            <tr key={plan.id} className={`hover:bg-slate-50 transition-colors ${isCompleted ? 'opacity-60 bg-slate-50/50' : ''}`}>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="font-mono text-xs font-bold text-slate-600">{plan.date.split('-').slice(1).join('/')}</span>
                                                </td>
                                                <td className="px-4 py-3 max-w-[150px]">
                                                    <div className="font-bold text-xs text-slate-800 truncate" title={plan.partyName}>{plan.partyName}</div>
                                                    <div className="text-[10px] font-bold text-indigo-600 uppercase">{plan.type}</div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="font-mono text-xs font-bold text-slate-700">{sizeDisplay}</div>
                                                    {plan.printName && <div className="text-[9px] text-purple-600 font-bold truncate max-w-[100px]">{plan.printName}</div>}
                                                </td>
                                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                                    <div className="text-xs font-bold text-slate-800">{plan.weight} <span className="text-[9px] text-slate-400 font-normal">kg</span></div>
                                                    <div className="flex justify-end gap-2 text-[10px] font-mono mt-0.5">
                                                        <span className="text-slate-500">{plan.micron}µ</span>
                                                        <span className="text-indigo-600 font-bold">{plan.meter}m</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                                    <div className="text-xs font-bold text-emerald-600">{plan.pcs}</div>
                                                    <div className="text-[9px] text-slate-400">Pcs</div>
                                                </td>
                                                <td className="px-4 py-3 text-center whitespace-nowrap">
                                                    {isCompleted ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                                            ✓ Taken
                                                        </span>
                                                    ) : (
                                                        <span className="inline-block px-2 py-1 rounded bg-slate-100 text-slate-500 text-[10px] font-bold border border-slate-200">
                                                            Pending
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center whitespace-nowrap">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button onClick={() => handleEdit(plan)} className="text-slate-400 hover:text-indigo-600 transition-colors p-1" title="Edit">
                                                            ✏️
                                                        </button>
                                                        <button onClick={() => handleDelete(plan.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1" title="Delete">
                                                            ✕
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {sortedPlans.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-sm italic">
                                                No plans found. Add a new plan to get started.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};