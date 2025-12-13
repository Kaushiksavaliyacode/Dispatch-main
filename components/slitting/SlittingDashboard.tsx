
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppData, SlittingJob, SlittingProductionRow, DispatchRow, DispatchEntry, DispatchStatus } from '../../types';
import { saveSlittingJob, saveDispatch, ensurePartyExists } from '../../services/storageService';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

interface BatchRow {
    meter: string;
    gross: string;
    core: string;
}

export const SlittingDashboard: React.FC<Props> = ({ data, onUpdate }) => {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [activeCoilId, setActiveCoilId] = useState<string>('');
  const [batchRows, setBatchRows] = useState<BatchRow[]>(
      Array(5).fill({ meter: '', gross: '', core: '' })
  );
  const [coilBundles, setCoilBundles] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedJob = data.slittingJobs.find(j => j.id === selectedJobId);

  // Initialize Coil Selection
  useEffect(() => {
    if (selectedJob && !activeCoilId && selectedJob.coils.length > 0) {
        setActiveCoilId(selectedJob.coils[0].id);
    }
  }, [selectedJobId, selectedJob]);

  // Load Bundles
  useEffect(() => {
      if (selectedJob && activeCoilId) {
          const coil = selectedJob.coils.find(c => c.id === activeCoilId);
          setCoilBundles(coil?.producedBundles?.toString() || '0');
          // Reset batch rows only on coil change to keep data clean
          setBatchRows(Array(5).fill({ meter: '', gross: '', core: '' }));
      }
  }, [activeCoilId, selectedJob]);

  // Helper: Get Next Sr No
  const historyRows = useMemo(() => {
      if (!selectedJob || !activeCoilId) return [];
      return selectedJob.rows
        .filter(r => r.coilId === activeCoilId)
        .sort((a, b) => a.srNo - b.srNo);
  }, [selectedJob, activeCoilId]);

  const startSrNo = useMemo(() => {
      if (historyRows.length === 0) return 1;
      return historyRows[historyRows.length - 1].srNo + 1;
  }, [historyRows]);

  // Handle Input Changes
  const handleBatchChange = (index: number, field: keyof BatchRow, value: string) => {
      const newRows = [...batchRows];
      const currentRow = { ...newRows[index], [field]: value };
      
      // Auto-calc Meter
      if (field === 'gross' || field === 'core') {
          const gross = parseFloat(currentRow.gross) || 0;
          const core = parseFloat(currentRow.core) || 0;
          const net = Math.max(0, gross - core);
          
          if (selectedJob && activeCoilId) {
             const coil = selectedJob.coils.find(c => c.id === activeCoilId);
             const sizeVal = parseFloat(coil?.size || '0');
             const micron = selectedJob.planMicron;
             
             if (net > 0 && sizeVal > 0 && micron > 0) {
                 const DENSITY = 0.00139; // Updated density factor
                 const calculatedMeter = (net * 1000) / (sizeVal * micron * DENSITY);
                 currentRow.meter = Math.round(calculatedMeter).toString();
             } else {
                 currentRow.meter = '';
             }
          }
      }

      newRows[index] = currentRow;
      setBatchRows(newRows);
  };

  // AUTO SAVE LOGIC
  const saveSingleRow = async (index: number) => {
      if (!selectedJob || !activeCoilId || isSaving) return;
      const row = batchRows[index];
      
      const gross = parseFloat(row.gross) || 0;
      const core = parseFloat(row.core); // Allow 0

      // Validation: Gross must be > 0, Core must be valid number
      if (gross <= 0 || isNaN(core)) return;

      setIsSaving(true);
      try {
          const selectedCoilIndex = selectedJob.coils.findIndex(c => c.id === activeCoilId);
          const selectedCoil = selectedJob.coils[selectedCoilIndex];
          const currentSr = startSrNo + index; // Use calculated SR based on history

          const newEntry: SlittingProductionRow = {
              id: `slit-row-${Date.now()}`,
              coilId: activeCoilId,
              srNo: currentSr, // Note: This might shift if multiple people edit, but for single op it's fine
              size: selectedCoil.size,
              micron: selectedJob.planMicron,
              grossWeight: gross,
              coreWeight: core,
              netWeight: gross - core,
              meter: parseFloat(row.meter) || 0
          };

          // 1. Add to Job Rows
          const updatedRows = [...selectedJob.rows, newEntry];
          
          // 2. Clear this specific batch row to "reset" it for next entry
          // We splice it out? No, keep index stable. Just reset values.
          const newBatchRows = [...batchRows];
          newBatchRows[index] = { meter: '', gross: '', core: '' };
          setBatchRows(newBatchRows);

          // 3. Save Job
          const updatedJob: SlittingJob = {
              ...selectedJob,
              rows: updatedRows,
              status: 'IN_PROGRESS', 
              updatedAt: new Date().toISOString()
          };

          await saveSlittingJob(updatedJob);
          await syncWithDispatch(updatedJob, updatedRows);
      } catch (e) {
          console.error("Auto Save Failed", e);
      } finally {
          setIsSaving(false);
      }
  };

  const handleBundleSave = async () => {
      if (!selectedJob || !activeCoilId) return;
      const selectedCoilIndex = selectedJob.coils.findIndex(c => c.id === activeCoilId);
      if (selectedCoilIndex === -1) return;

      const newBundleCount = parseInt(coilBundles) || 0;
      const selectedCoil = selectedJob.coils[selectedCoilIndex];

      if (newBundleCount === selectedCoil.producedBundles) return; // No change

      const updatedCoils = [...selectedJob.coils];
      updatedCoils[selectedCoilIndex] = { ...selectedCoil, producedBundles: newBundleCount };

      const updatedJob = { ...selectedJob, coils: updatedCoils, updatedAt: new Date().toISOString() };
      await saveSlittingJob(updatedJob);
      await syncWithDispatch(updatedJob, selectedJob.rows);
  };

  const handleDeleteRow = async (rowId: string) => {
      if (!selectedJob) return;
      if (!confirm("Delete this entry?")) return;

      const updatedRows = selectedJob.rows.filter(r => r.id !== rowId);
      const updatedJob = { ...selectedJob, rows: updatedRows, updatedAt: new Date().toISOString() };
      
      await saveSlittingJob(updatedJob);
      await syncWithDispatch(updatedJob, updatedRows);
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>, job: SlittingJob) => {
      e.stopPropagation();
      const newStatus = e.target.value as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
      const updatedJob = { ...job, status: newStatus, updatedAt: new Date().toISOString() };
      await saveSlittingJob(updatedJob);
  };

  const syncWithDispatch = async (job: SlittingJob, updatedRows: SlittingProductionRow[]) => {
      const existingDispatch = data.dispatches.find(d => d.dispatchNo === job.jobNo);
      const coilAggregates: Record<string, { weight: number, pcs: number }> = {};
      
      job.coils.forEach(c => { coilAggregates[c.size] = { weight: 0, pcs: 0 }; });

      updatedRows.forEach(r => {
          if (r.netWeight > 0) {
              const coil = job.coils.find(c => c.id === r.coilId);
              if (coil) {
                  coilAggregates[coil.size].weight += r.netWeight;
                  coilAggregates[coil.size].pcs += 1;
              }
          }
      });

      const dispatchRows: DispatchRow[] = job.coils.map(c => {
          const agg = coilAggregates[c.size];
          return {
              id: `slit-row-${c.id}`, 
              size: c.size,
              sizeType: 'ROLL',
              micron: job.planMicron,
              weight: parseFloat(agg.weight.toFixed(3)),
              productionWeight: 0,
              wastage: 0,
              pcs: agg.pcs, 
              bundle: c.producedBundles || 0, // SYNC BUNDLES
              status: DispatchStatus.SLITTING,
              isCompleted: false,
              isLoaded: false
          };
      });

      let dispatchEntry: DispatchEntry;
      const totalWt = parseFloat(Object.values(coilAggregates).reduce((s, a) => s + a.weight, 0).toFixed(3));
      const commonData = {
          rows: dispatchRows,
          totalWeight: totalWt,
          totalPcs: Object.values(coilAggregates).reduce((s, a) => s + a.pcs, 0),
          updatedAt: new Date().toISOString(),
          isTodayDispatch: true,
          status: DispatchStatus.SLITTING
      };

      if (existingDispatch) {
          dispatchEntry = { ...existingDispatch, ...commonData };
      } else {
          const partyId = await ensurePartyExists(data.parties, job.jobCode);
          dispatchEntry = {
              id: `d-slit-${job.id}`,
              dispatchNo: job.jobNo,
              date: new Date().toISOString().split('T')[0],
              partyId: partyId,
              createdAt: new Date().toISOString(),
              ...commonData
          };
      }
      await saveDispatch(dispatchEntry);
  };

  const getPartyName = (job: SlittingJob) => {
      const p = data.parties.find(p => p.name === job.jobCode);
      return p ? (p.code ? `[${p.code}] ${p.name}` : p.name) : job.jobCode;
  };

  const handleAddMoreRows = () => {
      setBatchRows(prev => [...prev, ...Array(5).fill({ meter: '', gross: '', core: '' })]);
  };

  if (selectedJob) {
      const selectedCoil = selectedJob.coils.find(c => c.id === activeCoilId);
      const totalProduction = selectedJob.rows.reduce((sum, r) => sum + r.netWeight, 0);

      return (
          <div className="max-w-5xl mx-auto p-2 sm:p-4 space-y-4 animate-in slide-in-from-right-4 duration-300">
             
             {/* 1. Header & Job Details */}
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4">
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 mb-3">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setSelectedJobId(null)} className="bg-slate-100 p-1.5 rounded-lg text-slate-500 hover:text-slate-800">
                                ←
                            </button>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-bold text-slate-800 leading-none">#{selectedJob.jobNo}</h2>
                                    <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-500">{selectedJob.date.split('-').reverse().join('/')}</span>
                                </div>
                                <p className="text-xs text-slate-500 font-bold truncate max-w-[200px]">{getPartyName(selectedJob)}</p>
                            </div>
                        </div>
                        <select 
                            value={selectedJob.status} 
                            onChange={(e) => handleStatusChange(e, selectedJob)}
                            className={`text-[10px] font-bold px-2 py-1.5 rounded border outline-none ${
                                selectedJob.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                selectedJob.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                        >
                            <option value="PENDING">PENDING</option>
                            <option value="IN_PROGRESS">RUNNING</option>
                            <option value="COMPLETED">DONE</option>
                        </select>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-50 p-1.5 rounded text-center border border-slate-100">
                            <span className="block text-[8px] font-bold text-slate-400 uppercase">Micron</span>
                            <span className="text-xs font-bold text-slate-700">{selectedJob.planMicron}</span>
                        </div>
                        <div className="bg-slate-50 p-1.5 rounded text-center border border-slate-100">
                            <span className="block text-[8px] font-bold text-slate-400 uppercase">Plan Qty</span>
                            <span className="text-xs font-bold text-slate-700">{selectedJob.planQty}</span>
                        </div>
                        <div className="bg-slate-50 p-1.5 rounded text-center border border-slate-100">
                            <span className="block text-[8px] font-bold text-slate-400 uppercase">Total Out</span>
                            <span className="text-xs font-bold text-emerald-600">{totalProduction.toFixed(1)}</span>
                        </div>
                    </div>
                </div>
             </div>

             {/* 2. Coil Tabs */}
             <div className="overflow-x-auto pb-1 -mx-2 px-2 sm:mx-0 sm:px-0">
                 <div className="flex gap-2 min-w-max">
                     {selectedJob.coils.map(coil => {
                         const coilTotal = selectedJob.rows.filter(r => r.coilId === coil.id).reduce((s,r) => s + r.netWeight, 0);
                         return (
                             <button 
                                key={coil.id}
                                onClick={() => setActiveCoilId(coil.id)}
                                className={`flex flex-col items-center px-4 py-2 rounded-lg border-2 transition-all min-w-[80px] ${
                                    activeCoilId === coil.id 
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                                    : 'bg-white border-slate-200 text-slate-500'
                                }`}
                             >
                                 <span className="text-xs font-bold">{coil.size}</span>
                                 <span className={`text-[10px] ${activeCoilId === coil.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                                     {coilTotal.toFixed(1)} kg
                                 </span>
                             </button>
                         );
                     })}
                 </div>
             </div>

             {/* 3. Unified Excel-Style Data Entry Table */}
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                 {/* Toolbar */}
                 <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100 flex flex-wrap justify-between items-center gap-3 sticky top-0 z-20">
                     <div className="flex items-center gap-2">
                         <span className="text-sm font-bold text-indigo-800 uppercase tracking-wide">{selectedCoil?.size} LOG</span>
                         {isSaving && <span className="text-[10px] font-bold text-amber-600 animate-pulse">Saving...</span>}
                     </div>
                     <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-indigo-100 shadow-sm">
                         <span className="text-[10px] font-bold text-slate-500 uppercase">Bundles:</span>
                         <input 
                            type="number" 
                            value={coilBundles}
                            onChange={(e) => setCoilBundles(e.target.value)}
                            onBlur={handleBundleSave}
                            className="w-16 font-bold text-indigo-700 outline-none border-b border-indigo-200 focus:border-indigo-500 text-center"
                            placeholder="0"
                         />
                     </div>
                 </div>
                 
                 <div className="overflow-x-auto">
                     <table className="w-full text-center text-xs">
                         <thead className="bg-slate-100 text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-10">
                             <tr>
                                 <th className="py-3 w-12 bg-slate-100">Sr</th>
                                 <th className="py-3 w-20 bg-slate-100">Meter</th>
                                 <th className="py-3 w-24 bg-slate-100">Gross</th>
                                 <th className="py-3 w-20 bg-slate-100">Core</th>
                                 <th className="py-3 w-24 text-indigo-600 bg-slate-100">Net Wt</th>
                                 <th className="py-3 w-10 bg-slate-100"></th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100 bg-slate-50/30">
                             {/* HISTORY ROWS (Read Only) */}
                             {historyRows.map((row) => (
                                 <tr key={row.id} className="bg-slate-50 text-slate-600">
                                     <td className="py-2 font-mono text-slate-400">{row.srNo}</td>
                                     <td className="py-2">{row.meter}</td>
                                     <td className="py-2">{row.grossWeight.toFixed(3)}</td>
                                     <td className="py-2 text-slate-400">{row.coreWeight}</td>
                                     <td className="py-2 font-bold text-emerald-600">{row.netWeight.toFixed(3)}</td>
                                     <td className="py-2">
                                         <button onClick={() => handleDeleteRow(row.id)} className="text-slate-300 hover:text-red-500 px-2 font-bold">×</button>
                                     </td>
                                 </tr>
                             ))}

                             {/* SEPARATOR */}
                             {historyRows.length > 0 && (
                                <tr><td colSpan={6} className="bg-white border-y border-indigo-100 py-1"><div className="h-0.5 w-full bg-indigo-50"></div></td></tr>
                             )}

                             {/* BATCH INPUT ROWS */}
                             {batchRows.map((row, idx) => {
                                 const net = (parseFloat(row.gross) || 0) - (parseFloat(row.core) || 0);
                                 return (
                                     <tr key={`batch-${idx}`} className="bg-white hover:bg-indigo-50/30 transition-colors">
                                         <td className="py-1 font-mono text-indigo-300 font-bold">{startSrNo + idx}</td>
                                         <td className="py-1 px-1">
                                             <input 
                                                 type="number" 
                                                 placeholder="Auto"
                                                 value={row.meter}
                                                 readOnly
                                                 className="w-full bg-slate-50 text-slate-500 border border-slate-200 rounded px-1 py-2 text-center font-bold outline-none cursor-not-allowed"
                                                 tabIndex={-1}
                                             />
                                         </td>
                                         <td className="py-1 px-1">
                                             <input 
                                                 type="number" 
                                                 placeholder="Gross"
                                                 value={row.gross}
                                                 onChange={e => handleBatchChange(idx, 'gross', e.target.value)}
                                                 onBlur={() => saveSingleRow(idx)}
                                                 className="w-full bg-white border border-slate-200 rounded px-1 py-2 text-center font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 text-slate-900"
                                             />
                                         </td>
                                         <td className="py-1 px-1">
                                             <input 
                                                 type="number" 
                                                 placeholder="Core"
                                                 value={row.core}
                                                 onChange={e => handleBatchChange(idx, 'core', e.target.value)}
                                                 onBlur={() => saveSingleRow(idx)}
                                                 className="w-full bg-white border border-slate-200 rounded px-1 py-2 text-center font-bold text-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                                             />
                                         </td>
                                         <td className="py-1 font-bold text-indigo-700">
                                             {net > 0 ? net.toFixed(3) : '-'}
                                         </td>
                                         <td></td>
                                     </tr>
                                 );
                             })}
                         </tbody>
                     </table>
                 </div>
                 
                 <div className="p-3 bg-white border-t border-slate-200 flex gap-2 sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                     <button 
                         onClick={handleAddMoreRows}
                         className="flex-1 bg-white border-2 border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 font-bold py-3 rounded-lg transition-all text-xs uppercase tracking-wide"
                     >
                         + 5 Rows
                     </button>
                 </div>
             </div>
          </div>
      );
  }

  // LIST VIEW - Show ALL jobs sorted by Status Priority
  const sortedJobs = [...data.slittingJobs].sort((a, b) => {
      const statusOrder = { 'IN_PROGRESS': 0, 'PENDING': 1, 'COMPLETED': 2 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
  
  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
       <div className="flex items-center gap-3 mb-6">
           <div className="bg-amber-500 text-white p-3 rounded-xl shadow-lg shadow-amber-200">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
           </div>
           <div>
               <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Operator Dashboard</h1>
               <p className="text-slate-500 text-xs font-bold">Select a Job Card to Start Production</p>
           </div>
       </div>

       {/* 2-Column Grid Layout */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {sortedJobs.map(job => {
               // Resolve Party Name
               const partyName = getPartyName(job);
               
               return (
               <div 
                   key={job.id} 
                   className={`bg-white rounded-xl border shadow-sm p-5 cursor-pointer hover:shadow-md transition-all group relative ${
                       job.status === 'IN_PROGRESS' ? 'border-amber-400 ring-1 ring-amber-100' : 
                       job.status === 'COMPLETED' ? 'border-slate-200 opacity-80 bg-slate-50' : 'border-slate-200'
                   }`}
                   onClick={() => setSelectedJobId(job.id)}
               >
                   <div className="flex justify-between items-start mb-3">
                       <div className="flex-1 pr-2">
                           <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200">{job.date.split('-').reverse().join('/')}</span>
                           <h3 className="text-lg font-bold text-slate-800 mt-2">#{job.jobNo}</h3>
                           <p className="text-sm font-medium text-slate-500 truncate">{partyName}</p>
                       </div>
                       
                       {/* Status Dropdown in Card */}
                       <div onClick={e => e.stopPropagation()}>
                           <select 
                               value={job.status} 
                               onChange={(e) => handleStatusChange(e, job)}
                               className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide outline-none border ${
                                   job.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                   job.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                   'bg-slate-100 text-slate-500 border-slate-200'
                               }`}
                           >
                               <option value="PENDING">PENDING</option>
                               <option value="IN_PROGRESS">RUNNING</option>
                               <option value="COMPLETED">DONE</option>
                           </select>
                       </div>
                   </div>
                   
                   <div className="bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                       <div className="flex justify-between text-xs mb-1">
                           <span className="font-bold text-slate-400 uppercase">Target</span>
                           <span className="font-bold text-slate-700">{job.planQty} kg</span>
                       </div>
                       <div className="flex justify-between text-xs">
                           <span className="font-bold text-slate-400 uppercase">Sizes</span>
                           <span className="font-bold text-slate-700">{job.coils.map(c => c.size).join(', ')}</span>
                       </div>
                   </div>

                   <button className="w-full mt-4 bg-white border-2 border-slate-100 text-slate-400 group-hover:bg-indigo-600 group-hover:border-indigo-600 group-hover:text-white py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider">
                       {job.status === 'COMPLETED' ? 'View Data' : 'Open Job'}
                   </button>
               </div>
           )})}
           
           {sortedJobs.length === 0 && (
               <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
                   <p className="text-slate-400 font-bold">No Jobs Found</p>
                   <p className="text-xs text-slate-300 mt-1">Contact Admin to create new Job Cards</p>
               </div>
           )}
       </div>
    </div>
  );
};
