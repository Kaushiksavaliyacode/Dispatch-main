
import React, { useState } from 'react';
import { AppData, DispatchEntry, DispatchStatus, DispatchRow } from '../../types';
import { saveDispatch, deleteDispatch, ensurePartyExists } from '../../services/storageService';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

const SIZE_TYPES = ["", "INTAS", "OPEN", "ROUND", "ST.SEAL", "LABEL"];

export const DispatchManager: React.FC<Props> = ({ data, onUpdate }) => {
  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [partyName, setPartyName] = useState('');
  const [currentRows, setCurrentRows] = useState<DispatchRow[]>([]);
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [isToday, setIsToday] = useState(false);
  
  // Row Input State
  const [size, setSize] = useState('');
  const [sizeType, setSizeType] = useState('');
  const [micron, setMicron] = useState(''); // New State
  const [weight, setWeight] = useState('');
  const [pcs, setPcs] = useState('');
  const [bundle, setBundle] = useState('');
  
  // Editing State
  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  // Filter State
  const [filterDate, setFilterDate] = useState('');
  const [filterParty, setFilterParty] = useState('');

  // --- Helpers ---
  const formatWeight = (val: number) => val.toFixed(3);

  const shareJobImage = async (d: DispatchEntry) => {
    // 1. Create a temporary container for the clean "Print View"
    const containerId = 'temp-share-container';
    let container = document.getElementById(containerId);
    if (container) document.body.removeChild(container);
    
    container = document.createElement('div');
    container.id = containerId;
    container.style.position = 'fixed';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    container.style.width = '600px';
    container.style.backgroundColor = '#ffffff';
    container.style.padding = '0'; // Reset padding
    container.style.fontFamily = 'Inter, sans-serif';
    container.style.color = '#000';
    document.body.appendChild(container);

    const party = data.parties.find(p => p.id === d.partyId)?.name || 'Unknown';
    const totalBundles = d.rows.reduce((acc, r) => acc + (Number(r.bundle) || 0), 0);

    // 2. Build the HTML Content with Colored Header
    const rowsHtml = d.rows.map((r, index) => `
      <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 12px 15px; font-weight: bold; color: #334155;">${r.size} <span style="font-size:10px; color:#6366f1; background:#eef2ff; padding: 2px 4px; border-radius: 4px; text-transform: uppercase;">${r.sizeType || ''}</span></td>
        <td style="padding: 12px 15px; text-align: right; color: #475569;">${r.weight.toFixed(3)}</td>
        <td style="padding: 12px 15px; text-align: right; color: #475569;">${r.pcs}</td>
        <td style="padding: 12px 15px; text-align: right; color: #475569;">${r.bundle}</td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div style="overflow: hidden; border-radius: 0;">
        <!-- Header with Color -->
        <div style="background: linear-gradient(135deg, #4f46e5, #6366f1); padding: 25px; color: white;">
           <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                 <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8;">Dispatch Note</div>
                 <div style="font-size: 24px; font-weight: bold; margin-top: 5px;">${party}</div>
              </div>
              <div style="text-align: right;">
                 <div style="background: rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 8px; backdrop-filter: blur(5px);">
                    <div style="font-size: 11px; font-weight: bold;">${d.date}</div>
                 </div>
                 <div style="font-size: 11px; margin-top: 5px; opacity: 0.9;">Job #${d.dispatchNo}</div>
              </div>
           </div>
        </div>
        
        <!-- Table -->
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
            <tbody>
                ${rowsHtml}
            </tbody>
            <tfoot style="background: #f8fafc; font-weight: bold; border-top: 2px solid #e2e8f0;">
                <tr>
                <td style="padding: 15px; color: #334155;">TOTAL</td>
                <td style="padding: 15px; text-align: right; color: #334155;">${d.totalWeight.toFixed(3)}</td>
                <td style="padding: 15px; text-align: right; color: #334155;">${d.totalPcs}</td>
                <td style="padding: 15px; text-align: right; color: #334155;">${totalBundles}</td>
                </tr>
            </tfoot>
            </table>
        </div>

        <!-- Footer -->
        <div style="padding: 0 20px 20px 20px; text-align: center;">
             <div style="border-top: 1px dashed #cbd5e1; padding-top: 10px; font-size: 10px; color: #94a3b8;">
                Generated by RDMS Production System
             </div>
        </div>
      </div>
    `;

    // 3. Generate Image using html2canvas
    if ((window as any).html2canvas) {
      try {
        const canvas = await (window as any).html2canvas(container, { 
          backgroundColor: '#ffffff',
          scale: 2 // High resolution
        });
        
        canvas.toBlob(async (blob: Blob) => {
          if (blob) {
            const file = new File([blob], `Job_${d.dispatchNo}.png`, { type: 'image/png' });
            
            // Try native sharing (Mobile)
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
              try {
                await navigator.share({
                  files: [file],
                  title: `Job #${d.dispatchNo}`,
                  text: `Dispatch Details for ${party}`
                });
              } catch (err) {
                console.log("Share failed/cancelled", err);
              }
            } else {
              // Fallback to download (Desktop)
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = `Job_${d.dispatchNo}.png`;
              link.click();
              alert("Image downloaded! You can now send it via WhatsApp Web.");
            }
          }
          // Cleanup
          if (document.body.contains(container!)) {
            document.body.removeChild(container!);
          }
        });
      } catch (e) {
        console.error("Image generation failed", e);
        alert("Failed to generate image.");
        if (document.body.contains(container!)) {
            document.body.removeChild(container!);
        }
      }
    } else {
      alert("Image generator not ready. Please refresh.");
      if (document.body.contains(container!)) {
          document.body.removeChild(container!);
      }
    }
  };

  // --- Form Handlers ---
  const addRow = () => {
    if (!size) return;
    const newRow: DispatchRow = {
      id: `r-${Date.now()}-${Math.random()}`,
      size: size,
      sizeType: sizeType,
      micron: parseFloat(micron) || 0, // Store Micron
      weight: parseFloat(weight) || 0,
      pcs: parseFloat(pcs) || 0,
      bundle: parseFloat(bundle) || 0,
      status: DispatchStatus.PENDING,
      isCompleted: false,
      isLoaded: false,
      productionWeight: 0,
      wastage: 0
    };
    setCurrentRows([...currentRows, newRow]);
    setWeight('');
    setPcs('');
    setBundle('');
    // setMicron(''); // Keep micron? Maybe useful for repeated entry.
  };

  const removeRow = (index: number) => {
    const updated = [...currentRows];
    updated.splice(index, 1);
    setCurrentRows(updated);
  };

  const resetForm = () => {
    setPartyName('');
    setCurrentRows([]);
    setSize('');
    setSizeType('');
    setMicron('');
    setWeight('');
    setPcs('');
    setBundle('');
    setIsEditingId(null);
    setIsToday(false);
  };

  const handleSave = async () => {
    if (!partyName) return alert("Party Name is required");
    if (currentRows.length === 0) return alert("Please add at least one item row");

    const partyId = await ensurePartyExists(data.parties, partyName);

    const totalWeight = currentRows.reduce((acc, r) => acc + r.weight, 0);
    const totalPcs = currentRows.reduce((acc, r) => acc + r.pcs, 0);
    
    // Auto-complete logic
    const allDispatched = currentRows.every(r => r.status === DispatchStatus.DISPATCHED);
    let jobStatus = DispatchStatus.PENDING; 
    if (allDispatched) jobStatus = DispatchStatus.COMPLETED; 

    const entry: DispatchEntry = {
      id: isEditingId || `d-${Date.now()}`,
      dispatchNo: isEditingId ? (data.dispatches.find(d => d.id === isEditingId)?.dispatchNo || '') : `JOB-${Math.floor(1000 + Math.random() * 9000)}`,
      date: date,
      partyId,
      status: jobStatus,
      rows: currentRows,
      totalWeight,
      totalPcs,
      isTodayDispatch: isToday,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await saveDispatch(entry);
    resetForm();
  };

  const handleJobDateUpdate = async (d: DispatchEntry, newDate: string) => {
    const updatedEntry = { ...d, date: newDate, updatedAt: new Date().toISOString() };
    await saveDispatch(updatedEntry);
  };

  const handleToggleToday = async (d: DispatchEntry, e: React.MouseEvent) => {
    e.stopPropagation(); 
    const updatedEntry = { ...d, isTodayDispatch: !d.isTodayDispatch, updatedAt: new Date().toISOString() };
    await saveDispatch(updatedEntry);
  };

  const handleAddRowToExistingJob = async (d: DispatchEntry) => {
      const newRow: DispatchRow = {
          id: `r-${Date.now()}-${Math.random()}`,
          size: '',
          sizeType: '',
          micron: 0,
          weight: 0,
          pcs: 0,
          bundle: 0,
          status: DispatchStatus.PENDING,
          isCompleted: false,
          isLoaded: false,
          productionWeight: 0,
          wastage: 0
      };
      const updatedRows = [...d.rows, newRow];
      const updatedEntry = { ...d, rows: updatedRows, updatedAt: new Date().toISOString() };
      await saveDispatch(updatedEntry);
  };

  const handleDeleteRow = async (d: DispatchEntry, rowId: string) => {
    if (d.rows.length <= 1) {
        if(confirm("Deleting the last item will delete the entire job entry. Continue?")) {
            await deleteDispatch(d.id);
        }
        return;
    }
    if (!confirm("Are you sure you want to delete this item?")) return;
    const updatedRows = d.rows.filter(r => r.id !== rowId);
    const totalWeight = updatedRows.reduce((acc, r) => acc + Number(r.weight), 0);
    const totalPcs = updatedRows.reduce((acc, r) => acc + Number(r.pcs), 0);
    const allDispatched = updatedRows.every(r => r.status === DispatchStatus.DISPATCHED);
    let newStatus = d.status;
    if (allDispatched) newStatus = DispatchStatus.COMPLETED;
    else if (updatedRows.every(r => r.status === DispatchStatus.PENDING) && !d.isTodayDispatch) newStatus = DispatchStatus.PENDING;

    const updatedEntry = {
        ...d,
        rows: updatedRows,
        totalWeight,
        totalPcs,
        status: newStatus,
        updatedAt: new Date().toISOString()
    };
    await saveDispatch(updatedEntry);
  };

  const handleRowUpdate = async (d: DispatchEntry, rowId: string, field: keyof DispatchRow, value: string | number) => {
    const updatedRows = d.rows.map(r => {
      if (r.id === rowId) {
        const updatedRow = { ...r, [field]: value };
        if (field === 'weight' || field === 'productionWeight') {
             const dispatchWt = field === 'weight' ? Number(value) : (r.weight || 0);
             const prodWt = field === 'productionWeight' ? Number(value) : (r.productionWeight || 0);
             updatedRow.wastage = prodWt > 0 ? (prodWt - dispatchWt) : 0;
        }
        return updatedRow;
      }
      return r;
    });
    const totalWeight = updatedRows.reduce((acc, r) => acc + Number(r.weight), 0);
    const totalPcs = updatedRows.reduce((acc, r) => acc + Number(r.pcs), 0);
    const updatedEntry = { ...d, rows: updatedRows, totalWeight, totalPcs, updatedAt: new Date().toISOString() };
    await saveDispatch(updatedEntry);
  };

  const toggleRowStatus = async (d: DispatchEntry, rowId: string) => {
    const updatedRows = d.rows.map(row => {
      if (row.id !== rowId) return row;
      let newStatus = row.status || DispatchStatus.PENDING;
      if (newStatus === DispatchStatus.PENDING) newStatus = DispatchStatus.PRINTING;
      else if (newStatus === DispatchStatus.PRINTING) newStatus = DispatchStatus.SLITTING;
      else if (newStatus === DispatchStatus.SLITTING) newStatus = DispatchStatus.CUTTING;
      else if (newStatus === DispatchStatus.CUTTING) newStatus = DispatchStatus.COMPLETED;
      else if (newStatus === DispatchStatus.COMPLETED) newStatus = DispatchStatus.DISPATCHED;
      else if (newStatus === DispatchStatus.DISPATCHED) newStatus = DispatchStatus.PENDING;
      else newStatus = DispatchStatus.PENDING; 
      
      return { ...row, status: newStatus };
    });

    const allPending = updatedRows.every(r => r.status === DispatchStatus.PENDING);
    const allDispatched = updatedRows.every(r => r.status === DispatchStatus.DISPATCHED);
    const anyCutting = updatedRows.some(r => r.status === DispatchStatus.CUTTING);
    const anySlitting = updatedRows.some(r => r.status === DispatchStatus.SLITTING);
    
    let newJobStatus = d.status;
    if (allPending) newJobStatus = DispatchStatus.PENDING;
    else if (allDispatched) newJobStatus = DispatchStatus.COMPLETED;
    else if (anyCutting) newJobStatus = DispatchStatus.CUTTING;
    else if (anySlitting) newJobStatus = DispatchStatus.SLITTING;
    else if (updatedRows.some(r => r.status === DispatchStatus.PRINTING)) newJobStatus = DispatchStatus.PRINTING;
    else if (updatedRows.every(r => r.status === DispatchStatus.COMPLETED)) newJobStatus = DispatchStatus.COMPLETED;

    const updatedEntry = { ...d, rows: updatedRows, status: newJobStatus };
    await saveDispatch(updatedEntry);
  };

  const filteredDispatches = data.dispatches.filter(d => {
    const party = data.parties.find(p => p.id === d.partyId)?.name.toLowerCase() || '';
    const dateMatch = filterDate ? d.date === filterDate : true;
    const partyMatch = filterParty ? party.includes(filterParty.toLowerCase()) : true;
    return dateMatch && partyMatch;
  }).sort((a, b) => {
      if (a.isTodayDispatch && !b.isTodayDispatch) return -1;
      if (!a.isTodayDispatch && b.isTodayDispatch) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const partySuggestions = data.parties.filter(p => 
    p.name.toLowerCase().includes(partyName.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* JOB ENTRY FORM */}
      <div className="glass-card rounded-3xl overflow-hidden ring-1 ring-slate-100">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-8 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl bg-white/20 p-2 rounded-xl backdrop-blur-sm">🚛</span>
              <h2 className="text-base font-bold text-white tracking-wide">
                {isEditingId ? 'Edit Job' : 'New Job Entry'}
              </h2>
            </div>
            <button 
              onClick={() => setIsToday(!isToday)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${isToday ? 'bg-white text-indigo-600 shadow-md' : 'bg-indigo-700/50 text-indigo-100 hover:bg-indigo-700'}`}
            >
              <span>{isToday ? '★' : '☆'}</span>
              <span>Today's Dispatch</span>
            </button>
        </div>

        <div className="p-6 md:p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
               <div className="md:col-span-8 space-y-2 relative">
                  <label className="text-xs font-bold text-slate-600 ml-1">Party Name</label>
                  <input 
                    type="text" 
                    value={partyName} 
                    onChange={e => {
                      setPartyName(e.target.value);
                      setShowPartyDropdown(true);
                    }}
                    onFocus={() => setShowPartyDropdown(true)}
                    onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)}
                    className="w-full bg-slate-50 border-0 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all shadow-inner placeholder-slate-400"
                    placeholder="Search or Select Party"
                  />
                  {showPartyDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                      {partySuggestions.map(p => (
                          <div 
                            key={p.id}
                            className="px-5 py-3 hover:bg-indigo-50 cursor-pointer text-sm font-bold text-slate-700 transition-colors border-b border-slate-50 last:border-0"
                            onClick={() => {
                              setPartyName(p.name);
                              setShowPartyDropdown(false);
                            }}
                          >
                            {p.name}
                          </div>
                      ))}
                    </div>
                  )}
               </div>
               <div className="md:col-span-4 space-y-2">
                  <label className="text-xs font-bold text-slate-600 ml-1">Date</label>
                  <input 
                    type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="w-full bg-slate-50 border-0 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all shadow-inner"
                  />
               </div>
            </div>

            <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-100/50">
              <div className="grid grid-cols-12 gap-4 items-end">
                 <div className="col-span-6 md:col-span-3 space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 ml-1">Size</label>
                   <input placeholder="Enter Size" value={size} onChange={e => setSize(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 transition-colors" />
                 </div>
                 <div className="col-span-3 md:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 ml-1">Type</label>
                    <select 
                       value={sizeType} 
                       onChange={e => setSizeType(e.target.value)} 
                       className="w-full bg-white border border-slate-200 rounded-xl px-2 py-3 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 transition-colors"
                    >
                       {SIZE_TYPES.map(t => (
                           <option key={t} value={t}>{t || 'Select...'}</option>
                       ))}
                    </select>
                 </div>
                 <div className="col-span-3 md:col-span-1 space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 ml-1">Micron</label>
                    <input type="number" placeholder="50" value={micron} onChange={e => setMicron(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-2 py-3 text-xs font-bold text-slate-900 text-center outline-none focus:border-indigo-500 transition-colors" />
                 </div>
                 <div className="col-span-4 md:col-span-2 space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 ml-1">Weight</label>
                   <input type="number" placeholder="0.000" value={weight} onChange={e => setWeight(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 text-center outline-none focus:border-indigo-500 transition-colors" />
                 </div>
                 <div className="col-span-4 md:col-span-2 space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 ml-1">Pcs/Rolls</label>
                   <input type="number" placeholder="0" value={pcs} onChange={e => setPcs(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 text-center outline-none focus:border-indigo-500 transition-colors" />
                 </div>
                 <div className="col-span-4 md:col-span-1 space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 ml-1">📦</label>
                   <input type="number" placeholder="0" value={bundle} onChange={e => setBundle(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 text-center outline-none focus:border-indigo-500 transition-colors" />
                 </div>
                 <div className="col-span-12 md:col-span-1">
                   <button onClick={addRow} className="w-full bg-slate-800 hover:bg-slate-900 text-white rounded-xl py-3.5 text-xs font-bold tracking-wider shadow-lg shadow-slate-200 flex justify-center items-center">
                     Add
                   </button>
                 </div>
              </div>
            </div>

            {currentRows.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {currentRows.map((r, idx) => (
                    <div key={idx} className="relative group bg-white p-4 rounded-xl border border-indigo-50 shadow-sm">
                      <div className="flex justify-between items-start">
                         <div>
                            <div className="text-sm font-bold text-slate-800 tracking-tight">
                                {r.size} 
                                {r.sizeType && <span className="ml-2 text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-wider">{r.sizeType}</span>}
                            </div>
                            <div className="text-xs text-indigo-500 font-semibold mt-1">{formatWeight(r.weight)} kg</div>
                         </div>
                         <div className="text-right">
                            <div className="text-xs font-bold text-slate-500">📦 {r.bundle}</div>
                            <div className="text-[10px] font-bold text-slate-400">{r.pcs} {r.size.toLowerCase().includes('mm')?'R':'P'}</div>
                         </div>
                      </div>
                      <button onClick={() => removeRow(idx)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-50 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-red-100 hover:bg-red-500 hover:text-white">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
            )}

            <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-200 text-sm tracking-wider transition-all transform active:scale-[0.99] flex justify-center items-center gap-2">
              <span>{isEditingId ? 'Update Job' : 'Save Job Entry'}</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between pt-4">
         <h3 className="text-xl font-bold text-slate-700 tracking-tight pl-2 border-l-4 border-indigo-500">Active Jobs</h3>
         <div className="flex gap-2 w-full md:w-auto">
             <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="bg-white border-0 shadow-sm rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 outline-none ring-1 ring-slate-100 focus:ring-indigo-200" />
             <input type="text" placeholder="Filter Party..." value={filterParty} onChange={e => setFilterParty(e.target.value)} className="flex-1 md:w-64 bg-white border-0 shadow-sm rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none ring-1 ring-slate-100 focus:ring-indigo-200" />
         </div>
      </div>

      <div className="space-y-4">
        {filteredDispatches.map(d => {
            const party = data.parties.find(p => p.id === d.partyId);
            const isExpanded = expandedJobId === d.id;
            const totalBundles = d.rows.reduce((acc, r) => acc + (Number(r.bundle) || 0), 0);
            
            let statusColor = 'bg-slate-100 text-slate-500 border-l-slate-300';
            let statusText = d.status || 'PENDING';
            let cardAnimation = '';

            if(d.status === DispatchStatus.COMPLETED) { statusColor = 'bg-emerald-50 text-emerald-600 border-l-emerald-500'; }
            else if(d.status === DispatchStatus.DISPATCHED) { statusColor = 'bg-purple-50 text-purple-600 border-l-purple-500'; }
            else if(d.status === DispatchStatus.PRINTING) { statusColor = 'bg-indigo-50 text-indigo-600 border-l-indigo-500'; }
            else if(d.status === DispatchStatus.SLITTING) { 
                statusColor = 'bg-amber-50 text-amber-600 border-l-amber-500';
                cardAnimation = 'ring-2 ring-amber-100 animate-pulse'; 
            }
            else if(d.status === DispatchStatus.CUTTING) { 
                statusColor = 'bg-blue-50 text-blue-600 border-l-blue-500';
                cardAnimation = 'ring-2 ring-blue-100 animate-pulse'; 
            }
            const isToday = d.isTodayDispatch;

            return (
              <div key={d.id} id={`job-card-${d.id}`} className={`bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-all duration-300 group ${isToday ? 'border-indigo-300 ring-2 ring-indigo-50' : 'border-slate-100'} ${cardAnimation}`}>
                 <div onClick={() => setExpandedJobId(isExpanded ? null : d.id)} className={`relative p-5 cursor-pointer border-l-4 ${statusColor.split(' ').pop()} transition-colors`}>
                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                           <span className="text-[10px] font-bold text-slate-400 tracking-wider bg-slate-50 px-2 py-1 rounded-md border border-slate-100">{d.date}</span>
                           <span className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wide ${statusColor.replace('border-l-4','').replace('border-l-','')} bg-opacity-50`}>{statusText}</span>
                           {isToday && <span className="bg-indigo-600 text-white px-2 py-1 rounded-md text-[10px] font-bold tracking-wide flex items-center gap-1 shadow-sm animate-pulse">📅 TODAY</span>}
                        </div>
                        <h4 className="text-lg font-bold text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors">{party?.name}</h4>
                      </div>
                      <div className="flex items-center gap-3">
                         <button 
                            onClick={(e) => handleToggleToday(d, e)}
                            className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 ${isToday ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                         >
                            <span>{isToday ? '★' : '☆'}</span>
                         </button>
                         <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                            <div className="text-center">
                                <div className="text-[10px] font-bold text-slate-400">📦</div>
                                <div className="text-sm font-bold text-slate-700">{totalBundles}</div>
                            </div>
                            <div className="w-px h-6 bg-slate-200"></div>
                            <div className="text-center">
                                <div className="text-[10px] font-bold text-slate-400">Weight</div>
                                <div className="text-sm font-bold text-slate-700">{formatWeight(d.totalWeight)}</div>
                            </div>
                         </div>
                      </div>
                   </div>
                 </div>

                 {isExpanded && (
                   <div className="bg-slate-50 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                      <div className="px-6 py-4 border-b border-slate-200 bg-white flex flex-col md:flex-row justify-between items-center gap-3">
                         <div className="flex items-center gap-2">
                           <span className="text-lg">🛠️</span>
                           <h4 className="text-sm font-bold text-slate-700">Edit Job Details</h4>
                         </div>
                         <div className="flex items-center gap-3">
                            <button onClick={() => shareJobImage(d)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-sm">
                               Share Job
                            </button>
                            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-2 py-1">
                                <label className="text-[10px] font-bold text-slate-500">Date:</label>
                                <input type="date" value={d.date} onChange={(e) => handleJobDateUpdate(d, e.target.value)} className="bg-transparent text-xs font-bold text-slate-800 outline-none w-24" />
                            </div>
                         </div>
                      </div>

                      <div className="p-4 sm:p-6 overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                           <thead className="bg-slate-100/50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wide">
                              <tr>
                                 <th className="px-4 py-3 min-w-[100px]">Size</th>
                                 <th className="px-4 py-3 w-20">Type</th>
                                 <th className="px-4 py-3 w-16">Micro</th>
                                 <th className="px-4 py-3 text-right w-24">Disp Wt</th>
                                 <th className="px-4 py-3 text-right w-24 text-indigo-600">Prod Wt</th>
                                 <th className="px-4 py-3 text-right w-24 text-red-500">Wastage</th>
                                 <th className="px-4 py-3 text-right w-20">Pcs</th>
                                 <th className="px-4 py-3 text-center w-20">📦</th>
                                 <th className="px-4 py-3 text-center w-32">Status</th>
                                 <th className="px-4 py-3 text-center w-10">❌</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {d.rows.map(row => {
                                  let rowStatusText = row.status || 'PENDING';
                                  let rowStatusColor = 'bg-white border-slate-200 text-slate-500';
                                  if(row.status === DispatchStatus.COMPLETED) rowStatusColor = 'bg-emerald-50 border-emerald-200 text-emerald-600';
                                  else if(row.status === DispatchStatus.DISPATCHED) rowStatusColor = 'bg-purple-50 border-purple-200 text-purple-600';
                                  else if(row.status === DispatchStatus.PRINTING) rowStatusColor = 'bg-indigo-50 border-indigo-200 text-indigo-600';
                                  else if(row.status === DispatchStatus.SLITTING) rowStatusColor = 'bg-amber-50 border-amber-200 text-amber-600 animate-pulse';
                                  else if(row.status === DispatchStatus.CUTTING) rowStatusColor = 'bg-blue-50 border-blue-200 text-blue-600 animate-pulse';

                                  const isMm = row.size.toLowerCase().includes('mm');

                                  return (
                                     <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-2"><input value={row.size} onChange={(e) => handleRowUpdate(d, row.id, 'size', e.target.value)} className="w-full bg-transparent font-bold text-slate-900 outline-none border-b border-transparent focus:border-indigo-500" /></td>
                                        <td className="px-4 py-2">
                                            <select value={row.sizeType || ''} onChange={(e) => handleRowUpdate(d, row.id, 'sizeType', e.target.value)} className="w-full bg-transparent text-xs font-bold text-slate-800 outline-none">
                                                {SIZE_TYPES.map(t => <option key={t} value={t}>{t || '-'}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-4 py-2">
                                            <input type="number" value={row.micron || ''} placeholder="-" onChange={(e) => handleRowUpdate(d, row.id, 'micron', parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-xs text-center font-bold text-slate-800 outline-none border-b border-transparent focus:border-indigo-500" />
                                        </td>
                                        <td className="px-4 py-2 text-right"><input type="number" value={row.weight===0?'':row.weight} onChange={(e) => handleRowUpdate(d, row.id, 'weight', parseFloat(e.target.value) || 0)} className="w-full text-right bg-transparent font-mono font-bold text-slate-900 outline-none" /></td>
                                        <td className="px-4 py-2 text-right bg-indigo-50/20"><input type="number" value={row.productionWeight===0?'':row.productionWeight} placeholder="-" onChange={(e) => handleRowUpdate(d, row.id, 'productionWeight', parseFloat(e.target.value) || 0)} className="w-full text-right bg-transparent font-mono font-bold text-indigo-900 outline-none" /></td>
                                        <td className="px-4 py-2 text-right"><div className={`font-mono font-bold text-xs ${Number(row.wastage) > 0 ? 'text-red-600' : 'text-slate-400'}`}>{row.wastage ? row.wastage.toFixed(3) : '-'}</div></td>
                                        <td className="px-4 py-2 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <input 
                                                    type="number" 
                                                    value={row.pcs === 0 ? '' : row.pcs} 
                                                    onChange={(e) => handleRowUpdate(d, row.id, 'pcs', parseFloat(e.target.value) || 0)} 
                                                    className="w-20 text-right bg-transparent font-mono font-extrabold text-slate-900 outline-none border-b border-transparent focus:border-indigo-500 transition-colors py-1 text-sm" 
                                                /> 
                                                <span className="text-[10px] font-bold text-slate-500">{isMm?'R':'P'}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-center"><input type="number" value={row.bundle===0?'':row.bundle} onChange={(e) => handleRowUpdate(d, row.id, 'bundle', parseFloat(e.target.value) || 0)} className="w-full text-center bg-transparent font-bold text-slate-900 outline-none" /></td>
                                        <td className="px-4 py-2 text-center"><button onClick={() => toggleRowStatus(d, row.id)} className={`px-3 py-1 rounded-md border text-[10px] font-bold tracking-wide w-full ${rowStatusColor}`}>{rowStatusText}</button></td>
                                        <td className="px-4 py-2 text-center"><button onClick={() => handleDeleteRow(d, row.id)} className="text-slate-400 hover:text-red-500 p-1">❌</button></td>
                                     </tr>
                                  );
                              })}
                           </tbody>
                        </table>
                      </div>
                      <div className="px-6 pb-2"><button onClick={() => handleAddRowToExistingJob(d)} className="w-full py-3 bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold text-xs hover:bg-white hover:text-indigo-600">+ Add Item Line</button></div>
                      <div className="px-6 pb-6 pt-2 flex justify-end"><button onClick={() => { if(confirm('Delete Job?')) deleteDispatch(d.id); }} className="text-xs font-bold text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl">Delete Entry</button></div>
                   </div>
                 )}
              </div>
            );
        })}
      </div>
    </div>
  );
};
