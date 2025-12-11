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

  // MULTI-SELECT PLANS
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);

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
      const allCompletedOrDispatched = updatedRows.every(r => 
          r.status === DispatchStatus.COMPLETED || r.status === DispatchStatus.DISPATCHED
      );
      const allDispatched = updatedRows.every(r => r.status === DispatchStatus.DISPATCHED);

      if (allDispatched) {
          newJobStatus = DispatchStatus.DISPATCHED;
      } else if (allCompletedOrDispatched) {
          newJobStatus = DispatchStatus.COMPLETED;
      }

      const totalWeight = updatedRows.reduce((s, r) => s + r.weight, 0);
      const totalPcs = updatedRows.reduce((s, r) => s + r.pcs, 0);
      
      const updatedDispatch = { 
          ...d, 
          rows: updatedRows, 
          totalWeight, 
          totalPcs,
          status: newJobStatus, 
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
      if (confirm(`Update all items in this job to ${newStatus}?`)) {
          updatedRows = d.rows.map(r => ({ ...r, status: newStatus }));
      }
      const updatedDispatch = { ...d, status: newStatus, rows: updatedRows, updatedAt: new Date().toISOString() };
      await saveDispatch(updatedDispatch);
  };

  // --- PLAN IMPORT LOGIC ---
  const importPlan = async (plan: ProductionPlan) => {
     if(activeDispatch.rows && activeDispatch.rows.length > 0) {
         if(!confirm("Current entry has items. Add Plan item to this list?")) return;
     }

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

  const togglePlanSelection = (id: string) => {
      setSelectedPlanIds(prev => 
          prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
      );
  };

  const handleMergeSelected = async () => {
      const selectedPlans = allPlans.filter(p => selectedPlanIds.includes(p.id));
      if (selectedPlans.length === 0) return;

      const uniqueParties: string[] = Array.from(new Set(selectedPlans.map(p => p.partyName)));
      if (uniqueParties.length > 1) {
          alert(`Cannot merge plans for different parties.\nSelected: ${uniqueParties.join(', ')}`);
          return;
      }
      const targetParty = uniqueParties[0];

      // Validate against current form state
      if (activeDispatch.rows && activeDispatch.rows.length > 0) {
          if (partyInput && partyInput.toLowerCase() !== targetParty.toLowerCase()) {
               if(!confirm(`Current job is for "${partyInput}", but selected plans are for "${targetParty}".\nDo you want to clear current items and switch to "${targetParty}"?`)) {
                   return;
               }
               // Clear rows if they agreed to switch
               setActiveDispatch(prev => ({ ...prev, rows: [] }));
          } else if (!partyInput) {
               // Form has rows but no name
          } else {
               // Party matches, confirm append
               if(!confirm(`Append ${selectedPlans.length} items to current list for ${targetParty}?`)) return;
          }
      }

      setPartyInput(targetParty);

      const newRows: DispatchRow[] = selectedPlans.map(plan => {
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

           return {
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
      });

      setActiveDispatch(prev => ({
          ...prev,
          rows: [...(prev.rows || []), ...newRows]
      }));

      // Mark as completed
      for (const plan of selectedPlans) {
          await saveProductionPlan({ ...plan, status: 'COMPLETED' });
      }
      
      setSelectedPlanIds([]);
      alert(`${selectedPlans.length} Plans Merged Successfully`);
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

  const filteredDispatches = useMemo(() => {
      return data.dispatches.filter(d => {
          const party = (data.parties.find(p => p.id === d.partyId)?.name || '').toLowerCase();
          return party.includes(searchJob.toLowerCase()) || d.dispatchNo.includes(searchJob);
      }).sort((a, b) => {
          if (a.isTodayDispatch && !b.isTodayDispatch) return -1;
          if (!a.isTodayDispatch && b.isTodayDispatch) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [data.dispatches, data.parties, searchJob]);

  const partySuggestions = data.parties.filter(p => 
    p.name.toLowerCase().includes(partyInput.toLowerCase())
  );

  // Show all plans, but sort PENDING first
  const allPlans = [...data.productionPlans].sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Helper for live wastage calc in form
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

        {/* --- PENDING PLANS SECTION (REDESIGNED CARD) --- */}
        {allPlans.length > 0 && !isEditingId && (
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm animate-in slide-in-from-top-4 duration-500">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">📋</span>
                        <h3 className="font-bold text-slate-800 text-lg">Active Production Queue</h3>
                    </div>
                    {selectedPlanIds.length > 0 && (
                        <button 
                            onClick={handleMergeSelected} 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 transform active:scale-95"
                        >
                            <span>⚡ Merge {selectedPlanIds.length} Jobs</span>
                        </button>
                    )}
                </div>
                
                <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x">
                    {allPlans.map(plan => {
                        const isSelected = selectedPlanIds.includes(plan.id);
                        const isTaken = plan.status === 'COMPLETED';
                        
                        // Dimensions Display
                        let dimensions = plan.size;
                        if(plan.cuttingSize && plan.cuttingSize > 0) dimensions += ` x ${plan.cuttingSize}`;
                        
                        return (
                            <div 
                                key={plan.id} 
                                className={`min-w-[320px] snap-center bg-white rounded-2xl border shadow-sm flex flex-col justify-between relative group hover:shadow-lg transition-all cursor-pointer ${isTaken ? 'opacity-75 bg-slate-50 border-slate-200' : isSelected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-indigo-300'}`}
                                onClick={() => !isTaken && togglePlanSelection(plan.id)}
                            >
                                {/* Selection Checkbox */}
                                {!isTaken && (
                                    <div className="absolute top-4 left-4 z-10">
                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shadow-sm ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                                            {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                                        </div>
                                    </div>
                                )}

                                {/* Remove Button */}
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeletePlan(plan.id); }}
                                    className="absolute top-3 right-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg p-1.5 transition-colors z-20"
                                    title="Remove Plan"
                                >
                                    ✕
                                </button>
                                
                                <div className="p-4 space-y-3">
                                    {/* Header: Date & Status */}
                                    <div className="flex justify-end items-center gap-2 pl-8">
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{plan.date.split('-').slice(1).join('/')}</span>
                                        {isTaken ? (
                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded uppercase tracking-wide">✓ Taken</span>
                                        ) : (
                                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wide">{plan.type}</span>
                                        )}
                                    </div>

                                    {/* Party Name */}
                                    <div>
                                        <h3 className={`text-base font-extrabold truncate leading-tight ${isTaken ? 'text-slate-500' : 'text-slate-800'}`} title={plan.partyName}>{plan.partyName}</h3>
                                        {plan.printName && (
                                            <div className="text-xs font-bold text-purple-600 mt-1 flex items-center gap-1">
                                                <span className="opacity-50">Print:</span> {plan.printName}
                                            </div>
                                        )}
                                    </div>

                                    {/* Detailed Grid */}
                                    <div className={`grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border ${isTaken ? 'border-slate-100' : 'border-slate-200'}`}>
                                        <div>
                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Size / Cut</span>
                                            <span className="font-bold text-slate-800 text-sm">{dimensions}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Micron</span>
                                            <span className="font-bold text-slate-800 text-sm">{plan.micron} µ</span>
                                        </div>
                                        
                                        <div className="pt-2 border-t border-slate-200 mt-1">
                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Weight / Meter</span>
                                            <div className="flex items-baseline gap-1">
                                                <span className="font-bold text-slate-900 text-sm">{plan.weight} <span className="text-[10px] font-normal text-slate-500">kg</span></span>
                                                <span className="text-[10px] text-slate-400">/</span>
                                                <span className="font-mono text-indigo-600 font-bold">{plan.meter}m</span>
                                            </div>
                                        </div>
                                        <div className="text-right pt-2 border-t border-slate-200 mt-1">
                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Target Pcs</span>
                                            <span className="font-bold text-emerald-600 text-sm">{plan.pcs}</span>
                                        </div>
                                    </div>

                                    {/* Notes Section (New) */}
                                    {plan.notes && (
                                        <div className="bg-amber-50 p-2 rounded-lg border border-amber-100 text-[10px] text-amber-800 font-medium leading-snug">
                                            <span className="font-bold opacity-70 block mb-0.5">Note:</span>
                                            {plan.notes}
                                        </div>
                                    )}
                                </div>

                                {/* Action Footer */}
                                <div className="p-4 pt-0">
                                    {isTaken ? (
                                        <div className="w-full bg-slate-100 text-slate-400 text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed border border-slate-200">
                                            <span>✓</span> Job Created
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); importPlan(plan); }}
                                            className="w-full bg-slate-900 hover:bg-black text-white text-xs font-bold py-3 rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
                                        >
                                            <span>⬇</span> Import Single
                                        </button>
                                    )}
                                </div>
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
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">Recent Jobs</h3>
                <input placeholder="Search Job..." value={searchJob} onChange={e => setSearchJob(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 outline-none w-48 focus:ring-2 focus:ring-indigo-100" />
            </div>

            <div className="space-y-3">
                {filteredDispatches.map(d => {
                    const party = data.parties.find(p => p.id === d.partyId)?.name || 'Unknown';
                    const isExpanded = expandedId === d.id;
                    const totalBundles = d.rows.reduce((acc, r) => acc + (Number(r.bundle) || 0), 0);
                    let statusColor = 'bg-slate-100 text-slate-600 border-l-slate-300';
                    
                    if(d.status === DispatchStatus.COMPLETED) { statusColor = 'bg-emerald-50 text-emerald-700 border-l-emerald-500'; }
                    else if(d.status === DispatchStatus.DISPATCHED) { statusColor = 'bg-purple-50 text-purple-700 border-l-purple-500'; }
                    else if(d.status === DispatchStatus.PRINTING) { statusColor = 'bg-indigo-50 text-indigo-700 border-l-indigo-500'; }
                    else if(d.status === DispatchStatus.SLITTING) { statusColor = 'bg-amber-50 text-amber-700 border-l-amber-500 animate-pulse'; }
                    else if(d.status === DispatchStatus.CUTTING) { statusColor = 'bg-blue-50 text-blue-700 border-l-blue-500 animate-pulse'; }
                    
                    const isToday = d.isTodayDispatch;

                    return (
                        <div key={d.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-all duration-300 ${isToday ? 'border-indigo-300 ring-2 ring-indigo-50' : 'border-slate-200'}`}>
                           <div onClick={() => setExpandedId(isExpanded ? null : d.id)} className={`relative p-5 cursor-pointer border-l-4 ${statusColor.split(' ').pop()} transition-colors`}>
                             <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-3 mb-1">
                                     <span className="text-[10px] font-bold text-slate-500 tracking-wider bg-slate-50 px-2 py-1 rounded-md border border-slate-100">{d.date}</span>
                                     <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">#{d.dispatchNo}</span>
                                     
                                     <select 
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => handleJobStatusChange(e, d)}
                                        value={d.status || DispatchStatus.PENDING}
                                        className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wide border-0 outline-none cursor-pointer ${statusColor.replace('border-l-4','').replace('border-l-','')}`}
                                     >
                                        <option value={DispatchStatus.PENDING}>PENDING</option>
                                        <option value={DispatchStatus.PRINTING}>PRINTING</option>
                                        <option value={DispatchStatus.SLITTING}>SLITTING</option>
                                        <option value={DispatchStatus.CUTTING}>CUTTING</option>
                                        <option value={DispatchStatus.COMPLETED}>COMPLETED</option>
                                        <option value={DispatchStatus.DISPATCHED}>DISPATCHED</option>
                                     </select>

                                     <button 
                                        onClick={(e) => toggleToday(e, d)}
                                        className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wide flex items-center gap-1 shadow-sm transition-all ${isToday ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                     >
                                        {isToday ? '★' : '☆'} Today
                                     </button>
                                  </div>
                                  <h4 className="text-lg font-bold text-slate-900 tracking-tight">{party}</h4>
                                </div>
                                <div className="flex items-center gap-3">
                                   <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
                                      <div className="text-center"><div className="text-[10px] font-bold text-slate-500">📦</div><div className="text-sm font-bold text-slate-800">{totalBundles}</div></div>
                                      <div className="w-px h-6 bg-slate-300"></div>
                                      <div className="text-center"><div className="text-[10px] font-bold text-slate-500">Weight</div><div className="text-sm font-bold text-slate-800">{d.totalWeight.toFixed(3)}</div></div>
                                   </div>
                                </div>
                             </div>
                           </div>
                           {isExpanded && (
                             <div className="bg-slate-50 border-t border-slate-200 animate-in slide-in-from-top-2 duration-300">
                                 <div className="px-6 py-4 border-b border-slate-200 bg-white flex justify-end">
                                    <button onClick={() => openShareModal(d)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-sm">Share Job</button>
                                 </div>
                                <div className="p-4 sm:p-6 overflow-x-auto">
                                  <table className="w-full text-left text-sm whitespace-nowrap bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                     <thead className="bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wide">
                                        <tr>
                                           <th className="px-4 py-3 min-w-[100px]">Size</th>
                                           <th className="px-4 py-3 w-20">Type</th>
                                           <th className="px-4 py-3 w-16">Micro</th>
                                           <th className="px-4 py-3 text-right w-24 text-slate-900">Disp Wt</th>
                                           <th className="px-4 py-3 text-right w-24 text-indigo-700">Prod Wt</th>
                                           <th className="px-4 py-3 text-right w-24 text-red-600">Wastage</th>
                                           <th className="px-4 py-3 text-right w-20">Pcs</th>
                                           <th className="px-4 py-3 text-center w-20">📦</th>
                                           <th className="px-4 py-3 text-center w-32">Status</th>
                                           <th className="px-2 py-3 w-10"></th>
                                        </tr>
                                     </thead>
                                     <tbody className="divide-y divide-slate-100">
                                        {d.rows.map(row => {
                                            let rowStatusText = row.status || 'PENDING';
                                            let rowStatusColor = 'bg-white border-slate-200 text-slate-600';
                                            if(row.status === DispatchStatus.COMPLETED) rowStatusColor = 'bg-emerald-50 border-emerald-200 text-emerald-700';
                                            
                                            const isMm = row.size.toLowerCase().includes('mm');

                                            return (
                                               <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                                  <td className="px-4 py-2 font-bold text-slate-900">
                                                      <input value={row.size} onChange={(e) => handleRowUpdate(d, row.id, 'size', e.target.value)} className="w-full bg-transparent font-bold text-slate-900 outline-none border-b border-transparent focus:border-indigo-500 transition-colors py-1" />
                                                  </td>
                                                  <td className="px-4 py-2">
                                                      <select value={row.sizeType || ''} onChange={(e) => handleRowUpdate(d, row.id, 'sizeType', e.target.value)} className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none border-b border-transparent focus:border-indigo-500 transition-colors py-1">
                                                            {SIZE_TYPES.map(t => <option key={t} value={t}>{t || '-'}</option>)}
                                                        </select>
                                                  </td>
                                                  <td className="px-4 py-2">
                                                      <input type="number" value={row.micron || ''} placeholder="-" onChange={(e) => handleRowUpdate(d, row.id, 'micron', parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-xs font-bold text-center text-slate-700 outline-none border-b border-transparent focus:border-indigo-500 transition-colors py-1" />
                                                  </td>
                                                  <td className="px-4 py-2 text-right font-mono font-bold text-slate-900">
                                                    <input type="number" value={row.weight === 0 ? '' : row.weight} onChange={(e) => handleRowUpdate(d, row.id, 'weight', parseFloat(e.target.value) || 0)} className="w-full text-right bg-transparent font-mono font-bold text-slate-900 outline-none border-b border-transparent focus:border-indigo-500 transition-colors py-1" />
                                                  </td>
                                                  <td className="px-4 py-2 text-right font-mono font-bold text-indigo-700">
                                                     <input type="number" value={row.productionWeight === 0 ? '' : row.productionWeight} placeholder="-" onChange={(e) => handleRowUpdate(d, row.id, 'productionWeight', parseFloat(e.target.value) || 0)} className="w-full text-right bg-transparent font-mono font-bold text-indigo-700 outline-none border-b border-transparent focus:border-indigo-300 transition-colors py-1" />
                                                  </td>
                                                  <td className="px-4 py-2 text-right font-mono font-bold text-red-600">{row.wastage ? row.wastage.toFixed(3) : '-'}</td>
                                                  <td className="px-4 py-2 text-right">
                                                      <div className="flex items-center justify-end gap-1">
                                                        <input 
                                                            type="number" 
                                                            value={row.pcs === 0 ? '' : row.pcs} 
                                                            onChange={(e) => handleRowUpdate(d, row.id, 'pcs', parseFloat(e.target.value) || 0)} 
                                                            className="w-16 text-right bg-transparent font-mono font-extrabold text-slate-900 outline-none border-b border-transparent focus:border-indigo-500 transition-colors py-1 text-sm" 
                                                        /> 
                                                        <span className="text-[10px] font-bold text-slate-500">{isMm?'R':'P'}</span>
                                                      </div>
                                                  </td>
                                                  <td className="px-4 py-2 text-center font-bold text-slate-800">
                                                     <input type="number" value={row.bundle === 0 ? '' : row.bundle} onChange={(e) => handleRowUpdate(d, row.id, 'bundle', parseFloat(e.target.value) || 0)} className="w-full text-center bg-transparent font-bold text-slate-800 outline-none border-b border-transparent focus:border-indigo-500 transition-colors py-1" />
                                                  </td>
                                                  <td className="px-4 py-2 text-center">
                                                     <select 
                                                        value={row.status || DispatchStatus.PENDING} 
                                                        onChange={(e) => handleRowUpdate(d, row.id, 'status', e.target.value)} 
                                                        className={`bg-transparent text-[10px] font-bold outline-none border-b border-transparent focus:border-indigo-500 py-1 cursor-pointer ${rowStatusColor}`}
                                                     >
                                                        <option value={DispatchStatus.PENDING}>PENDING</option>
                                                        <option value={DispatchStatus.PRINTING}>PRINTING</option>
                                                        <option value={DispatchStatus.SLITTING}>SLITTING</option>
                                                        <option value={DispatchStatus.CUTTING}>CUTTING</option>
                                                        <option value={DispatchStatus.COMPLETED}>COMPLETED</option>
                                                        <option value={DispatchStatus.DISPATCHED}>DISPATCHED</option>
                                                     </select>
                                                  </td>
                                                  <td className="px-2 py-2 text-center">
                                                      <button onClick={() => {
                                                          if(confirm("Delete this item row?")) {
                                                              const newRows = d.rows.filter(r => r.id !== row.id);
                                                              const newTotalWeight = newRows.reduce((acc, r) => acc + r.weight, 0);
                                                              const newTotalPcs = newRows.reduce((acc, r) => acc + r.pcs, 0);
                                                              const updatedDispatch = { ...d, rows: newRows, totalWeight: newTotalWeight, totalPcs: newTotalPcs, updatedAt: new Date().toISOString() };
                                                              saveDispatch(updatedDispatch);
                                                          }
                                                      }} className="text-slate-400 hover:text-red-600 transition-colors p-1" title="Delete Item">
                                                          🗑️
                                                      </button>
                                                  </td>
                                               </tr>
                                            );
                                        })}
                                     </tbody>
                                  </table>
                                </div>
                                
                                <div className="flex justify-between items-center px-6 py-3 bg-slate-50 border-t border-slate-200">
                                    <button 
                                        onClick={() => {
                                            if(confirm("Delete this entire Job Card? This cannot be undone.")) {
                                                deleteDispatch(d.id);
                                            }
                                        }}
                                        className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1 hover:bg-red-50 px-3 py-1.5 rounded transition-colors"
                                    >
                                        <span>🗑️ Delete Job</span>
                                    </button>
                                    
                                    <div className="flex gap-2">
                                         <button onClick={() => handleEdit(d)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:bg-indigo-50 px-3 py-1.5 rounded transition-colors">
                                            <span>✏️ Edit Details</span>
                                         </button>
                                    </div>
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