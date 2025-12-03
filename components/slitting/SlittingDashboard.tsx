
import React, { useState, useEffect, useCallback } from 'react';
import { AppData, SlittingJob, SlittingProductionRow } from '../../types';
import { saveSlittingJob } from '../../services/storageService';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const SlittingDashboard: React.FC<Props> = ({ data }) => {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [activeCoilId, setActiveCoilId] = useState<string | null>(null);
  
  // Local state for the table grid (buffer before saving)
  const [gridRows, setGridRows] = useState<SlittingProductionRow[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const selectedJob = data.slittingJobs.find(j => j.id === selectedJobId);
  const pendingJobs = data.slittingJobs.filter(j => j.status !== 'COMPLETED');
  
  const selectedCoil = selectedJob?.coils?.find(c => c.id === activeCoilId);

  // Helper to extract numeric size from string (e.g. "500mm" -> 500)
  const parseSize = (sizeStr: string): number => {
    const match = sizeStr.match(/(\d+(\.\d+)?)/);
    return match ? parseFloat(match[0]) : 0;
  };

  // 1. Initialize Coil Data when switching coils
  useEffect(() => {
     if (selectedJob && activeCoilId) {
        // Filter rows belonging to this coil
        const existingRows = selectedJob.rows.filter(r => r.coilId === activeCoilId);
        
        // If empty, add 5 placeholders
        if (existingRows.length === 0) {
           const placeholders = Array.from({ length: 5 }).map((_, i) => createEmptyRow(activeCoilId, i + 1));
           setGridRows(placeholders);
        } else {
           // Sort by SrNo to ensure order
           setGridRows(existingRows.sort((a,b) => a.srNo - b.srNo));
        }
        setHasUnsavedChanges(false);
     }
  }, [selectedJobId, activeCoilId, selectedJob]); // dependency on selectedJobId/activeCoilId primarily

  // 2. Default to first coil on open
  useEffect(() => {
     if (selectedJob && selectedJob.coils && selectedJob.coils.length > 0 && !activeCoilId) {
        setActiveCoilId(selectedJob.coils[0].id);
     }
  }, [selectedJob, activeCoilId]);

  const createEmptyRow = (coilId: string, srNo: number): SlittingProductionRow => ({
      id: `sr-${Date.now()}-${Math.random()}`,
      coilId,
      srNo,
      size: '', // Will be filled from Coil Plan on save/calc
      meter: 0,
      micron: 0, // Will be filled from Job Plan on save/calc
      grossWeight: 0,
      coreWeight: 0,
      netWeight: 0
  });

  const handleOpenJob = (job: SlittingJob) => {
    setSelectedJobId(job.id);
    setActiveCoilId(null); 
  };

  const handleGridChange = (rowId: string, field: 'grossWeight' | 'coreWeight', value: string) => {
     if (!selectedJob || !selectedCoil) return;
     
     const val = parseFloat(value) || 0;
     
     setGridRows(prev => prev.map(row => {
        if (row.id !== rowId) return row;

        const updatedRow = { ...row, [field]: val };
        
        // Auto Calculate Net Wt
        updatedRow.netWeight = (updatedRow.grossWeight || 0) - (updatedRow.coreWeight || 0);
        if (updatedRow.netWeight < 0) updatedRow.netWeight = 0;

        // Auto Calculate Meter
        // Formula: Net / (Micron * Size * 0.00139)
        const micron = selectedJob.planMicron;
        const sizeNum = parseSize(selectedCoil.size);
        const factor = 0.00139;

        if (micron > 0 && sizeNum > 0 && updatedRow.netWeight > 0) {
            const calculatedMeter = updatedRow.netWeight / (micron * sizeNum * factor);
            updatedRow.meter = Math.round(calculatedMeter);
        } else {
            updatedRow.meter = 0;
        }

        return updatedRow;
     }));
     setHasUnsavedChanges(true);
  };

  const addMoreRows = () => {
     if (!activeCoilId) return;
     const startSr = gridRows.length > 0 ? Math.max(...gridRows.map(r => r.srNo)) + 1 : 1;
     const newRows = Array.from({ length: 5 }).map((_, i) => createEmptyRow(activeCoilId, startSr + i));
     setGridRows(prev => [...prev, ...newRows]);
     setHasUnsavedChanges(true);
  };

  const handleSaveChanges = async () => {
     if (!selectedJob || !activeCoilId) return;

     // Filter out empty rows (where Gross Wt is 0) to save DB space, OR keep them if you want placeholders saved.
     // Typically better to save only valid data.
     const validRows = gridRows.filter(r => r.grossWeight > 0);
     
     // 1. Enrich rows with static data (Size/Micron) just in case
     const enrichedRows = validRows.map(r => ({
         ...r,
         size: selectedJob.coils.find(c => c.id === activeCoilId)?.size || '',
         micron: selectedJob.planMicron
     }));

     // 2. Merge with rows from OTHER coils
     const otherCoilRows = selectedJob.rows.filter(r => r.coilId !== activeCoilId);
     const allRows = [...otherCoilRows, ...enrichedRows];

     const updatedJob = {
        ...selectedJob,
        rows: allRows,
        status: 'IN_PROGRESS' as const,
        updatedAt: new Date().toISOString()
     };

     await saveSlittingJob(updatedJob);
     setHasUnsavedChanges(false);
     
     // Update local grid to match saved state (remove empty rows from UI if we didn't save them?)
     // For user experience, better to keep the grid as is or re-initialize.
     // Let's re-initialize with the saved rows + placeholders if needed.
     // Actually, let's keep the UI state but mark clean.
  };

  const handleCompleteJob = async () => {
    if (!selectedJob) return;
    if (hasUnsavedChanges) {
        alert("Please save your changes first!");
        return;
    }
    if (!confirm('Mark Job as COMPLETED?')) return;
    const updatedJob = { ...selectedJob, status: 'COMPLETED' as const, updatedAt: new Date().toISOString() };
    await saveSlittingJob(updatedJob);
    setSelectedJobId(null);
  };

  // --- JOB SELECTION VIEW ---
  if (!selectedJob) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-amber-100 p-3 rounded-xl text-amber-600">
             <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Slitting Department</h1>
            <p className="text-slate-500 font-medium">Select a Job Card to start production</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pendingJobs.map(job => (
            <div key={job.id} onClick={() => handleOpenJob(job)} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-lg hover:border-amber-300 transition-all cursor-pointer group">
               <div className="flex justify-between items-start mb-4">
                 <div>
                    <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-md text-xs font-bold tracking-wide border border-amber-100">JOB NO: {job.jobNo}</span>
                    <h3 className="text-lg font-bold text-slate-800 mt-2">{job.jobCode}</h3>
                 </div>
                 <div className="text-right">
                    <div className="text-xs font-bold text-slate-400">{job.date}</div>
                    <div className="text-[10px] text-slate-400 mt-1">{job.rows.length} Entries</div>
                 </div>
               </div>
               
               <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="text-xs font-bold text-slate-400 uppercase">Coil Plan</div>
                  {job.coils?.map(coil => (
                     <div key={coil.id} className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">Coil {coil.number} ({coil.size})</span>
                        <span className="font-bold text-slate-700">{coil.rolls} Rolls</span>
                     </div>
                  ))}
               </div>
               
               <div className="mt-4 pt-3 border-t border-slate-100 text-center text-xs font-bold text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Click to Open Card →
               </div>
            </div>
          ))}
          {pendingJobs.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
               No pending jobs assigned by Admin.
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- JOB ENTRY VIEW ---
  const totalNetWeight = selectedJob.rows.reduce((sum, r) => sum + r.netWeight, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <button onClick={() => { 
                if(hasUnsavedChanges && !confirm("Discard unsaved changes?")) return;
                setSelectedJobId(null); 
            }} className="text-xs font-bold text-slate-400 hover:text-slate-700 mb-2 flex items-center gap-1">← Back to List</button>
            <h1 className="text-2xl font-bold text-slate-800">Job No: {selectedJob.jobNo} <span className="text-lg text-slate-500 font-medium ml-2">({selectedJob.jobCode})</span></h1>
            <div className="flex flex-wrap gap-3 mt-2 text-xs font-bold text-slate-600">
               <span className="bg-slate-100 px-2 py-1 rounded">Date: {selectedJob.date}</span>
               <span className="bg-slate-100 px-2 py-1 rounded">Micron: {selectedJob.planMicron}</span>
            </div>
         </div>
         <div className="text-right">
             <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total Net Production</div>
             <div className="text-3xl font-bold text-emerald-600">{totalNetWeight.toFixed(3)} <span className="text-sm">kg</span></div>
             <button onClick={handleCompleteJob} className="mt-3 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-sm">
                Mark Job Completed
             </button>
         </div>
      </div>

      {/* COIL TABS */}
      <div className="flex gap-2 overflow-x-auto pb-2">
         {selectedJob.coils?.map(coil => (
            <button
               key={coil.id}
               onClick={() => {
                   if(hasUnsavedChanges && !confirm("Save changes before switching coils?")) return;
                   setActiveCoilId(coil.id);
               }}
               className={`px-5 py-2.5 rounded-t-xl font-bold text-sm whitespace-nowrap transition-colors border-b-2 ${activeCoilId === coil.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-transparent hover:bg-slate-50'}`}
            >
               Coil {coil.number} <span className="text-xs opacity-70 ml-1">({coil.size})</span>
            </button>
         ))}
      </div>

      {/* EXCEL TABLE */}
      <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-lg border border-indigo-100 overflow-hidden relative top-[-10px] z-10">
         <div className="bg-indigo-600 px-6 py-3 flex justify-between items-center">
             <h3 className="text-white font-bold text-sm tracking-wide flex items-center gap-2">
                 <span>Data Entry</span>
                 <span className="bg-white/20 text-white px-2 py-0.5 rounded text-xs">
                     {selectedCoil ? `Coil ${selectedCoil.number} (${selectedCoil.size})` : 'Select Coil'}
                 </span>
             </h3>
             <div className="text-xs text-indigo-100 font-mono">
                 Formula: Net / ({selectedJob.planMicron} * Size * 0.00139)
             </div>
         </div>
         
         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
               <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase border-b border-slate-200">
                  <tr>
                     <th className="px-4 py-3 text-center w-16">Sr.</th>
                     <th className="px-4 py-3 text-right text-slate-800">Gross Wt</th>
                     <th className="px-4 py-3 text-right text-red-500">Core Wt</th>
                     <th className="px-4 py-3 text-right text-emerald-600 font-extrabold bg-emerald-50/50">Net Wt (Calc)</th>
                     <th className="px-4 py-3 text-right">Meter (Calc)</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {gridRows.map((row) => (
                     <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2 text-center font-mono text-slate-400 bg-slate-50">{row.srNo}</td>
                        
                        {/* Editable Gross */}
                        <td className="px-4 py-1">
                            <input 
                                type="number" 
                                value={row.grossWeight || ''} 
                                onChange={(e) => handleGridChange(row.id, 'grossWeight', e.target.value)}
                                className="w-full text-right font-mono font-bold text-slate-800 bg-slate-50/50 focus:bg-white border border-transparent focus:border-indigo-500 rounded py-1.5 px-2 outline-none transition-all"
                                placeholder="0.000"
                            />
                        </td>
                        
                        {/* Editable Core */}
                        <td className="px-4 py-1">
                            <input 
                                type="number" 
                                value={row.coreWeight || ''} 
                                onChange={(e) => handleGridChange(row.id, 'coreWeight', e.target.value)}
                                className="w-full text-right font-mono font-bold text-red-500 bg-slate-50/50 focus:bg-white border border-transparent focus:border-red-300 rounded py-1.5 px-2 outline-none transition-all"
                                placeholder="0.000"
                            />
                        </td>

                        {/* Calculated Net */}
                        <td className="px-4 py-2 text-right font-mono font-bold text-emerald-600 bg-emerald-50/30">
                            {row.netWeight > 0 ? row.netWeight.toFixed(3) : '-'}
                        </td>
                        
                        {/* Calculated Meter */}
                        <td className="px-4 py-2 text-right font-mono text-slate-600">
                            {row.meter > 0 ? row.meter : '-'}
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>

         {/* Actions Bar */}
         <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center sticky bottom-0 z-20">
             <button onClick={addMoreRows} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg border border-transparent hover:border-indigo-100 transition-colors">
                 + Add 5 More Rows
             </button>
             
             <button 
                onClick={handleSaveChanges} 
                disabled={!hasUnsavedChanges}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all ${hasUnsavedChanges ? 'bg-indigo-600 hover:bg-indigo-700 text-white transform hover:scale-105' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
             >
                <span>💾 Save Changes</span>
             </button>
         </div>
      </div>
    </div>
  );
};
