
import React, { useState, useEffect } from 'react';
import { AppData, SlittingJob, SlittingCoil } from '../../types';
import { saveSlittingJob, deleteSlittingJob } from '../../services/storageService';

interface Props {
  data: AppData;
}

export const SlittingManager: React.FC<Props> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'view'>('view');
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  
  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [jobNo, setJobNo] = useState('');
  
  // jobCode acts as the Party Name identifier in the current schema
  const [jobCode, setJobCode] = useState(''); 
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);

  // Dynamic Coils State
  const [coils, setCoils] = useState<SlittingCoil[]>([
     { id: 'c-1', number: 1, size: '', rolls: 0 }
  ]);

  const [planMicron, setPlanMicron] = useState('');
  const [planQty, setPlanQty] = useState('');
  const [planRollLength, setPlanRollLength] = useState('');
  
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  // Filter Parties for Dropdown
  const partySuggestions = data.parties.filter(p => {
      const search = jobCode.toLowerCase();
      return p.name.toLowerCase().includes(search) || (p.code && p.code.toLowerCase().includes(search));
  });

  // Coil Management
  const addCoil = () => {
     setCoils([
        ...coils, 
        { id: `c-${Date.now()}`, number: coils.length + 1, size: '', rolls: 0 }
     ]);
  };

  const removeCoil = (index: number) => {
     if (coils.length <= 1) return;
     const updated = coils.filter((_, i) => i !== index).map((c, i) => ({ ...c, number: i + 1 }));
     setCoils(updated);
  };

  const updateCoil = (index: number, field: keyof SlittingCoil, value: string) => {
     const updated = [...coils];
     updated[index] = { ...updated[index], [field]: field === 'rolls' ? (parseFloat(value)||0) : value };
     setCoils(updated);
  };

  const handleEdit = (job: SlittingJob) => {
    setEditingJobId(job.id);
    setDate(job.date);
    setJobNo(job.jobNo);
    setJobCode(job.jobCode);
    setCoils(job.coils || [{ id: 'c-1', number: 1, size: '', rolls: 0 }]);
    setPlanMicron(job.planMicron?.toString() || '');
    setPlanQty(job.planQty?.toString() || '');
    setPlanRollLength(job.planRollLength?.toString() || '');
    setActiveTab('create');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingJobId(null);
    setJobNo(''); 
    setJobCode(''); 
    setDate(new Date().toISOString().split('T')[0]);
    setCoils([{ id: 'c-1', number: 1, size: '', rolls: 0 }]);
    setPlanMicron(''); 
    setPlanQty(''); 
    setPlanRollLength('');
  };

  const handleSave = async () => {
    if(!jobNo || !jobCode || coils.some(c => !c.size)) return alert("Fill required fields (Job No, Party, Coil Sizes)");

    const pMicron = parseFloat(planMicron) || 0;
    const pQty = parseFloat(planQty) || 0;

    const existingJob = editingJobId ? data.slittingJobs.find(j => j.id === editingJobId) : null;

    const jobData: SlittingJob = {
       id: editingJobId || `slit-${Date.now()}`,
       date,
       jobNo,
       jobCode, // Stores Party Name
       coils: coils,
       planMicron: pMicron,
       planQty: pQty,
       planRollLength: parseFloat(planRollLength) || 0,
       rows: existingJob ? existingJob.rows : [],
       status: existingJob ? existingJob.status : 'PENDING',
       createdAt: existingJob ? existingJob.createdAt : new Date().toISOString(),
       updatedAt: new Date().toISOString()
    };
    
    await saveSlittingJob(jobData);

    resetForm();
    setActiveTab('view');
    alert(editingJobId ? "Slitting Job Updated!" : "Slitting Job Card Created Successfully!");
  };

  const handleDelete = async (id: string) => {
     if(confirm("Delete this Job Card and all its data?")) {
        await deleteSlittingJob(id);
     }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
       <div className="flex bg-white/50 backdrop-blur-sm p-1.5 rounded-xl w-full max-w-md mx-auto mb-6 border border-white/60 shadow-sm">
          <button 
            onClick={() => { setActiveTab('view'); setEditingJobId(null); }} 
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab==='view'?'bg-slate-900 text-white shadow-md':'text-slate-500 hover:bg-slate-100'}`}
          >
            View Jobs
          </button>
          <button 
            onClick={() => { setActiveTab('create'); resetForm(); }} 
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab==='create' && !editingJobId ?'bg-slate-900 text-white shadow-md':'text-slate-500 hover:bg-slate-100'}`}
          >
            + Create Job
          </button>
       </div>

       {activeTab === 'create' && (
          <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
             <div className={`px-6 py-4 flex items-center justify-between ${editingJobId ? 'bg-amber-600' : 'bg-slate-900'}`}>
                <div className="flex items-center gap-3">
                    <span className="text-xl text-white">{editingJobId ? '✏️' : '🏭'}</span>
                    <h3 className="text-white font-bold text-lg">{editingJobId ? 'Edit Slitting Job' : 'Create Slitting Job Card'}</h3>
                </div>
                {editingJobId && (
                  <button onClick={() => { setEditingJobId(null); resetForm(); setActiveTab('view'); }} className="text-white/80 hover:text-white text-xs font-bold border border-white/30 px-3 py-1 rounded-md">
                    Cancel Edit
                  </button>
                )}
             </div>
             <div className="p-6 space-y-5">
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-start gap-2 mb-2">
                    <span className="text-blue-500 text-lg">ℹ️</span>
                    <p className="text-xs text-blue-700 font-medium">This will {editingJobId ? 'update the' : 'create a new'} job card for the Slitting Operator. Dispatch sync happens when production starts.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Date</label>
                      <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all" />
                   </div>
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Job No</label>
                      <input type="text" value={jobNo} onChange={e => setJobNo(e.target.value)} placeholder="e.g. 1005" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all" />
                   </div>
                </div>
                
                {/* Party Selection Dropdown */}
                <div className="relative">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Select Party</label>
                    <input 
                        type="text" 
                        value={jobCode} 
                        onChange={e => { setJobCode(e.target.value); setShowPartyDropdown(true); }}
                        onFocus={() => setShowPartyDropdown(true)}
                        onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)}
                        placeholder="Search Name or Code..." 
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-sm" 
                    />
                    {showPartyDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                            {partySuggestions.map(p => (
                                <div 
                                    key={p.id} 
                                    className="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm border-b border-slate-50 last:border-0"
                                    onClick={() => { setJobCode(p.name); setShowPartyDropdown(false); }}
                                >
                                    <div className="font-bold text-slate-800">{p.name}</div>
                                    {p.code && <div className="text-xs text-indigo-600 font-bold">{p.code}</div>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* Dynamic Coils Section */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                   <div className="flex justify-between items-center">
                       <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Coil Plan</h4>
                       <button onClick={addCoil} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 shadow-sm">+ Add Coil</button>
                   </div>
                   
                   {coils.map((coil, idx) => (
                      <div key={coil.id} className="grid grid-cols-12 gap-3 items-end animate-in slide-in-from-left-2 duration-300">
                          <div className="col-span-8">
                             <label className="text-[9px] font-bold text-slate-400 uppercase">Size</label>
                             <input type="text" value={coil.size} onChange={e => updateCoil(idx, 'size', e.target.value)} placeholder="e.g. 100mm" className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold outline-none focus:border-indigo-500" />
                          </div>
                          <div className="col-span-3">
                             <label className="text-[9px] font-bold text-slate-400 uppercase">Rolls</label>
                             <input type="number" value={coil.rolls === 0 ? '' : coil.rolls} onChange={e => updateCoil(idx, 'rolls', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold text-center outline-none focus:border-indigo-500" />
                          </div>
                          <div className="col-span-1 flex justify-center pb-2">
                             {coils.length > 1 && (
                                <button onClick={() => removeCoil(idx)} className="text-red-400 hover:text-red-600 font-bold text-lg">×</button>
                             )}
                          </div>
                      </div>
                   ))}
                </div>

                <div className="grid grid-cols-3 gap-4">
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Micron</label>
                      <input type="number" value={planMicron} onChange={e => setPlanMicron(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-center outline-none focus:border-indigo-500 focus:bg-white" />
                   </div>
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Qty (kg)</label>
                      <input type="number" value={planQty} onChange={e => setPlanQty(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-center outline-none focus:border-indigo-500 focus:bg-white" />
                   </div>
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Length (m)</label>
                      <input type="number" value={planRollLength} onChange={e => setPlanRollLength(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-center outline-none focus:border-indigo-500 focus:bg-white" />
                   </div>
                </div>

                <button onClick={handleSave} className={`w-full text-white font-bold py-3.5 rounded-xl shadow-lg active:scale-[0.98] transform transition-all ${editingJobId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-900 hover:bg-black'}`}>
                   {editingJobId ? 'Update Job Card' : 'Create Job Card'}
                </button>
             </div>
          </div>
       )}

       {activeTab === 'view' && (
          <div className="space-y-4">
             {data.slittingJobs.length === 0 && (
                <div className="text-center py-16 text-slate-400">
                    <p className="font-bold">No Slitting Jobs Found</p>
                    <p className="text-xs mt-1">Create a new job to see it here</p>
                </div>
             )}
             
             {data.slittingJobs.map(job => {
                const isExpanded = expandedJobId === job.id;
                const totalNetWt = job.rows.reduce((s, r) => s + r.netWeight, 0);
                
                // Try to find the party to show code
                const party = data.parties.find(p => p.name === job.jobCode);

                return (
                   <div key={job.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all">
                      <div onClick={() => setExpandedJobId(isExpanded ? null : job.id)} className="p-4 cursor-pointer hover:bg-slate-50/50 transition-colors">
                         <div className="flex justify-between items-center">
                            <div>
                               <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200">{job.date}</span>
                                  <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide border ${
                                      job.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                                      job.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                                      'bg-slate-100 text-slate-500 border-slate-200'
                                  }`}>
                                      {job.status.replace('_', ' ')}
                                  </span>
                               </div>
                               <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                   <span>#{job.jobNo}</span>
                                   <span className="text-slate-300">|</span>
                                   <span>{job.jobCode}</span>
                               </h3>
                               {party?.code && <div className="text-[10px] font-bold text-indigo-600 mt-0.5">{party.code}</div>}
                            </div>
                            <div className="text-right">
                               <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Total Output</div>
                               <div className="text-xl font-bold text-slate-800">{totalNetWt.toFixed(3)} <span className="text-xs text-slate-400">kg</span></div>
                            </div>
                         </div>
                      </div>

                      {isExpanded && (
                         <div className="bg-slate-50/50 border-t border-slate-100 p-4 animate-in slide-in-from-top-2 duration-300">
                            
                            {/* Job Details Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 text-xs">
                               <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                  <div className="text-slate-400 font-bold text-[10px] uppercase">Target Qty</div>
                                  <div className="font-bold text-slate-700 text-sm mt-0.5">{job.planQty} kg</div>
                               </div>
                               <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                  <div className="text-slate-400 font-bold text-[10px] uppercase">Micron</div>
                                  <div className="font-bold text-slate-700 text-sm mt-0.5">{job.planMicron}</div>
                               </div>
                               <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                  <div className="text-slate-400 font-bold text-[10px] uppercase">Roll Length</div>
                                  <div className="font-bold text-slate-700 text-sm mt-0.5">{job.planRollLength} m</div>
                               </div>
                               <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                  <div className="text-slate-400 font-bold text-[10px] uppercase">Coils</div>
                                  <div className="font-bold text-slate-700 text-sm mt-0.5">{job.coils?.length || 0}</div>
                               </div>
                            </div>
                            
                            <div className="flex justify-end gap-3 mb-4">
                               <button onClick={() => handleEdit(job)} className="text-indigo-600 text-xs font-bold border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-1">
                                  ✏️ Edit Card
                               </button>
                               <button onClick={() => handleDelete(job.id)} className="text-red-500 text-xs font-bold border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1">
                                  🗑️ Delete Card
                               </button>
                            </div>

                            {/* Production Table - Grouped by Coil */}
                            <div className="space-y-4">
                                {job.coils.map(coil => {
                                    const coilRows = job.rows.filter(r => r.coilId === coil.id).sort((a,b) => a.srNo - b.srNo);
                                    if (coilRows.length === 0) return (
                                        <div key={coil.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                             <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                                                    <span className="font-bold text-slate-700 text-xs uppercase">{coil.size} (Planned)</span>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400 italic">No production yet</span>
                                            </div>
                                        </div>
                                    );

                                    const totalNet = coilRows.reduce((s, r) => s + r.netWeight, 0);
                                    const totalMeter = coilRows.reduce((s, r) => s + r.meter, 0);

                                    return (
                                        <div key={coil.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                                    <span className="font-bold text-slate-700 text-xs uppercase">{coil.size}</span>
                                                </div>
                                                <div className="flex gap-4 text-[10px]">
                                                    <div className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 font-bold font-mono">
                                                        M: {totalMeter}
                                                    </div>
                                                    <div className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100 font-bold font-mono">
                                                        Wt: {totalNet.toFixed(3)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-white text-slate-400 font-bold uppercase text-[9px] border-b border-slate-100">
                                                        <tr>
                                                            <th className="px-4 py-2 w-12 text-center">Sr</th>
                                                            <th className="px-4 py-2 text-center text-slate-500">Meter</th>
                                                            <th className="px-4 py-2 text-right text-slate-500">Gross</th>
                                                            <th className="px-4 py-2 text-right text-slate-500">Core</th>
                                                            <th className="px-4 py-2 text-right text-indigo-600">Net Wt</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {coilRows.map(row => (
                                                            <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                                                <td className="px-4 py-2 text-center text-slate-400 font-mono text-[10px]">{row.srNo}</td>
                                                                <td className="px-4 py-2 text-center font-mono text-[10px] font-bold text-slate-600">{row.meter}</td>
                                                                <td className="px-4 py-2 text-right font-mono text-[10px] text-slate-500">{row.grossWeight.toFixed(3)}</td>
                                                                <td className="px-4 py-2 text-right font-mono text-[10px] text-red-400">{row.coreWeight.toFixed(3)}</td>
                                                                <td className="px-4 py-2 text-right font-mono text-[10px] font-bold text-emerald-600">{row.netWeight.toFixed(3)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })}
                                {job.rows.length === 0 && (
                                   <div className="text-center py-8 text-slate-400 text-xs italic bg-slate-50/50 rounded-xl border border-dashed border-slate-300">No production data yet.</div>
                                )}
                            </div>
                         </div>
                      )}
                   </div>
                );
             })}
          </div>
       )}
    </div>
  );
};
