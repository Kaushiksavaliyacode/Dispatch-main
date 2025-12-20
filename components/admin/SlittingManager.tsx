
import React, { useState, useEffect, useMemo } from 'react';
import { AppData, SlittingJob, SlittingCoil, SlittingPlan } from '../../types';
import { saveSlittingJob, deleteSlittingJob, updateSlittingPlan } from '../../services/storageService';
import { Share2, CheckSquare, Square, Layers, ArrowRightCircle, Ruler, Scale, UserCheck, Package } from 'lucide-react';

interface Props {
  data: AppData;
}

export const SlittingManager: React.FC<Props> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'view'>('view');
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [selectedSlitRowsForShare, setSelectedSlitRowsForShare] = useState<Record<string, string[]>>({});

  // Form State
  const [planId, setPlanId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [jobNo, setJobNo] = useState('');
  const [jobCode, setJobCode] = useState(''); 
  const [sizer, setSizer] = useState(''); 
  const [size, setSize] = useState(''); // Input roll size
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [coils, setCoils] = useState<SlittingCoil[]>([{ id: 'c-1', number: 1, size: '', rolls: 0 }]);
  const [planMicron, setPlanMicron] = useState('');
  const [planQty, setPlanQty] = useState('');
  const [planRollLength, setPlanRollLength] = useState('');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const pendingSlittingPlans = useMemo(() => 
    (data.slittingPlans || []).filter(p => p.status === 'PENDING'), 
  [data.slittingPlans]);

  const partySuggestions = useMemo(() => 
    data.parties.filter(p => {
      const search = jobCode.toLowerCase();
      return p.name.toLowerCase().includes(search) || (p.code && p.code.toLowerCase().includes(search));
    }), [data.parties, jobCode]);

  const addCoil = () => {
     setCoils([...coils, { id: `c-${Date.now()}`, number: coils.length + 1, size: '', rolls: 0 }]);
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

  const handleImportPlan = (p: SlittingPlan) => {
      setPlanId(p.id);
      setDate(p.date);
      setJobCode(p.partyCode);
      setSizer(p.sizer || '');
      setSize(p.size || ''); 
      setCoils(p.coilSizes.map((s, idx) => ({ id: `c-${idx}`, number: idx+1, size: s, rolls: 0 })));
      setPlanMicron(p.micron.toString());
      setPlanQty(p.qty.toString());
      setPlanRollLength('0');
      setActiveTab('create');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const shareSlittingJob = async (job: SlittingJob) => {
      const party = data.parties.find(p => p.name === job.jobCode)?.name || job.jobCode;
      const markedIds = selectedSlitRowsForShare[job.id] || [];
      const rowsToShare = markedIds.length > 0 ? job.rows.filter(r => markedIds.includes(r.id)) : job.rows;

      const containerId = 'share-slitting-gen';
      let container = document.getElementById(containerId);
      if (container) document.body.removeChild(container);
      
      container = document.createElement('div');
      container.id = containerId;
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0px';
      container.style.width = '900px'; 
      container.style.background = '#fff';
      container.style.zIndex = '-1';
      document.body.appendChild(container);

      const totalNetWt = rowsToShare.reduce((s, r) => s + r.netWeight, 0);
      const rowsHtml = rowsToShare.map((r, i) => {
          const coil = job.coils.find(c => c.id === r.coilId);
          return `
            <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f0f9ff'}; border-bottom: 2px solid #e2e8f0;">
                <td style="padding: 12px; font-size: 18px; font-weight: bold; color: #1e293b; text-align: center;">${r.srNo}</td>
                <td style="padding: 12px; font-size: 18px; color: #0f172a; font-weight: bold;">${coil?.size || 'N/A'} ${job.size ? `<span style="font-size: 14px; color: #94a3b8;">(${job.size} roll)</span>` : ''}</td>
                <td style="padding: 12px; font-size: 18px; color: #475569; text-align: center;">${r.meter}</td>
                <td style="padding: 12px; font-size: 18px; font-weight: bold; color: #0284c7; text-align: right;">${r.grossWeight.toFixed(3)}</td>
                <td style="padding: 12px; font-size: 18px; font-weight: bold; color: #10b981; text-align: right;">${r.netWeight.toFixed(3)}</td>
            </tr>
          `;
      }).join('');

      container.innerHTML = `
        <div style="font-family: 'Inter', sans-serif; border: 4px solid #0f172a; background: #fff;">
            <div style="background: #0f172a; padding: 32px; color: white;">
                <div style="font-size: 18px; text-transform: uppercase; letter-spacing: 2px; color: #14b8a6; font-weight: bold;">Slitting Production Details</div>
                <div style="font-size: 36px; font-weight: bold; margin-top: 8px;">${party}</div>
                <div style="margin-top: 20px; display: flex; justify-content: space-between; border-top: 1px solid #334155; padding-top: 15px;">
                    <span style="font-size: 24px; font-weight: bold;">Job No: #${job.jobNo}</span>
                    <span style="font-size: 20px; opacity: 0.8;">Date: ${job.date.split('-').reverse().join('/')}</span>
                </div>
                ${job.sizer ? `<div style="font-size: 18px; font-weight: bold; color: #fbbf24; margin-top: 10px;">Sizer: ${job.sizer}</div>` : ''}
            </div>
            <table style="width: 100%; border-collapse: collapse;">
                <thead style="background: #f1f5f9; border-bottom: 3px solid #0f172a;">
                    <tr style="text-transform: uppercase; color: #475569; font-size: 16px;">
                        <th style="padding: 15px 12px;">Sr</th>
                        <th style="padding: 15px 12px; text-align: left;">Output Coil</th>
                        <th style="padding: 15px 12px;">Meter</th>
                        <th style="padding: 15px 12px; text-align: right;">Gross</th>
                        <th style="padding: 15px 12px; text-align: right;">Net Wt</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
                <tfoot style="background: #0f172a; color: white;">
                    <tr>
                        <td colspan="4" style="padding: 20px; font-size: 22px; font-weight: bold;">TOTAL OUTPUT</td>
                        <td style="padding: 20px; text-align: right; font-size: 26px; font-weight: bold;">${totalNetWt.toFixed(3)} kg</td>
                    </tr>
                </tfoot>
            </table>
        </div>
      `;

      if ((window as any).html2canvas) {
          const canvas = await (window as any).html2canvas(container, { scale: 2 });
          canvas.toBlob(async (blob: Blob) => {
              if (blob) {
                  const file = new File([blob], `Slitting_${job.jobNo}.png`, { type: 'image/png' });
                  if (navigator.share && navigator.canShare({ files: [file] })) {
                      await navigator.share({ files: [file], title: `Slitting #${job.jobNo}`, text: `Production details for ${party}` });
                  } else {
                      const link = document.createElement('a');
                      link.href = URL.createObjectURL(blob);
                      link.download = `Slitting_${job.jobNo}.png`;
                      link.click();
                  }
              }
              document.body.removeChild(container!);
          });
      }
  };

  const handleEdit = (job: SlittingJob) => {
    setEditingJobId(job.id);
    setPlanId(job.planId || null);
    setDate(job.date);
    setJobNo(job.jobNo);
    setJobCode(job.jobCode);
    setSizer(job.sizer || '');
    setSize(job.size || ''); 
    setCoils(job.coils || [{ id: 'c-1', number: 1, size: '', rolls: 0 }]);
    setPlanMicron(job.planMicron?.toString() || '');
    setPlanQty(job.planQty?.toString() || '');
    setPlanRollLength(job.planRollLength?.toString() || '');
    setActiveTab('create');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingJobId(null);
    setPlanId(null);
    setJobNo(''); 
    setJobCode(''); 
    setSizer('');
    setSize('');
    setDate(new Date().toISOString().split('T')[0]);
    setCoils([{ id: 'c-1', number: 1, size: '', rolls: 0 }]);
    setPlanMicron(''); setPlanQty(''); setPlanRollLength('');
  };

  const handleSave = async () => {
    if(!jobNo || !jobCode || coils.some(c => !c.size)) return alert("Fill required fields");
    const pMicron = parseFloat(planMicron) || 0;
    const pQty = parseFloat(planQty) || 0;
    const existingJob = editingJobId ? data.slittingJobs.find(j => j.id === editingJobId) : null;
    const jobData: SlittingJob = {
       id: editingJobId || `slit-${Date.now()}`,
       planId: planId || undefined,
       date, jobNo, jobCode, sizer, size,
       coils,
       planMicron: pMicron, planQty: pQty,
       planRollLength: parseFloat(planRollLength) || 0,
       rows: existingJob ? existingJob.rows : [],
       status: existingJob ? existingJob.status : 'PENDING',
       createdAt: existingJob ? existingJob.createdAt : new Date().toISOString(),
       updatedAt: new Date().toISOString()
    };
    await saveSlittingJob(jobData);
    if (planId) {
        await updateSlittingPlan({ id: planId, status: 'COMPLETED' });
    }
    resetForm();
    setActiveTab('view');
    alert("Saved Successfully!");
  };

  const handleDelete = async (id: string) => {
     if(confirm("Delete this Job Card?")) await deleteSlittingJob(id);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
       
       {/* 1. Pending Slitting Plans - Detailed Carousel */}
       {pendingSlittingPlans.length > 0 && activeTab === 'view' && (
           <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 shadow-inner">
               <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                   <Layers size={14} /> Pending Slitting Plans (Full Overview)
               </h3>
               <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-3">
                   {pendingSlittingPlans.map(plan => (
                       <div key={plan.id} className="min-w-[280px] bg-white border border-amber-200 rounded-2xl p-4 hover:border-amber-400 hover:shadow-xl transition-all group flex flex-col">
                           <div className="flex justify-between items-start mb-2">
                               <span className="text-[10px] font-bold text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded">
                                   {plan.date.split('-').reverse().slice(0,2).join('/')}
                               </span>
                               <span className="text-[10px] font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                                   #{plan.planNo}
                               </span>
                           </div>
                           
                           <div className="font-bold text-slate-900 text-sm mb-1 truncate leading-tight">
                               {plan.partyCode}
                           </div>

                           <div className="flex items-center gap-4 mb-3">
                               <div className="flex items-center gap-1.5 text-indigo-600 font-bold text-[10px] uppercase">
                                   <UserCheck size={12} className="text-indigo-400" />
                                   {plan.sizer || 'No Sizer'}
                               </div>
                               <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[10px] uppercase">
                                   <Package size={12} className="text-slate-300" />
                                   {plan.size || 'Input ?'}
                               </div>
                           </div>

                           <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2 mb-4 flex-1">
                               <div>
                                   <div className="text-[8px] text-slate-400 font-bold uppercase mb-1">Coil Output Breakdown</div>
                                   <div className="flex flex-wrap gap-1.5">
                                       {plan.coilSizes.map((s, i) => (
                                           <span key={i} className="bg-white border border-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                                               {s}
                                           </span>
                                       ))}
                                   </div>
                               </div>
                               
                               <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                                   <div>
                                       <div className="text-[8px] text-slate-400 font-bold uppercase">Micron</div>
                                       <div className="text-xs font-extrabold text-slate-700">{plan.micron}</div>
                                   </div>
                                   <div>
                                       <div className="text-[8px] text-slate-400 font-bold uppercase">Target Wt</div>
                                       <div className="text-xs font-extrabold text-indigo-600">{plan.qty} kg</div>
                                   </div>
                               </div>
                           </div>

                           <button 
                               onClick={() => handleImportPlan(plan)} 
                               className="w-full bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md group-hover:scale-[1.02] transition-all transform active:scale-95"
                           >
                               <ArrowRightCircle size={14} /> Create Job Card
                           </button>
                       </div>
                   ))}
               </div>
           </div>
       )}

       <div className="flex bg-white/50 backdrop-blur-sm p-1.5 rounded-xl w-full max-w-md mx-auto mb-6 border border-white/60 shadow-sm">
          <button onClick={() => { setActiveTab('view'); setEditingJobId(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab==='view'?'bg-slate-900 text-white shadow-md':'text-slate-500 hover:bg-slate-100'}`}>View Jobs</button>
          <button onClick={() => { setActiveTab('create'); resetForm(); }} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab==='create' && !editingJobId ?'bg-slate-900 text-white shadow-md':'text-slate-500 hover:bg-slate-100'}`}>+ Create Job</button>
       </div>

       {activeTab === 'create' && (
          <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
             <div className={`px-6 py-4 flex items-center justify-between ${editingJobId ? 'bg-amber-600' : 'bg-slate-900'}`}>
                <div className="flex items-center gap-3"><span className="text-xl text-white">{editingJobId ? '✏️' : '🏭'}</span><h3 className="text-white font-bold text-lg">{editingJobId ? 'Edit Slitting Job' : (planId ? 'Imported Slitting Job' : 'Create Slitting Job Card')}</h3></div>
                {(editingJobId || planId) && <button onClick={resetForm} className="text-white/80 hover:text-white text-xs font-bold border border-white/30 px-3 py-1 rounded-md">Reset</button>}
             </div>
             <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                   <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-indigo-500" /></div>
                   <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Job No</label><input type="text" value={jobNo} onChange={e => setJobNo(e.target.value)} placeholder="e.g. 1005" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-indigo-500" /></div>
                </div>
                
                <div className="relative">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Party Name / Code</label>
                    <input type="text" value={jobCode} onChange={e => { setJobCode(e.target.value); setShowPartyDropdown(true); }} onFocus={() => setShowPartyDropdown(true)} onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)} placeholder="Search Party..." className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-indigo-500 shadow-sm" />
                    {showPartyDropdown && jobCode && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto p-1 animate-in slide-in-from-top-1">
                            {partySuggestions.map(p => (
                                <div key={p.id} className="px-3 py-2 hover:bg-indigo-50 rounded-lg cursor-pointer text-xs font-bold text-slate-700 flex justify-between items-center" onClick={() => { setJobCode(p.code || p.name); setShowPartyDropdown(false); }}>
                                    <span>{p.name}</span>
                                    <span className="text-[9px] bg-slate-100 px-1.5 rounded text-slate-500">{p.code}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                       <label className="text-[10px] font-bold text-indigo-400 uppercase block mb-1.5">Sizer</label>
                       <input type="text" value={sizer} onChange={e => setSizer(e.target.value)} placeholder="Assign Operator" className="w-full bg-indigo-50/20 border border-indigo-100 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-indigo-500 shadow-sm" />
                   </div>
                   <div>
                       <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Parent Size</label>
                       <input type="text" value={size} onChange={e => setSize(e.target.value)} placeholder="e.g. 800mm" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-indigo-500 shadow-sm" />
                   </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                   <div className="flex justify-between items-center"><h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Output Coils</h4><button onClick={addCoil} className="text-[10px] font-bold text-indigo-600 bg-white px-3 py-1.5 rounded border shadow-sm">+ Add Coil</button></div>
                   {coils.map((coil, idx) => (
                      <div key={coil.id} className="grid grid-cols-12 gap-3 items-end bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                          <div className="col-span-8">
                              <label className="text-[9px] font-bold text-slate-300 uppercase block mb-1">Coil {idx + 1}</label>
                              <input type="text" value={coil.size} onChange={e => updateCoil(idx, 'size', e.target.value)} placeholder="Size..." className="w-full border-b border-slate-100 outline-none focus:border-indigo-400 py-1 text-sm font-bold text-slate-700" />
                          </div>
                          <div className="col-span-3">
                              <label className="text-[9px] font-bold text-slate-300 uppercase block mb-1 text-center">Rolls</label>
                              <input type="number" value={coil.rolls === 0 ? '' : coil.rolls} onChange={e => updateCoil(idx, 'rolls', e.target.value)} className="w-full border-b border-slate-100 outline-none focus:border-indigo-400 py-1 text-sm font-bold text-center text-slate-700" />
                          </div>
                          <div className="col-span-1 flex justify-center pb-1">{coils.length > 1 && <button onClick={() => removeCoil(idx)} className="text-red-300 hover:text-red-500 transition-colors font-bold text-lg">×</button>}</div>
                      </div>
                   ))}
                </div>
                <div className="grid grid-cols-3 gap-4">
                   <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Micron</label><input type="number" value={planMicron} onChange={e => setPlanMicron(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-center outline-none focus:border-indigo-500" /></div>
                   <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Qty (kg)</label><input type="number" value={planQty} onChange={e => setPlanQty(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-center outline-none focus:border-indigo-500" /></div>
                   <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Length (m)</label><input type="number" value={planRollLength} onChange={e => setPlanRollLength(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-center outline-none focus:border-indigo-500" /></div>
                </div>
                <button onClick={handleSave} className={`w-full text-white font-bold py-3.5 rounded-xl shadow-lg active:scale-[0.98] transform transition-all ${editingJobId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-900 hover:bg-black'}`}>
                   {editingJobId ? 'Update Job Card' : 'Save Job Card'}
                </button>
             </div>
          </div>
       )}

       {activeTab === 'view' && (
          <div className="space-y-4">
             {data.slittingJobs.map(job => {
                const isExpanded = expandedJobId === job.id;
                const totalNetWt = job.rows.reduce((s, r) => s + r.netWeight, 0);
                const markedCount = (selectedSlitRowsForShare[job.id] || []).length;
                return (
                   <div key={job.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all">
                      <div onClick={() => setExpandedJobId(isExpanded ? null : job.id)} className="p-4 cursor-pointer hover:bg-slate-50/50">
                         <div className="flex justify-between items-center">
                            <div>
                               <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200">{job.date}</span>
                                  <span className={`text-[10px] font-bold px-2 py-1 rounded border ${job.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{job.status}</span>
                               </div>
                               <h3 className="text-base font-bold text-slate-800">#{job.jobNo} | {getPartyName(job)}</h3>
                               <div className="flex gap-3 mt-1">
                                   {job.sizer && <div className="text-[9px] font-bold text-indigo-600 uppercase">Sizer: {job.sizer}</div>}
                                   {job.size && <div className="text-[9px] font-bold text-slate-400 uppercase">Parent: {job.size}</div>}
                               </div>
                            </div>
                            <div className="text-right">
                               <div className="text-[10px] font-bold text-slate-400 uppercase">Output</div>
                               <div className="text-xl font-bold text-slate-800">{totalNetWt.toFixed(3)} kg</div>
                            </div>
                         </div>
                      </div>
                      {isExpanded && (
                        <div className="bg-slate-50/50 border-t border-slate-100 p-4">
                            <div className="flex justify-between gap-2 mb-4">
                                <button onClick={() => handleEdit(job)} className="text-xs font-bold bg-white border px-3 py-1.5 rounded-lg transition-colors hover:bg-slate-100">Edit Header</button>
                                <button onClick={() => shareSlittingJob(job)} className="text-xs font-bold bg-emerald-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm hover:bg-emerald-700"><Share2 size={14}/> Share {markedCount > 0 ? `(${markedCount})` : ''}</button>
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

  function getPartyName(job: SlittingJob) {
      const searchKey = job.jobCode.trim().toLowerCase();
      const p = data.parties.find(p => p.name.toLowerCase() === searchKey || (p.code && p.code.toLowerCase() === searchKey));
      return p ? p.name : job.jobCode;
  }
};
