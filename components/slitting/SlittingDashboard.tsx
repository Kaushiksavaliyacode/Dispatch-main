import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppData, SlittingJob, SlittingProductionRow } from '../../types';
import { saveSlittingJob } from '../../services/storageService';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const SlittingDashboard: React.FC<Props> = ({ data }) => {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [activeCoilId, setActiveCoilId] = useState<string | null>(null);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDate, setSearchDate] = useState('');

  const [gridRows, setGridRows] = useState<SlittingProductionRow[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // Refs to access latest state inside timeouts
  const activeCoilIdRef = useRef(activeCoilId);
  const selectedJobIdRef = useRef(selectedJobId);

  useEffect(() => { activeCoilIdRef.current = activeCoilId; }, [activeCoilId]);
  useEffect(() => { selectedJobIdRef.current = selectedJobId; }, [selectedJobId]);

  const selectedJob = data.slittingJobs.find(j => j.id === selectedJobId);
  const selectedCoil = selectedJob?.coils?.find(c => c.id === activeCoilId);

  // Filter Jobs - CHANGED: No longer filtering out COMPLETED jobs
  const filteredJobs = data.slittingJobs.filter(j => {
      const matchesSearch = searchTerm === '' || 
          j.jobNo.toLowerCase().includes(searchTerm.toLowerCase()) || 
          j.jobCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          j.coils.some(c => c.size.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesDate = searchDate === '' || j.date === searchDate;

      return matchesSearch && matchesDate;
  });

  const parseSize = (sizeStr: string): number => {
    const match = sizeStr.match(/(\d+(\.\d+)?)/);
    return match ? parseFloat(match[0]) : 0;
  };

  // --- SHARE REPORT FUNCTION ---
  const shareSlittingReport = async (job: SlittingJob) => {
    const containerId = 'slitting-share-container';
    let container = document.getElementById(containerId);
    if (container) document.body.removeChild(container);
    
    container = document.createElement('div');
    container.id = containerId;
    container.style.position = 'fixed';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    container.style.width = '600px';
    container.style.backgroundColor = '#ffffff';
    container.style.fontFamily = 'Inter, sans-serif';
    document.body.appendChild(container);

    const totalNet = job.rows.reduce((s, r) => s + (r.netWeight || 0), 0);
    const totalGross = job.rows.reduce((s, r) => s + (r.grossWeight || 0), 0);

    // Build Rows HTML Grouped by Coil
    let tablesHtml = '';
    job.coils.forEach(coil => {
        const coilRows = job.rows.filter(r => r.coilId === coil.id).sort((a,b) => a.srNo - b.srNo);
        if (coilRows.length === 0) return;

        const coilTotalNet = coilRows.reduce((s,r) => s + (r.netWeight||0), 0);
        
        const rowsHtml = coilRows.map(r => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 12px; color: #475569;">${r.srNo}</td>
                <td style="padding: 8px 12px; text-align: right; font-family: monospace; color: #334155;">${r.grossWeight.toFixed(3)}</td>
                <td style="padding: 8px 12px; text-align: right; font-family: monospace; color: #ef4444;">${r.coreWeight.toFixed(3)}</td>
                <td style="padding: 8px 12px; text-align: right; font-family: monospace; font-weight: bold; color: #059669;">${r.netWeight.toFixed(3)}</td>
                <td style="padding: 8px 12px; text-align: right; font-family: monospace; color: #64748b;">${r.meter}</td>
            </tr>
        `).join('');

        tablesHtml += `
            <div style="margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background: #f8fafc; padding: 10px 15px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: bold; color: #334155; font-size: 14px;">Size: ${coil.size}</span>
                    <span style="font-size: 12px; background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-weight: bold;">Total: ${coilTotalNet.toFixed(3)} kg</span>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead style="background: #ffffff; border-bottom: 2px solid #f1f5f9; color: #64748b; font-weight: bold;">
                        <tr>
                            <th style="padding: 8px 12px; text-align: left;">SR</th>
                            <th style="padding: 8px 12px; text-align: right;">Gross</th>
                            <th style="padding: 8px 12px; text-align: right;">Core</th>
                            <th style="padding: 8px 12px; text-align: right;">Net</th>
                            <th style="padding: 8px 12px; text-align: right;">Meter</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        `;
    });

    container.innerHTML = `
      <div style="background: white; overflow: hidden;">
         <!-- Header -->
         <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 25px; color: white;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9;">Slitting Report</div>
                    <div style="font-size: 22px; font-weight: bold; margin-top: 4px;">${job.jobCode}</div>
                    <div style="font-size: 12px; margin-top: 4px; opacity: 0.9;">Job No: <strong>#${job.jobNo}</strong></div>
                </div>
                <div style="text-align: right;">
                    <div style="background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 8px; backdrop-filter: blur(4px);">
                        <div style="font-size: 12px; font-weight: bold;">${job.date}</div>
                    </div>
                    <div style="font-size: 11px; margin-top: 6px;">Status: ${job.status}</div>
                </div>
            </div>
         </div>

         <!-- Summary Cards -->
         <div style="padding: 20px; display: flex; gap: 10px; background: #fffbeb;">
            <div style="flex: 1; background: white; padding: 10px; border-radius: 8px; border: 1px solid #fcd34d; text-align: center;">
                <div style="font-size: 10px; color: #92400e; font-weight: bold; text-transform: uppercase;">Total Net Wt</div>
                <div style="font-size: 18px; font-weight: bold; color: #b45309;">${totalNet.toFixed(3)} <span style="font-size: 12px;">kg</span></div>
            </div>
            <div style="flex: 1; background: white; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: center;">
                <div style="font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase;">Total Gross</div>
                <div style="font-size: 18px; font-weight: bold; color: #334155;">${totalGross.toFixed(3)} <span style="font-size: 12px;">kg</span></div>
            </div>
            <div style="flex: 1; background: white; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: center;">
                <div style="font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase;">Micron</div>
                <div style="font-size: 18px; font-weight: bold; color: #334155;">${job.planMicron}</div>
            </div>
         </div>

         <!-- Details -->
         <div style="padding: 20px;">
            ${tablesHtml || '<div style="text-align: center; color: #94a3b8; font-style: italic;">No production data recorded.</div>'}
         </div>

         <!-- Footer -->
         <div style="padding: 0 20px 20px 20px; text-align: center;">
             <div style="border-top: 1px dashed #e2e8f0; padding-top: 10px; font-size: 10px; color: #94a3b8;">
                Generated by RDMS Production System
             </div>
         </div>
      </div>
    `;

    if ((window as any).html2canvas) {
      try {
        const canvas = await (window as any).html2canvas(container, { backgroundColor: '#ffffff', scale: 2 });
        canvas.toBlob(async (blob: Blob) => {
          if (blob) {
            const file = new File([blob], `Slitting_${job.jobNo}.png`, { type: 'image/png' });
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file], title: `Job #${job.jobNo}`, text: `Production Report for ${job.jobCode}` });
            } else {
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = `Slitting_${job.jobNo}.png`;
              link.click();
            }
          }
          if (document.body.contains(container!)) document.body.removeChild(container!);
        });
      } catch (e) {
        console.error("Image gen failed", e);
        if (document.body.contains(container!)) document.body.removeChild(container!);
      }
    }
  };

  // --- LOAD ROWS ---
  useEffect(() => {
     if (selectedJob && activeCoilId) {
        const existingRows = selectedJob.rows.filter(r => r.coilId === activeCoilId);
        if (existingRows.length === 0) {
           const placeholders = Array.from({ length: 5 }).map((_, i) => createEmptyRow(activeCoilId, i + 1));
           setGridRows(placeholders);
        } else {
           setGridRows(existingRows.sort((a,b) => a.srNo - b.srNo));
        }
        setHasUnsavedChanges(false);
     }
  }, [selectedJobId, activeCoilId]); 

  // Set default coil
  useEffect(() => {
     if (selectedJob && selectedJob.coils && selectedJob.coils.length > 0 && !activeCoilId) {
        setActiveCoilId(selectedJob.coils[0].id);
     }
  }, [selectedJob, activeCoilId]);

  // --- AUTO SAVE LOGIC ---
  useEffect(() => {
    const timer = setTimeout(() => {
        if (hasUnsavedChanges && !isAutoSaving && selectedJobId && activeCoilId) {
            handleSaveChanges(true);
        }
    }, 1500); 

    return () => clearTimeout(timer);
  }, [gridRows, hasUnsavedChanges, selectedJobId, activeCoilId]);

  const createEmptyRow = (coilId: string, srNo: number): SlittingProductionRow => ({
      id: `sr-${Date.now()}-${Math.random()}`,
      coilId,
      srNo,
      size: '',
      meter: 0,
      micron: 0,
      grossWeight: 0,
      coreWeight: 0,
      netWeight: 0
  });

  const handleOpenJob = (job: SlittingJob) => {
    setSelectedJobId(job.id);
    setActiveCoilId(null); 
  };

  const calculateRow = (row: SlittingProductionRow, job: SlittingJob, coilSize: number) => {
      const net = (row.grossWeight || 0) - (row.coreWeight || 0);
      const netWeight = net < 0 ? 0 : net;
      let meter = 0;
      if (job.planMicron > 0 && coilSize > 0 && netWeight > 0) {
          // Formula: (Net / Micron / 0.00139 / Size) * 1000
          const calculatedMeter = (netWeight / job.planMicron / 0.00139 / coilSize) * 1000;
          meter = Math.round(calculatedMeter);
      }
      return { ...row, netWeight, meter };
  };

  const handleGridChange = (rowId: string, field: 'grossWeight' | 'coreWeight', value: string) => {
     if (!selectedJob || !selectedCoil) return;
     
     const val = parseFloat(value) || 0;
     const sizeNum = parseSize(selectedCoil.size);
     
     // Detect if editing the first row's core weight
     const isFirstRowCore = field === 'coreWeight' && gridRows.length > 0 && gridRows[0].id === rowId;

     setGridRows(prev => {
        const newRows = prev.map(row => {
            if (row.id === rowId) {
                return calculateRow({ ...row, [field]: val }, selectedJob, sizeNum);
            }
            return row;
        });

        // Auto-fill core weight for ALL rows if the first row's core weight changed
        if (isFirstRowCore) {
            return newRows.map(row => calculateRow({ ...row, coreWeight: val }, selectedJob, sizeNum));
        }

        return newRows;
     });
     setHasUnsavedChanges(true);
  };

  const addMoreRows = () => {
     if (!activeCoilId) return;
     const startSr = gridRows.length > 0 ? Math.max(...gridRows.map(r => r.srNo)) + 1 : 1;
     const newRows = Array.from({ length: 5 }).map((_, i) => createEmptyRow(activeCoilId, startSr + i));
     setGridRows(prev => [...prev, ...newRows]);
     setHasUnsavedChanges(true);
  };

  const handleSaveChanges = async (isAuto = false) => {
     const currentJobId = selectedJobIdRef.current;
     const currentCoilId = activeCoilIdRef.current;
     const currentJob = data.slittingJobs.find(j => j.id === currentJobId);
     if (!currentJob || !currentCoilId) return;

     if (isAuto) setIsAutoSaving(true);

     const validRows = gridRows.filter(r => r.grossWeight > 0);
     const enrichedRows = validRows.map(r => ({
         ...r,
         size: currentJob.coils.find(c => c.id === currentCoilId)?.size || '',
         micron: currentJob.planMicron
     }));
     const otherCoilRows = currentJob.rows.filter(r => r.coilId !== currentCoilId);
     const allRows = [...otherCoilRows, ...enrichedRows];

     const updatedJob = {
        ...currentJob,
        rows: allRows,
        status: 'IN_PROGRESS' as const,
        updatedAt: new Date().toISOString()
     };

     await saveSlittingJob(updatedJob);
     if (isAuto) {
         setIsAutoSaving(false);
         setHasUnsavedChanges(false);
     } else {
         setHasUnsavedChanges(false);
     }
  };

  const handleCompleteJob = async () => {
    if (!selectedJob) return;
    if (hasUnsavedChanges) await handleSaveChanges(false);
    if (!confirm('Mark Job as COMPLETED?')) return;
    const updatedJob = { ...selectedJob, status: 'COMPLETED' as const, updatedAt: new Date().toISOString() };
    await saveSlittingJob(updatedJob);
    setSelectedJobId(null);
  };

  // --- JOB SELECTION LIST ---
  if (!selectedJob) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in zoom-in duration-500">
        
        {/* Header with Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-4 rounded-2xl text-white shadow-xl shadow-amber-200 transform hover:scale-105 transition-transform">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Slitting Floor</h1>
                    <p className="text-slate-500 font-medium">Select a job to update production</p>
                </div>
            </div>

            {/* Search Bar */}
            <div className="flex gap-3 w-full md:w-auto bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                <div className="relative flex-1 md:w-64">
                    <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
                    <input 
                        type="text" 
                        placeholder="Search Job No, Code, Size..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-0 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-200 transition-all placeholder:font-normal"
                    />
                </div>
                <input 
                    type="date" 
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    className="bg-slate-50 border-0 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-amber-200 cursor-pointer"
                />
                {(searchTerm || searchDate) && (
                    <button onClick={() => { setSearchTerm(''); setSearchDate(''); }} className="px-3 py-2 text-slate-400 hover:text-red-500 transition-colors font-bold">
                        ✕
                    </button>
                )}
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map((job, idx) => {
            const totalNet = job.rows.reduce((s, r) => s + (r.netWeight || 0), 0);
            const progress = job.planQty > 0 ? (totalNet / job.planQty) * 100 : 0;
            
            // Dynamic Styles based on Status
            let statusColor = 'border-l-slate-300';
            let badgeClass = 'bg-slate-100 text-slate-500';
            
            if (job.status === 'IN_PROGRESS') {
                statusColor = 'border-l-blue-500';
                badgeClass = 'bg-blue-100 text-blue-700 animate-pulse ring-2 ring-blue-200';
            } else if (job.status === 'COMPLETED') {
                statusColor = 'border-l-emerald-500';
                badgeClass = 'bg-emerald-100 text-emerald-700';
            }

            return (
                <div 
                    key={job.id} 
                    style={{ animationDelay: `${idx * 50}ms` }}
                    onClick={() => handleOpenJob(job)} 
                    className={`group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden border-l-4 ${statusColor} animate-in slide-in-from-bottom-4`}
                >
                   <div className="p-6 relative">
                       {/* Header */}
                       <div className="flex justify-between items-start mb-4">
                           <div>
                               <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${badgeClass}`}>
                                   {job.status.replace('_',' ')}
                               </span>
                               <h3 className="text-xl font-bold text-slate-800 mt-2 leading-tight group-hover:text-blue-600 transition-colors">
                                   {job.jobCode}
                               </h3>
                               <div className="text-xs font-semibold text-slate-400 mt-1 flex items-center gap-1">Job No: <span className="text-slate-600">#{job.jobNo}</span></div>
                           </div>
                           <div className="text-right">
                               <div className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">{job.date}</div>
                           </div>
                       </div>

                       {/* Metrics Grid */}
                       <div className="grid grid-cols-2 gap-3 mb-5 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                           <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100">
                               <div className="text-[9px] font-bold text-slate-400 uppercase">Target</div>
                               <div className="text-sm font-bold text-slate-700">{job.planQty} <span className="text-[10px] font-normal text-slate-400">kg</span></div>
                           </div>
                           <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100 text-right">
                               <div className="text-[9px] font-bold text-slate-400 uppercase">Produced</div>
                               <div className={`text-sm font-bold ${totalNet > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{totalNet.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">kg</span></div>
                           </div>
                           <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100">
                               <div className="text-[9px] font-bold text-slate-400 uppercase">Micron</div>
                               <div className="text-sm font-bold text-slate-700">{job.planMicron}</div>
                           </div>
                           <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100 text-right">
                               <div className="text-[9px] font-bold text-slate-400 uppercase">Rolls</div>
                               <div className="text-sm font-bold text-slate-700">{job.rows.length}</div>
                           </div>
                       </div>

                       {/* Progress Bar with Glow */}
                       <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden shadow-inner relative">
                           <div 
                                className={`h-full rounded-full transition-all duration-1000 ease-out ${job.status==='IN_PROGRESS' ? 'bg-gradient-to-r from-blue-400 to-blue-600 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : job.status==='COMPLETED' ? 'bg-emerald-500' : 'bg-slate-300'}`} 
                                style={{width: `${Math.min(progress, 100)}%`}}
                           ></div>
                       </div>
                       <div className="text-[10px] text-right font-bold text-slate-400">{progress.toFixed(0)}% Completed</div>
                   </div>
                   
                   <div className="bg-slate-50/50 p-3 text-center border-t border-slate-100 text-xs font-bold text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors tracking-wide">
                       {job.status === 'COMPLETED' ? 'View Details' : 'Tap to Start Production →'}
                   </div>
                </div>
            );
          })}
          
          {filteredJobs.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300 shadow-sm animate-in fade-in duration-700">
                <div className="text-6xl mb-4 opacity-50 grayscale">✅</div>
                <h3 className="text-xl text-slate-800 font-bold mb-2">No Jobs Found</h3>
                <p className="text-slate-400 font-medium">Try adjusting your filters.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- JOB DETAIL VIEW ---
  const totalNetWeight = selectedJob.rows.reduce((sum, r) => sum + r.netWeight, 0);
  const currentCoilTotal = gridRows.reduce((sum, r) => sum + (r.netWeight || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-24 animate-in slide-in-from-right-8 duration-500">
      
      {/* Header Panel */}
      <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-5 sm:p-6 relative overflow-hidden">
         <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
         
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6 relative z-10">
             <div>
                <div className="flex items-center gap-3 mb-2">
                    <button onClick={() => { 
                        if(hasUnsavedChanges && !confirm("Discard unsaved changes?")) return;
                        setSelectedJobId(null); 
                    }} className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 bg-slate-100 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors group">
                        <span className="group-hover:-translate-x-1 transition-transform">←</span> Back
                    </button>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border uppercase tracking-wider ${selectedJob.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-600 border-blue-100' : selectedJob.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                        {selectedJob.status.replace('_', ' ')}
                    </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-2">
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight">#{selectedJob.jobNo}</h1>
                    <span className="text-lg font-medium text-slate-500">{selectedJob.jobCode}</span>
                </div>
             </div>
             
             <div className="flex flex-wrap gap-3 w-full md:w-auto">
                 <button onClick={() => shareSlittingReport(selectedJob)} className="flex-1 md:flex-none bg-white border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs font-bold px-5 py-3 rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-8.683-2.031-.967-.272-.297-.471-.421-.92-.891-.298-.471-.794-.666-1.514-.666-.72 0-1.885.27-2.871 1.336-.986 1.066-3.758 3.515-3.758 8.57 0 5.055 3.684 9.941 4.179 10.662.495.721 7.218 11.025 17.514 11.025 10.296 0 11.757-.692 13.843-2.775 2.086-2.083 2.086-3.89 2.086-3.89.27-.124.544-.272.718-.396.174-.124.322-.272.396-.446.074-.174.198-.644.198-1.336 0-.692-.52-1.238-1.114-1.535z"/></svg>
                    Share Report
                 </button>
                 <button onClick={handleCompleteJob} className="flex-1 md:flex-none bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-5 py-3 rounded-xl transition-all shadow-md hover:shadow-lg transform active:scale-95">
                    {selectedJob.status === 'COMPLETED' ? 'Update Status' : 'Mark Completed'}
                 </button>
             </div>
         </div>
         
         <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
             <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target Quantity</div>
                 <div className="text-xl font-bold text-slate-700 mt-1">{selectedJob.planQty} <span className="text-sm font-medium text-slate-400">kg</span></div>
             </div>
             <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                 <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Total Produced</div>
                 <div className="text-xl font-bold text-emerald-700 mt-1">{totalNetWeight.toFixed(3)} <span className="text-sm font-medium text-emerald-500">kg</span></div>
             </div>
         </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-0 px-2 scrollbar-hide">
         {selectedJob.coils?.map(coil => (
            <button
               key={coil.id}
               onClick={() => {
                   if(hasUnsavedChanges && !confirm("Save changes before switching coils?")) return;
                   setActiveCoilId(coil.id);
               }}
               className={`relative px-6 py-3 rounded-t-2xl font-bold text-sm whitespace-nowrap transition-all duration-300 ${activeCoilId === coil.id ? 'bg-indigo-600 text-white shadow-lg translate-y-1 z-10' : 'bg-white text-slate-500 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 translate-y-2'}`}
            >
               {coil.size}
            </button>
         ))}
      </div>

      {/* Grid Container */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden relative z-0 animate-in fade-in slide-in-from-bottom-8 duration-500">
         <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white shadow-md relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600"></div>
             <div className="relative z-10 flex items-center gap-3">
                 <span className="text-xl font-bold tracking-tight">{selectedCoil ? selectedCoil.size : '-'}</span>
                 <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold backdrop-blur-sm border border-white/10">DATA ENTRY</span>
             </div>
             <div className="relative z-10 hidden sm:block text-[10px] font-mono opacity-80 bg-black/20 px-3 py-1 rounded-lg">
                 Formula: (Net / {selectedJob.planMicron} / 0.00139 / Size) * 1000
             </div>
         </div>
         
         <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-xs text-left">
               <thead className="bg-slate-50/80 backdrop-blur text-slate-500 font-bold uppercase border-b border-slate-200 sticky top-0 z-20">
                  <tr>
                     <th className="px-4 py-3 text-center w-12">#</th>
                     <th className="px-4 py-3 text-right text-slate-800 w-32">Gross</th>
                     <th className="px-4 py-3 text-right text-red-500 w-24">Core</th>
                     <th className="px-4 py-3 text-right text-emerald-600 w-32">Net</th>
                     <th className="px-4 py-3 text-right text-slate-500 w-24">Meter</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {gridRows.map((row) => (
                     <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors h-12 group">
                        <td className="px-4 text-center font-mono text-slate-400 bg-slate-50/30 group-hover:bg-transparent">{row.srNo}</td>
                        <td className="px-2">
                            <input 
                                type="number" 
                                step="0.001"
                                value={row.grossWeight || ''} 
                                onChange={(e) => handleGridChange(row.id, 'grossWeight', e.target.value)}
                                className="w-full text-right font-mono font-bold text-slate-800 bg-slate-100 focus:bg-white border border-transparent focus:border-indigo-500 rounded-lg py-2 px-3 outline-none transition-all shadow-sm focus:shadow-md"
                                placeholder="0.000"
                            />
                        </td>
                        <td className="px-2">
                            <input 
                                type="number" 
                                step="0.001"
                                value={row.coreWeight || ''} 
                                onChange={(e) => handleGridChange(row.id, 'coreWeight', e.target.value)}
                                className="w-full text-right font-mono font-bold text-red-500 bg-red-50/30 focus:bg-white border border-transparent focus:border-red-400 rounded-lg py-2 px-3 outline-none transition-all shadow-sm focus:shadow-md"
                                placeholder="0.000"
                            />
                        </td>
                        <td className="px-4 text-right">
                            <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{row.netWeight > 0 ? row.netWeight.toFixed(3) : '-'}</span>
                        </td>
                        <td className="px-4 text-right font-mono text-slate-500">
                            {row.meter > 0 ? row.meter : '-'}
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>

         <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
             <div className="flex w-full sm:w-auto gap-2">
                 <button onClick={addMoreRows} className="flex-1 sm:flex-none text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-4 py-3 rounded-xl border border-indigo-100 transition-colors bg-white shadow-sm h-12 flex items-center justify-center gap-2">
                     <span>+ Add Rows</span>
                 </button>
                 <div className="flex-1 sm:flex-none bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl shadow-inner flex flex-col justify-center h-12">
                    <span className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Current Total</span>
                    <span className="text-sm font-bold text-emerald-600 leading-none">{currentCoilTotal.toFixed(3)} kg</span>
                 </div>
             </div>
             
             <button 
                onClick={() => handleSaveChanges(false)} 
                disabled={!hasUnsavedChanges && !isAutoSaving}
                className={`w-full sm:w-auto px-8 h-12 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${hasUnsavedChanges || isAutoSaving ? 'bg-indigo-600 hover:bg-indigo-700 text-white transform hover:scale-[1.02]' : 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default opacity-100'}`}
             >
                {isAutoSaving ? (
                    <>
                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                        <span>Saving...</span>
                    </>
                ) : hasUnsavedChanges ? (
                    <span>💾 Save Changes</span>
                ) : (
                    <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        <span>Saved</span>
                    </>
                )}
             </button>
         </div>
      </div>
    </div>
  );
};