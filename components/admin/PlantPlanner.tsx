
import React, { useState, useEffect, useMemo } from 'react';
import { AppData, PlantProductionPlan, SlittingJob, SlittingCoil } from '../../types';
import { savePlantPlan, deletePlantPlan, updatePlantPlan, saveSlittingJob } from '../../services/storageService';
import { Factory, Trash2, CheckCircle, Search, Copy, Edit2, Ruler, Scale, Calendar, Hash, ArrowRightLeft, GitMerge, X, Calculator, Info, FileText, Scissors, Plus, Minus } from 'lucide-react';

interface Props {
  data: AppData;
}

const PROD_DENSITY = 0.00276;

export const PlantPlanner: React.FC<Props> = ({ data }) => {
  const [entryMode, setEntryMode] = useState<'SINGLE' | 'MASTER'>('SINGLE');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Common States
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [partyCode, setPartyCode] = useState('');
  const [micron, setMicron] = useState('');
  const [qty, setQty] = useState('');
  
  // Single Order States
  const [size, setSize] = useState('');
  const [meter, setMeter] = useState('');
  const [lastEdited, setLastEdited] = useState<'qty' | 'meter'>('qty');

  // Master Job States (Direct Creation)
  const [masterSizer, setMasterSizer] = useState(''); 
  const [masterRollLength, setMasterRollLength] = useState('2000'); 
  const [masterSlitCoils, setMasterSlitCoils] = useState<{size: string}[]>([{size: ''}, {size: ''}]);

  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSizer, setMergeSizer] = useState(''); 
  const [mergeRollLength, setMergeRollLength] = useState('2000'); 

  const partySuggestions = data.parties.filter(p => 
    p.name.toLowerCase().includes(partyCode.toLowerCase()) || 
    (p.code && p.code.toLowerCase().includes(partyCode.toLowerCase()))
  );

  // Auto-calculation for Single Order
  useEffect(() => {
    if (entryMode !== 'SINGLE') return;
    const s = parseFloat(size) || 0;
    const m = parseFloat(micron) || 0;
    const FACTOR = 0.00138;
    if (s > 0 && m > 0) {
      if (lastEdited === 'qty') {
        const q = parseFloat(qty) || 0;
        const calcMeter = q / (m * FACTOR * (s/1000)); 
        setMeter(calcMeter > 0 ? Math.round(calcMeter).toString() : '');
      } else if (lastEdited === 'meter') {
        const mtr = parseFloat(meter) || 0;
        const calcQty = (s/1000) * FACTOR * mtr * m;
        setQty(calcQty > 0 ? calcQty.toFixed(3) : '');
      }
    }
  }, [size, micron, qty, meter, lastEdited, entryMode]);

  // Master Calculation Logic (Unified for Merge and Direct)
  const calculateMasterSpecs = (targetQty: number, mic: number, sizerSize: number, slitLen: number, coilSizes: number[]) => {
    const slittingSize = coilSizes.reduce((a, b) => a + b, 0);
    if (mic <= 0 || targetQty <= 0 || sizerSize <= 0 || slitLen <= 0 || slittingSize <= 0) return null;

    // Production Formulas
    const tube1mtrWeight = sizerSize * mic * PROD_DENSITY;
    const tubeRollLength = slitLen / 2;
    const oneRollWeight = (tube1mtrWeight / 1000) * tubeRollLength;
    const totalRolls = targetQty / oneRollWeight;
    const totalTubeQty = (targetQty / slittingSize) * sizerSize;

    // Slitting Formulas
    const coils = coilSizes.map(s => {
        const coilRollWeight = (s * mic * PROD_DENSITY / 2 * slitLen) / 1000;
        const coilQty = (targetQty / slittingSize) * s;
        return { size: s, rollWeight: coilRollWeight, qty: coilQty, rolls: totalRolls };
    });

    // Added combinedQty to the return object to satisfy handleConfirmMerge requirements
    return { combinedQty: targetQty, tube1mtrWeight, tubeRollLength, oneRollWeight, totalRolls, totalTubeQty, coils, slittingSize };
  };

  const directMasterCalcs = useMemo(() => {
    if (entryMode !== 'MASTER') return null;
    return calculateMasterSpecs(
        parseFloat(qty) || 0,
        parseFloat(micron) || 0,
        parseFloat(masterSizer) || 0,
        parseFloat(masterRollLength) || 0,
        masterSlitCoils.map(c => parseFloat(c.size) || 0)
    );
  }, [qty, micron, masterSizer, masterRollLength, masterSlitCoils, entryMode]);

  const mergeCalcs = useMemo(() => {
    if (!isMergeModalOpen || selectedIds.length === 0) return null;
    const selectedPlans = data.plantProductionPlans.filter(p => selectedIds.includes(p.id));
    return calculateMasterSpecs(
        selectedPlans.reduce((sum, p) => sum + p.qty, 0),
        selectedPlans[0].micron,
        parseFloat(mergeSizer) || 0,
        parseFloat(mergeRollLength) || 0,
        selectedPlans.map(p => parseFloat(p.size) || 0)
    );
  }, [isMergeModalOpen, selectedIds, data.plantProductionPlans, mergeSizer, mergeRollLength]);

  const handleSave = async () => {
    if (entryMode === 'SINGLE') {
        if (!partyCode || !size || !qty) return alert("Fill Party, Size and Qty");
        const plan: PlantProductionPlan = {
            id: editingId || `plant-plan-${Date.now()}`,
            date, partyCode, sizer: 'LABEL', size, coils: [],
            micron: parseFloat(micron) || 0,
            qty: parseFloat(qty) || 0,
            meter: parseFloat(meter) || 0,
            status: editingId ? (data.plantProductionPlans.find(p => p.id === editingId)?.status || 'PENDING') : 'PENDING',
            createdAt: editingId ? (data.plantProductionPlans.find(p => p.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
        };
        await savePlantPlan(plan);
        alert("Order Saved!");
    } else {
        if (!partyCode || !directMasterCalcs) return alert("Complete all Master Job details");
        const jobNo = `M-${Date.now().toString().slice(-4)}`;
        const slittingCoils: SlittingCoil[] = masterSlitCoils.map((c, i) => ({
            id: `coil-${Date.now()}-${i}`,
            number: i + 1, size: c.size, rolls: Math.ceil(directMasterCalcs.totalRolls), producedBundles: 0
        }));
        await saveSlittingJob({
            id: `slit-master-${Date.now()}`, date, jobNo, jobCode: partyCode, coils: slittingCoils,
            planMicron: parseFloat(micron), planQty: parseFloat(qty), planRollLength: parseFloat(masterRollLength),
            rows: [], status: 'PENDING', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        });
        alert(`Master Job Card #${jobNo} Created!`);
    }
    resetForm();
  };

  const handleConfirmMerge = async () => {
      if (!mergeCalcs) return;
      const selectedPlans = data.plantProductionPlans.filter(p => selectedIds.includes(p.id));
      const jobNo = `M-${Date.now().toString().slice(-4)}`;
      const slittingCoils: SlittingCoil[] = selectedPlans.map((p, idx) => ({
          id: `coil-${Date.now()}-${idx}`,
          number: idx + 1, size: p.size, rolls: Math.ceil(mergeCalcs.totalRolls), producedBundles: 0
      }));
      await saveSlittingJob({
          id: `slit-master-${Date.now()}`, date: new Date().toISOString().split('T')[0],
          jobNo, jobCode: selectedPlans[0].partyCode, coils: slittingCoils,
          planMicron: selectedPlans[0].micron, planQty: mergeCalcs.combinedQty,
          planRollLength: parseFloat(mergeRollLength), rows: [], status: 'PENDING',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
      for (const p of selectedPlans) await updatePlantPlan({ id: p.id, status: 'COMPLETED' });
      setIsMergeModalOpen(false);
      setSelectedIds([]);
      alert(`Master Job #${jobNo} Created!`);
  };

  const resetForm = () => {
    setEditingId(null);
    setDate(new Date().toISOString().split('T')[0]);
    setPartyCode(''); setSize(''); setMicron(''); setQty(''); setMeter('');
    setMasterSizer(''); setMasterSlitCoils([{size: ''}, {size: ''}]);
  };

  // Added missing handleEdit function to populate form for editing
  const handleEdit = (plan: PlantProductionPlan) => {
    setEntryMode('SINGLE');
    setEditingId(plan.id);
    setDate(plan.date);
    setPartyCode(plan.partyCode);
    setMicron(plan.micron.toString());
    setQty(plan.qty.toString());
    setSize(plan.size);
    setMeter(plan.meter?.toString() || '');
    setLastEdited('qty');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenMerge = () => {
    const selectedPlans = data.plantProductionPlans.filter(p => selectedIds.includes(p.id));
    if (selectedPlans.length < 2) return;
    const combinedSize = selectedPlans.reduce((sum, p) => sum + (parseFloat(p.size) || 0), 0);
    setMergeSizer(combinedSize.toString());
    setIsMergeModalOpen(true);
  };

  const toggleSelection = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const filteredPlans = data.plantProductionPlans.filter(p => {
    const s = searchTerm.toLowerCase();
    return p.partyCode.toLowerCase().includes(s) || p.size.toLowerCase().includes(s);
  });

  return (
    <div className="flex flex-col xl:flex-row gap-8 items-start max-w-7xl mx-auto pb-20">
      
      {/* MERGE MODAL - DETAILED BREAKDOWN */}
      {isMergeModalOpen && mergeCalcs && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden border-[2px] border-slate-900 animate-in zoom-in duration-300">
                  <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
                      <div className="flex items-center gap-3"><GitMerge size={20} className="text-amber-400" /><h3 className="text-xl font-black uppercase tracking-tighter">Merge Order Breakdown</h3></div>
                      <button onClick={() => setIsMergeModalOpen(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
                  </div>
                  <div className="p-6 overflow-y-auto max-h-[85vh] space-y-6">
                      <div className="grid grid-cols-3 gap-4">
                          <div className="bg-slate-50 border-[2px] border-slate-900 p-3 rounded-lg"><label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Label Combined</label><div className="text-xl font-black text-slate-900">{mergeCalcs.slittingSize} MM</div></div>
                          <div className="bg-white border-[2px] border-slate-900 p-3 rounded-lg"><label className="text-[10px] font-black text-indigo-500 uppercase block mb-1">Target Tube Size</label><input type="number" value={mergeSizer} onChange={e => setMergeSizer(e.target.value)} className="w-full bg-transparent text-xl font-black text-slate-900 outline-none" /></div>
                          <div className="bg-white border-[2px] border-slate-900 p-3 rounded-lg"><label className="text-[10px] font-black text-indigo-500 uppercase block mb-1">Roll Length</label><input type="number" value={mergeRollLength} onChange={e => setMergeRollLength(e.target.value)} className="w-full bg-transparent text-xl font-black text-slate-900 outline-none" /></div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="border-[2px] border-slate-900 rounded-lg overflow-hidden shadow-inner">
                              <div className="bg-slate-900 text-white px-3 py-2 text-[10px] font-black uppercase flex items-center gap-2"><Factory size={12}/> Production Details</div>
                              <div className="divide-y divide-slate-100 bg-white">
                                  <div className="flex justify-between px-4 py-3 text-xs"><span>1 Mtr Weight</span><span className="font-mono font-bold">{mergeCalcs.tube1mtrWeight.toFixed(3)} kg</span></div>
                                  <div className="flex justify-between px-4 py-3 text-xs"><span>Tube Roll Length</span><span className="font-mono font-bold">{mergeCalcs.tubeRollLength} m</span></div>
                                  <div className="flex justify-between px-4 py-3 text-xs"><span>1 Roll Weight</span><span className="font-mono font-bold">{mergeCalcs.oneRollWeight.toFixed(3)} kg</span></div>
                                  <div className="flex justify-between px-4 py-3 bg-indigo-50 font-black"><span className="text-indigo-700 uppercase text-[10px]">Total Rolls</span><span className="text-indigo-700">{Math.ceil(mergeCalcs.totalRolls)} PCS</span></div>
                              </div>
                          </div>
                          <div className="border-[2px] border-slate-900 rounded-lg overflow-hidden shadow-inner">
                              <div className="bg-slate-900 text-white px-3 py-2 text-[10px] font-black uppercase flex items-center gap-2"><Scissors size={12}/> Slitting Details (Per Coil)</div>
                              <div className="divide-y divide-slate-100 max-h-[200px] overflow-auto custom-scrollbar bg-white">
                                  {mergeCalcs.coils.map((c, i) => (
                                      <div key={i} className="px-4 py-2 flex justify-between items-center group hover:bg-slate-50">
                                          <div><div className="font-black text-xs text-slate-800">{c.size} MM</div><div className="text-[9px] text-slate-400 font-bold uppercase">Coil {i+1}</div></div>
                                          <div className="text-right"><div className="font-bold text-emerald-600 text-sm">{c.qty.toFixed(2)} KG</div><div className="text-[9px] text-slate-400 font-bold italic">RW: {c.rollWeight.toFixed(3)} kg</div></div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                      <button onClick={handleConfirmMerge} className="w-full bg-slate-900 text-white font-black py-5 rounded uppercase text-sm border-[2px] border-slate-900 shadow-xl hover:bg-black active:scale-[0.98] transition-all">Confirm & Generate Job Card</button>
                  </div>
              </div>
          </div>
      )}

      {/* ENTRY FORM */}
      <div className="w-full xl:w-[480px] xl:sticky xl:top-24 z-30">
        <div className={`bg-white border-[2px] border-slate-900 overflow-hidden transition-all duration-300 ${editingId ? 'ring-4 ring-amber-100' : ''}`}>
          
          <div className="flex border-b-[2px] border-slate-900">
              <button onClick={() => setEntryMode('SINGLE')} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-colors ${entryMode === 'SINGLE' ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>Single Order</button>
              <button onClick={() => { setEntryMode('MASTER'); setEditingId(null); }} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest border-l-[2px] border-slate-900 transition-colors ${entryMode === 'MASTER' ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>Master Job</button>
          </div>

          <div className="p-4 flex items-center justify-center bg-white border-b-[2px] border-slate-900 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none flex items-center justify-center select-none text-7xl font-black italic">RDMS</div>
             <div className="text-2xl font-black uppercase tracking-tighter text-slate-900 text-center">{entryMode === 'MASTER' ? 'DIRECT MASTER JOB' : 'LABEL ORDER ENTRY'}</div>
          </div>

          <div className="grid grid-cols-2 border-b-[2px] border-slate-900 bg-slate-50">
            <div className="border-r-[1.5px] border-slate-900 p-3 flex flex-col">
              <label className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1 flex items-center gap-1"><Calendar size={10} /> Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent text-sm font-black font-mono leading-none w-full outline-none focus:text-indigo-600" />
            </div>
            <div className="p-3 flex flex-col relative">
              <label className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1 flex items-center gap-1"><Hash size={10} /> Party</label>
              <input type="text" value={partyCode} onChange={e => { setPartyCode(e.target.value); setShowPartyDropdown(true); }} onFocus={() => setShowPartyDropdown(true)} onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)} placeholder="Code/Name..." className="bg-transparent text-sm font-black font-mono truncate w-full uppercase leading-none outline-none focus:text-indigo-600" />
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

          <div className="flex flex-col">
            {entryMode === 'SINGLE' ? (
                <div className="grid grid-cols-2 border-b-[1.5px] border-slate-900 bg-white">
                    <div className="p-3 border-r-[1.5px] border-slate-900 text-[9px] font-black uppercase flex items-center gap-1 justify-center"><Ruler size={12} className="text-indigo-500" /> Size :-</div>
                    <div className="p-3 flex items-center justify-center gap-1">
                        <input type="number" value={size} onChange={e => setSize(e.target.value)} placeholder="000" className="w-24 text-2xl font-black font-mono text-center outline-none focus:text-indigo-600 leading-none bg-transparent" />
                        <span className="text-[10px] text-slate-400 font-normal">MM</span>
                    </div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 border-b-[1.5px] border-slate-900 bg-indigo-50/30">
                        <div className="p-3 border-r-[1.5px] border-slate-900 text-[9px] font-black uppercase flex items-center gap-1 justify-center"><Ruler size={12} className="text-indigo-600" /> Tube Size :-</div>
                        <div className="p-3 flex items-center justify-center gap-1">
                            <input type="number" value={masterSizer} onChange={e => setMasterSizer(e.target.value)} placeholder="000" className="w-24 text-2xl font-black font-mono text-center outline-none focus:text-indigo-600 leading-none bg-transparent" />
                            <span className="text-[10px] text-slate-400 font-normal">MM</span>
                        </div>
                    </div>
                    <div className="p-4 border-b-[1.5px] border-slate-900 bg-white">
                        <div className="flex justify-between items-center mb-3"><span className="text-[10px] font-black uppercase text-slate-400">Slitting Breakdown</span><button onClick={() => setMasterSlitCoils([...masterSlitCoils, {size: ''}])} className="text-[9px] bg-slate-900 text-white px-3 py-1.5 rounded font-bold uppercase tracking-widest hover:bg-black transition-colors">+ Add size</button></div>
                        <div className="grid grid-cols-2 gap-3">
                            {masterSlitCoils.map((c, i) => (
                                <div key={i} className="flex items-center gap-2 border-[1.5px] border-slate-900 rounded p-2 bg-slate-50">
                                    <span className="text-[9px] font-black text-slate-400">#{i+1}</span>
                                    <input value={c.size} onChange={e => {
                                        const updated = [...masterSlitCoils];
                                        updated[i].size = e.target.value;
                                        setMasterSlitCoils(updated);
                                    }} placeholder="Size" className="flex-1 text-sm font-black font-mono outline-none text-center bg-transparent" />
                                    {masterSlitCoils.length > 2 && <button onClick={() => setMasterSlitCoils(masterSlitCoils.filter((_, idx) => idx !== i))} className="text-red-500 p-1"><Minus size={14}/></button>}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="p-4 border-b-[1.5px] border-slate-900 bg-slate-50">
                        <label className="text-[10px] font-black text-slate-400 uppercase block text-center mb-1">Master Roll Length</label>
                        <div className="flex items-center justify-center gap-2">
                            <input type="number" value={masterRollLength} onChange={e => setMasterRollLength(e.target.value)} className="w-32 text-2xl font-black font-mono text-center outline-none bg-transparent border-b-2 border-slate-300 focus:border-indigo-500" />
                            <span className="text-[10px] text-slate-400 font-bold">MTR</span>
                        </div>
                    </div>
                </>
            )}

            <div className="grid grid-cols-2 border-b-[1.5px] border-slate-900 bg-white">
              <div className="p-3 border-r-[1.5px] border-slate-900 text-[9px] font-black uppercase flex items-center gap-1 justify-center"><div className="w-5 h-5 rounded-full border border-amber-500 flex items-center justify-center text-[10px] font-bold">μ</div> Micron :-</div>
              <div className="p-3 flex items-center justify-center gap-1">
                <input type="number" value={micron} onChange={e => setMicron(e.target.value)} placeholder="00" className="w-24 text-2xl font-black font-mono text-center outline-none focus:text-amber-600 leading-none bg-transparent" />
                <span className="text-[10px] text-slate-400 font-normal italic font-serif">μm</span>
              </div>
            </div>

            <div className="grid grid-cols-2 border-b-[2px] border-slate-900 bg-slate-50">
               <div className="p-4 border-r-[1.5px] border-slate-900 flex flex-col items-center justify-center">
                  <label className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1 flex items-center gap-1"><Scale size={10} className="text-emerald-500" /> Target Qty</label>
                  <div className="flex items-center">
                    <input type="number" value={qty} onChange={e => { setQty(e.target.value); setLastEdited('qty'); }} className="w-full text-2xl font-black font-mono text-center outline-none bg-transparent text-emerald-600" placeholder="0.00" />
                    <span className="text-[10px] text-slate-400 font-bold uppercase ml-1">kg</span>
                  </div>
               </div>
               <div className="p-4 flex flex-col items-center justify-center">
                  {entryMode === 'SINGLE' ? (
                      <>
                        <label className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1 flex items-center gap-1"><ArrowRightLeft size={10} className="text-indigo-500" /> Meter (Est.)</label>
                        <div className="flex items-center">
                            <input type="number" value={meter} onChange={e => { setMeter(e.target.value); setLastEdited('meter'); }} className="w-full text-2xl font-black font-mono text-center outline-none bg-transparent text-indigo-600" placeholder="000" />
                            <span className="text-[10px] text-slate-400 font-bold uppercase ml-1">mtr</span>
                        </div>
                      </>
                  ) : (
                      <>
                        <label className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1 flex items-center gap-1"><Info size={10} className="text-indigo-500" /> Rolls (Est.)</label>
                        <div className="text-2xl font-black font-mono text-indigo-600 leading-none">{directMasterCalcs ? Math.ceil(directMasterCalcs.totalRolls) : '-'}</div>
                      </>
                  )}
               </div>
            </div>
          </div>

          <button onClick={handleSave} className="w-full bg-slate-900 text-white font-black py-6 flex items-center justify-center gap-3 uppercase text-sm tracking-[0.2em] active:scale-[0.98] transition-all hover:bg-black border-t-[2px] border-slate-900">
            <CheckCircle size={20} /> {editingId ? 'Update Entry' : entryMode === 'MASTER' ? 'Generate Master Job Card' : 'Post Label Order'}
          </button>
        </div>
      </div>

      {/* QUEUE SECTION */}
      <div className="flex-1 space-y-4 w-full">
          <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200 gap-3">
              <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center"><Factory size={24} /></div>
                  <div><h3 className="text-lg font-bold text-slate-800 leading-none">Order Queue</h3><div className="flex items-center gap-2 mt-1"><p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Live Feed</p>{selectedIds.length > 0 && <span className="bg-indigo-600 text-white text-[9px] px-2 py-0.5 rounded-full font-bold animate-in zoom-in">{selectedIds.length} Selected</span>}</div></div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                  {selectedIds.length >= 2 && <button onClick={handleOpenMerge} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all animate-in fade-in slide-in-from-right-2"><GitMerge size={16} /> Merge</button>}
                  <div className="relative flex-1 sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-bold outline-none focus:ring-4 focus:ring-slate-100 shadow-inner" /></div>
              </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden min-h-[500px]">
              <div className="overflow-x-auto custom-scrollbar h-[600px]">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead className="sticky top-0 z-20 bg-slate-900 text-white text-[10px] uppercase tracking-wider font-black">
                          <tr>
                              <th className="px-4 py-4 w-10 text-center"><input type="checkbox" className="rounded border-slate-300" onChange={e => setSelectedIds(e.target.checked ? filteredPlans.map(p => p.id) : [])} checked={selectedIds.length === filteredPlans.length && filteredPlans.length > 0} /></th>
                              <th className="px-4 py-4">Date</th>
                              <th className="px-4 py-4">Party</th>
                              <th className="px-4 py-4 text-center">Label Size</th>
                              <th className="px-4 py-4 text-center">Mic</th>
                              <th className="px-4 py-4 text-right">Target</th>
                              <th className="px-4 py-4 text-right">Meter</th>
                              <th className="px-4 py-4 text-center">Action</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {filteredPlans.map(plan => {
                              const isSelected = selectedIds.includes(plan.id);
                              return (
                                <tr key={plan.id} className={`hover:bg-indigo-50/50 transition-all ${plan.status === 'COMPLETED' ? 'opacity-50 grayscale bg-slate-50' : ''} ${isSelected ? 'bg-indigo-50' : ''}`}>
                                    <td className="px-4 py-3 text-center"><input type="checkbox" className="rounded border-slate-300 text-indigo-600" checked={isSelected} onChange={() => toggleSelection(plan.id)} /></td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-slate-500 font-mono">{plan.date.split('-').reverse().join('/')}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs font-black text-slate-800 uppercase">{plan.partyCode}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs font-black text-slate-700 font-mono text-center">{plan.size} MM</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-slate-500 text-center">{plan.micron}</td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap text-xs font-black text-emerald-600">{plan.qty.toFixed(3)} <span className="text-[9px] text-slate-400">KG</span></td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap text-xs font-black text-indigo-600">{plan.meter || '-'} <span className="text-[9px] text-slate-400">M</span></td>
                                    <td className="px-4 py-3"><div className="flex justify-center gap-2"><button onClick={() => handleEdit(plan)} className="p-1.5 text-indigo-600 hover:bg-white border border-transparent hover:border-indigo-200 rounded transition-colors"><Edit2 size={12} /></button><button onClick={() => { if(confirm("Delete entry?")) deletePlantPlan(plan.id); }} className="p-1.5 text-red-500 hover:bg-white border border-transparent hover:border-red-200 rounded transition-colors"><Trash2 size={12} /></button></div></td>
                                </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>
    </div>
  );
};
