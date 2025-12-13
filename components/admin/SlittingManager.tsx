
import React, { useState, useEffect } from 'react';
import { AppData, SlittingJob, SlittingCoil } from '../../types';
import { saveSlittingJob, deleteSlittingJob } from '../../services/storageService';

interface Props {
  data: AppData;
}

export const SlittingManager: React.FC<Props> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'view'>('view');
  
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

  const handleCreate = async () => {
    if(!jobNo || !jobCode || coils.some(c => !c.size)) return alert("Fill required fields (Job No, Party, Coil Sizes)");

    const pMicron = parseFloat(planMicron) || 0;
    const pQty = parseFloat(planQty) || 0;

    // 1. Create Slitting Job
    const newJob: SlittingJob = {
       id: `slit-${Date.now()}`,
       date,
       jobNo,
       jobCode, // Stores Party Name
       coils: coils,
       planMicron: pMicron,
       planQty: pQty,
       planRollLength: parseFloat(planRollLength) || 0,
       rows: [],
       status: 'PENDING',
       createdAt: new Date().toISOString(),
       updatedAt: new Date().toISOString()
    };
    
    await saveSlittingJob(newJob);

    // Reset Form
    setJobNo(''); setJobCode(''); 
    setCoils([{ id: 'c-1', number: 1, size: '', rolls: 0 }]);
    setPlanMicron(''); setPlanQty(''); setPlanRollLength('');
    setActiveTab('view');
    alert("Slitting Job Card Created Successfully!");
  };

  const handleDelete = async (id: string) => {
     if(confirm("Delete this Job Card and all its data?")) {
        await deleteSlittingJob(id);
     }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
       <div className="flex bg-slate-100 p-1 rounded-xl w-full max-w-md mx-auto mb-6">
          <button onClick={() => setActiveTab('view')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab==='view'?'bg-white text-indigo-600 shadow-sm':'text-slate-500'}`}>View Jobs</button>
          <button onClick={() => setActiveTab('create')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab==='create'?'bg-white text-indigo-600 shadow-sm':'text-slate-500'}`}>+ Create Job Card</button>
       </div>

       {activeTab === 'create' && (
          <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
             <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center gap-3">
                <span className="text-2xl text-white">🏭</span>
                <h3 className="text-white font-bold text-lg">Create Slitting Job Card</h3>
             </div>
             <div className="p-6 space-y-4">
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-start gap-2 mb-2">
                    <span className="text-blue-500 text-lg">ℹ️</span>
                    <p className="text-xs text-blue-700 font-medium">This will create a new job card for the Slitting Operator. Dispatch sync happens when production starts.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Date</label>
                      <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-bold" />
                   </div>
                   <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Job No</label>
                      <input type="text" value={jobNo} onChange={e => setJobNo(e.target.value)} placeholder="e.g. 1005" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-bold" />
                   </div>
                </div>
                
                {/* Party Selection Dropdown */}
                <div className="relative">
                    <label className="text-xs font-bold text-slate-500 block mb-1">Select Party</label>
                    <input 
                        type="text" 
                        value={jobCode} 
                        onChange={e => { setJobCode(e.target.value); setShowPartyDropdown(true); }}
                        onFocus={() => setShowPartyDropdown(true)}
                        onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)}
                        placeholder="Search Name or Code (e.g. REL/001)..." 
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" 
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
                            {partySuggestions.length === 0 && (
                                <div className="px-4 py-2 text-xs text-slate-400 italic">No matches found</div>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Dynamic Coils Section */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                   <div className="flex justify-between items-center">
                       <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Coil Plan</h4>
                       <button onClick={addCoil} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">+ Add Coil</button>
                   </div>
                   
                   {coils.map((coil, idx) => (
                      <div key={coil.id} className="grid grid-cols-12 gap-3 items-end animate-in slide-in-from-left-2 duration-300">
                          <div className="col-span-8">
                             <label className="text-[10px] font-bold text-slate-500">Size</label>
                             <input type="text" value={coil.size} onChange={e => updateCoil(idx, 'size', e.target.value)} placeholder="e.g. 100mm" className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold" />
                          </div>
                          <div className="col-span-3">
                             <label className="text-[10px] font-bold text-slate-500">Rolls</label>
                             <input type="number" value={coil.rolls === 0 ? '' : coil.rolls} onChange={e => updateCoil(idx, 'rolls', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold text-center" />
                          </div>
                          <div className="col-span-1 flex justify-center pb-2">
                             {coils.length > 1 && (
                                <button onClick={() => removeCoil(idx)} className="text-red-400 hover:text-red-600 font-bold">✕</button>
                             )}
                          </div>
                      </div>
                   ))}
                </div>

                <div className="grid grid-cols-3 gap-4">
                   <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Micron</label>
                      <input type="number" value={planMicron} onChange={e => setPlanMicron(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-center" />
                   </div>
                   <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Qty</label>
                      <input type="number" value={planQty} onChange={e => setPlanQty(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-center" />
                   </div>
                   <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Length (m)</label>
                      <input type="number" value={planRollLength} onChange={e => setPlanRollLength(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-center" />
                   </div>
                </div>

                <button onClick={handleCreate} className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-black transition-colors shadow-lg">
                   Create Job Card
                </button>
             </div>
          </div>
       )}

       {activeTab === 'view' && (
          <div className="space-y-4">
             {data.slittingJobs.length === 0 && <div className="text-center py-10 text-slate-400">No Slitting Jobs Found</div>}
             
             {data.slittingJobs.map(job => {
                const isExpanded = expandedJobId === job.id;
                const totalNetWt = job.rows.reduce((s, r) => s + r.netWeight, 0);
                
                // Try to find the party to show code
                const party = data.parties.find(p => p.name === job.jobCode);

                return (
                   <div key={job.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all">
                      <div onClick={() => setExpandedJobId(isExpanded ? null : job.id)} className="p-4 cursor-pointer hover:bg-slate-50">
                         <div className="flex justify-between items-center">
                            <div>
                               <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded">{job.date}</span>
                                  <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                                      job.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' : 
                                      job.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-600' : 
                                      'bg-slate-100 text-slate-500'
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
                               <div className="text-xs font-bold text-slate-400">Total Net Wt</div>
                               <div className="text-xl font-bold text-emerald-600">{totalNetWt.toFixed(3)}</div>
                            </div>
                         </div>
                      </div>

                      {isExpanded && (
                         <div className="bg-slate-50 border-t border-slate-100 p-4">
                            
                            {/* Job Details Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-xs">
                               <div className="bg-white p-2 rounded border border-slate-200">
                                  <div className="text-slate-400 font-bold">Target Qty</div>
                                  <div className="font-bold text-slate-700">{job.planQty}</div>
                               </div>
                               <div className="bg-white p-2 rounded border border-slate-200">
                                  <div className="text-slate-400 font-bold">Micron</div>
                                  <div className="font-bold text-slate-700">{job.planMicron}</div>
                               </div>
                               <div className="bg-white p-2 rounded border border-slate-200">
                                  <div className="text-slate-400 font-bold">Roll Length</div>
                                  <div className="font-bold text-slate-700">{job.planRollLength} m</div>
                               </div>
                               <div className="bg-white p-2 rounded border border-slate-200">
                                  <div className="text-slate-400 font-bold">Coils</div>
                                  <div className="font-bold text-slate-700">{job.coils?.length || 0}</div>
                               </div>
                            </div>
                            
                            {/* Plan Details Section */}
                            <div className="mb-4">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Plan Details</h4>
                                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1">
                                    {job.coils?.map((coil, idx) => (
                                        <div key={coil.id} className="flex justify-between text-xs">
                                            <span className="font-bold text-slate-700">Coil {idx+1}: {coil.size}</span>
                                            <span className="text-indigo-600 font-bold">{coil.rolls} Rolls</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end mb-4">
                               <button onClick={() => handleDelete(job.id)} className="text-red-500 text-xs font-bold border border-red-200 px-3 py-1.5 rounded hover:bg-red-50">Delete Card</button>
                            </div>

                            {/* Production Table - Flat List without Coil Column */}
                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                               <table className="w-full text-xs text-left">
                                  <thead className="bg-slate-100 font-bold text-slate-500 uppercase">
                                     <tr>
                                        <th className="px-3 py-2 w-12">Sr</th>
                                        <th className="px-3 py-2">Size</th>
                                        <th className="px-3 py-2 text-right">Meter</th>
                                        <th className="px-3 py-2 text-right">Gross</th>
                                        <th className="px-3 py-2 text-right text-red-500">Core</th>
                                        <th className="px-3 py-2 text-right text-emerald-600">Net</th>
                                     </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                     {job.rows.length === 0 ? (
                                        <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-300 italic">No production data recorded.</td></tr>
                                     ) : (
                                        job.rows.sort((a,b) => a.srNo - b.srNo).map(row => {
                                            const coil = job.coils?.find(c => c.id === row.coilId);
                                            const displaySize = row.size || coil?.size || '-';
                                            
                                            return (
                                              <tr key={row.id}>
                                                 <td className="px-3 py-2 text-slate-500 font-mono">{row.srNo}</td>
                                                 <td className="px-3 py-2 font-bold text-slate-700">{displaySize}</td>
                                                 <td className="px-3 py-2 text-right font-mono">{row.meter}</td>
                                                 <td className="px-3 py-2 text-right font-mono">{row.grossWeight.toFixed(3)}</td>
                                                 <td className="px-3 py-2 text-right font-mono text-red-500">{row.coreWeight.toFixed(3)}</td>
                                                 <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600">{row.netWeight.toFixed(3)}</td>
                                              </tr>
                                            );
                                        })
                                     )}
                                  </tbody>
                               </table>
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
