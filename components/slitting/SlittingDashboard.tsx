
import React, { useState, useEffect, useRef } from 'react';
import { AppData, SlittingJob, SlittingProductionRow, DispatchRow, DispatchEntry, DispatchStatus } from '../../types';
import { saveSlittingJob, saveDispatch, ensurePartyExists } from '../../services/storageService';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const SlittingDashboard: React.FC<Props> = ({ data, onUpdate }) => {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  
  // Production Entry State
  const [activeCoilId, setActiveCoilId] = useState<string>('');
  const [srNo, setSrNo] = useState<string>('');
  const [grossWt, setGrossWt] = useState<string>('');
  const [coreWt, setCoreWt] = useState<string>('');
  const [meter, setMeter] = useState<string>('');
  
  const srNoInputRef = useRef<HTMLInputElement>(null);

  const selectedJob = data.slittingJobs.find(j => j.id === selectedJobId);

  // Auto-increment Sr No
  useEffect(() => {
    if (selectedJob) {
       const maxSr = selectedJob.rows.reduce((max, r) => r.srNo > max ? r.srNo : max, 0);
       setSrNo((maxSr + 1).toString());
       
       // Default to first coil if not set
       if (!activeCoilId && selectedJob.coils.length > 0) {
           setActiveCoilId(selectedJob.coils[0].id);
       }
    }
  }, [selectedJobId, selectedJob]); 

  // Focus SrNo on coil change or save
  const focusInput = () => {
      setTimeout(() => {
          if(srNoInputRef.current) srNoInputRef.current.focus();
      }, 100);
  };

  const handleSaveRow = async () => {
     if (!selectedJob) return;
     
     const gross = parseFloat(grossWt) || 0;
     const core = parseFloat(coreWt) || 0;
     const net = gross - core;
     const mtr = parseFloat(meter) || 0;
     const sNo = parseInt(srNo) || 0;

     if (gross <= 0 || !activeCoilId) return alert("Please enter valid weight");

     const selectedCoil = selectedJob.coils.find(c => c.id === activeCoilId);
     if (!selectedCoil) return;

     const newRow: SlittingProductionRow = {
         id: `slit-row-${Date.now()}`,
         coilId: activeCoilId,
         srNo: sNo,
         size: selectedCoil.size,
         micron: selectedJob.planMicron,
         grossWeight: gross,
         coreWeight: core,
         netWeight: net,
         meter: mtr
     };

     const updatedRows = [...selectedJob.rows, newRow];
     const updatedJob: SlittingJob = {
         ...selectedJob,
         rows: updatedRows,
         status: 'IN_PROGRESS',
         updatedAt: new Date().toISOString()
     };

     await saveSlittingJob(updatedJob);
     await syncWithDispatch(updatedJob, updatedRows);
     
     // Reset Inputs for next entry
     setGrossWt(''); setCoreWt(''); setMeter('');
     setSrNo((sNo + 1).toString());
     focusInput();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          handleSaveRow();
      }
  };

  const handleDeleteRow = async (rowId: string) => {
      if (!selectedJob) return;
      if (!confirm("Delete this entry?")) return;

      const updatedRows = selectedJob.rows.filter(r => r.id !== rowId);
      const updatedJob = {
          ...selectedJob,
          rows: updatedRows,
          updatedAt: new Date().toISOString()
      };
      
      await saveSlittingJob(updatedJob);
      await syncWithDispatch(updatedJob, updatedRows);
  };

  const handleFinishJob = async () => {
      if (!selectedJob) return;
      if (!confirm("Mark this job as COMPLETED?")) return;

      const updatedJob = { ...selectedJob, status: 'COMPLETED' as const };
      await saveSlittingJob(updatedJob);
      setSelectedJobId(null);
  };
  
  const syncWithDispatch = async (job: SlittingJob, updatedRows: SlittingProductionRow[]) => {
      const existingDispatch = data.dispatches.find(d => d.dispatchNo === job.jobNo);
      
      // Calculate Aggregates for each Coil (Size) from updated Rows
      const coilAggregates: Record<string, { weight: number, pcs: number }> = {};
      
      job.coils.forEach(c => {
          coilAggregates[c.size] = { weight: 0, pcs: 0 };
      });

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
          // STRICT: Format to 3 decimal places
          const formattedWeight = parseFloat(agg.weight.toFixed(3));

          return {
              id: `slit-row-${c.id}`, 
              size: c.size,
              sizeType: 'ROLL',
              micron: job.planMicron,
              weight: formattedWeight, // Dispatch Weight gets value
              productionWeight: 0,     // Production Weight MUST be 0
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

      if (existingDispatch) {
          dispatchEntry = {
              ...existingDispatch,
              rows: dispatchRows,
              totalWeight: totalWt,
              totalPcs: Object.values(coilAggregates).reduce((s, a) => s + a.pcs, 0),
              updatedAt: new Date().toISOString(),
              isTodayDispatch: true,
              status: DispatchStatus.SLITTING
          };
      } else {
          const partyId = await ensurePartyExists(data.parties, job.jobCode);
          dispatchEntry = {
              id: `d-slit-${job.id}`,
              dispatchNo: job.jobNo,
              date: new Date().toISOString().split('T')[0],
              partyId: partyId,
              status: DispatchStatus.SLITTING,
              rows: dispatchRows,
              totalWeight: totalWt,
              totalPcs: Object.values(coilAggregates).reduce((s, a) => s + a.pcs, 0),
              isTodayDispatch: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
          };
      }

      await saveDispatch(dispatchEntry);
  };

  if (selectedJob) {
      const selectedCoil = selectedJob.coils.find(c => c.id === activeCoilId);
      const totalProduction = selectedJob.rows.reduce((sum, r) => sum + r.netWeight, 0);
      const sortedRows = [...selectedJob.rows].sort((a, b) => b.srNo - a.srNo);

      // Calculation for Input Row
      const net = ((parseFloat(grossWt)||0) - (parseFloat(coreWt)||0)).toFixed(3);

      return (
          <div className="max-w-7xl mx-auto p-2 sm:p-4 space-y-4 sm:space-y-6 animate-in slide-in-from-right-4 duration-300">
             {/* Header */}
             <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 gap-4">
                <button onClick={() => setSelectedJobId(null)} className="text-slate-500 hover:text-slate-800 font-bold flex items-center gap-2">
                   ← Back to Jobs
                </button>
                <div className="flex flex-wrap justify-center gap-6 text-sm">
                   <div>
                      <span className="text-xs font-bold text-slate-400 uppercase block">Job No</span>
                      <span className="font-bold text-slate-800">#{selectedJob.jobNo}</span>
                   </div>
                   <div>
                      <span className="text-xs font-bold text-slate-400 uppercase block">Party</span>
                      <span className="font-bold text-slate-800">{selectedJob.jobCode}</span>
                   </div>
                   <div>
                      <span className="text-xs font-bold text-slate-400 uppercase block">Total Output</span>
                      <span className="font-bold text-emerald-600 text-lg">{totalProduction.toFixed(3)} kg</span>
                   </div>
                </div>
                <button onClick={handleFinishJob} className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2 px-4 rounded-lg shadow-sm transition-colors">
                   Complete Job
                </button>
             </div>

             <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="p-4 sm:p-6">
                   
                   {/* 1. Coil Selection Tabs */}
                   <div className="mb-6 overflow-x-auto">
                       <div className="flex gap-2 min-w-max pb-2">
                           {selectedJob.coils.map(coil => {
                               const coilTotal = selectedJob.rows.filter(r => r.coilId === coil.id).reduce((sum, r) => sum + r.netWeight, 0);
                               return (
                                   <button 
                                       key={coil.id}
                                       onClick={() => { setActiveCoilId(coil.id); focusInput(); }}
                                       className={`relative px-4 py-2 rounded-lg text-sm font-bold border transition-all ${activeCoilId === coil.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200 scale-105' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                                   >
                                       <span>{coil.size}</span>
                                       <span className={`block text-[10px] ${activeCoilId === coil.id ? 'text-indigo-200' : 'text-slate-400'}`}>{coilTotal.toFixed(1)} kg</span>
                                   </button>
                               );
                           })}
                       </div>
                   </div>

                   {/* 2. Unified Data Table with Input Row */}
                   <div className="overflow-x-auto rounded-lg border border-slate-200">
                       <table className="w-full text-sm text-left">
                           <thead className="bg-slate-100 text-slate-500 font-bold text-xs uppercase">
                               <tr>
                                   <th className="px-4 py-3 w-20">Sr No</th>
                                   <th className="px-4 py-3 min-w-[120px]">Size</th>
                                   <th className="px-4 py-3 text-right w-24">Meter</th>
                                   <th className="px-4 py-3 text-right w-24">Gross</th>
                                   <th className="px-4 py-3 text-right w-24">Core</th>
                                   <th className="px-4 py-3 text-right text-indigo-600 w-24">Net</th>
                                   <th className="px-4 py-3 text-center w-24">Action</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                               {/* INPUT ROW - DIRECT ENTRY */}
                               <tr className="bg-indigo-50/60 shadow-inner">
                                   <td className="px-2 py-2">
                                       <input 
                                           ref={srNoInputRef}
                                           type="number" 
                                           value={srNo} 
                                           onChange={e => setSrNo(e.target.value)}
                                           onKeyDown={handleKeyDown} 
                                           className="w-full bg-white border border-indigo-200 rounded-md px-2 py-1.5 font-bold text-center outline-none focus:ring-2 focus:ring-indigo-400"
                                           placeholder="Sr"
                                       />
                                   </td>
                                   <td className="px-4 py-2 font-bold text-indigo-900">
                                       {selectedCoil?.size || "Select Coil"}
                                   </td>
                                   <td className="px-2 py-2">
                                       <input 
                                           type="number" 
                                           value={meter} 
                                           onChange={e => setMeter(e.target.value)}
                                           onKeyDown={handleKeyDown}  
                                           className="w-full bg-white border border-indigo-200 rounded-md px-2 py-1.5 font-bold text-right outline-none focus:ring-2 focus:ring-indigo-400"
                                           placeholder="0"
                                       />
                                   </td>
                                   <td className="px-2 py-2">
                                       <input 
                                           type="number" 
                                           value={grossWt} 
                                           onChange={e => setGrossWt(e.target.value)}
                                           onKeyDown={handleKeyDown}  
                                           className="w-full bg-white border border-indigo-200 rounded-md px-2 py-1.5 font-bold text-right outline-none focus:ring-2 focus:ring-indigo-400"
                                           placeholder="0.00"
                                       />
                                   </td>
                                   <td className="px-2 py-2">
                                       <input 
                                           type="number" 
                                           value={coreWt} 
                                           onChange={e => setCoreWt(e.target.value)}
                                           onKeyDown={handleKeyDown}  
                                           className="w-full bg-white border border-indigo-200 rounded-md px-2 py-1.5 font-bold text-right outline-none focus:ring-2 focus:ring-indigo-400"
                                           placeholder="0.00"
                                       />
                                   </td>
                                   <td className="px-4 py-2 text-right font-bold text-indigo-700 text-base">
                                       {net}
                                   </td>
                                   <td className="px-2 py-2 text-center">
                                       <button 
                                           onClick={handleSaveRow}
                                           className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded shadow-sm transition-all active:scale-95"
                                       >
                                           ADD
                                       </button>
                                   </td>
                               </tr>

                               {/* DATA ROWS */}
                               {sortedRows.length === 0 ? (
                                   <tr>
                                       <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">No entries yet. Add data above.</td>
                                   </tr>
                               ) : (
                                   sortedRows.map(row => (
                                       <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                           <td className="px-4 py-2.5 font-mono font-bold text-slate-700 text-center">{row.srNo}</td>
                                           <td className="px-4 py-2.5 font-bold text-slate-800">{row.size}</td>
                                           <td className="px-4 py-2.5 text-right font-mono text-slate-600">{row.meter}</td>
                                           <td className="px-4 py-2.5 text-right font-mono text-slate-600">{row.grossWeight.toFixed(3)}</td>
                                           <td className="px-4 py-2.5 text-right font-mono text-slate-500">{row.coreWeight.toFixed(3)}</td>
                                           <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-600">{row.netWeight.toFixed(3)}</td>
                                           <td className="px-4 py-2.5 text-center">
                                               <button onClick={() => handleDeleteRow(row.id)} className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded transition-colors" title="Delete Row">
                                                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                               </button>
                                           </td>
                                       </tr>
                                   ))
                               )}
                           </tbody>
                       </table>
                   </div>
                </div>
             </div>
          </div>
      );
  }

  // LIST VIEW
  const pendingJobs = data.slittingJobs.filter(j => j.status !== 'COMPLETED');
  
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
       <div className="flex items-center gap-3 mb-6">
           <div className="bg-amber-500 text-white p-3 rounded-xl shadow-lg shadow-amber-200">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
           </div>
           <div>
               <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Operator Dashboard</h1>
               <p className="text-slate-500 text-xs font-bold">Select a Job Card to Start Production</p>
           </div>
       </div>

       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
           {pendingJobs.map(job => (
               <div 
                   key={job.id} 
                   onClick={() => setSelectedJobId(job.id)}
                   className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all group"
               >
                   <div className="flex justify-between items-start mb-3">
                       <div>
                           <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200">{job.date}</span>
                           <h3 className="text-lg font-bold text-slate-800 mt-2">#{job.jobNo}</h3>
                           <p className="text-sm font-medium text-slate-500">{job.jobCode}</p>
                       </div>
                       <div className="text-right">
                           <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide ${job.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-600 animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
                               {job.status.replace('_', ' ')}
                           </span>
                       </div>
                   </div>
                   
                   <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
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
                       Open Job
                   </button>
               </div>
           ))}
           
           {pendingJobs.length === 0 && (
               <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
                   <p className="text-slate-400 font-bold">No Pending Jobs</p>
                   <p className="text-xs text-slate-300 mt-1">Contact Admin to create new Job Cards</p>
               </div>
           )}
       </div>
    </div>
  );
};
