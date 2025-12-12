
import React, { useState, useMemo, useEffect } from 'react';
import { AppData, DispatchEntry, DispatchRow, DispatchStatus, ProductionPlan } from '../../types';
import { saveDispatch, deleteDispatch, ensurePartyExists, deleteProductionPlan, saveProductionPlan } from '../../services/storageService';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

const SIZE_TYPES = ["", "INTAS", "OPEN", "ROUND", "ST.SEAL", "LABEL", "ROLL"];

export const DispatchManager: React.FC<Props> = ({ data, onUpdate }) => {
  const [activeDispatch, setActiveDispatch] = useState<Partial<DispatchEntry>>({
    date: new Date().toISOString().split('T')[0],
    dispatchNo: '',
    status: DispatchStatus.PENDING,
    rows: []
  });

  const [partyInput, setPartyInput] = useState('');
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  
  // Line Item Inputs
  const [lineSize, setLineSize] = useState('');
  const [lineType, setLineType] = useState('');
  const [lineMicron, setLineMicron] = useState('');
  const [lineWt, setLineWt] = useState('');
  const [lineProdWt, setLineProdWt] = useState(''); // New State
  const [linePcs, setLinePcs] = useState('');
  const [lineBundle, setLineBundle] = useState('');

  const [searchJob, setSearchJob] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);

  // Share Modal State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [jobToShare, setJobToShare] = useState<DispatchEntry | null>(null);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);

  // MULTI-SELECT JOBS (For Merging)
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);

  // Auto-generate Dispatch No
  useEffect(() => {
    if (!isEditingId && !activeDispatch.dispatchNo) {
      const maxNo = data.dispatches.reduce((max, d) => {
        const num = parseInt(d.dispatchNo);
        return !isNaN(num) && num > max ? num : max;
      }, 0);
      setActiveDispatch(prev => ({ ...prev, dispatchNo: (maxNo + 1).toString() }));
    }
  }, [data.dispatches, isEditingId, activeDispatch.dispatchNo]);

  const addLine = () => {
    const wt = parseFloat(lineWt) || 0;
    const prodWt = parseFloat(lineProdWt) || 0;
    const pcs = parseFloat(linePcs) || 0;
    const bundle = parseFloat(lineBundle) || 0;
    const wastage = prodWt > 0 ? (prodWt - wt) : 0;
    
    const newRow: DispatchRow = {
      id: `r-${Date.now()}-${Math.random()}`,
      size: lineSize || 'Item',
      sizeType: lineType,
      micron: parseFloat(lineMicron) || 0,
      weight: wt,
      productionWeight: prodWt,
      wastage: wastage,
      pcs: pcs,
      bundle: bundle,
      status: DispatchStatus.PENDING,
      isCompleted: false,
      isLoaded: false,
    };

    setActiveDispatch(prev => ({ ...prev, rows: [...(prev.rows || []), newRow] }));
    
    // Reset Inputs
    setLineSize(''); setLineType(''); setLineMicron(''); setLineWt(''); setLineProdWt(''); setLinePcs(''); setLineBundle('');
  };

  const removeLine = (index: number) => {
    setActiveDispatch(prev => {
      const newRows = [...(prev.rows || [])];
      newRows.splice(index, 1);
      return { ...prev, rows: newRows };
    });
  };

  const handleEdit = (d: DispatchEntry) => {
    const partyName = data.parties.find(p => p.id === d.partyId)?.name || '';
    setPartyInput(partyName);
    setActiveDispatch({ ...d });
    setIsEditingId(d.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setPartyInput('');
    // Reset dispatchNo to empty so useEffect recalculates it based on latest data
    setActiveDispatch({
        date: new Date().toISOString().split('T')[0],
        dispatchNo: '', 
        status: DispatchStatus.PENDING,
        rows: []
    });
    setIsEditingId(null);
  };

  const handleSave = async () => {
    if (!partyInput) return alert("Party Name Required");
    const partyId = await ensurePartyExists(data.parties, partyInput);
    const rows = activeDispatch.rows || [];
    const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
    const totalPcs = rows.reduce((s, r) => s + r.pcs, 0);

    const newDispatch: DispatchEntry = {
        id: activeDispatch.id || `d-${Date.now()}`,
        dispatchNo: activeDispatch.dispatchNo || 'AUTO',
        date: activeDispatch.date!,
        partyId,
        status: activeDispatch.status || DispatchStatus.PENDING,
        rows,
        totalWeight,
        totalPcs,
        isTodayDispatch: activeDispatch.isTodayDispatch || false,
        createdAt: activeDispatch.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    await saveDispatch(newDispatch);
    resetForm();
  };

  const handleRowUpdate = async (d: DispatchEntry, rowId: string, field: keyof DispatchRow, value: any) => {
      const updatedRows = d.rows.map(r => {
          if (r.id === rowId) {
              const updated = { ...r, [field]: value };
              if (field === 'productionWeight' || field === 'weight') {
                  const prodWt = field === 'productionWeight' ? Number(value) : (r.productionWeight || 0);
                  const dispWt = field === 'weight' ? Number(value) : (r.weight || 0);
                  updated.wastage = prodWt > 0 ? prodWt - dispWt : 0;
              }
              return updated;
          }
          return r;
      });
      
      // Auto-update Job status logic
      let newJobStatus = d.status;
      const allDispatched = updatedRows.every(r => r.status === DispatchStatus.DISPATCHED);
      
      if (allDispatched && d.status !== DispatchStatus.DISPATCHED) {
          newJobStatus = DispatchStatus.DISPATCHED;
      } else if (!allDispatched && d.status === DispatchStatus.DISPATCHED) {
          newJobStatus = DispatchStatus.PENDING; 
      } else if (updatedRows.every(r => r.status === DispatchStatus.COMPLETED || r.status === DispatchStatus.DISPATCHED)) {
          newJobStatus = DispatchStatus.COMPLETED;
      }

      // ** AUTO-UPDATE DATE IF STATUS BECOMES DISPATCHED **
      let newDate = d.date;
      if (newJobStatus === DispatchStatus.DISPATCHED && d.status !== DispatchStatus.DISPATCHED) {
          newDate = new Date().toISOString().split('T')[0];
      }

      const totalWeight = updatedRows.reduce((s, r) => s + r.weight, 0);
      const totalPcs = updatedRows.reduce((s, r) => s + r.pcs, 0);
      
      const updatedDispatch = { 
          ...d, 
          rows: updatedRows, 
          totalWeight, 
          totalPcs,
          status: newJobStatus,
          date: newDate,
          updatedAt: new Date().toISOString() 
      };

      await saveDispatch(updatedDispatch);
      
      if (isEditingId === d.id) {
          setActiveDispatch(updatedDispatch);
      }
  };

  const toggleToday = async (e: React.MouseEvent, d: DispatchEntry) => {
      e.stopPropagation();
      const updatedDispatch = { ...d, isTodayDispatch: !d.isTodayDispatch };
      await saveDispatch(updatedDispatch);
  };

  const handleJobStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>, d: DispatchEntry) => {
      e.stopPropagation();
      const newStatus = e.target.value as DispatchStatus;
      let updatedRows = d.rows;
      
      // ** AUTO-UPDATE DATE IF STATUS BECOMES DISPATCHED **
      let newDate = d.date;
      if (newStatus === DispatchStatus.DISPATCHED) {
          newDate = new Date().toISOString().split('T')[0];
      }

      if (confirm(`Update status to ${newStatus}? ${newStatus === 'DISPATCHED' ? '(Date will update to Today)' : ''}`)) {
          updatedRows = d.rows.map(r => ({ ...r, status: newStatus }));
          
          const updatedDispatch = { 
              ...d, 
              status: newStatus, 
              rows: updatedRows, 
              date: newDate,
              updatedAt: new Date().toISOString() 
          };
          await saveDispatch(updatedDispatch);
      }
  };

  // --- JOB MERGE LOGIC ---
  const toggleJobSelection = (id: string) => {
      setSelectedJobIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleMergeJobs = async () => {
      const jobsToMerge = data.dispatches.filter(d => selectedJobIds.includes(d.id));
      if (jobsToMerge.length < 2) return;

      // 1. Validate Party
      const firstPartyId = jobsToMerge[0].partyId;
      if (jobsToMerge.some(d => d.partyId !== firstPartyId)) {
          const partyName1 = data.parties.find(p => p.id === firstPartyId)?.name;
          alert(`Cannot merge jobs from different parties. All jobs must be for "${partyName1}".`);
          return;
      }

      // 2. Sort to find "Survivor" (Newest / Highest ID)
      const sortedJobs = jobsToMerge.sort((a,b) => parseInt(b.dispatchNo) - parseInt(a.dispatchNo));
      const survivor = sortedJobs[0];
      const victims = sortedJobs.slice(1);

      if (!confirm(`Merge ${victims.length} jobs into Job #${survivor.dispatchNo}? \n\n• ${victims.length} old job cards will be deleted.\n• All items will be moved to Job #${survivor.dispatchNo}.`)) return;

      // 3. Combine Rows
      let combinedRows = [...survivor.rows];
      victims.forEach(v => {
          combinedRows = [...combinedRows, ...v.rows];
      });

      // 4. Recalculate
      const totalWeight = combinedRows.reduce((acc, r) => acc + r.weight, 0);
      const totalPcs = combinedRows.reduce((acc, r) => acc + r.pcs, 0);

      // 5. Update Survivor
      const updatedSurvivor = {
          ...survivor,
          rows: combinedRows,
          totalWeight,
          totalPcs,
          updatedAt: new Date().toISOString()
      };
      
      await saveDispatch(updatedSurvivor);

      // 6. Delete Victims
      for (const v of victims) {
          await deleteDispatch(v.id);
      }

      setSelectedJobIds([]);
      alert("Jobs Merged Successfully!");
  };

  // --- PLAN IMPORT LOGIC ---
  const importPlan = async (plan: ProductionPlan) => {
     // Strict Party Check
     const currentParty = partyInput.trim().toLowerCase();
     const planParty = plan.partyName.trim().toLowerCase();

     if (activeDispatch.rows && activeDispatch.rows.length > 0) {
         if (currentParty && currentParty !== planParty) {
             if(!confirm(`Conflict: Current job is for "${partyInput}", but this plan is for "${plan.partyName}".\n\nClick OK to CLEAR current items and switch to "${plan.partyName}".\nClick Cancel to abort.`)) {
                 return;
             }
             // Clear old rows and set new party
             setActiveDispatch(prev => ({ ...prev, rows: [] }));
         }
     }
     
     // Set Party Input (always safe here)
     setPartyInput(plan.partyName);
     
     let displaySize = plan.cuttingSize > 0 ? `${plan.size} x ${plan.cuttingSize}` : plan.size;
     if (plan.type === 'Printing' && plan.printName) {
         displaySize = `${displaySize} (${plan.printName})`;
     }
     
     let mappedType = "";
     if (plan.type) {
         const upper = plan.type.toUpperCase();
         if(upper.includes("SEAL")) mappedType = "ST.SEAL";
         else if(upper.includes("ROUND")) mappedType = "ROUND";
         else if(upper.includes("OPEN")) mappedType = "OPEN";
         else if(upper.includes("INTAS")) mappedType = "INTAS";
         else if(upper.includes("LABEL")) mappedType = "LABEL";
         else if(upper.includes("ROLL")) mappedType = "ROLL";
     }

     const newRow: DispatchRow = {
        id: `r-${Date.now()}-${Math.random()}`,
        planId: plan.id, 
        size: displaySize,
        sizeType: mappedType, 
        micron: plan.micron,
        weight: 0, 
        productionWeight: plan.weight, 
        wastage: 0,
        pcs: plan.pcs,
        bundle: 0,
        status: DispatchStatus.PENDING,
        isCompleted: false,
        isLoaded: false
      };

      setActiveDispatch(prev => ({
          ...prev,
          rows: [...(prev.rows || []), newRow]
      }));

      if(confirm("Plan added to list. Mark plan as Completed?")) {
          const updatedPlan = { ...plan, status: 'COMPLETED' as const };
          await saveProductionPlan(updatedPlan);
      }
  };

  const handleDeletePlan = async (id: string) => {
      if(confirm("Remove this plan from pending list?")) {
          await deleteProductionPlan(id);
      }
  };

  // --- SHARE LOGIC ---
  const openShareModal = (d: DispatchEntry) => {
      const sizes = Array.from(new Set(d.rows.map(r => r.size)));
      setAvailableSizes(sizes);
      setSelectedSizes(sizes);
      setJobToShare(d);
      setShareModalOpen(true);
  };

  const toggleSizeSelection = (size: string) => {
      setSelectedSizes(prev => 
          prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
      );
  };

  const generateShareImage = async () => {
      if (!jobToShare) return;
      setShareModalOpen(false);
      
      const containerId = 'temp-share-container-job';
      let container = document.getElementById(containerId);
      if (container) document.body.removeChild(container);
      container = document.createElement('div');
      container.id = containerId;
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = '600px';
      container.style.backgroundColor = '#ffffff';
      container.style.padding = '0'; 
      container.style.fontFamily = 'Inter, sans-serif';
      container.style.color = '#000';
      document.body.appendChild(container);
  
      const party = data.parties.find(p => p.id === jobToShare.partyId)?.name || 'Unknown';
      const validRows = jobToShare.rows.filter(r => r.weight > 0 && selectedSizes.includes(r.size));
      const totalBundles = validRows.reduce((acc, r) => acc + (Number(r.bundle) || 0), 0);
      const totalWeight = validRows.reduce((acc, r) => acc + (Number(r.weight) || 0), 0);
      const totalPcs = validRows.reduce((acc, r) => acc + (Number(r.pcs) || 0), 0);
  
      const rowsHtml = validRows.map((r, index) => `
        <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 12px 15px; font-weight: bold; color: #1e293b;">${r.size} <span style="font-size:10px; color:#6366f1; background:#eef2ff; padding: 2px 4px; border-radius: 4px; text-transform: uppercase;">${r.sizeType || ''}</span></td>
          <td style="padding: 12px 15px; text-align: right; color: #334155; font-weight: bold;">${r.weight.toFixed(3)}</td>
          <td style="padding: 12px 15px; text-align: right; color: #334155; font-weight: bold;">${r.pcs}</td>
          <td style="padding: 12px 15px; text-align: right; color: #334155; font-weight: bold;">${r.bundle}</td>
        </tr>
      `).join('');
  
      container.innerHTML = `
        <div style="overflow: hidden; border-radius: 0;">
          <div style="background: linear-gradient(135deg, #4f46e5, #6366f1); padding: 25px; color: white;">
             <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                   <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8;">Dispatch Note</div>
                   <div style="font-size: 24px; font-weight: bold; margin-top: 5px;">${party}</div>
                </div>
                <div style="text-align: right;">
                   <div style="background: rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 8px; backdrop-filter: blur(5px);">
                      <div style="font-size: 11px; font-weight: bold;">${jobToShare.date}</div>
                   </div>
                   <div style="font-size: 11px; margin-top: 5px; opacity: 0.9;">Job #${jobToShare.dispatchNo}</div>
                </div>
             </div>
          </div>
          <div style="padding: 20px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <thead style="background: #f1f5f9;">
                  <tr>
                  <th style="padding: 10px 15px; text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase;">Size</th>
                  <th style="padding: 10px 15px; text-align: right; color: #64748b; font-size: 11px; text-transform: uppercase;">Weight</th>
                  <th style="padding: 10px 15px; text-align: right; color: #64748b; font-size: 11px; text-transform: uppercase;">Pcs</th>
                  <th style="padding: 10px 15px; text-align: right; color: #64748b; font-size: 11px; text-transform: uppercase;">Bundle</th>
                  </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
              <tfoot style="background: #f8fafc; font-weight: bold; border-top: 2px solid #e2e8f0;">
                  <tr>
                  <td style="padding: 15px; color: #1e293b;">TOTAL</td>
                  <td style="padding: 15px; text-align: right; color: #1e293b;">${totalWeight.toFixed(3)}</td>
                  <td style="padding: 15px; text-align: right; color: #1e293b;">${totalPcs}</td>
                  <td style="padding: 15px; text-align: right; color: #1e293b;">${totalBundles}</td>
                  </tr>
              </tfoot>
              </table>
          </div>
        </div>
      `;
  
      if ((window as any).html2canvas) {
        try {
          const canvas = await (window as any).html2canvas(container, { backgroundColor: '#ffffff', scale: 2 });
          canvas.toBlob(async (blob: Blob) => {
            if (blob) {
              const file = new File([blob], `Job_${jobToShare.dispatchNo}.png`, { type: 'image/png' });
              if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: `Job #${jobToShare.dispatchNo}`, text: `Dispatch Details for ${party}` });
              } else {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `Job_${jobToShare.dispatchNo}.png`;
                link.click();
              }
            }
            if (document.body.contains(container!)) document.body.removeChild(container!);
          });
        } catch (e) {
          console.error("Image generation failed", e);
          if (document.body.contains(container!)) document.body.removeChild(container!);
        }
      }
  };

  const getStatusPriority = (status: string) => {
      const s = status || 'PENDING';
      if (['PENDING', 'PRINTING', 'SLITTING', 'CUTTING'].includes(s)) return 0;
      if (s === 'COMPLETED') return 1;
      return 2; // DISPATCHED
  };

  const filteredDispatches = useMemo(() => {
      return data.dispatches.filter(d => {
          const party = (data.parties.find(p => p.id === d.partyId)?.name || '').toLowerCase();
          return party.includes(searchJob.toLowerCase()) || d.dispatchNo.includes(searchJob);
      }).sort((a, b) => {
          const scoreA = getStatusPriority(a.status);
          const scoreB = getStatusPriority(b.status);
          if (scoreA !== scoreB) return scoreA - scoreB;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [data.dispatches, data.parties, searchJob]);

  const partySuggestions = data.parties.filter(p => 
    p.name.toLowerCase().includes(partyInput.toLowerCase())
  );

  const allPlans = [...data.productionPlans].sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const calcWastage = (parseFloat(lineProdWt) || 0) > 0 ? (parseFloat(lineProdWt) || 0) - (parseFloat(lineWt) || 0) : 0;

  return (
    <div className="space-y-6">
        
        {/* SHARE MODAL */}
        {shareModalOpen && jobToShare && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="bg-indigo-600 px-6 py-4 text-white">
                        <h3 className="text-lg font-bold">Select Items to Share</h3>
                        <p className="text-xs opacity-80">Uncheck items you don't want in the image.</p>
                    </div>
                    <div className="p-4 max-h-[60vh] overflow-y-auto">
                        <div className="space-y-2">
                            {availableSizes.map(size => (
                                <label key={size} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                                    <input type="checkbox" checked={selectedSizes.includes(size)} onChange={() => toggleSizeSelection(size)} className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"/>
                                    <span className="font-bold text-slate-700">{size}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3">
                        <button onClick={() => setShareModalOpen(false)} className="flex-1 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
                        <button onClick={generateShareImage} className="flex-[2] py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg transition-colors">Generate Image</button>
                    </div>
                </div>
            </div>
        )}

        {/* --- PENDING PLANS SECTION (Compact View) --- */}
        {allPlans.length > 0 && !isEditingId && (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-slate-200 shadow-sm animate-in slide-in-from-top-4 duration-500 mb-4">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-sm bg-indigo-100 text-indigo-600 p-1 rounded-md">📋</span>
                        <h3 className="font-bold text-slate-700 text-sm">Active Queue <span className="text-slate-400 font-medium">({allPlans.length})</span></h3>
                    </div>
                </div>
                
                <div className="flex gap-2 overflow-x-auto pb-2 pt-1 snap-x scrollbar-thin">
                    {allPlans.map(plan => {
                        const isTaken = plan.status === 'COMPLETED';
                        let dimensions = plan.size;
                        if(plan.cuttingSize && plan.cuttingSize > 0) dimensions += ` x ${plan.cuttingSize}`;
                        
                        return (
                            <div 
                                key={plan.id} 
                                className={`min-w-[170px] max-w-[170px] snap-start bg-white rounded-lg border shadow-sm flex flex-col relative group cursor-pointer ${isTaken ? 'opacity-60 bg-slate-50 border-slate-200' : 'border-slate-200 hover:border-indigo-300'}`}
                            >
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeletePlan(plan.id); }}
                                    className="absolute top-1.5 left-1.5 text-slate-300 hover:text-red-500 bg-white/80 hover:bg-red-50 rounded-full p-0.5 transition-colors z-20 opacity-0 group-hover:opacity-100"
                                    title="Remove Plan"
                                >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                                
                                <div className="p-2 flex-1">
                                    <div className="mb-2 pr-4">
                                        <div className="text-[10px] font-bold text-slate-800 truncate" title={plan.partyName}>{plan.partyName}</div>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <span className="text-[8px] font-mono text-slate-400">{plan.date.substring(5)}</span>
                                            <span className="text-[8px] font-bold text-indigo-600 uppercase bg-indigo-50 px-1 rounded truncate max-w-[60px]">{plan.type}</span>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 border border-slate-100 rounded p-1.5 grid grid-cols-2 gap-x-2 gap-y-1">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] text-slate-400 uppercase leading-none">Size</span>
                                            <span className="text-[10px] font-bold text-slate-700 truncate" title={dimensions}>{dimensions}</span>
                                        </div>
                                        <div className="flex flex-col text-right">
                                            <span className="text-[8px] text-slate-400 uppercase leading-none">Wt</span>
                                            <span className="text-[10px] font-bold text-slate-900">{plan.weight}</span>
                                        </div>
                                    </div>
                                    
                                    {plan.notes && (
                                        <div className="mt-1 text-[8px] text-amber-600 truncate bg-amber-50 px-1 rounded border border-amber-100">
                                            {plan.notes}
                                        </div>
                                    )}
                                </div>

                                {isTaken ? (
                                    <div className="bg-slate-50 text-slate-400 text-[9px] font-bold py-1 text-center border-t border-slate-100 rounded-b-lg">
                                        Added
                                    </div>
                                ) : (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); importPlan(plan); }}
                                        className="mx-2 mb-2 py-1 bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-100 hover:border-indigo-200 text-[10px] font-bold rounded transition-all shadow-sm active:scale-95"
                                    >
                                        Import
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {/* Form Section */}
        <div className={`bg-white rounded-2xl shadow-sm border ${isEditingId ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'} overflow-hidden transition-all`}>
            <div className={`px-6 py-4 flex justify-between items-center ${isEditingId ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{isEditingId ? '✏️' : '🚛'}</span>
                    <h3 className="text-base font-bold text-white tracking-wide">
                        {isEditingId ? 'Edit Job' : 'New Job Entry'}
                    </h3>
                </div>
            </div>

            <div className="p-6 space-y-4">
                <div className="flex gap-4">
                    <div className="w-28">
                        <label className="text-xs font-bold text-slate-700 block mb-1">Job No</label>
                        <div className="w-full bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-sm font-extrabold text-indigo-700 text-center tracking-wide shadow-inner">
                            #{activeDispatch.dispatchNo || '...'}
                        </div>
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-bold text-slate-700 block mb-1">Date</label>
                        <input type="date" value={activeDispatch.date} onChange={e => setActiveDispatch({...activeDispatch, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500" />
                    </div>
                </div>

                <div className="relative">
                    <label className="text-xs font-bold text-slate-700 block mb-1">Party Name</label>
                    <input type="text" placeholder="Select Party..." value={partyInput} onChange={e => { setPartyInput(e.target.value); setShowPartyDropdown(true); }} onFocus={() => setShowPartyDropdown(true)} onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500" />
                    {showPartyDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {partySuggestions.map(p => (
                            <div key={p.id} className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-bold text-slate-800" onClick={() => { setPartyInput(p.name); setShowPartyDropdown(false); }}>{p.name}</div>
                        ))}
                        </div>
                    )}
                </div>

                {/* Add Line Item Box - Redesigned Grid */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="grid grid-cols-12 gap-3 mb-3 items-end">
                        <div className="col-span-12 md:col-span-3">
                            <label className="text-xs font-bold text-slate-700 block mb-1">Size / Item</label>
                            <input value={lineSize} onChange={e => setLineSize(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500" />
                        </div>
                        <div className="col-span-6 md:col-span-2">
                            <label className="text-xs font-bold text-slate-700 block mb-1">Type</label>
                            <select value={lineType} onChange={e => setLineType(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500">
                                {SIZE_TYPES.map(t => <option key={t} value={t}>{t || 'Select...'}</option>)}
                            </select>
                        </div>
                        <div className="col-span-6 md:col-span-1">
                            <label className="text-xs font-bold text-slate-700 block mb-1">Mic</label>
                            <input type="number" placeholder="0" value={lineMicron} onChange={e => setLineMicron(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm font-bold text-slate-900 text-center outline-none focus:border-indigo-500" />
                        </div>
                        
                        {/* Weights Row */}
                        <div className="col-span-4 md:col-span-2">
                             <label className="text-xs font-bold text-slate-700 block mb-1">Disp Wt</label>
                             <input type="number" value={lineWt} onChange={e => setLineWt(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm font-bold text-slate-900 text-center outline-none" placeholder="0" />
                        </div>
                        <div className="col-span-4 md:col-span-2">
                             <label className="text-xs font-bold text-indigo-700 block mb-1">Prod Wt</label>
                             <input type="number" value={lineProdWt} onChange={e => setLineProdWt(e.target.value)} className="w-full bg-white border border-indigo-200 rounded-lg px-2 py-2 text-sm font-bold text-indigo-700 text-center outline-none focus:border-indigo-500" placeholder="0" />
                        </div>
                        <div className="col-span-4 md:col-span-2 flex flex-col justify-end pb-2">
                             <div className="text-xs font-bold text-red-500 text-center">Waste: {calcWastage.toFixed(3)}</div>
                        </div>

                        {/* Counts Row */}
                        <div className="col-span-6 md:col-span-1">
                             <label className="text-xs font-bold text-slate-700 block mb-1">Pcs</label>
                             <input type="number" value={linePcs} onChange={e => setLinePcs(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm font-bold text-slate-900 text-center outline-none" />
                        </div>
                        <div className="col-span-6 md:col-span-1">
                             <label className="text-xs font-bold text-slate-700 block mb-1">Bdl</label>
                             <input type="number" value={lineBundle} onChange={e => setLineBundle(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm font-bold text-slate-900 text-center outline-none" />
                        </div>
                    </div>
                    <button onClick={addLine} className="w-full bg-white border border-indigo-200 text-indigo-700 rounded-lg py-2 text-xs font-bold hover:bg-indigo-50 transition-colors shadow-sm">+ Add Line Item</button>
                </div>

                {/* Rows List */}
                <div className="space-y-1 max-h-40 overflow-auto custom-scrollbar">
                    {(activeDispatch.rows || []).map((row, i) => (
                        <div key={i} className="group flex justify-between items-center text-xs bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 hover:border-indigo-200 transition-colors">
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-900">{row.size} {row.sizeType && `(${row.sizeType})`}</span>
                                <div className="flex gap-2 text-[10px] font-bold text-slate-600">
                                    <span>Disp: {row.weight}</span>
                                    {row.productionWeight && row.productionWeight > 0 ? (
                                        <span className="text-indigo-600">Prod: {row.productionWeight}</span>
                                    ) : null}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-slate-800">P:{row.pcs} B:{row.bundle}</span>
                                <button onClick={() => removeLine(i)} className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity p-1">✖</button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2 pt-4">
                    {isEditingId && (
                        <button onClick={resetForm} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-xl text-sm transition-colors">Cancel</button>
                    )}
                    <button onClick={handleSave} className={`flex-[2] text-white font-bold py-4 rounded-xl text-sm shadow-lg transition-transform active:scale-[0.99] ${isEditingId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-900 hover:bg-black'}`}>
                        {isEditingId ? 'Update Job' : 'Save Job'}
                    </button>
                </div>
            </div>
        </div>

        {/* List Section */}
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="text-xl">📋</span> Recent Jobs
                    </h3>
                    {selectedJobIds.length > 1 && (
                        <button 
                            onClick={handleMergeJobs} 
                            className="bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1 animate-in fade-in zoom-in"
                        >
                            <span>⚡ Merge {selectedJobIds.length} Jobs</span>
                        </button>
                    )}
                </div>
                <input placeholder="Search Job..." value={searchJob} onChange={e => setSearchJob(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 outline-none w-full sm:w-48 focus:ring-2 focus:ring-indigo-100" />
            </div>

            <div className="space-y-3">
                {filteredDispatches.map(d => {
                    const party = data.parties.find(p => p.id === d.partyId)?.name || 'Unknown';
                    const isExpanded = expandedId === d.id;
                    const totalBundles = d.rows.reduce((acc, r) => acc + (Number(r.bundle) || 0), 0);
                    const isSelected = selectedJobIds.includes(d.id);
                    
                    // Priority Visuals
                    const isPriority = ['PENDING', 'PRINTING', 'SLITTING', 'CUTTING'].includes(d.status);
                    const isCompleted = d.status === 'COMPLETED';
                    const isDispatched = d.status === 'DISPATCHED';

                    let cardStyle = 'bg-white border-slate-200';
                    let statusBadge = 'bg-slate-100 text-slate-500';
                    let accentColor = 'border-l-slate-300';

                    if (isPriority) {
                        cardStyle = 'bg-white border-blue-100 shadow-md';
                        accentColor = 'border-l-blue-500';
                        if(d.status === 'PRINTING') statusBadge = 'bg-indigo-100 text-indigo-700';
                        else if(d.status === 'SLITTING') statusBadge = 'bg-amber-100 text-amber-700 animate-pulse';
                        else if(d.status === 'CUTTING') statusBadge = 'bg-blue-100 text-blue-700 animate-pulse';
                        else statusBadge = 'bg-blue-50 text-blue-600';
                    } else if (isCompleted) {
                        cardStyle = 'bg-emerald-50/30 border-emerald-100 shadow-sm';
                        accentColor = 'border-l-emerald-500';
                        statusBadge = 'bg-emerald-100 text-emerald-700';
                    } else if (isDispatched) {
                        cardStyle = 'bg-slate-50/50 border-slate-100 opacity-90';
                        accentColor = 'border-l-purple-400';
                        statusBadge = 'bg-purple-100 text-purple-600';
                    }

                    const isToday = d.isTodayDispatch;

                    return (
                        <div key={d.id} className={`rounded-xl border border-l-4 overflow-hidden transition-all duration-300 ${cardStyle} ${accentColor} ${isExpanded ? 'ring-2 ring-indigo-50 shadow-lg scale-[1.01]' : 'hover:shadow-md'} ${isSelected ? 'ring-2 ring-indigo-500 scale-[1.01]' : ''}`}>
                           <div className="relative">
                               <div className="absolute top-3 right-3 z-10">
                                   <input 
                                        type="checkbox" 
                                        checked={isSelected} 
                                        onChange={() => toggleJobSelection(d.id)} 
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                   />
                               </div>
                               <div onClick={() => setExpandedId(isExpanded ? null : d.id)} className="p-4 cursor-pointer">
                                 <div className="flex flex-col gap-3">
                                    
                                    {/* Info */}
                                    <div className="pr-8">
                                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                         <span className="text-[10px] font-bold text-slate-400 tracking-wider font-mono">{d.date.substring(5).split('-').reverse().join('/')}</span>
                                         <span className="text-[10px] font-bold text-slate-300">|</span>
                                         <span className="text-[10px] font-extrabold text-slate-500 font-mono">#{d.dispatchNo}</span>
                                         {isToday && <span className="bg-indigo-500 text-white px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide flex items-center gap-1 shadow-sm">★ TODAY</span>}
                                      </div>
                                      <div className="flex justify-between items-start">
                                          {/* Wrap text for long names */}
                                          <h4 className="text-base font-bold text-slate-800 tracking-tight leading-tight flex-1 pr-2 break-words whitespace-normal">{party}</h4>
                                          
                                          {/* Mobile Status Dropdown */}
                                          <div className="sm:hidden" onClick={e => e.stopPropagation()}>
                                              <select 
                                                value={d.status || DispatchStatus.PENDING}
                                                onChange={(e) => handleJobStatusChange(e, d)}
                                                className={`text-[10px] font-bold py-1 px-2 rounded border-0 outline-none ${statusBadge} max-w-[100px]`}
                                              >
                                                  <option value={DispatchStatus.PENDING}>PENDING</option>
                                                  <option value={DispatchStatus.PRINTING}>PRINTING</option>
                                                  <option value={DispatchStatus.SLITTING}>SLITTING</option>
                                                  <option value={DispatchStatus.CUTTING}>CUTTING</option>
                                                  <option value={DispatchStatus.COMPLETED}>COMPLETED</option>
                                                  <option value={DispatchStatus.DISPATCHED}>DISPATCHED</option>
                                              </select>
                                          </div>
                                      </div>
                                    </div>

                                    {/* Stats & Desktop Status */}
                                    <div className="flex items-center gap-3 justify-between border-t border-slate-100 pt-3">
                                       <div className="flex gap-4">
                                           <div className="text-center">
                                               <div className="text-[9px] font-bold text-slate-400 uppercase">Bundles</div>
                                               <div className="text-sm font-bold text-slate-700">{totalBundles}</div>
                                           </div>
                                           <div className="text-center">
                                               <div className="text-[9px] font-bold text-slate-400 uppercase">Weight</div>
                                               <div className="text-sm font-bold text-slate-900">{d.totalWeight.toFixed(1)}</div>
                                           </div>
                                       </div>

                                       {/* Desktop Status Dropdown */}
                                       <div className="hidden sm:block" onClick={e => e.stopPropagation()}>
                                           <select 
                                                value={d.status || DispatchStatus.PENDING}
                                                onChange={(e) => handleJobStatusChange(e, d)}
                                                className={`text-[10px] font-bold py-1.5 px-3 rounded-lg border-0 outline-none cursor-pointer transition-colors hover:opacity-80 ${statusBadge}`}
                                            >
                                                <option value={DispatchStatus.PENDING}>PENDING</option>
                                                <option value={DispatchStatus.PRINTING}>PRINTING</option>
                                                <option value={DispatchStatus.SLITTING}>SLITTING</option>
                                                <option value={DispatchStatus.CUTTING}>CUTTING</option>
                                                <option value={DispatchStatus.COMPLETED}>COMPLETED</option>
                                                <option value={DispatchStatus.DISPATCHED}>DISPATCHED</option>
                                            </select>
                                       </div>
                                    </div>
                                 </div>
                               </div>
                           </div>

                           {/* EXPANDED DETAILS */}
                           {isExpanded && (
                             <div className="bg-slate-50/80 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                                <div className="px-4 py-2 bg-white border-b border-slate-100 flex justify-between items-center">
                                    <button onClick={(e) => toggleToday(e, d)} className={`text-[10px] font-bold px-2 py-1 rounded border transition-colors ${isToday ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                                        {isToday ? 'Unmark Today' : 'Mark for Today'}
                                    </button>
                                    <button onClick={() => openShareModal(d)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-sm">
                                        <span>Share Job Card</span>
                                    </button>
                                </div>
                                
                                <div className="p-3 sm:p-4">
                                  {/* Mobile Card Layout for Rows */}
                                  <div className="sm:hidden space-y-3">
                                    {d.rows.map(row => {
                                        let rowStatusColor = 'bg-white border-slate-200 text-slate-500';
                                        if(row.status === DispatchStatus.COMPLETED) rowStatusColor = 'bg-emerald-50 border-emerald-200 text-emerald-700';
                                        const isMm = row.size.toLowerCase().includes('mm');

                                        return (
                                            <div key={row.id} className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex-1">
                                                        <input 
                                                            value={row.size} 
                                                            onChange={(e) => handleRowUpdate(d, row.id, 'size', e.target.value)} 
                                                            className="w-full text-sm font-bold text-slate-800 outline-none bg-transparent border-b border-transparent focus:border-indigo-300 mb-1" 
                                                        />
                                                        <div className="flex gap-2">
                                                            <select 
                                                                value={row.sizeType || ''} 
                                                                onChange={(e) => handleRowUpdate(d, row.id, 'sizeType', e.target.value)} 
                                                                className="text-[10px] font-bold text-slate-500 bg-slate-50 rounded px-1 py-0.5 outline-none"
                                                            >
                                                                {SIZE_TYPES.map(t => <option key={t} value={t}>{t || '-'}</option>)}
                                                            </select>
                                                            <div className="flex items-center text-[10px] font-bold text-slate-400">
                                                                Mic: 
                                                                <input 
                                                                    type="number" 
                                                                    value={row.micron || ''} 
                                                                    onChange={(e) => handleRowUpdate(d, row.id, 'micron', parseFloat(e.target.value) || 0)} 
                                                                    className="w-8 ml-1 bg-transparent text-slate-600 outline-none border-b border-slate-200 focus:border-indigo-300 text-center"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => {
                                                        if(confirm("Delete this item row?")) {
                                                            const newRows = d.rows.filter(r => r.id !== row.id);
                                                            const newTotalWeight = newRows.reduce((acc, r) => acc + r.weight, 0);
                                                            const newTotalPcs = newRows.reduce((acc, r) => acc + r.pcs, 0);
                                                            const updatedDispatch = { ...d, rows: newRows, totalWeight: newTotalWeight, totalPcs: newTotalPcs, updatedAt: new Date().toISOString() };
                                                            saveDispatch(updatedDispatch);
                                                        }
                                                    }} className="text-slate-300 hover:text-red-500 p-1">🗑️</button>
                                                </div>

                                                <div className="grid grid-cols-3 gap-2 mb-2">
                                                    <div className="bg-slate-50 p-2 rounded">
                                                        <div className="text-[9px] text-slate-400 font-bold uppercase">Disp Wt</div>
                                                        <input type="number" value={row.weight === 0 ? '' : row.weight} onChange={(e) => handleRowUpdate(d, row.id, 'weight', parseFloat(e.target.value) || 0)} className="w-full bg-transparent font-bold text-slate-800 outline-none text-sm" placeholder="-" />
                                                    </div>
                                                    <div className="bg-slate-50 p-2 rounded border border-indigo-50">
                                                        <div className="text-[9px] text-indigo-400 font-bold uppercase">Prod Wt</div>
                                                        <input type="number" value={row.productionWeight === 0 ? '' : row.productionWeight} onChange={(e) => handleRowUpdate(d, row.id, 'productionWeight', parseFloat(e.target.value) || 0)} className="w-full bg-transparent font-bold text-indigo-600 outline-none text-sm" placeholder="-" />
                                                    </div>
                                                    <div className="bg-slate-50 p-2 rounded text-center">
                                                        <div className="text-[9px] text-slate-400 font-bold uppercase">{isMm?'Rolls':'Pcs'}</div>
                                                        <input type="number" value={row.pcs === 0 ? '' : row.pcs} onChange={(e) => handleRowUpdate(d, row.id, 'pcs', parseFloat(e.target.value) || 0)} className="w-full bg-transparent font-bold text-slate-800 outline-none text-center text-sm" placeholder="-" />
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 bg-slate-50 px-2 py-1 rounded flex items-center">
                                                        <span className="text-[9px] font-bold text-slate-400 mr-2">BDL:</span>
                                                        <input type="number" value={row.bundle === 0 ? '' : row.bundle} onChange={(e) => handleRowUpdate(d, row.id, 'bundle', parseFloat(e.target.value) || 0)} className="w-full bg-transparent font-bold text-slate-700 outline-none text-sm" />
                                                    </div>
                                                    <select 
                                                        value={row.status || DispatchStatus.PENDING} 
                                                        onChange={(e) => handleRowUpdate(d, row.id, 'status', e.target.value)} 
                                                        className={`flex-1 text-[10px] font-bold py-1.5 rounded outline-none border ${rowStatusColor}`}
                                                    >
                                                        <option value={DispatchStatus.PENDING}>PENDING</option>
                                                        <option value={DispatchStatus.PRINTING}>PRINTING</option>
                                                        <option value={DispatchStatus.SLITTING}>SLITTING</option>
                                                        <option value={DispatchStatus.CUTTING}>CUTTING</option>
                                                        <option value={DispatchStatus.COMPLETED}>COMPLETED</option>
                                                        <option value={DispatchStatus.DISPATCHED}>DISPATCHED</option>
                                                    </select>
                                                </div>
                                                {row.wastage > 0 && <div className="mt-1 text-[9px] font-bold text-red-400 text-right">Waste: {row.wastage.toFixed(3)}</div>}
                                            </div>
                                        );
                                    })}
                                  </div>

                                  {/* Desktop Table Layout */}
                                  <div className="hidden sm:block overflow-x-auto">
                                    <table className="w-full text-left text-sm whitespace-nowrap bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                                     <thead className="bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wide">
                                        <tr>
                                           <th className="px-3 py-2 min-w-[100px]">Size</th>
                                           <th className="px-3 py-2 w-20">Type</th>
                                           <th className="px-3 py-2 w-16 text-center">Mic</th>
                                           <th className="px-3 py-2 text-right w-20 text-slate-800">D.Wt</th>
                                           <th className="px-3 py-2 text-right w-20 text-indigo-600">P.Wt</th>
                                           <th className="px-3 py-2 text-right w-16 text-red-500">Wst</th>
                                           <th className="px-3 py-2 text-right w-16">Pcs</th>
                                           <th className="px-3 py-2 text-center w-16">Bdl</th>
                                           <th className="px-3 py-2 text-center w-28">Status</th>
                                           <th className="px-2 py-2 w-8"></th>
                                        </tr>
                                     </thead>
                                     <tbody className="divide-y divide-slate-100">
                                        {d.rows.map(row => {
                                            let rowStatusColor = 'bg-white border-slate-200 text-slate-500';
                                            if(row.status === DispatchStatus.COMPLETED) rowStatusColor = 'bg-emerald-50 border-emerald-200 text-emerald-700';
                                            
                                            const isMm = row.size.toLowerCase().includes('mm');

                                            return (
                                               <tr key={row.id} className="hover:bg-indigo-50/20 transition-colors">
                                                  <td className="px-3 py-1 font-bold text-slate-800">
                                                      <input value={row.size} onChange={(e) => handleRowUpdate(d, row.id, 'size', e.target.value)} className="w-full bg-transparent font-bold text-slate-800 outline-none border-b border-transparent focus:border-indigo-300 transition-colors py-1" />
                                                  </td>
                                                  <td className="px-3 py-1">
                                                      <select value={row.sizeType || ''} onChange={(e) => handleRowUpdate(d, row.id, 'sizeType', e.target.value)} className="w-full bg-transparent text-[10px] font-bold text-slate-600 outline-none focus:text-indigo-600 py-1">
                                                            {SIZE_TYPES.map(t => <option key={t} value={t}>{t || '-'}</option>)}
                                                        </select>
                                                  </td>
                                                  <td className="px-3 py-1">
                                                      <input type="number" value={row.micron || ''} placeholder="-" onChange={(e) => handleRowUpdate(d, row.id, 'micron', parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-xs font-bold text-center text-slate-600 outline-none border-b border-transparent focus:border-indigo-300 transition-colors py-1" />
                                                  </td>
                                                  <td className="px-3 py-1 text-right font-mono font-bold text-slate-800">
                                                    <input type="number" value={row.weight === 0 ? '' : row.weight} onChange={(e) => handleRowUpdate(d, row.id, 'weight', parseFloat(e.target.value) || 0)} className="w-full text-right bg-transparent font-mono font-bold text-slate-800 outline-none border-b border-transparent focus:border-indigo-300 transition-colors py-1" />
                                                  </td>
                                                  <td className="px-3 py-1 text-right font-mono font-bold text-indigo-600">
                                                     <input type="number" value={row.productionWeight === 0 ? '' : row.productionWeight} placeholder="-" onChange={(e) => handleRowUpdate(d, row.id, 'productionWeight', parseFloat(e.target.value) || 0)} className="w-full text-right bg-transparent font-mono font-bold text-indigo-600 outline-none border-b border-transparent focus:border-indigo-300 transition-colors py-1" />
                                                  </td>
                                                  <td className="px-3 py-1 text-right font-mono font-bold text-red-500 text-xs">{row.wastage ? row.wastage.toFixed(3) : '-'}</td>
                                                  <td className="px-3 py-1 text-right">
                                                      <div className="flex items-center justify-end gap-1">
                                                        <input 
                                                            type="number" 
                                                            value={row.pcs === 0 ? '' : row.pcs} 
                                                            onChange={(e) => handleRowUpdate(d, row.id, 'pcs', parseFloat(e.target.value) || 0)} 
                                                            className="w-12 text-right bg-transparent font-mono font-bold text-slate-800 outline-none border-b border-transparent focus:border-indigo-300 transition-colors py-1 text-xs" 
                                                        /> 
                                                        <span className="text-[9px] font-bold text-slate-400">{isMm?'R':'P'}</span>
                                                      </div>
                                                  </td>
                                                  <td className="px-3 py-1 text-center font-bold text-slate-700">
                                                     <input type="number" value={row.bundle === 0 ? '' : row.bundle} onChange={(e) => handleRowUpdate(d, row.id, 'bundle', parseFloat(e.target.value) || 0)} className="w-full text-center bg-transparent font-bold text-slate-700 outline-none border-b border-transparent focus:border-indigo-300 transition-colors py-1" />
                                                  </td>
                                                  <td className="px-3 py-1 text-center">
                                                     <select 
                                                        value={row.status || DispatchStatus.PENDING} 
                                                        onChange={(e) => handleRowUpdate(d, row.id, 'status', e.target.value)} 
                                                        className={`bg-transparent text-[9px] font-bold outline-none border-b border-transparent focus:border-indigo-500 py-1 cursor-pointer w-full text-center ${rowStatusColor}`}
                                                     >
                                                        <option value={DispatchStatus.PENDING}>PENDING</option>
                                                        <option value={DispatchStatus.PRINTING}>PRINTING</option>
                                                        <option value={DispatchStatus.SLITTING}>SLITTING</option>
                                                        <option value={DispatchStatus.CUTTING}>CUTTING</option>
                                                        <option value={DispatchStatus.COMPLETED}>COMPLETED</option>
                                                        <option value={DispatchStatus.DISPATCHED}>DISPATCHED</option>
                                                     </select>
                                                  </td>
                                                  <td className="px-2 py-1 text-center">
                                                      <button onClick={() => {
                                                          if(confirm("Delete this item row?")) {
                                                              const newRows = d.rows.filter(r => r.id !== row.id);
                                                              const newTotalWeight = newRows.reduce((acc, r) => acc + r.weight, 0);
                                                              const newTotalPcs = newRows.reduce((acc, r) => acc + r.pcs, 0);
                                                              const updatedDispatch = { ...d, rows: newRows, totalWeight: newTotalWeight, totalPcs: newTotalPcs, updatedAt: new Date().toISOString() };
                                                              saveDispatch(updatedDispatch);
                                                          }
                                                      }} className="text-slate-300 hover:text-red-500 transition-colors p-1" title="Delete Item">
                                                          🗑️
                                                      </button>
                                                  </td>
                                               </tr>
                                            );
                                        })}
                                     </tbody>
                                  </table>
                                  </div>
                                </div>
                                
                                <div className="flex justify-between items-center px-4 py-2 bg-slate-50 border-t border-slate-200">
                                    <button 
                                        onClick={() => {
                                            if(confirm("Delete this entire Job Card? This cannot be undone.")) {
                                                deleteDispatch(d.id);
                                            }
                                        }}
                                        className="text-xs font-bold text-red-400 hover:text-red-600 flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                                    >
                                        <span>🗑️ Delete Job</span>
                                    </button>
                                    
                                    <button onClick={() => handleEdit(d)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:bg-indigo-50 px-3 py-1.5 rounded transition-colors">
                                        <span>✏️ Edit Details</span>
                                    </button>
                                </div>
                             </div>
                           )}
                        </div>
                    );
                })}
            </div>
        </div>
    </div>
  );
};
