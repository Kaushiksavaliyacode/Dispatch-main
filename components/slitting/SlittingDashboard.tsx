import React, { useState, useEffect, useMemo } from 'react';
import { AppData, SlittingJob, SlittingProductionRow } from '../../types';
import { saveSlittingJob } from '../../services/storageService';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const SlittingDashboard: React.FC<Props> = ({ data, onUpdate }) => {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeCoilId, setActiveCoilId] = useState<string | null>(null);

  // Form Inputs
  const [meter, setMeter] = useState('');
  const [gross, setGross] = useState('');
  const [core, setCore] = useState('1.5'); // Default core weight

  // Derived State
  const activeJob = useMemo(() => 
    data.slittingJobs.find(j => j.id === activeJobId), 
    [data.slittingJobs, activeJobId]
  );

  const activeCoil = useMemo(() => 
    activeJob?.coils.find(c => c.id === activeCoilId), 
    [activeJob, activeCoilId]
  );

  // Auto-select first coil if not selected
  useEffect(() => {
      if (activeJob && !activeCoilId && activeJob.coils.length > 0) {
          setActiveCoilId(activeJob.coils[0].id);
      }
  }, [activeJob, activeCoilId]);

  // Calculate next Sr No for current coil
  const nextSrNo = useMemo(() => {
      if (!activeJob || !activeCoilId) return 1;
      const coilRows = activeJob.rows.filter(r => r.coilId === activeCoilId);
      return coilRows.length + 1;
  }, [activeJob, activeCoilId]);

  // Handlers
  const handleEntry = async () => {
      if (!activeJob || !activeCoilId) return;
      
      const m = parseFloat(meter) || 0;
      const g = parseFloat(gross) || 0;
      const c = parseFloat(core) || 0;

      if (g === 0) return alert("Please enter Gross Weight");

      const net = g - c;
      
      const newRow: SlittingProductionRow = {
          id: `row-${Date.now()}`,
          coilId: activeCoilId,
          srNo: nextSrNo,
          size: activeCoil?.size || 'Unknown',
          meter: m,
          grossWeight: g,
          coreWeight: c,
          netWeight: net
      };

      // Update Job
      const updatedJob: SlittingJob = {
          ...activeJob,
          status: 'IN_PROGRESS',
          rows: [...activeJob.rows, newRow],
          updatedAt: new Date().toISOString()
      };

      await saveSlittingJob(updatedJob);
      
      // Reset some fields, keep Core
      setMeter('');
      setGross('');
  };

  const handleDeleteRow = async (rowId: string) => {
      if (!activeJob || !confirm("Delete this entry?")) return;
      const updatedRows = activeJob.rows.filter(r => r.id !== rowId);
      
      const updatedJob = {
          ...activeJob,
          rows: updatedRows,
          updatedAt: new Date().toISOString()
      };
      await saveSlittingJob(updatedJob);
  };

  const handleCompleteJob = async () => {
      if (!activeJob || !confirm("Mark this Job as COMPLETED?")) return;
      const updatedJob: SlittingJob = {
          ...activeJob,
          status: 'COMPLETED',
          updatedAt: new Date().toISOString()
      };
      await saveSlittingJob(updatedJob);
      setActiveJobId(null);
  };

  // --- JOB SELECTION VIEW ---
  if (!activeJobId) {
      const pendingJobs = data.slittingJobs
          .filter(j => j.status !== 'COMPLETED')
          .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      return (
          <div className="p-4 max-w-lg mx-auto space-y-4">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Select Active Job</h2>
              {pendingJobs.length === 0 ? (
                  <div className="bg-slate-50 p-8 rounded-xl text-center text-slate-400 border-2 border-dashed border-slate-200">
                      <div className="text-4xl mb-2">💤</div>
                      <div className="font-bold">No Pending Jobs</div>
                      <div className="text-xs mt-1">Wait for Admin to create a job card</div>
                  </div>
              ) : (
                  pendingJobs.map(job => (
                      <div 
                        key={job.id} 
                        onClick={() => setActiveJobId(job.id)}
                        className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 active:scale-[0.98] transition-all cursor-pointer hover:border-indigo-300 group"
                      >
                          <div className="flex justify-between items-start">
                              <div>
                                  <div className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-2">
                                     <span>{job.date}</span>
                                     <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                     <span className="text-indigo-500">#{job.jobNo}</span>
                                  </div>
                                  <div className="text-lg font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">{job.jobCode}</div>
                              </div>
                              <div className={`px-3 py-1 rounded-lg text-xs font-bold ${job.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-600 animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
                                  {job.status.replace('_', ' ')}
                              </div>
                          </div>
                          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                              {job.coils.map(c => (
                                  <span key={c.id} className="text-[10px] font-bold bg-slate-50 border border-slate-100 text-slate-600 px-2 py-1 rounded-md whitespace-nowrap">
                                      {c.size}
                                  </span>
                              ))}
                          </div>
                      </div>
                  ))
              )}
          </div>
      );
  }

  // --- PRODUCTION VIEW ---
  if (!activeCoil && activeJob) return <div className="p-10 text-center font-bold text-slate-400">Loading Coil Data...</div>;

  // Filter rows for active coil
  const currentRows = activeJob!.rows.filter(r => r.coilId === activeCoilId).sort((a, b) => b.srNo - a.srNo);

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
        {/* Header */}
        <div className="bg-white px-4 pt-4 pb-2 shadow-sm z-10">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => setActiveJobId(null)} className="text-slate-500 font-bold text-sm flex items-center gap-1 hover:text-slate-800 transition-colors">
                    ← Back
                </button>
                <div className="text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Job #{activeJob?.jobNo}</div>
                    <div className="text-sm font-bold text-slate-800">{activeJob?.jobCode}</div>
                </div>
                <button onClick={handleCompleteJob} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-md shadow-emerald-200 transition-all">
                    Finish Job
                </button>
            </div>

            {/* Coil Tabs */}
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                {activeJob?.coils.map(coil => {
                    const isActive = coil.id === activeCoilId;
                    const coilTotal = activeJob.rows.filter(r => r.coilId === coil.id).reduce((s, r) => s + r.netWeight, 0);
                    
                    return (
                        <button
                            key={coil.id}
                            onClick={() => setActiveCoilId(coil.id)}
                            className={`flex-shrink-0 min-w-[110px] p-3 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center justify-center ${
                                isActive 
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md scale-105' 
                                : 'border-slate-100 bg-white text-slate-400 opacity-80'
                            }`}
                        >
                            <div className="text-xl font-black tracking-tight">{coil.size}</div>
                            <div className="text-[10px] font-bold mt-1 opacity-80">{coilTotal.toFixed(1)} kg</div>
                        </button>
                    );
                })}
            </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {/* Input Form */}
            <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100 p-6 border border-white">
                <div className="flex justify-between items-center mb-6">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                        New Entry
                    </span>
                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-black">SR: {nextSrNo}</span>
                </div>
                
                <div className="grid grid-cols-3 gap-6 mb-6">
                     <div className="group">
                         <label className="text-[10px] font-bold text-slate-400 block mb-2 uppercase text-center group-focus-within:text-blue-500 transition-colors">Meter</label>
                         <input 
                            type="number" 
                            value={meter} 
                            onChange={e => setMeter(e.target.value)} 
                            className="w-full text-center text-2xl font-black border-b-2 border-slate-100 focus:border-blue-500 bg-transparent outline-none py-2 text-slate-800 placeholder-slate-200 transition-colors"
                            placeholder="-"
                        />
                     </div>
                     <div className="group">
                         <label className="text-[10px] font-bold text-slate-400 block mb-2 uppercase text-center group-focus-within:text-indigo-500 transition-colors">Gross</label>
                         <input 
                            type="number" 
                            value={gross} 
                            onChange={e => setGross(e.target.value)} 
                            className="w-full text-center text-2xl font-black border-b-2 border-slate-100 focus:border-indigo-500 bg-transparent outline-none py-2 text-indigo-600 placeholder-slate-200 transition-colors"
                            placeholder="0"
                        />
                     </div>
                     <div className="group">
                         <label className="text-[10px] font-bold text-slate-400 block mb-2 uppercase text-center group-focus-within:text-slate-600 transition-colors">Core</label>
                         <input 
                            type="number" 
                            value={core} 
                            onChange={e => setCore(e.target.value)} 
                            className="w-full text-center text-2xl font-black border-b-2 border-slate-100 focus:border-slate-500 bg-transparent outline-none py-2 text-slate-500 transition-colors"
                        />
                     </div>
                </div>

                <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl">
                     <div className="text-xs font-bold text-slate-500 ml-2">
                         Net: <span className="text-lg text-slate-800 ml-1">{( (parseFloat(gross)||0) - (parseFloat(core)||0) ).toFixed(2)}</span>
                     </div>
                     <button 
                        onClick={handleEntry}
                        className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-slate-300 active:scale-95 transition-all hover:bg-black"
                     >
                         ADD ENTRY
                     </button>
                </div>
            </div>

            {/* History List */}
            <div className="space-y-3 pb-20">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase ml-2 tracking-wider">Production History</h3>
                {currentRows.length === 0 ? (
                    <div className="text-center py-8 text-slate-300 text-xs font-bold italic">No rolls produced yet</div>
                ) : (
                    currentRows.map(row => (
                        <div key={row.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-4">
                                <span className="bg-slate-100 text-slate-500 w-10 h-10 flex items-center justify-center rounded-xl font-mono text-sm font-bold shadow-inner">
                                    {row.srNo}
                                </span>
                                <div>
                                    <div className="text-base font-black text-slate-800">{row.netWeight.toFixed(2)} kg</div>
                                    <div className="text-[10px] font-bold text-slate-400 mt-0.5 flex gap-2">
                                        <span className="bg-slate-50 px-1.5 rounded">G: {row.grossWeight}</span>
                                        <span className="bg-slate-50 px-1.5 rounded">C: {row.coreWeight}</span>
                                        <span className="bg-slate-50 px-1.5 rounded text-blue-400">M: {row.meter}</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => handleDeleteRow(row.id)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                 ✕
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    </div>
  );
};
