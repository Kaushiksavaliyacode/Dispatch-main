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
                                <label className="text-xs font-bold text-slate-500 block mb-1">Micron</label>
                                <input type="number" value={micron} onChange={e => setMicron(e.target.value)} placeholder="0" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-center" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Cutting Size</label>
                                <input type="number" value={cuttingSize} onChange={e => setCuttingSize(e.target.value)} placeholder="0" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-center" />
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

                        {/* Bidirectional Inputs */}
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div>
                                <label className="text-xs font-bold text-indigo-600 block mb-1 uppercase">Weight (kg)</label>
                                <input 
                                    type="number" 
                                    value={weight} 
                                    onChange={e => handleWeightChange(e.target.value)} 
                                    placeholder="0" 
                                    className={`w-full border-2 rounded-lg p-2.5 text-lg font-bold text-center ${lastEdited === 'weight' ? 'border-indigo-500 bg-white shadow-sm' : 'border-slate-300 bg-slate-100'}`} 
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-emerald-600 block mb-1 uppercase">Target Pcs</label>
                                <input 
                                    type="number" 
                                    value={pcs} 
                                    onChange={e => handlePcsChange(e.target.value)} 
                                    placeholder="0" 
                                    className={`w-full border-2 rounded-lg p-2.5 text-lg font-bold text-center ${lastEdited === 'pcs' ? 'border-emerald-500 bg-white shadow-sm' : 'border-slate-300 bg-slate-100'}`} 
                                />
                            </div>
                        </div>

                        {/* Calculations Display */}
                        <div className="flex justify-center items-center py-2">
                            <div className="text-center">
                                <div className="text-xs font-bold text-slate-400 uppercase">Calculated Meter</div>
                                <div className="text-3xl font-mono font-bold text-slate-700">{calcMeter} <span className="text-sm text-slate-400">m</span></div>
                                {(planType === 'Printing' || getAllowance(planType) > 0) && (
                                    <div className="text-[10px] text-slate-400 mt-1">
                                        Includes: {planType === 'Printing' ? '+200m Print Waste' : ''} 
                                        {getAllowance(planType) > 0 ? ` & +${getAllowance(planType)}mm Cut Allowance` : ''}
                                    </div>
                                )}
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

                {/* Plans List */}
                <div className="max-w-7xl mx-auto px-4 pb-12">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-8 w-1 bg-indigo-600 rounded-full"></div>
                        <h3 className="text-xl font-bold text-slate-800">Production Plans</h3>
                        <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-full">{sortedPlans.length}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {sortedPlans.map(plan => {
                            const sizeDisplay = plan.cuttingSize > 0 ? `${plan.size} x ${plan.cuttingSize}` : plan.size;
                            const isCompleted = plan.status === 'COMPLETED';
                            
                            return (
                                <div key={plan.id} className={`group relative bg-white rounded-2xl border shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col ${isCompleted ? 'border-slate-200 opacity-80' : 'border-indigo-100 ring-1 ring-indigo-50'}`}>
                                    {/* Edit Overlay */}
                                    <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <button onClick={() => handleEdit(plan)} className="bg-white text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg shadow-sm border border-slate-200 transition-colors" title="Edit">
                                            ✏️
                                        </button>
                                        <button onClick={() => handleDelete(plan.id)} className="bg-white text-red-500 hover:bg-red-50 p-2 rounded-lg shadow-sm border border-slate-200 transition-colors" title="Delete">
                                            ✕
                                        </button>
                                    </div>

                                    {/* Status Badge Over Image */}
                                    {isCompleted && (
                                        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 z-20"></div>
                                    )}

                                    <div className="p-5 flex-1 flex flex-col">
                                        {/* Header Badges */}
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2.5 py-1 rounded-md border border-slate-200 uppercase tracking-wide">
                                                {plan.date.split('-').slice(1).join('/')}
                                            </span>
                                            {isCompleted ? (
                                                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-md border border-emerald-200 uppercase tracking-wide flex items-center gap-1">
                                                    ✓ Taken
                                                </span>
                                            ) : (
                                                <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2.5 py-1 rounded-md border border-indigo-100 uppercase tracking-wide">
                                                    {plan.type}
                                                </span>
                                            )}
                                        </div>

                                        {/* Party Name */}
                                        <h3 className={`text-lg font-bold mb-1 leading-snug line-clamp-2 ${isCompleted ? 'text-slate-500' : 'text-slate-800'}`} title={plan.partyName}>
                                            {plan.partyName}
                                        </h3>

                                        {/* Size Display */}
                                        <div className="text-sm font-bold text-slate-600 mb-4 flex flex-wrap items-center gap-2">
                                            <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100 text-slate-700 font-mono">
                                                {sizeDisplay}
                                            </span>
                                            {plan.printName && (
                                                <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200 font-bold truncate max-w-[150px]">
                                                    {plan.printName}
                                                </span>
                                            )}
                                        </div>

                                        {/* Metrics Grid */}
                                        <div className="grid grid-cols-3 gap-3 py-3 border-t border-b border-slate-50 bg-slate-50/50 rounded-xl px-2 mb-3">
                                            <div className="text-center">
                                                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Weight</div>
                                                <div className="text-sm font-bold text-slate-700">{plan.weight} <span className="text-[9px] text-slate-400">kg</span></div>
                                            </div>
                                            <div className="text-center border-l border-slate-200">
                                                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Micron</div>
                                                <div className="text-sm font-bold text-slate-700">{plan.micron}</div>
                                            </div>
                                            <div className="text-center border-l border-slate-200">
                                                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Meter</div>
                                                <div className="text-sm font-bold text-indigo-600">{plan.meter}</div>
                                            </div>
                                        </div>

                                        {/* Notes */}
                                        {plan.notes ? (
                                            <div className="text-xs text-slate-500 italic bg-amber-50/50 p-2 rounded-lg border border-amber-100/50 line-clamp-2 min-h-[40px]">
                                                "{plan.notes}"
                                            </div>
                                        ) : (
                                            <div className="min-h-[40px]"></div>
                                        )}
                                    </div>

                                    {/* Footer Target */}
                                    <div className={`px-5 py-3 border-t flex justify-between items-center ${isCompleted ? 'bg-slate-50 border-slate-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isCompleted ? 'text-slate-400' : 'text-emerald-600'}`}>Target Production</span>
                                        <span className={`text-lg font-bold ${isCompleted ? 'text-slate-500' : 'text-emerald-700'}`}>{plan.pcs} <span className="text-xs font-semibold">pcs</span></span>
                                    </div>
                                </div>
                            );
                        })}
                        {sortedPlans.length === 0 && (
                             <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-dashed border-slate-300">
                                 <div className="text-4xl mb-3 opacity-30">✨</div>
                                 <p className="text-slate-400 font-medium">No production plans.</p>
                                 <p className="text-xs text-slate-300 mt-1">Create a new plan to get started.</p>
                             </div>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};