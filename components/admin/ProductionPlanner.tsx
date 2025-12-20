
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppData, ProductionPlan, SlittingPlan } from '../../types';
import { saveProductionPlan, deleteProductionPlan, updateProductionPlan, saveSlittingPlan, deleteSlittingPlan, updateSlittingPlan } from '../../services/storageService';
import { SlittingManager } from './SlittingManager';
import { Ruler, Scale, Layers, CheckCircle, Trash2, Edit2, FileText, Box, ArrowRightLeft, Plus, X } from 'lucide-react';

interface Props {
  data: AppData;
  isUserView?: boolean;
}

const PLAN_TYPES = ["Printing", "Roll", "Winder", "St. Seal", "Round", "Open", "Intas"];

export const ProductionPlanner: React.FC<Props> = ({ data, isUserView = false }) => {
  const [activeMode, setActiveMode] = useState<'printing' | 'slitting_plan' | 'slitting'>('printing');

  // Printing/Cutting Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [partyName, setPartyName] = useState('');
  const [size, setSize] = useState('');
  const [planType, setPlanType] = useState('Printing');
  const [printName, setPrintName] = useState(''); 
  const [weight, setWeight] = useState('');
  const [meter, setMeter] = useState('');
  const [micron, setMicron] = useState('');
  const [cuttingSize, setCuttingSize] = useState('');
  const [pcs, setPcs] = useState('');
  const [notes, setNotes] = useState('');
  const [lastEdited, setLastEdited] = useState<'weight' | 'pcs' | 'meter'>('weight');
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);

  // Slitting Plan Form State
  const [spEditingId, setSpEditingId] = useState<string | null>(null);
  const [spDate, setSpDate] = useState(new Date().toISOString().split('T')[0]);
  const [spPlanNo, setSpPlanNo] = useState('');
  const [spPartyCode, setSpPartyCode] = useState('');
  const [spSizer, setSpSizer] = useState(''); 
  const [spSize, setSpSize] = useState(''); 
  const [spCoilSizes, setSpCoilSizes] = useState<string[]>(['']);
  const [spMicron, setSpMicron] = useState('');
  const [spQty, setSpQty] = useState('');
  const [showSpPartyDropdown, setShowSpPartyDropdown] = useState(false);

  // Long Press Delete Logic
  const [pressingId, setPressingId] = useState<string | null>(null);
  const [pressProgress, setPressProgress] = useState(0);
  const pressTimerRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);

  const startPress = (id: string, type: 'prod' | 'slit') => {
    if (isUserView) return;
    setPressingId(id);
    setPressProgress(0);
    
    let startTime = Date.now();
    const duration = 5000; // 5 seconds as requested

    progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / duration) * 100, 100);
        setPressProgress(progress);
        if (progress >= 100) {
            clearInterval(progressIntervalRef.current);
            handleLongPressDelete(id, type);
        }
    }, 50);

    pressTimerRef.current = setTimeout(() => {
        handleLongPressDelete(id, type);
    }, duration);
  };

  const cancelPress = () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setPressingId(null);
    setPressProgress(0);
  };

  const handleLongPressDelete = (id: string, type: 'prod' | 'slit') => {
    cancelPress();
    if (confirm(`Confirm Delete Plan?`)) {
        if (type === 'prod') deleteProductionPlan(id);
        else deleteSlittingPlan(id);
    }
  };

  const getAllowance = (type: string) => {
      const t = type.toLowerCase();
      if (t.includes('seal')) return 5;
      if (t.includes('round')) return 15;
      return 0;
  };

  const getExtraMeter = (type: string) => {
      return type === 'Printing' ? 200 : 0;
  };

  const calculate = () => {
      const s = parseFloat(size) || 0;
      const m = parseFloat(micron) || 0;
      const cut = parseFloat(cuttingSize) || 0;
      const DENSITY = 0.00280;
      const allowance = getAllowance(planType);
      const extraMeter = getExtraMeter(planType);
      const effectiveCutSize = cut + allowance;

      if (s > 0 && m > 0) {
          if (lastEdited === 'weight') {
              const w = parseFloat(weight) || 0;
              const calcM = (w * 1000) / (s * m * DENSITY);
              setMeter(Math.floor(calcM).toString());
              if (effectiveCutSize > 0) {
                  const availableMeter = calcM > extraMeter ? calcM - extraMeter : 0;
                  const rawPcs = (availableMeter * 1000) / effectiveCutSize;
                  const roundedPcs = Math.round(rawPcs / 100) * 100;
                  setPcs(roundedPcs > 0 ? roundedPcs.toString() : '0');
              } else {
                  setPcs('0');
              }
          } else if (lastEdited === 'pcs') {
              const p = parseFloat(pcs) || 0;
              const cuttingMeter = (effectiveCutSize * p) / 1000;
              const totalMeter = cuttingMeter + extraMeter;
              setMeter(Math.ceil(totalMeter).toString());
              const calculatedWeight = (s * m * DENSITY * totalMeter) / 1000;
              setWeight(calculatedWeight > 0 ? calculatedWeight.toFixed(3) : '0');
          } else if (lastEdited === 'meter') {
              const mtr = parseFloat(meter) || 0;
              const calculatedWeight = (s * DENSITY * mtr * m) / 1000;
              setWeight(calculatedWeight > 0 ? calculatedWeight.toFixed(3) : '0');
              if (effectiveCutSize > 0) {
                  const netMeter = mtr > extraMeter ? mtr - extraMeter : 0;
                  const rawPcs = (netMeter * 1000) / effectiveCutSize;
                  const roundedPcs = Math.round(rawPcs / 100) * 100;
                  setPcs(roundedPcs > 0 ? roundedPcs.toString() : '0');
              } else {
                  setPcs('0');
              }
          }
      }
  };

  useEffect(() => { calculate(); }, [size, micron, cuttingSize, planType, lastEdited === 'weight' ? weight : (lastEdited === 'pcs' ? pcs : meter)]); 

  const handleWeightChange = (val: string) => { setWeight(val); setLastEdited('weight'); };
  const handlePcsChange = (val: string) => { setPcs(val); setLastEdited('pcs'); };
  const handleMeterChange = (val: string) => { setMeter(val); setLastEdited('meter'); };

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
      setPcs(plan.pcs.toString());
      setMeter(plan.meter.toString());
      setLastEdited('weight');
      setNotes(plan.notes || '');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSavePlan = async () => {
    if (!partyName || !size || !weight) return alert("Please fill Party, Size and Weight");
    const basePayload = {
        date, partyName, size, type: planType,
        printName: planType === 'Printing' ? printName : "",
        weight: parseFloat(weight) || 0, micron: parseFloat(micron) || 0,
        meter: parseFloat(meter) || 0, cuttingSize: parseFloat(cuttingSize) || 0, 
        pcs: parseFloat(pcs) || 0, notes,
    };

    if (editingId) {
        await updateProductionPlan({ id: editingId, ...basePayload });
    } else {
        await saveProductionPlan({ id: `plan-${Date.now()}`, ...basePayload, status: 'PENDING', createdAt: new Date().toISOString() });
    }
    handleCancelEdit();
  };

  const handleCancelEdit = () => {
      setEditingId(null);
      setPartyName(''); setSize(''); setWeight(''); setMicron(''); setCuttingSize(''); setNotes(''); setPrintName(''); setPcs(''); setMeter('');
      setPlanType('Printing');
  };

  const handleAddCoil = () => setSpCoilSizes([...spCoilSizes, '']);
  const handleRemoveCoil = (i: number) => setSpCoilSizes(spCoilSizes.filter((_, idx) => idx !== i));
  const handleCoilChange = (i: number, val: string) => {
      const next = [...spCoilSizes];
      next[i] = val;
      setSpCoilSizes(next);
  };

  const handleSaveSlittingPlan = async () => {
      if (!spPartyCode || spCoilSizes.some(s => !s) || !spQty) return alert("Please fill all fields");
      const payload: SlittingPlan = {
          id: spEditingId || `sp-${Date.now()}`,
          date: spDate,
          planNo: spPlanNo || 'AUTO',
          partyCode: spPartyCode,
          sizer: spSizer,
          size: spSize,
          coilSizes: spCoilSizes,
          micron: parseFloat(spMicron) || 0,
          qty: parseFloat(spQty) || 0,
          status: 'PENDING',
          createdAt: new Date().toISOString()
      };
      if (spEditingId) await updateSlittingPlan(payload);
      else await saveSlittingPlan(payload);
      resetSpForm();
  };

  const resetSpForm = () => {
      setSpEditingId(null);
      setSpDate(new Date().toISOString().split('T')[0]);
      setSpPlanNo(''); setSpPartyCode(''); setSpSizer(''); setSpSize(''); setSpCoilSizes(['']); setSpMicron(''); setSpQty('');
  };

  const handleEditSp = (p: SlittingPlan) => {
      setSpEditingId(p.id); setSpDate(p.date); setSpPlanNo(p.planNo); setSpPartyCode(p.partyCode);
      setSpSizer(p.sizer || ''); setSpSize(p.size || ''); setSpCoilSizes(p.coilSizes);
      setSpMicron(p.micron.toString()); setSpQty(p.qty.toString());
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const partySuggestions = useMemo(() => 
    data.parties.filter(p => p.name.toLowerCase().includes(partyName.toLowerCase()) || (p.code && p.code.toLowerCase().includes(partyName.toLowerCase()))), [data.parties, partyName]);

  const spPartySuggestions = useMemo(() => 
    data.parties.filter(p => p.name.toLowerCase().includes(spPartyCode.toLowerCase()) || (p.code && p.code.toLowerCase().includes(spPartyCode.toLowerCase()))), [data.parties, spPartyCode]);

  const sortedPlans = [...data.productionPlans].sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const sortedSlitPlans = [...(data.slittingPlans || [])].sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        
        {!isUserView && (
            <div className="flex bg-white/50 backdrop-blur-sm p-1.5 rounded-xl w-full max-w-lg mx-auto shadow-sm border border-white/60">
                <button onClick={() => setActiveMode('printing')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${activeMode==='printing'?'bg-slate-900 text-white shadow-md':'text-slate-500 hover:bg-slate-100'}`}>
                    <Layers size={14} /> Print/Cut
                </button>
                <button onClick={() => setActiveMode('slitting_plan')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${activeMode==='slitting_plan'?'bg-slate-900 text-white shadow-md':'text-slate-500 hover:bg-slate-100'}`}>
                    <Ruler size={14} /> Slit Plan
                </button>
                <button onClick={() => setActiveMode('slitting')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${activeMode==='slitting'?'bg-slate-900 text-white shadow-md':'text-slate-500 hover:bg-slate-100'}`}>
                    <Box size={14} /> Jobs
                </button>
            </div>
        )}

        {activeMode === 'slitting' && !isUserView ? (
            <SlittingManager data={data} />
        ) : activeMode === 'slitting_plan' && !isUserView ? (
            <div className="flex flex-col xl:flex-row gap-6 items-start">
                <div className={`w-full xl:w-[380px] bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6 xl:sticky xl:top-24 z-30 transition-all ${spEditingId ? 'ring-2 ring-amber-400' : ''}`}>
                    <div className="flex justify-between items-center mb-6 border-b border-slate-50 pb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                                <Ruler size={16} />
                            </span>
                            {spEditingId ? 'Edit Slit Plan' : 'Slitting Plan'}
                        </h3>
                        {spEditingId && <button onClick={resetSpForm} className="text-xs font-bold text-red-500">Cancel</button>}
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Date</label><input type="date" value={spDate} onChange={e => setSpDate(e.target.value)} className="w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs font-bold" /></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Sr.No</label><input type="text" value={spPlanNo} onChange={e => setSpPlanNo(e.target.value)} placeholder="Auto" className="w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs font-bold text-center" /></div>
                        </div>
                        <div className="relative">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Party Name / Code</label>
                            <input value={spPartyCode} onChange={e => { setSpPartyCode(e.target.value); setShowSpPartyDropdown(true); }} onFocus={() => setShowSpPartyDropdown(true)} onBlur={() => setTimeout(() => setShowSpPartyDropdown(false), 200)} placeholder="Select Party..." className="w-full bg-slate-50 border rounded-xl px-3 py-2.5 text-xs font-bold" />
                            {showSpPartyDropdown && spPartyCode && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto p-1 animate-in slide-in-from-top-1">
                                    {spPartySuggestions.map(p => (
                                        <div key={p.id} className="px-3 py-2 hover:bg-amber-50 rounded-lg cursor-pointer text-xs font-bold text-slate-700 flex justify-between items-center" onClick={() => { setSpPartyCode(p.code || p.name); setShowSpPartyDropdown(false); }}>
                                            <span>{p.name}</span>
                                            <span className="text-[9px] bg-slate-100 px-1.5 rounded text-slate-500">{p.code}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-bold text-indigo-400 uppercase block mb-1">Sizer</label>
                                <input value={spSizer} onChange={e => setSpSizer(e.target.value)} placeholder="Assign..." className="w-full bg-indigo-50/20 border border-indigo-100 rounded-xl px-3 py-2.5 text-xs font-bold" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Parent Size</label>
                                <input value={spSize} onChange={e => setSpSize(e.target.value)} placeholder="e.g. 800mm" className="w-full bg-slate-50 border rounded-xl px-3 py-2.5 text-xs font-bold" />
                            </div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                            <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Output Coils</span><button onClick={handleAddCoil} className="text-[10px] text-indigo-600 font-bold px-2 py-1 bg-white border rounded shadow-sm">+ Add Coil</button></div>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                                {spCoilSizes.map((val, idx) => (
                                    <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                        <span className="text-[9px] font-bold text-slate-300 w-8">Coil {idx + 1}</span>
                                        <input value={val} onChange={e => handleCoilChange(idx, e.target.value)} placeholder="Size..." className="flex-1 border-b border-slate-100 outline-none focus:border-indigo-400 py-1 text-xs font-bold text-slate-700" />
                                        {spCoilSizes.length > 1 && <button onClick={() => handleRemoveCoil(idx)} className="text-red-300 hover:text-red-500 font-bold px-1">×</button>}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Micron</label><input type="number" value={spMicron} onChange={e => setSpMicron(e.target.value)} placeholder="0" className="w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs font-bold text-center" /></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Qty (kg)</label><input type="number" value={spQty} onChange={e => setSpQty(e.target.value)} placeholder="0" className="w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs font-bold text-center" /></div>
                        </div>
                        <button onClick={handleSaveSlittingPlan} className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-black transition-all transform active:scale-95">
                            {spEditingId ? 'Update Slitting Plan' : 'Add to Slitting Queue'}
                        </button>
                    </div>
                </div>
                <div className="flex-1 w-full min-w-0 space-y-4">
                    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden flex flex-col h-[700px]">
                        <div className="bg-slate-900 px-4 py-3 text-white flex justify-between items-center">
                            <h4 className="text-sm font-bold">Slitting Production Plans</h4>
                            <span className="text-[10px] font-bold opacity-60">Admin: Hold row for 5s to delete</span>
                        </div>
                        <div className="overflow-auto custom-scrollbar flex-1">
                            <table className="w-full text-left border-collapse min-w-[1000px]">
                                <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-500 sticky top-0 z-20 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">Sr.No</th>
                                        <th className="px-4 py-3">Party Code</th>
                                        <th className="px-4 py-3">Sizer</th>
                                        <th className="px-4 py-3">P.Size</th>
                                        <th className="px-4 py-3">Output Coils</th>
                                        <th className="px-4 py-3 text-center">Mic</th>
                                        <th className="px-4 py-3 text-right">Target Wt</th>
                                        <th className="px-4 py-3 text-center">Status</th>
                                        <th className="px-4 py-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sortedSlitPlans.map(p => (
                                        <tr 
                                            key={p.id} 
                                            onMouseDown={() => startPress(p.id, 'slit')}
                                            onMouseUp={cancelPress}
                                            onMouseLeave={cancelPress}
                                            onTouchStart={() => startPress(p.id, 'slit')}
                                            onTouchEnd={cancelPress}
                                            className={`hover:bg-slate-50 transition-colors relative ${p.status === 'COMPLETED' ? 'opacity-60 bg-slate-50' : ''} ${pressingId === p.id ? 'bg-red-50' : ''}`}
                                        >
                                            <td className="px-4 py-3 text-xs font-medium relative">
                                                {pressingId === p.id && <div className="absolute bottom-0 left-0 h-1 bg-red-500 transition-all" style={{ width: `${pressProgress}%` }}></div>}
                                                {p.date.split('-').reverse().slice(0,2).join('/')}
                                            </td>
                                            <td className="px-4 py-3 text-xs font-mono font-bold text-slate-400">{p.planNo}</td>
                                            <td className="px-4 py-3 text-xs font-bold text-slate-800">{p.partyCode}</td>
                                            <td className="px-4 py-3 text-[10px] font-bold text-indigo-600 uppercase">{p.sizer || '-'}</td>
                                            <td className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">{p.size || '-'}</td>
                                            <td className="px-4 py-3 text-xs font-bold text-indigo-600">
                                                <div className="flex gap-1 flex-wrap">
                                                    {p.coilSizes.map((s, i) => <span key={i} className="bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{s}</span>)}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs font-bold text-center text-slate-500">{p.micron}</td>
                                            <td className="px-4 py-3 text-xs font-bold text-right text-slate-900">{p.qty} kg</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${p.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                                    {p.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={(e) => { e.stopPropagation(); handleEditSp(p); }} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"><Edit2 size={14} /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); deleteSlittingPlan(p.id); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 size={14} /></button>
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
        ) : (
            <div className="flex flex-col xl:flex-row gap-6 items-start">
                {!isUserView && (
                    <div className={`w-full xl:w-[380px] bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6 xl:sticky xl:top-24 z-30 transition-all ${editingId ? 'ring-2 ring-amber-400' : ''}`}>
                        <div className="flex justify-between items-center mb-6 border-b border-slate-50 pb-4">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                    {editingId ? <Edit2 size={16} /> : <Layers size={16} />}
                                </span>
                                {editingId ? 'Edit Plan' : 'Create Plan'}
                            </h3>
                            {editingId && <button onClick={handleCancelEdit} className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">Cancel</button>}
                        </div>

                        <div className="space-y-5">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Date & Party</label>
                                    <div className="flex gap-2">
                                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-1/3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-sm" />
                                        <div className="relative flex-1">
                                            <input 
                                                type="text" 
                                                value={partyName} 
                                                onChange={e => { setPartyName(e.target.value); setShowPartyDropdown(true); }}
                                                onFocus={() => setShowPartyDropdown(true)}
                                                onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)}
                                                placeholder="Select Party..." 
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-sm" 
                                            />
                                            {showPartyDropdown && (
                                                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar p-1 animate-in slide-in-from-top-1">
                                                    {partySuggestions.map(p => (
                                                        <div key={p.id} className="px-3 py-2 hover:bg-indigo-50 rounded-lg cursor-pointer text-xs font-bold text-slate-700 flex justify-between items-center" onClick={() => { setPartyName(p.name); setShowPartyDropdown(false); }}>
                                                            <span>{p.name}</span>
                                                            <span className="text-[9px] bg-slate-100 px-1.5 rounded text-slate-500">{p.code}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Plan Size</label>
                                    <input type="number" value={size} onChange={e => setSize(e.target.value)} placeholder="Width in mm" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-sm" />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Job Type</label>
                                    <select value={planType} onChange={e => setPlanType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-sm appearance-none">
                                        {PLAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Specifications (Mic / Cut Size)</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="number" value={micron} onChange={e => setMicron(e.target.value)} placeholder="Micron" className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white text-center shadow-sm" />
                                    <input type="number" value={cuttingSize} onChange={e => setCuttingSize(e.target.value)} placeholder="Cutting Size" className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white text-center shadow-sm" />
                                </div>
                            </div>

                            {planType === 'Printing' && (
                                <div className="animate-in fade-in slide-in-from-top-1">
                                    <label className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block mb-1.5">Print Name</label>
                                    <input type="text" value={printName} onChange={e => setPrintName(e.target.value)} placeholder="Design Name" className="w-full bg-purple-50/30 border border-purple-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-purple-500 focus:bg-white text-purple-700 shadow-sm" />
                                </div>
                            )}

                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 relative overflow-hidden group hover:border-indigo-200 transition-colors">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1"><Scale size={10} /> Calculator</label>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <label className="text-[9px] font-bold text-indigo-600 mb-1 block uppercase text-center">Weight (kg)</label>
                                        <input type="number" value={weight} onChange={e => handleWeightChange(e.target.value)} placeholder="0" className={`w-full border rounded-xl p-2 text-sm font-bold text-center outline-none transition-all ${lastEdited === 'weight' ? 'border-indigo-500 shadow-sm ring-2 ring-indigo-100 bg-white' : 'border-slate-200 bg-white/50'}`} />
                                    </div>
                                    <div className="text-slate-300"><ArrowRightLeft size={14} /></div>
                                    <div className="flex-1">
                                        <label className="text-[9px] font-bold text-blue-600 mb-1 block uppercase text-center">Meter (m)</label>
                                        <input type="number" value={meter} onChange={e => handleMeterChange(e.target.value)} placeholder="0" className={`w-full border rounded-xl p-2 text-sm font-bold text-center outline-none transition-all ${lastEdited === 'meter' ? 'border-blue-500 shadow-sm ring-2 ring-blue-100 bg-white' : 'border-slate-200 bg-white/50'}`} />
                                    </div>
                                    <div className="text-slate-300"><ArrowRightLeft size={14} /></div>
                                    <div className="flex-1">
                                        <label className="text-[9px] font-bold text-emerald-600 mb-1 block uppercase text-center">Pieces</label>
                                        <input type="number" value={pcs} onChange={e => handlePcsChange(e.target.value)} placeholder="0" className={`w-full border rounded-xl p-2 text-sm font-bold text-center outline-none transition-all ${lastEdited === 'pcs' ? 'border-emerald-500 shadow-sm ring-2 ring-emerald-100 bg-white' : 'border-slate-200 bg-white/50'}`} />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Notes</label>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 h-20 resize-none outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-sm" placeholder="Optional details..."></textarea>
                            </div>

                            <button onClick={handleSavePlan} className={`w-full text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 ${editingId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-900 hover:bg-black'}`}>
                                {editingId ? <><Edit2 size={16} /> Update Plan</> : <><CheckCircle size={16} /> Add to Queue</>}
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex-1 w-full min-w-0 space-y-4">
                    <div className="flex items-center justify-between bg-white px-5 py-4 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg"><Layers size={20} /></div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 leading-none">Production Queue</h3>
                                <p className="text-xs text-slate-500 font-medium mt-1">{sortedPlans.filter(p => p.status === 'PENDING').length} Pending Orders</p>
                            </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 hidden sm:inline uppercase tracking-widest">Hold row for 5s to delete</span>
                    </div>

                    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden flex flex-col h-[700px]">
                        <div className="block sm:hidden overflow-y-auto custom-scrollbar h-full bg-slate-50 p-2">
                            {sortedPlans.length === 0 ? (
                                <div className="text-center py-12 text-slate-400"><p className="text-xs font-bold">Empty Queue</p></div>
                            ) : (
                                <div className="space-y-2">
                                    {sortedPlans.map((plan) => {
                                        const isCompleted = plan.status === 'COMPLETED';
                                        return (
                                            <div 
                                                key={plan.id} 
                                                onMouseDown={() => startPress(plan.id, 'prod')}
                                                onMouseUp={cancelPress}
                                                onMouseLeave={cancelPress}
                                                onTouchStart={() => startPress(plan.id, 'prod')}
                                                onTouchEnd={cancelPress}
                                                className={`bg-white rounded-lg border border-slate-200 shadow-sm p-3 relative transition-all ${isCompleted ? 'opacity-70 bg-slate-50' : ''} ${pressingId === plan.id ? 'bg-red-50' : ''}`}
                                            >
                                                {pressingId === plan.id && <div className="absolute bottom-0 left-0 h-1 bg-red-500 transition-all" style={{ width: `${pressProgress}%` }}></div>}
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="font-bold text-xs text-slate-900 truncate w-[65%] leading-tight">{plan.partyName}</div>
                                                    <div className="text-[9px] font-mono text-slate-400 font-bold">{plan.date.split('-').reverse().join('/')}</div>
                                                </div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold">
                                                        <span className="text-slate-800">{plan.size}</span>
                                                        <span className="text-indigo-600">{plan.type}</span>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-end">
                                                    <div className="text-[10px] font-bold text-slate-600">{plan.weight} kg | {plan.meter} m | {plan.pcs} pcs</div>
                                                    <div className="flex items-center gap-2">
                                                        {!isUserView && !isCompleted && <button onClick={(e) => { e.stopPropagation(); handleEdit(plan); }} className="text-indigo-600"><Edit2 size={12} /></button>}
                                                        {isCompleted && <span className="text-[9px] text-emerald-600 font-bold">Taken</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="hidden sm:block overflow-auto custom-scrollbar flex-1">
                            <table className="w-full text-left border-collapse min-w-[1000px]">
                                <thead className="bg-slate-900 text-white text-[10px] uppercase tracking-wider sticky top-0 z-20 shadow-md">
                                    <tr>
                                        <th className="px-3 py-4 font-bold">Date</th>
                                        <th className="px-3 py-4 font-bold">Party</th>
                                        <th className="px-3 py-4 font-bold">Type</th>
                                        <th className="px-3 py-4 font-bold">Size</th>
                                        <th className="px-3 py-4 font-bold">Print</th>
                                        <th className="px-3 py-4 font-bold text-right">Mic</th>
                                        <th className="px-3 py-4 font-bold text-right">Wt (kg)</th>
                                        <th className="px-3 py-4 font-bold text-right">Mtr</th>
                                        <th className="px-3 py-4 font-bold text-right">Pcs</th>
                                        <th className="px-3 py-4 font-bold">Note</th>
                                        <th className="px-3 py-4 font-bold text-center">Status</th>
                                        {!isUserView && <th className="px-3 py-4 font-bold text-center sticky right-0 bg-slate-900 z-30 w-24">Action</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sortedPlans.map((plan) => (
                                        <tr 
                                            key={plan.id} 
                                            onMouseDown={() => startPress(plan.id, 'prod')}
                                            onMouseUp={cancelPress}
                                            onMouseLeave={cancelPress}
                                            className={`hover:bg-indigo-50/30 relative ${plan.status === 'COMPLETED' ? 'bg-slate-50 opacity-60' : 'bg-white'} ${pressingId === plan.id ? 'bg-red-50' : ''}`}
                                        >
                                            <td className="px-3 py-3 text-xs font-mono relative">
                                                {pressingId === plan.id && <div className="absolute bottom-0 left-0 h-1 bg-red-500 transition-all" style={{ width: `${pressProgress}%` }}></div>}
                                                {plan.date.split('-').slice(1).join('/')}
                                            </td>
                                            <td className="px-3 py-3 text-xs font-bold truncate max-w-[150px]">{plan.partyName}</td>
                                            <td className="px-3 py-3 text-[10px] font-bold text-indigo-600 uppercase">{plan.type}</td>
                                            <td className="px-3 py-3 text-xs font-mono font-bold">{plan.cuttingSize > 0 ? `${plan.size}x${plan.cuttingSize}` : plan.size}</td>
                                            <td className="px-3 py-3 text-xs truncate max-w-[120px]">{plan.printName || '-'}</td>
                                            <td className="px-3 py-3 text-right font-mono text-xs">{plan.micron}</td>
                                            <td className="px-3 py-3 text-right text-xs font-bold">{plan.weight}</td>
                                            <td className="px-3 py-3 text-right font-mono text-xs text-indigo-600">{plan.meter}</td>
                                            <td className="px-3 py-3 text-right text-xs font-bold text-emerald-600">{plan.pcs}</td>
                                            <td className="px-3 py-3 text-[10px] truncate max-w-[150px]">{plan.notes || '-'}</td>
                                            <td className="px-3 py-3 text-center">
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${plan.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                                                    {plan.status}
                                                </span>
                                            </td>
                                            {!isUserView && (
                                                <td className="px-3 py-3 text-center sticky right-0 bg-inherit shadow-[-4px_0_12px_rgba(0,0,0,0.05)]">
                                                    <div className="flex justify-center gap-1.5">
                                                        <button onClick={(e) => { e.stopPropagation(); handleEdit(plan); }} className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded transition-colors"><Edit2 size={14} /></button>
                                                        <button onClick={(e) => { e.stopPropagation(); deleteProductionPlan(plan.id); }} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"><Trash2 size={14} /></button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
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
