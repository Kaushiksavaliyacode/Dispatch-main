import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppData, SlittingJob, SlittingProductionRow, DispatchRow, DispatchEntry, DispatchStatus } from '../../types';
import { saveSlittingJob, saveDispatch, ensurePartyExists } from '../../services/storageService';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

// --- Component: Smart Table Row ---
// Handles its own state for performant typing and auto-saving
interface SlittingRowProps {
    row: SlittingProductionRow;
    planMicron: number;
    coilSize: number;
    isLast: boolean;
    defaultCore: number;
    onSave: (row: SlittingProductionRow) => void;
    onClear: (rowId: string) => void; // Clears data, keeps row
}

const SlittingRow: React.FC<SlittingRowProps> = ({ row, planMicron, coilSize, isLast, defaultCore, onSave, onClear }) => {
    // Local state for inputs to allow smooth typing without re-rendering parent
    const [gross, setGross] = useState(row.grossWeight > 0 ? row.grossWeight.toString() : '');
    const [core, setCore] = useState(row.coreWeight > 0 ? row.coreWeight.toString() : '');
    // If it's a new empty row (gross=0), pre-fill core from props (previous row)
    useEffect(() => {
        if (row.grossWeight === 0 && row.coreWeight === 0 && defaultCore > 0 && !core) {
            setCore(defaultCore.toString());
        }
    }, [defaultCore, row.grossWeight]);

    // Recalculate Net and Meter locally for display
    const currentGross = parseFloat(gross) || 0;
    const currentCore = parseFloat(core) || 0;
    const currentNet = Math.max(0, currentGross - currentCore);
    
    // Meter Calc: Net / Micron / 0.00139 / (Size/1000)
    let displayMeter = 0;
    if (currentNet > 0 && planMicron > 0 && coilSize > 0) {
        const sizeInMeters = coilSize / 1000;
        const calc = currentNet / planMicron / 0.00139 / sizeInMeters;
        displayMeter = Math.round(calc / 10) * 10;
    }

    const handleBlur = () => {
        const g = parseFloat(gross) || 0;
        const c = parseFloat(core) || 0;

        // If data changed AND we have a valid Gross weight
        if ((g !== row.grossWeight || c !== row.coreWeight)) {
            if (g > 0) {
                // SAVE / UPDATE
                onSave({
                    ...row,
                    grossWeight: g,
                    coreWeight: c,
                    netWeight: g - c,
                    meter: displayMeter,
                    micron: planMicron
                });
            } else if (row.grossWeight > 0 && g === 0) {
                // User cleared the gross weight -> Clear the row in DB
                onClear(row.id);
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur(); // Trigger Blur to save
        }
    };

    return (
        <tr className={`group transition-colors ${currentNet > 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50'}`}>
            <td className="py-2 px-2 text-center border-b border-slate-100">
                <span className={`font-mono text-xs font-bold ${currentNet > 0 ? 'text-slate-500' : 'text-slate-300'}`}>
                    {row.srNo}
                </span>
            </td>
            <td className="py-2 px-2 border-b border-slate-100">
                <input 
                    type="number" 
                    value={gross}
                    onChange={e => setGross(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder="Gross"
                    className={`w-full text-center font-bold text-sm py-1.5 rounded outline-none border transition-all ${
                        gross ? 'bg-white border-slate-300 text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200' 
                              : 'bg-transparent border-transparent hover:border-slate-200 focus:bg-white focus:border-indigo-500'
                    }`}
                />
            </td>
            <td className="py-2 px-2 border-b border-slate-100">
                <input 
                    type="number" 
                    value={core}
                    onChange={e => setCore(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder="Core"
                    className="w-full text-center font-medium text-sm text-slate-500 py-1.5 rounded outline-none bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-indigo-500 focus:text-slate-800 transition-all"
                />
            </td>
            <td className="py-2 px-2 text-center border-b border-slate-100">
                <div className={`font-mono font-bold text-sm ${currentNet > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                    {currentNet > 0 ? currentNet.toFixed(3) : '-'}
                </div>
            </td>
            <td className="py-2 px-2 text-center border-b border-slate-100">
                <div className={`font-mono font-bold text-xs ${displayMeter > 0 ? 'text-blue-600' : 'text-slate-300'}`}>
                    {displayMeter > 0 ? displayMeter : '-'}
                </div>
            </td>
            <td className="py-2 px-2 text-center border-b border-slate-100">
                {currentGross > 0 && (
                    <button 
                        onClick={() => { setGross(''); setCore(''); onClear(row.id); }}
                        className="text-slate-300 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 transition-all"
                        title="Clear Row"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                )}
            </td>
        </tr>
    );
};

export const SlittingDashboard: React.FC<Props> = ({ data, onUpdate }) => {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [activeCoilId, setActiveCoilId] = useState<string>('');
  const [coilBundles, setCoilBundles] = useState<string>('');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const selectedJob = data.slittingJobs.find(j => j.id === selectedJobId);

  // Initialize Coil
  useEffect(() => {
    if (selectedJob && !activeCoilId && selectedJob.coils.length > 0) {
        setActiveCoilId(selectedJob.coils[0].id);
    }
  }, [selectedJobId, selectedJob]);

  // Sync Bundles State when Coil Changes
  useEffect(() => {
      if (selectedJob && activeCoilId) {
          const coil = selectedJob.coils.find(c => c.id === activeCoilId);
          setCoilBundles(coil?.producedBundles?.toString() || '0');
      }
  }, [activeCoilId, selectedJob]);

  // --- DATA LOGIC ---

  // Get rows for current coil, sorted by SrNo
  // We need to ensure there is always one empty row at the end
  const tableRows = useMemo(() => {
      if (!selectedJob || !activeCoilId) return [];
      
      const existing = selectedJob.rows
          .filter(r => r.coilId === activeCoilId)
          .sort((a, b) => a.srNo - b.srNo);
      
      const lastSr = existing.length > 0 ? existing[existing.length - 1].srNo : 0;
      
      // Add the "Next Input" row
      const nextRow: SlittingProductionRow = {
          id: `new-${Date.now()}`, // Temporary ID
          coilId: activeCoilId,
          srNo: lastSr + 1,
          size: selectedJob.coils.find(c => c.id === activeCoilId)?.size || '',
          micron: selectedJob.planMicron,
          grossWeight: 0,
          coreWeight: 0, // Will be filled by component from defaultCore
          netWeight: 0,
          meter: 0
      };

      return [...existing, nextRow];
  }, [selectedJob, activeCoilId]);

  // Get the last used core weight to pass as default for new rows
  const lastCoreWeight = useMemo(() => {
      if (!selectedJob || !activeCoilId) return 0;
      const existing = selectedJob.rows.filter(r => r.coilId === activeCoilId && r.coreWeight > 0);
      if (existing.length === 0) return 0;
      // Get core of the last entry
      return existing.sort((a, b) => a.srNo - b.srNo)[existing.length - 1].coreWeight;
  }, [selectedJob, activeCoilId]);

  // --- ACTIONS ---

  const handleRowSave = async (updatedRow: SlittingProductionRow) => {
      if (!selectedJob) return;

      let newRows = [...selectedJob.rows];
      const existingIndex = newRows.findIndex(r => r.id === updatedRow.id);

      if (existingIndex >= 0) {
          // Update Existing
          newRows[existingIndex] = updatedRow;
      } else {
          // Add New (Generate permanent ID)
          newRows.push({ ...updatedRow, id: `slit-row-${Date.now()}` });
      }

      // 1. Update Job
      const updatedJob = { 
          ...selectedJob, 
          rows: newRows, 
          status: 'IN_PROGRESS' as const,
          updatedAt: new Date().toISOString() 
      };
      await saveSlittingJob(updatedJob);

      // 2. Sync to Dispatch
      await syncWithDispatch(updatedJob);
  };

  const handleRowClear = async (rowId: string) => {
      if (!selectedJob) return;
      if (rowId.startsWith('new-')) return; // Ignore clearing the temp input row

      // "Delete Data Only" logic:
      // Option A: Remove row completely -> Sr Nos shift? 
      // User said: "so that raw is empty only delete data not raw".
      // This implies keeping the Sr No slot. 
      // To achieve this in a NoSQL structure, we can either:
      // 1. Keep the row with 0 values.
      // 2. Delete the row but ensure the UI renders a "Gap".
      
      // Let's go with Option 1 (Keep row with 0 values) for visual stability
      // BUT filter 0 values out of "Totals" and "Exports".
      
      const newRows = selectedJob.rows.map(r => {
          if (r.id === rowId) {
              return { ...r, grossWeight: 0, netWeight: 0, meter: 0 };
          }
          return r;
      });

      const updatedJob = { ...selectedJob, rows: newRows, updatedAt: new Date().toISOString() };
      await saveSlittingJob(updatedJob);
      await syncWithDispatch(updatedJob);
  };

  const handleBundleSave = async () => {
      if (!selectedJob || !activeCoilId) return;
      const index = selectedJob.coils.findIndex(c => c.id === activeCoilId);
      if (index === -1) return;

      const newCoils = [...selectedJob.coils];
      newCoils[index] = { ...newCoils[index], producedBundles: parseInt(coilBundles) || 0 };

      const updatedJob = { ...selectedJob, coils: newCoils, updatedAt: new Date().toISOString() };
      await saveSlittingJob(updatedJob);
      await syncWithDispatch(updatedJob);
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>, job: SlittingJob) => {
      e.stopPropagation();
      const s = e.target.value as any;
      const updatedJob = { ...job, status: s, updatedAt: new Date().toISOString() };
      await saveSlittingJob(updatedJob);
  };

  const syncWithDispatch = async (job: SlittingJob) => {
      // Create/Update Dispatch Entry based on Slitting Production
      // Only sum up rows with NetWeight > 0
      const existingDispatch = data.dispatches.find(d => d.dispatchNo === job.jobNo);
      
      const coilAggregates: Record<string, { weight: number, pcs: number, bundle: number }> = {};
      job.coils.forEach(c => { coilAggregates[c.size] = { weight: 0, pcs: 0, bundle: c.producedBundles || 0 }; });

      job.rows.forEach(r => {
          if (r.netWeight > 0) { // Ignore cleared rows
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
              bundle: agg.bundle,
              status: DispatchStatus.SLITTING,
              isCompleted: false,
              isLoaded: false
          };
      });

      // Party Resolution
      let partyId = existingDispatch?.partyId;
      if (!partyId) {
          const searchKey = job.jobCode.trim().toLowerCase();
          const p = data.parties.find(p => (p.code && p.code.toLowerCase() === searchKey) || p.name.toLowerCase() === searchKey);
          partyId = p ? p.id : await ensurePartyExists(data.parties, job.jobCode);
      }

      const totalWt = Object.values(coilAggregates).reduce((s, a) => s + a.weight, 0);
      const totalPcs = Object.values(coilAggregates).reduce((s, a) => s + a.pcs, 0);

      const entry: DispatchEntry = {
          id: existingDispatch ? existingDispatch.id : `d-slit-${job.id}`,
          dispatchNo: job.jobNo,
          date: existingDispatch?.date || new Date().toISOString().split('T')[0],
          partyId,
          status: DispatchStatus.SLITTING,
          rows: dispatchRows,
          totalWeight: parseFloat(totalWt.toFixed(3)),
          totalPcs,
          isTodayDispatch: true,
          createdAt: existingDispatch?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
      };

      await saveDispatch(entry);
  };

  const getPartyName = (job: SlittingJob) => {
      const search = job.jobCode.trim().toLowerCase();
      const p = data.parties.find(p => p.name.toLowerCase() === search || (p.code && p.code.toLowerCase() === search));
      return p ? p.name : job.jobCode;
  };

  // --- FILTERED LIST ---
  const filteredJobs = useMemo(() => {
      return data.slittingJobs.filter(job => {
          const q = searchQuery.toLowerCase();
          const pName = getPartyName(job).toLowerCase();
          const matchesSearch = job.jobNo.includes(q) || pName.includes(q) || job.coils.some(c => c.size.includes(q));
          const matchesStatus = filterStatus === 'ALL' || job.status === filterStatus;
          
          if (filterStartDate && new Date(job.date) < new Date(filterStartDate)) return false;
          if (filterEndDate && new Date(job.date) > new Date(filterEndDate)) return false;

          return matchesSearch && matchesStatus;
      }).sort((a, b) => {
          const statusOrder: any = { 'IN_PROGRESS': 0, 'PENDING': 1, 'COMPLETED': 2 };
          if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [data.slittingJobs, searchQuery, filterStatus, filterStartDate, filterEndDate, data.parties]);

  if (selectedJob) {
      const activeCoil = selectedJob.coils.find(c => c.id === activeCoilId);
      const coilTotalWt = selectedJob.rows.filter(r => r.coilId === activeCoilId).reduce((s, r) => s + r.netWeight, 0);
      const coilTotalMtr = selectedJob.rows.filter(r => r.coilId === activeCoilId).reduce((s, r) => s + r.meter, 0);

      return (
          <div className="max-w-5xl mx-auto p-2 sm:p-4 space-y-4 animate-in slide-in-from-right-4">
             
             {/* HEADER CARD */}
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex justify-between items-start mb-3">
                    <button onClick={() => setSelectedJobId(null)} className="text-slate-400 hover:text-slate-800 flex items-center gap-1 text-sm font-bold">
                        ← Back
                    </button>
                    <div className="flex gap-2">
                        <select 
                            value={selectedJob.status} 
                            onChange={e => handleStatusChange(e, selectedJob)}
                            className="bg-slate-100 border border-slate-200 text-xs font-bold rounded-lg px-3 py-1.5 outline-none"
                        >
                            <option value="PENDING">PENDING</option>
                            <option value="IN_PROGRESS">RUNNING</option>
                            <option value="COMPLETED">DONE</option>
                        </select>
                    </div>
                </div>
                
                <div className="flex flex-col sm:flex-row justify-between items-end gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-2xl font-bold text-slate-800">#{selectedJob.jobNo}</h2>
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold border border-indigo-100">
                                {selectedJob.planMicron} micron
                            </span>
                        </div>
                        <p className="text-sm font-bold text-slate-500">{getPartyName(selectedJob)}</p>
                    </div>
                    <div className="flex gap-4 text-center">
                        <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                            <div className="text-[9px] font-bold text-slate-400 uppercase">Target</div>
                            <div className="text-sm font-bold text-slate-800">{selectedJob.planQty} kg</div>
                        </div>
                        <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                            <div className="text-[9px] font-bold text-slate-400 uppercase">Total Out</div>
                            <div className="text-sm font-bold text-emerald-600">
                                {selectedJob.rows.reduce((s, r) => s + r.netWeight, 0).toFixed(1)} kg
                            </div>
                        </div>
                    </div>
                </div>
             </div>

             {/* COIL TABS */}
             <div className="overflow-x-auto pb-1 -mx-2 px-2 sm:mx-0 sm:px-0">
                 <div className="flex gap-2 min-w-max">
                     {selectedJob.coils.map((coil, idx) => {
                         const cWt = selectedJob.rows.filter(r => r.coilId === coil.id).reduce((s,r) => s + r.netWeight, 0);
                         return (
                             <button 
                                key={coil.id}
                                onClick={() => setActiveCoilId(coil.id)}
                                className={`flex flex-col items-center px-5 py-2.5 rounded-xl border-2 transition-all min-w-[100px] ${
                                    activeCoilId === coil.id 
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105' 
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                }`}
                             >
                                 <span className="text-[10px] font-bold uppercase opacity-80 mb-0.5">Coil {idx+1}</span>
                                 <span className="text-lg font-bold leading-none">{coil.size}</span>
                                 <span className={`text-[10px] font-bold mt-1 ${activeCoilId === coil.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                                     {cWt.toFixed(1)} kg
                                 </span>
                             </button>
                         );
                     })}
                 </div>
             </div>

             {/* DATA ENTRY AREA */}
             <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
                 {/* Toolbar */}
                 <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center sticky top-0 z-20">
                     <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                         <span>Running: <span className="text-indigo-600 text-sm">{activeCoil?.size}</span></span>
                         <span className="w-px h-4 bg-slate-300"></span>
                         <span>Total Wt: <span className="text-emerald-600">{coilTotalWt.toFixed(2)}</span></span>
                         <span className="hidden sm:inline">Total Mtr: <span className="text-blue-600">{coilTotalMtr}</span></span>
                     </div>
                     
                     <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                         <span className="text-[10px] font-bold text-slate-400 uppercase">Box Count:</span>
                         <input 
                            type="number" 
                            value={coilBundles}
                            onChange={(e) => setCoilBundles(e.target.value)}
                            onBlur={handleBundleSave}
                            className="w-12 font-bold text-slate-800 outline-none border-b border-transparent focus:border-indigo-500 text-center text-sm"
                            placeholder="0"
                         />
                     </div>
                 </div>

                 {/* Table */}
                 <div className="flex-1 overflow-y-auto">
                     <table className="w-full text-left border-collapse">
                         <thead className="bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                             <tr>
                                 <th className="py-3 px-2 text-center w-12 border-b border-slate-200">Sr</th>
                                 <th className="py-3 px-2 text-center border-b border-slate-200">Gross (kg)</th>
                                 <th className="py-3 px-2 text-center border-b border-slate-200">Core (kg)</th>
                                 <th className="py-3 px-2 text-center border-b border-slate-200">Net Wt</th>
                                 <th className="py-3 px-2 text-center border-b border-slate-200">Meter</th>
                                 <th className="py-3 px-2 text-center w-10 border-b border-slate-200"></th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50">
                             {tableRows.map((row, index) => (
                                 <SlittingRow 
                                    key={row.id || `temp-${index}`}
                                    row={row}
                                    planMicron={selectedJob.planMicron}
                                    coilSize={parseFloat(selectedJob.coils.find(c => c.id === activeCoilId)?.size || '0')}
                                    isLast={index === tableRows.length - 1}
                                    defaultCore={lastCoreWeight}
                                    onSave={handleRowSave}
                                    onClear={handleRowClear}
                                 />
                             ))}
                         </tbody>
                     </table>
                     
                     {/* Empty State / Instructional */}
                     {tableRows.length <= 1 && (
                         <div className="p-8 text-center text-slate-400">
                             <p className="text-xs italic">Start typing Gross & Core weight to auto-save entries.</p>
                         </div>
                     )}
                 </div>
             </div>
          </div>
      );
  }

  // --- JOB LIST VIEW (Initial State) ---
  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Header & Filters */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <span className="text-2xl">🏭</span> Operator Dashboard
            </h1>
            <div className="flex gap-2 w-full md:w-auto">
                <input 
                    placeholder="Search Job..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-100 flex-1 md:w-64"
                />
                <select 
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none"
                >
                    <option value="ALL">All Jobs</option>
                    <option value="IN_PROGRESS">Running</option>
                    <option value="PENDING">Pending</option>
                    <option value="COMPLETED">Done</option>
                </select>
            </div>
        </div>

        {/* Job Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredJobs.map(job => {
                const party = getPartyName(job);
                const totalOut = job.rows.reduce((s, r) => s + r.netWeight, 0);
                const percent = Math.min((totalOut / job.planQty) * 100, 100);

                return (
                    <div 
                        key={job.id} 
                        onClick={() => setSelectedJobId(job.id)}
                        className={`bg-white rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-all relative overflow-hidden group ${
                            job.status === 'IN_PROGRESS' ? 'border-amber-400 ring-1 ring-amber-100' : 'border-slate-200'
                        }`}
                    >
                        {/* Status Stripe */}
                        <div className={`absolute top-0 left-0 w-1.5 h-full ${
                            job.status === 'IN_PROGRESS' ? 'bg-amber-500' : 
                            job.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}></div>

                        <div className="pl-5 p-4">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-bold text-slate-800">#{job.jobNo}</h3>
                                        <span className="text-[10px] font-bold text-slate-400">{job.date.split('-').reverse().join('/')}</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-600 truncate max-w-[250px]" title={party}>{party}</p>
                                </div>
                                <span className={`text-[9px] font-bold px-2 py-1 rounded border uppercase ${
                                    job.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                                    job.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                    'bg-slate-50 text-slate-500 border-slate-200'
                                }`}>
                                    {job.status.replace('_', ' ')}
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mb-3">
                                <div className="bg-slate-50 p-2 rounded border border-slate-100 text-center">
                                    <div className="text-[8px] text-slate-400 font-bold uppercase">Micron</div>
                                    <div className="text-xs font-bold text-slate-700">{job.planMicron}</div>
                                </div>
                                <div className="bg-slate-50 p-2 rounded border border-slate-100 text-center">
                                    <div className="text-[8px] text-slate-400 font-bold uppercase">Target</div>
                                    <div className="text-xs font-bold text-slate-700">{job.planQty}</div>
                                </div>
                                <div className="bg-slate-50 p-2 rounded border border-slate-100 text-center">
                                    <div className="text-[8px] text-slate-400 font-bold uppercase">Coils</div>
                                    <div className="text-xs font-bold text-slate-700">{job.coils.length}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                        <span>Progress</span>
                                        <span>{percent.toFixed(0)}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div className={`h-full ${job.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${percent}%` }}></div>
                                    </div>
                                </div>
                                <button className="bg-slate-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow hover:bg-slate-800 transition-colors uppercase">
                                    Open
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
            
            {filteredJobs.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                    <p>No jobs found matching criteria.</p>
                </div>
            )}
        </div>
    </div>
  );
};