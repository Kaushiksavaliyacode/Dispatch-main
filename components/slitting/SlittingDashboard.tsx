
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppData, SlittingJob, SlittingProductionRow, DispatchRow, DispatchEntry, DispatchStatus, SlittingPlan } from '../../types';
import { saveSlittingJob, saveDispatch, ensurePartyExists } from '../../services/storageService';
import { UserCheck, Package, Ruler, Layers } from 'lucide-react';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

interface LocalRow {
    id: string; 
    srNo: number;
    meter: string;
    gross: string;
    core: string;
    isSaved: boolean; 
}

const formatInputValue = (val: number | string) => {
    if (!val) return '';
    const num = parseFloat(val.toString());
    return num === 0 ? '' : val.toString();
};

interface UnifiedRowProps {
    id: string;
    srNo: number;
    meter: string | number;
    gross: string | number;
    core: string | number;
    net: number;
    isSaved: boolean;
    onSave: (srNo: number, gross: string, core: string) => void;
    onDelete: (id: string, srNo: number) => void;
    onInputChange?: (srNo: number, field: 'gross'|'core', value: string) => void;
}

const UnifiedRow: React.FC<UnifiedRowProps> = ({ 
    id, srNo, meter, gross, core, net, isSaved, onSave, onDelete, onInputChange 
}) => {
    const [localGross, setLocalGross] = useState(formatInputValue(gross));
    const [localCore, setLocalCore] = useState(formatInputValue(core));

    useEffect(() => { setLocalGross(formatInputValue(gross)); }, [gross]);
    useEffect(() => { setLocalCore(formatInputValue(core)); }, [core]);

    const handleChange = (field: 'gross' | 'core', val: string) => {
        if (field === 'gross') setLocalGross(val);
        else setLocalCore(val);
        if (onInputChange) onInputChange(srNo, field, val);
    };

    return (
        <tr className={`transition-colors h-7 group ${isSaved ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-blue-50'}`}>
            <td className="border border-slate-300 text-[10px] font-mono text-slate-500 font-bold text-center w-8 bg-slate-50 relative">
                {srNo}
                {isSaved && <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-emerald-500 rounded-bl-full"></span>}
            </td>
            <td className="border border-slate-300 p-0 w-16 bg-slate-50">
                <div className="w-full h-full flex items-center justify-center font-mono font-bold text-slate-500 text-[10px]">{meter || '-'}</div>
            </td>
            <td className="border border-slate-300 p-0">
                <input type="number" value={localGross} onChange={e => handleChange('gross', e.target.value)} onBlur={() => onSave(srNo, localGross, localCore)} className="w-full h-full px-1 text-center bg-transparent outline-none font-bold text-slate-900 focus:bg-indigo-50 text-[10px]" />
            </td>
            <td className="border border-slate-300 p-0">
                <input type="number" value={localCore} onChange={e => handleChange('core', e.target.value)} onBlur={() => onSave(srNo, localGross, localCore)} className="w-full h-full px-1 text-center bg-transparent outline-none font-bold text-slate-600 focus:bg-indigo-50 text-[10px]" />
            </td>
            <td className="border border-slate-300 bg-slate-50 text-[10px] font-bold text-emerald-700 text-center w-16 font-mono">{(parseFloat(localGross) > 0 && net > 0) ? net.toFixed(3) : ''}</td>
            <td className="border border-slate-300 bg-slate-50 text-center w-8 p-0">
                {(localGross || localCore || isSaved) && (
                    <button onClick={() => onDelete(id, srNo)} className="w-full h-full flex items-center justify-center text-slate-300 hover:text-red-500" tabIndex={-1}><span className="text-[10px] font-bold">✕</span></button>
                )}
            </td>
        </tr>
    );
};

export const SlittingDashboard: React.FC<Props> = ({ data, onUpdate }) => {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [activeCoilId, setActiveCoilId] = useState<string>('');
  const [coilBundles, setCoilBundles] = useState<string>('');
  const [localRows, setLocalRows] = useState<LocalRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const selectedJob = data.slittingJobs.find(j => j.id === selectedJobId);

  useEffect(() => { if (selectedJob && !activeCoilId && selectedJob.coils.length > 0) setActiveCoilId(selectedJob.coils[0].id); }, [selectedJobId, selectedJob]);

  useEffect(() => {
      if (selectedJob && activeCoilId) {
          const coil = selectedJob.coils.find(c => c.id === activeCoilId);
          setCoilBundles(coil?.producedBundles?.toString() || '0');
          const dbRows = selectedJob.rows.filter(r => r.coilId === activeCoilId);
          const maxSr = dbRows.length > 0 ? Math.max(...dbRows.map(r => r.srNo)) : 0;
          generateLocalRows(maxSr, 5, true); 
      }
  }, [activeCoilId, selectedJobId]);

  const generateLocalRows = (startAfterSr: number, count: number, reset: boolean = false) => {
      setLocalRows(prev => {
          const newRows: LocalRow[] = [];
          let defaultCore = '';
          if (!reset && prev.length > 0) { const last = prev[prev.length - 1]; if (last.core) defaultCore = last.core; }
          for (let i = 1; i <= count; i++) {
              const sr = startAfterSr + i;
              newRows.push({ id: `slit-row-${activeCoilId}-${sr}`, srNo: sr, meter: '', gross: '', core: defaultCore, isSaved: false });
          }
          return reset ? newRows : [...prev, ...newRows];
      });
  };

  const displayRows = useMemo(() => {
      if (!selectedJob || !activeCoilId) return [];
      const dbRows = selectedJob.rows.filter(r => r.coilId === activeCoilId);
      const validLocalRows = localRows.filter(l => !dbRows.some(d => d.srNo === l.srNo));
      const combined = [
          ...dbRows.map(r => ({ ...r, gross: r.grossWeight, core: r.coreWeight, net: r.netWeight, isSaved: true })),
          ...validLocalRows.map(r => {
              const g = parseFloat(r.gross) || 0;
              const c = parseFloat(r.core) || 0;
              return { id: r.id, coilId: activeCoilId, srNo: r.srNo, size: '', meter: r.meter || 0, micron: 0, grossWeight: g, coreWeight: c, netWeight: g - c, gross: r.gross, core: r.core, net: g - c, isSaved: false };
          })
      ];
      return combined.sort((a, b) => a.srNo - b.srNo);
  }, [selectedJob, activeCoilId, localRows]);

  const handleLocalInputChange = (srNo: number, field: 'gross'|'core', value: string) => {
      setLocalRows(prev => {
          const idx = prev.findIndex(r => r.srNo === srNo);
          if (idx === -1) return prev;
          const updated = [...prev];
          updated[idx] = { ...updated[idx], [field]: value };
          if (field === 'core') { for (let i = idx + 1; i < updated.length; i++) updated[i] = { ...updated[i], core: value }; }
          const row = updated[idx];
          const g = parseFloat(row.gross) || 0;
          const c = parseFloat(row.core) || 0;
          const net = Math.max(0, g - c);
          if (net > 0 && selectedJob) {
              const coil = selectedJob.coils.find(c => c.id === activeCoilId);
              const sizeVal = parseFloat(coil?.size || '0');
              const micron = selectedJob.planMicron;
              if (sizeVal > 0 && micron > 0) {
                  const sizeInMeters = sizeVal / 1000;
                  const calculatedMeter = net / micron / 0.00139 / sizeInMeters;
                  updated[idx].meter = (Math.round(calculatedMeter / 10) * 10).toString();
              }
          } else updated[idx].meter = '';
          return updated;
      });
  };

  const handleSaveRow = async (srNo: number, grossStr: string, coreStr: string) => {
      if (!selectedJob || !activeCoilId) return;
      const gross = parseFloat(grossStr) || 0;
      const core = parseFloat(coreStr);
      if (gross <= 0 || isNaN(core)) return;
      const existingDbRow = selectedJob.rows.find(r => r.coilId === activeCoilId && r.srNo === srNo);
      if (existingDbRow && existingDbRow.grossWeight === gross && existingDbRow.coreWeight === core) return;
      setIsSaving(true);
      try {
          const selectedCoil = selectedJob.coils.find(c => c.id === activeCoilId);
          const netWeight = gross - core;
          let meter = 0;
          const sizeVal = parseFloat(selectedCoil?.size || '0');
          if (netWeight > 0 && sizeVal > 0 && selectedJob.planMicron > 0) {
              const calculatedMeter = netWeight / selectedJob.planMicron / 0.00139 / (sizeVal / 1000);
              meter = Math.round(calculatedMeter / 10) * 10;
          }
          const newEntry: SlittingProductionRow = { id: `slit-row-${activeCoilId}-${srNo}`, coilId: activeCoilId, srNo: srNo, size: selectedCoil?.size || '', micron: selectedJob.planMicron, grossWeight: gross, coreWeight: core, netWeight: netWeight, meter: meter };
          let updatedRows = [...selectedJob.rows];
          const existingIdx = updatedRows.findIndex(r => r.id === newEntry.id);
          if (existingIdx >= 0) updatedRows[existingIdx] = newEntry; else updatedRows.push(newEntry);
          const updatedJob: SlittingJob = { ...selectedJob, rows: updatedRows, status: 'IN_PROGRESS', updatedAt: new Date().toISOString() };
          await saveSlittingJob(updatedJob);
          await syncWithDispatch(updatedJob, updatedRows);
      } catch (e) { console.error("Save Failed", e); } finally { setIsSaving(false); }
  };

  const handleDeleteRow = async (id: string, srNo: number) => {
      const inDb = selectedJob?.rows.some(r => r.id === id);
      if (inDb && selectedJob) {
          const updatedRows = selectedJob.rows.filter(r => r.id !== id);
          const updatedJob = { ...selectedJob, rows: updatedRows, updatedAt: new Date().toISOString() };
          await saveSlittingJob(updatedJob);
          await syncWithDispatch(updatedJob, updatedRows);
      }
      setLocalRows(prev => {
          const idx = prev.findIndex(r => r.srNo === srNo);
          if (idx !== -1) { const updated = [...prev]; updated[idx] = { ...updated[idx], gross: '', core: '', meter: '', isSaved: false }; return updated; }
          return [...prev, { id: id, srNo: srNo, meter: '', gross: '', core: '', isSaved: false }].sort((a, b) => a.srNo - b.srNo);
      });
  };

  const handleAddMoreRows = () => {
      const maxSr = displayRows.length > 0 ? Math.max(...displayRows.map(r => r.srNo)) : 0;
      generateLocalRows(maxSr, 5, false);
  };

  const handleBundleSave = async () => {
      if (!selectedJob || !activeCoilId) return;
      const idx = selectedJob.coils.findIndex(c => c.id === activeCoilId);
      if (idx === -1) return;
      const newCount = parseInt(coilBundles) || 0;
      if (newCount === selectedJob.coils[idx].producedBundles) return;
      const updatedCoils = [...selectedJob.coils];
      updatedCoils[idx] = { ...selectedJob.coils[idx], producedBundles: newCount };
      const updatedJob = { ...selectedJob, coils: updatedCoils, updatedAt: new Date().toISOString() };
      await saveSlittingJob(updatedJob);
      await syncWithDispatch(updatedJob, selectedJob.rows);
  };

  const syncWithDispatch = async (job: SlittingJob, updatedRows: SlittingProductionRow[]) => {
      const existingDispatch = data.dispatches.find(d => d.dispatchNo === job.jobNo);
      const aggregates: Record<string, { weight: number, pcs: number }> = {};
      job.coils.forEach(c => { aggregates[c.size] = { weight: 0, pcs: 0 }; });
      updatedRows.forEach(r => {
          const coil = job.coils.find(c => c.id === r.coilId);
          if (coil) { aggregates[coil.size].weight += r.netWeight; aggregates[coil.size].pcs += 1; }
      });
      const dispatchRows: DispatchRow[] = job.coils.map(c => ({ id: `slit-row-${c.id}`, size: c.size, sizeType: 'ROLL', micron: job.planMicron, weight: parseFloat(aggregates[c.size].weight.toFixed(3)), productionWeight: 0, wastage: 0, pcs: aggregates[c.size].pcs, bundle: c.producedBundles || 0, status: DispatchStatus.SLITTING, isCompleted: false, isLoaded: false }));
      const searchKey = job.jobCode.trim().toLowerCase();
      const matchedParty = data.parties.find(p => (p.code && p.code.toLowerCase() === searchKey) || p.name.toLowerCase() === searchKey);
      const partyId = matchedParty ? matchedParty.id : (existingDispatch?.partyId || await ensurePartyExists(data.parties, job.jobCode));
      const totalWt = parseFloat(Object.values(aggregates).reduce((s, a) => s + a.weight, 0).toFixed(3));
      const payload = { rows: dispatchRows, totalWeight: totalWt, totalPcs: Object.values(aggregates).reduce((s, a) => s + a.pcs, 0), updatedAt: new Date().toISOString(), isTodayDispatch: true, status: DispatchStatus.SLITTING, partyId: partyId };
      if (existingDispatch) await saveDispatch({ ...existingDispatch, ...payload });
      else await saveDispatch({ id: `d-slit-${job.id}`, dispatchNo: job.jobNo, date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(), ...payload });
  };

  const filteredJobs = useMemo(() => {
      return data.slittingJobs.filter(j => {
          const q = searchQuery.toLowerCase();
          const pName = data.parties.find(p => p.name.toLowerCase() === j.jobCode.toLowerCase() || (p.code && p.code.toLowerCase() === j.jobCode.toLowerCase()))?.name.toLowerCase() || j.jobCode.toLowerCase();
          return (j.jobNo.toLowerCase().includes(q) || pName.includes(q)) && (filterStatus === 'ALL' || j.status === filterStatus);
      }).sort((a, b) => {
          const order: any = { 'IN_PROGRESS': 0, 'PENDING': 1, 'COMPLETED': 2 };
          if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [data.slittingJobs, searchQuery, filterStatus, data.parties]);

  if (selectedJob) {
      const totalProduction = selectedJob.rows.reduce((sum, r) => sum + r.netWeight, 0);
      return (
          <div className="max-w-5xl mx-auto p-2 sm:p-4 space-y-4 animate-in slide-in-from-right-4 duration-300 pb-20">
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setSelectedJobId(null)} className="bg-slate-100 p-1.5 rounded-lg text-slate-500 hover:text-slate-800 transition-colors">←</button>
                        <div>
                            <div className="flex items-center gap-2"><h2 className="text-lg font-bold text-slate-800 leading-none">#{selectedJob.jobNo}</h2><span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-500">{selectedJob.date.split('-').reverse().join('/')}</span></div>
                            <p className="text-xs text-slate-500 font-bold truncate max-w-[200px]">{data.parties.find(p => p.name.toLowerCase() === selectedJob.jobCode.toLowerCase() || (p.code && p.code.toLowerCase() === selectedJob.jobCode.toLowerCase()))?.name || selectedJob.jobCode}</p>
                        </div>
                    </div>
                    <select value={selectedJob.status} onChange={(e) => saveSlittingJob({ ...selectedJob, status: e.target.value as any, updatedAt: new Date().toISOString() })} className={`text-[10px] font-bold px-2 py-1.5 rounded border ${selectedJob.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' : selectedJob.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'}`}><option value="PENDING">PENDING</option><option value="IN_PROGRESS">RUNNING</option><option value="COMPLETED">DONE</option></select>
                </div>
                <div className="flex gap-2 text-xs bg-slate-50 p-2 rounded-lg border border-slate-100 overflow-x-auto whitespace-nowrap">
                    <div className="px-2 border-r border-slate-200"><span className="text-[9px] text-slate-400 font-bold uppercase block">Micron</span><span className="font-bold text-slate-700">{selectedJob.planMicron}</span></div>
                    <div className="px-2 border-r border-slate-200"><span className="text-[9px] text-slate-400 font-bold uppercase block">Length</span><span className="font-bold text-slate-700">{selectedJob.planRollLength} m</span></div>
                    <div className="px-2 border-r border-slate-200"><span className="text-[9px] text-slate-400 font-bold uppercase block">Total Out</span><span className="font-bold text-emerald-600">{totalProduction.toFixed(3)} kg</span></div>
                    {selectedJob.sizer && <div className="px-2 border-r border-slate-200"><span className="text-[9px] text-slate-400 font-bold uppercase block">Sizer</span><span className="font-bold text-indigo-600 uppercase">{selectedJob.sizer}</span></div>}
                    {selectedJob.size && <div className="px-2"><span className="text-[9px] text-slate-400 font-bold uppercase block">Parent</span><span className="font-bold text-slate-700 uppercase">{selectedJob.size}</span></div>}
                </div>
             </div>
             <div className="overflow-x-auto pb-1 -mx-2 px-2 sm:mx-0 sm:px-0 custom-scrollbar"><div className="flex gap-2 min-w-max">{selectedJob.coils.map((coil, idx) => (<button key={coil.id} onClick={() => setActiveCoilId(coil.id)} className={`flex flex-col items-center px-4 py-2 rounded-lg border-2 transition-all min-w-[80px] ${activeCoilId === coil.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-md transform scale-105' : 'bg-white border-slate-200 text-slate-500'}`}><span className="text-[9px] font-bold uppercase opacity-80">Coil {idx+1}</span><span className="text-sm font-bold">{coil.size}</span><span className={`text-[9px] font-bold ${activeCoilId === coil.id ? 'text-indigo-200' : 'text-slate-400'}`}>{selectedJob.rows.filter(r => r.coilId === coil.id).reduce((s,r) => s + r.netWeight, 0).toFixed(1)} kg</span></button>))}</div></div>
             <div className="bg-white rounded-lg shadow-lg shadow-slate-200/50 border border-slate-300 overflow-hidden flex flex-col">
                 <div className="bg-slate-50 px-4 py-2 border-b border-slate-300 flex flex-wrap justify-between items-center gap-3 sticky top-0 z-20">
                     <div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{selectedJob.coils.find(c => c.id === activeCoilId)?.size} LOG</span>{isSaving && <span className="text-[9px] font-bold text-amber-500 animate-pulse bg-white px-2 py-0.5 rounded border">Saving...</span>}</div>
                     <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm"><span className="text-[9px] font-bold text-slate-500 uppercase">Bundles</span><input type="number" value={coilBundles} onChange={(e) => setCoilBundles(e.target.value)} onBlur={handleBundleSave} className="w-10 font-bold text-indigo-700 outline-none border-b border-indigo-100 text-center text-xs" /></div>
                 </div>
                 <div className="overflow-x-auto custom-scrollbar p-1">
                     <table className="w-full text-center text-[10px] border-collapse border border-slate-400">
                         <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-400 sticky top-0 z-10"><tr><th className="py-1 px-1 border border-slate-400 w-8">#</th><th className="py-1 px-1 border border-slate-400 w-16">Meter</th><th className="py-1 px-1 border border-slate-400 w-20">Gross Wt</th><th className="py-1 px-1 border border-slate-400 w-20">Core Wt</th><th className="py-1 px-1 border border-slate-400 w-16 text-indigo-800">Net Wt</th><th className="py-1 px-1 border border-slate-400 w-8"></th></tr></thead>
                         <tbody className="bg-white">{displayRows.map((row) => (<UnifiedRow key={row.id} id={row.id} srNo={row.srNo} meter={row.meter} gross={row.gross || row.grossWeight} core={row.core || row.coreWeight} net={row.net || row.netWeight} isSaved={row.isSaved} onSave={handleSaveRow} onDelete={handleDeleteRow} onInputChange={handleLocalInputChange} />))}</tbody>
                     </table>
                 </div>
                 <div className="p-2 bg-slate-50 border-t border-slate-300 flex gap-2 sticky bottom-0 z-20"><button onClick={handleAddMoreRows} className="w-full bg-white border border-slate-300 text-slate-600 font-bold py-2 rounded shadow-sm text-[10px] uppercase tracking-wide"><span>+ Add 5 Rows</span></button></div>
             </div>
          </div>
      );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6 pb-20">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div><h1 className="text-2xl font-bold text-slate-800 tracking-tight">Operator Dashboard</h1><p className="text-xs font-bold text-slate-500">Select a Job Card to Start Production</p></div>
           <div className="flex flex-wrap gap-2 w-full md:w-auto"><input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none" /><select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold focus:outline-none"><option value="ALL">All Status</option><option value="PENDING">Pending</option><option value="IN_PROGRESS">Running</option><option value="COMPLETED">Done</option></select></div>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {filteredJobs.map(job => (
               <div key={job.id} className={`bg-white rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-all relative overflow-hidden ${job.status === 'IN_PROGRESS' ? 'border-amber-400 ring-1 ring-amber-100' : job.status === 'COMPLETED' ? 'opacity-80 bg-slate-50' : 'border-slate-200'}`} onClick={() => setSelectedJobId(job.id)}>
                   <div className={`absolute top-0 left-0 w-1.5 h-full ${job.status === 'IN_PROGRESS' ? 'bg-amber-500' : job.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                   <div className="pl-5 p-4">
                       <div className="flex justify-between items-start mb-3">
                           <div><div className="flex items-center gap-2 mb-1"><h3 className="text-lg font-bold text-slate-800">#{job.jobNo}</h3><span className="text-[10px] font-bold text-slate-400">{job.date.split('-').reverse().slice(0,2).join('/')}</span></div><div className="text-xs font-bold text-slate-600 truncate max-w-[200px]">{data.parties.find(p => p.name.toLowerCase() === job.jobCode.toLowerCase() || (p.code && p.code.toLowerCase() === job.jobCode.toLowerCase()))?.name || job.jobCode}</div></div>
                           <span className={`text-[9px] font-bold px-1.5 py-1 rounded uppercase tracking-wide border ${job.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-700 border-amber-200' : job.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500'}`}>{job.status}</span>
                       </div>
                       <div className="flex items-center gap-3 mb-4">
                           {job.sizer && <div className="flex items-center gap-1 text-indigo-600 font-bold text-[10px] uppercase"><UserCheck size={12}/>{job.sizer}</div>}
                           {job.size && <div className="flex items-center gap-1 text-slate-500 font-bold text-[10px] uppercase"><Package size={12}/>{job.size}</div>}
                       </div>
                       <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
                           <div className="flex flex-wrap gap-1.5">{job.coils.map((c, i) => (<span key={i} className="bg-white border border-indigo-100 text-indigo-700 text-[9px] font-bold px-1.5 py-0.5 rounded">{c.size}</span>))}</div>
                           <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                               <div><div className="text-[8px] text-slate-400 font-bold uppercase">Micron</div><div className="text-xs font-extrabold text-slate-700">{job.planMicron}</div></div>
                               <div><div className="text-[8px] text-slate-400 font-bold uppercase">Target</div><div className="text-xs font-extrabold text-indigo-600">{job.planQty} kg</div></div>
                           </div>
                       </div>
                   </div>
               </div>
           ))}
       </div>
    </div>
  );
};
