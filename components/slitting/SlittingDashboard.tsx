
import React, { useState, useEffect, useMemo } from 'react';
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
  
  // State
  const [activeCoilId, setActiveCoilId] = useState<string>('');
  
  // Batch Entry State (5 Rows default)
  const [batchRows, setBatchRows] = useState<BatchRow[]>(
      Array(5).fill({ meter: '', gross: '', core: '' })
  );

  const selectedJob = data.slittingJobs.find(j => j.id === selectedJobId);

  // Initialize Coil Selection
  useEffect(() => {
    if (selectedJob && !activeCoilId && selectedJob.coils.length > 0) {
        setActiveCoilId(selectedJob.coils[0].id);
    }
  }, [selectedJobId, selectedJob]);

  // Helper: Get Next Sr No
  const startSrNo = useMemo(() => {
      if (!selectedJob) return 1;
      const max = selectedJob.rows.reduce((m, r) => Math.max(m, r.srNo), 0);
      return max + 1;
  }, [selectedJob]);

  // Handlers
  const handleBatchChange = (index: number, field: keyof BatchRow, value: string) => {
      const newRows = [...batchRows];
      newRows[index] = { ...newRows[index], [field]: value };
      setBatchRows(newRows);
  };

  const handleSaveBatch = async () => {
      if (!selectedJob || !activeCoilId) return;

      const selectedCoil = selectedJob.coils.find(c => c.id === activeCoilId);
      if (!selectedCoil) return;

      const newEntries: SlittingProductionRow[] = [];
      let currentSr = startSrNo;

      batchRows.forEach(row => {
          const gross = parseFloat(row.gross) || 0;
          if (gross > 0) {
              const core = parseFloat(row.core) || 0;
              const meter = parseFloat(row.meter) || 0;
              
              newEntries.push({
                  id: `slit-row-${Date.now()}-${Math.random()}`,
                  coilId: activeCoilId,
                  srNo: currentSr++,
                  size: selectedCoil.size,
                  micron: selectedJob.planMicron,
                  grossWeight: gross,
                  coreWeight: core,
                  netWeight: gross - core,
                  meter: meter
              });
          }
      });

      if (newEntries.length === 0) return alert("Please enter at least one valid row (Gross Wt > 0)");

      const updatedRows = [...selectedJob.rows, ...newEntries];
      const updatedJob: SlittingJob = {
          ...selectedJob,
          rows: updatedRows,
          status: 'IN_PROGRESS', // Auto set to In Progress on entry
          updatedAt: new Date().toISOString()
      };

      await saveSlittingJob(updatedJob);
      await syncWithDispatch(updatedJob, updatedRows);

      // Reset Batch Rows
      setBatchRows(Array(5).fill({ meter: '', gross: '', core: '' }));
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
              bundle: 0,
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

  if (selectedJob) {
      const selectedCoil = selectedJob.coils.find(c => c.id === activeCoilId);
      const totalProduction = selectedJob.rows.reduce((sum, r) => sum + r.netWeight, 0);
      const sortedHistory = [...selectedJob.rows].sort((a, b) => b.srNo - a.srNo);

      return (
          <div className="max-w-5xl mx-auto p-2 sm:p-4 space-y-4 animate-in slide-in-from-right-4 duration-300">
             
             {/* 1. Header & Job Details (Mobile Fit) */}
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4">
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 mb-3">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setSelectedJobId(null)} className="bg-slate-100 p-1.5 rounded-lg text-slate-500 hover:text-slate-800">
                                ←
                            </button>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800 leading-none">#{selectedJob.jobNo}</h2>
                                <p className="text-xs text-slate-500 font-bold">{selectedJob.jobCode}</p>
                            </div>
                        </div>
                        <select 
                            value={selectedJob.status} 
                            onChange={(e) => handleStatusChange(e, selectedJob)}
                            className={`text-xs font-bold px-2 py-1.5 rounded border outline-none ${
                                selectedJob.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                selectedJob.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                        >
                            <option value="PENDING">PENDING</option>
                            <option value="IN_PROGRESS">RUNNING</option>
                            <option value="COMPLETED">COMPLETED</option>
                        </select>
                    </div>
                    
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Current Output</span>
                        <span className="text-xl font-bold text-emerald-600">{totalProduction.toFixed(3)} <span className="text-xs text-emerald-400">kg</span></span>
                    </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                        <span className="block text-[9px] font-bold text-slate-400 uppercase">Date</span>
                        <span className="text-xs font-bold text-slate-700">{selectedJob.date.split('-').slice(1).join('/')}</span>
                    </div>
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                        <span className="block text-[9px] font-bold text-slate-400 uppercase">Plan Qty</span>
                        <span className="text-xs font-bold text-slate-700">{selectedJob.planQty}</span>
                    </div>
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                        <span className="block text-[9px] font-bold text-slate-400 uppercase">Micron</span>
                        <span className="text-xs font-bold text-slate-700">{selectedJob.planMicron}</span>
                    </div>
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                        <span className="block text-[9px] font-bold text-slate-400 uppercase">Length</span>
                        <span className="text-xs font-bold text-slate-700">{selectedJob.planRollLength}m</span>
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
                                className={`flex flex-col items-center px-4 py-2 rounded-lg border-2 transition-all ${
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

             {/* 3. Batch Entry Table */}
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-100 flex justify-between items-center">
                     <span className="text-xs font-bold text-indigo-700 uppercase">Batch Entry ({selectedCoil?.size})</span>
                     <span className="text-[10px] font-bold text-indigo-400">Next Sr: {startSrNo}</span>
                 </div>
                 
                 <div className="overflow-x-auto">
                     <table className="w-full text-center text-xs">
                         <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                             <tr>
                                 <th className="py-2 w-10">Sr</th>
                                 <th className="py-2 w-20">Meter</th>
                                 <th className="py-2 w-24">Gross</th>
                                 <th className="py-2 w-20">Core</th>
                                 <th className="py-2 w-24 text-indigo-600">Net Wt</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                             {batchRows.map((row, idx) => {
                                 const net = (parseFloat(row.gross) || 0) - (parseFloat(row.core) || 0);
                                 return (
                                     <tr key={idx}>
                                         <td className="py-1 font-mono text-slate-400">{startSrNo + idx}</td>
                                         <td className="py-1 px-1">
                                             <input 
                                                 type="number" 
                                                 placeholder="0"
                                                 value={row.meter}
                                                 onChange={e => handleBatchChange(idx, 'meter', e.target.value)}
                                                 className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-2 text-center font-bold outline-none focus:border-indigo-500"
                                             />
                                         </td>
                                         <td className="py-1 px-1">
                                             <input 
                                                 type="number" 
                                                 placeholder="0.00"
                                                 value={row.gross}
                                                 onChange={e => handleBatchChange(idx, 'gross', e.target.value)}
                                                 className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-2 text-center font-bold outline-none focus:border-indigo-500 focus:bg-white"
                                             />
                                         </td>
                                         <td className="py-1 px-1">
                                             <input 
                                                 type="number" 
                                                 placeholder="0"
                                                 value={row.core}
                                                 onChange={e => handleBatchChange(idx, 'core', e.target.value)}
                                                 className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-2 text-center font-bold outline-none focus:border-indigo-500"
                                             />
                                         </td>
                                         <td className="py-1 font-bold text-indigo-700">
                                             {net > 0 ? net.toFixed(3) : '-'}
                                         </td>
                                     </tr>
                                 );
                             })}
                         </tbody>
                     </table>
                 </div>
                 
                 <div className="p-3 bg-slate-50 border-t border-slate-200">
                     <button 
                         onClick={handleSaveBatch}
                         className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-sm transition-all active:scale-95 text-sm uppercase tracking-wide"
                     >
                         Save Entries
                     </button>
                 </div>
             </div>

             {/* 4. History List (Simple Table) */}
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                     Recent Production
                 </div>
                 <div className="overflow-x-auto max-h-[300px]">
                     <table className="w-full text-center text-xs">
                         <thead className="bg-white text-slate-400 font-bold border-b border-slate-100">
                             <tr>
                                 <th className="py-2">Sr</th>
                                 <th className="py-2">Size</th>
                                 <th className="py-2">Meter</th>
                                 <th className="py-2">Net Wt</th>
                                 <th className="py-2">Act</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50">
                             {sortedHistory.map(row => (
                                 <tr key={row.id}>
                                     <td className="py-2 font-mono text-slate-500">{row.srNo}</td>
                                     <td className="py-2 font-bold text-slate-700">{row.size}</td>
                                     <td className="py-2 text-slate-600">{row.meter}</td>
                                     <td className="py-2 font-bold text-emerald-600">{row.netWeight.toFixed(3)}</td>
                                     <td className="py-2">
                                         <button onClick={() => handleDeleteRow(row.id)} className="text-red-400 hover:text-red-600 px-2">✕</button>
                                     </td>
                                 </tr>
                             ))}
                             {sortedHistory.length === 0 && (
                                 <tr><td colSpan={5} className="py-4 text-slate-400 italic">No records yet</td></tr>
                             )}
                         </tbody>
                     </table>
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
           {sortedJobs.map(job => (
               <div 
                   key={job.id} 
                   className={`bg-white rounded-xl border shadow-sm p-5 cursor-pointer hover:shadow-md transition-all group relative ${
                       job.status === 'IN_PROGRESS' ? 'border-amber-400 ring-1 ring-amber-100' : 
                       job.status === 'COMPLETED' ? 'border-slate-200 opacity-80 bg-slate-50' : 'border-slate-200'
                   }`}
                   onClick={() => setSelectedJobId(job.id)}
               >
                   <div className="flex justify-between items-start mb-3">
                       <div>
                           <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200">{job.date}</span>
                           <h3 className="text-lg font-bold text-slate-800 mt-2">#{job.jobNo}</h3>
                           <p className="text-sm font-medium text-slate-500">{job.jobCode}</p>
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
           ))}
           
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
