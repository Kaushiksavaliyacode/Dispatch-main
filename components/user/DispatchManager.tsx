import React, { useState, useMemo, useEffect } from 'react';
import { AppData, DispatchEntry, DispatchStatus, DispatchRow } from '../../types';
import { saveDispatch, deleteDispatch, ensurePartyExists } from '../../services/storageService';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

const SIZE_TYPES = ["", "INTAS", "OPEN", "ROUND", "ST.SEAL", "LABEL", "ROLL"];

export const DispatchManager: React.FC<Props> = ({ data, onUpdate }) => {
  // State for Form
  const [activeDispatch, setActiveDispatch] = useState<Partial<DispatchEntry>>({
    date: new Date().toISOString().split('T')[0],
    dispatchNo: '',
    rows: [],
    status: DispatchStatus.PENDING
  });
  const [partyInput, setPartyInput] = useState('');
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);

  // Row Input State
  const [rowSize, setRowSize] = useState('');
  const [rowType, setRowType] = useState('');
  const [rowMicron, setRowMicron] = useState('');
  const [rowWeight, setRowWeight] = useState('');
  const [rowPcs, setRowPcs] = useState('');
  const [rowBundle, setRowBundle] = useState('');

  // List View State
  const [searchJob, setSearchJob] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);

  // Auto-generate Dispatch No
  useEffect(() => {
    if (!isEditingId && !activeDispatch.dispatchNo) {
        const maxNo = data.dispatches.reduce((max, d) => {
            const num = parseInt(d.dispatchNo);
            return !isNaN(num) && num > max ? num : max;
        }, 0);
        const nextNo = maxNo === 0 ? '1001' : (maxNo + 1).toString();
        setActiveDispatch(prev => ({ ...prev, dispatchNo: nextNo }));
    }
  }, [data.dispatches, isEditingId]);

  const partySuggestions = data.parties.filter(p => {
    const search = partyInput.toLowerCase();
    return p.name.toLowerCase().includes(search) || (p.code && p.code.toLowerCase().includes(search));
  });

  const filteredDispatches = useMemo(() => {
      const search = searchJob.toLowerCase();
      return data.dispatches.filter(d => {
          const p = data.parties.find(p => p.id === d.partyId);
          const pName = p ? p.name.toLowerCase() : '';
          return d.dispatchNo.includes(search) || pName.includes(search) || d.rows.some(r => r.size.toLowerCase().includes(search));
      }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data.dispatches, data.parties, searchJob]);

  // Form Handlers
  const addRow = () => {
      if (!rowSize || !rowWeight) return alert("Size and Weight required");
      
      const newRow: DispatchRow = {
          id: `r-${Date.now()}-${Math.random()}`,
          size: rowSize,
          sizeType: rowType,
          micron: parseFloat(rowMicron) || 0,
          weight: parseFloat(rowWeight) || 0,
          pcs: parseFloat(rowPcs) || 0,
          bundle: parseFloat(rowBundle) || 0,
          status: DispatchStatus.PENDING,
          isCompleted: false,
          isLoaded: false
      };

      setActiveDispatch(prev => ({
          ...prev,
          rows: [...(prev.rows || []), newRow]
      }));

      // Reset inputs
      setRowSize(''); setRowType(''); setRowMicron(''); setRowWeight(''); setRowPcs(''); setRowBundle('');
  };

  const removeRow = (index: number) => {
      setActiveDispatch(prev => {
          const newRows = [...(prev.rows || [])];
          newRows.splice(index, 1);
          return { ...prev, rows: newRows };
      });
  };

  const resetForm = () => {
      setPartyInput('');
      setActiveDispatch({
          date: new Date().toISOString().split('T')[0],
          dispatchNo: '',
          rows: [],
          status: DispatchStatus.PENDING
      });
      setIsEditingId(null);
  };

  const handleSave = async () => {
      if (!partyInput) return alert("Party Name Required");
      if (!activeDispatch.rows || activeDispatch.rows.length === 0) return alert("Add at least one item");

      const partyId = await ensurePartyExists(data.parties, partyInput);
      const totalWeight = activeDispatch.rows.reduce((sum, r) => sum + r.weight, 0);
      const totalPcs = activeDispatch.rows.reduce((sum, r) => sum + r.pcs, 0);

      const dispatch: DispatchEntry = {
          id: activeDispatch.id || `d-${Date.now()}`,
          dispatchNo: activeDispatch.dispatchNo || 'AUTO',
          date: activeDispatch.date!,
          partyId,
          status: activeDispatch.status || DispatchStatus.PENDING,
          rows: activeDispatch.rows,
          totalWeight,
          totalPcs,
          isTodayDispatch: activeDispatch.isTodayDispatch || false,
          createdAt: activeDispatch.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
      };

      await saveDispatch(dispatch);
      resetForm();
  };

  // Actions
  const handleEdit = (d: DispatchEntry) => {
      const p = data.parties.find(p => p.id === d.partyId);
      setPartyInput(p ? p.name : '');
      setActiveDispatch({ ...d });
      setIsEditingId(d.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRepeatOrder = (d: DispatchEntry) => {
      const p = data.parties.find(p => p.id === d.partyId);
      setPartyInput(p ? p.name : '');
      // Clone rows with new IDs
      const clonedRows = d.rows.map(r => ({ ...r, id: `r-${Date.now()}-${Math.random()}`, status: DispatchStatus.PENDING }));
      setActiveDispatch({
          date: new Date().toISOString().split('T')[0],
          dispatchNo: '', // Will auto-gen
          rows: clonedRows,
          status: DispatchStatus.PENDING,
          isTodayDispatch: true
      });
      setIsEditingId(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMergeJobs = async () => {
      if (selectedJobIds.length < 2) return;
      if (!confirm(`Merge ${selectedJobIds.length} jobs into one? Original jobs will be deleted.`)) return;

      const jobsToMerge = data.dispatches.filter(d => selectedJobIds.includes(d.id));
      if (jobsToMerge.length === 0) return;

      // Use the party of the first job
      const primaryJob = jobsToMerge[0];
      const mergedRows = jobsToMerge.flatMap(j => j.rows);
      
      const totalWeight = mergedRows.reduce((s, r) => s + r.weight, 0);
      const totalPcs = mergedRows.reduce((s, r) => s + r.pcs, 0);

      const mergedDispatch: DispatchEntry = {
          id: `d-${Date.now()}`,
          dispatchNo: primaryJob.dispatchNo, // Keep one number or gen new
          date: primaryJob.date,
          partyId: primaryJob.partyId,
          status: DispatchStatus.PENDING,
          rows: mergedRows,
          totalWeight,
          totalPcs,
          isTodayDispatch: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
      };

      await saveDispatch(mergedDispatch);
      
      // Delete old ones
      for (const id of selectedJobIds) {
          await deleteDispatch(id);
      }
      setSelectedJobIds([]);
  };

  const toggleJobSelection = (id: string) => {
      setSelectedJobIds(prev => 
          prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
  };

  const handleJobStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>, d: DispatchEntry) => {
      const newStatus = e.target.value as DispatchStatus;
      await saveDispatch({ ...d, status: newStatus, updatedAt: new Date().toISOString() });
  };

  const toggleToday = async (e: React.MouseEvent, d: DispatchEntry) => {
      e.stopPropagation();
      await saveDispatch({ ...d, isTodayDispatch: !d.isTodayDispatch, updatedAt: new Date().toISOString() });
  };

  const handleRowUpdate = async (d: DispatchEntry, rowId: string, field: keyof DispatchRow, value: any) => {
      const newRows = d.rows.map(r => r.id === rowId ? { ...r, [field]: value } : r);
      const totalWeight = newRows.reduce((s, r) => s + r.weight, 0);
      const totalPcs = newRows.reduce((s, r) => s + r.pcs, 0);
      await saveDispatch({ ...d, rows: newRows, totalWeight, totalPcs, updatedAt: new Date().toISOString() });
  };

  const openShareModal = async (d: DispatchEntry) => {
     const containerId = 'temp-share-container';
     let container = document.getElementById(containerId);
     if (container) document.body.removeChild(container);
     
     container = document.createElement('div');
     container.id = containerId;
     // Styling...
     container.style.position = 'fixed';
     container.style.top = '-9999px';
     container.style.left = '-9999px';
     container.style.width = '600px';
     container.style.backgroundColor = '#ffffff';
     document.body.appendChild(container);

     const party = data.parties.find(p => p.id === d.partyId)?.name || 'Unknown';
     const totalBundles = d.rows.reduce((acc, r) => acc + (Number(r.bundle) || 0), 0);

     const rowsHtml = d.rows.map((r, i) => `
        <tr style="background-color: ${i%2===0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
           <td style="padding: 10px; font-weight: bold; font-size: 14px; color: #334155;">${r.size} ${r.sizeType ? `(${r.sizeType})` : ''}</td>
           <td style="padding: 10px; text-align: right; color: #475569;">${r.weight.toFixed(3)}</td>
           <td style="padding: 10px; text-align: right; color: #475569;">${r.pcs}</td>
           <td style="padding: 10px; text-align: right; color: #475569;">${r.bundle}</td>
        </tr>
     `).join('');

     container.innerHTML = `
        <div style="font-family: sans-serif; border: 1px solid #cbd5e1;">
            <div style="background: linear-gradient(135deg, #4f46e5, #6366f1); padding: 20px; color: white;">
                <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9;">Dispatch Note</div>
                <div style="font-size: 24px; font-weight: bold;">${party}</div>
                <div style="display: flex; justify-content: space-between; margin-top: 10px;">
                    <div>Job #${d.dispatchNo}</div>
                    <div>${d.date}</div>
                </div>
            </div>
            <div style="padding: 20px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f1f5f9; color: #64748b; font-size: 12px; text-transform: uppercase;">
                            <th style="padding: 10px; text-align: left;">Item</th>
                            <th style="padding: 10px; text-align: right;">Wt (kg)</th>
                            <th style="padding: 10px; text-align: right;">Pcs</th>
                            <th style="padding: 10px; text-align: right;">Box</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                    <tfoot style="background: #f8fafc; border-top: 2px solid #e2e8f0; font-weight: bold;">
                        <tr>
                            <td style="padding: 15px; color: #1e293b;">TOTAL</td>
                            <td style="padding: 15px; text-align: right; color: #1e293b;">${d.totalWeight.toFixed(3)}</td>
                            <td style="padding: 15px; text-align: right; color: #1e293b;">${d.totalPcs}</td>
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
                     const file = new File([blob], `Job_${d.dispatchNo}.png`, { type: 'image/png' });
                     if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                         await navigator.share({ files: [file], title: `Job #${d.dispatchNo}`, text: `Dispatch for ${party}` });
                     } else {
                         const link = document.createElement('a');
                         link.href = URL.createObjectURL(blob);
                         link.download = `Job_${d.dispatchNo}.png`;
                         link.click();
                     }
                 }
                 if (document.body.contains(container!)) document.body.removeChild(container!);
             });
         } catch(e) { console.error(e); if (document.body.contains(container!)) document.body.removeChild(container!); }
     } else {
         if (document.body.contains(container!)) document.body.removeChild(container!);
         alert("Sharing module loading...");
     }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
        
        {/* FORM SECTION */}
        <div className={`bg-white rounded-2xl shadow-sm border ${isEditingId ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'} overflow-hidden transition-all`}>
            <div className={`px-6 py-4 flex justify-between items-center ${isEditingId ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                    {isEditingId ? <span className="animate-pulse">✏️ Edit Job</span> : <span>🚚 New Job Entry</span>}
                </h3>
            </div>
            
            <div className="p-6 space-y-5">
                <div className="flex gap-4">
                    <div className="w-24">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Job #</label>
                        <input value={activeDispatch.dispatchNo} onChange={e => setActiveDispatch({...activeDispatch, dispatchNo: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-center outline-none focus:border-indigo-500" placeholder="Auto" />
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Date</label>
                        <input type="date" value={activeDispatch.date} onChange={e => setActiveDispatch({...activeDispatch, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500" />
                    </div>
                </div>

                <div className="relative">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Party Name</label>
                    <input 
                        type="text" 
                        value={partyInput} 
                        onChange={e => { setPartyInput(e.target.value); setShowPartyDropdown(true); }}
                        onFocus={() => setShowPartyDropdown(true)}
                        onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500"
                        placeholder="Search Party..."
                    />
                    {showPartyDropdown && partyInput && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                            {partySuggestions.map(p => (
                                <div key={p.id} className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-bold text-slate-700" onClick={() => { setPartyInput(p.name); setShowPartyDropdown(false); }}>
                                    {p.name} <span className="text-[10px] text-slate-400 ml-2">{p.code}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="grid grid-cols-12 gap-3 mb-3">
                        <div className="col-span-12 md:col-span-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Size</label>
                            <input value={rowSize} onChange={e => setRowSize(e.target.value)} placeholder="Size Description" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500" />
                        </div>
                        <div className="col-span-6 md:col-span-2">
                             <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Type</label>
                             <select value={rowType} onChange={e => setRowType(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold outline-none focus:border-indigo-500">
                                 {SIZE_TYPES.map(t => <option key={t} value={t}>{t || '-'}</option>)}
                             </select>
                        </div>
                        <div className="col-span-6 md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Mic</label>
                            <input type="number" value={rowMicron} onChange={e => setRowMicron(e.target.value)} placeholder="0" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm font-bold text-center outline-none focus:border-indigo-500" />
                        </div>
                        <div className="col-span-4 md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Wt</label>
                            <input type="number" value={rowWeight} onChange={e => setRowWeight(e.target.value)} placeholder="0.000" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm font-bold text-center outline-none focus:border-indigo-500" />
                        </div>
                        <div className="col-span-4 md:col-span-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Pcs</label>
                            <input type="number" value={rowPcs} onChange={e => setRowPcs(e.target.value)} placeholder="0" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm font-bold text-center outline-none focus:border-indigo-500" />
                        </div>
                        <div className="col-span-4 md:col-span-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Box</label>
                            <input type="number" value={rowBundle} onChange={e => setRowBundle(e.target.value)} placeholder="0" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm font-bold text-center outline-none focus:border-indigo-500" />
                        </div>
                    </div>
                    <button onClick={addRow} className="w-full bg-white border border-slate-300 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 rounded-lg py-2.5 text-xs font-bold transition-all shadow-sm">+ Add Item Row</button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {activeDispatch.rows?.map((r, i) => (
                        <div key={i} className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 text-xs">
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-800">{r.size} {r.sizeType && `(${r.sizeType})`}</span>
                                <div className="flex gap-2 text-[10px] text-slate-500 font-bold">
                                    <span>{r.micron}m</span>
                                    <span>{r.weight.toFixed(3)}kg</span>
                                    <span>{r.pcs}pcs</span>
                                </div>
                            </div>
                            <button onClick={() => removeRow(i)} className="text-slate-400 hover:text-red-500 px-2 py-1 font-bold">×</button>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                    {isEditingId && <button onClick={resetForm} className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl text-sm hover:bg-slate-200 transition-colors">Cancel</button>}
                    <button onClick={handleSave} className={`flex-[2] text-white font-bold py-3 rounded-xl text-sm shadow-lg transition-transform active:scale-[0.98] ${isEditingId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-900 hover:bg-black'}`}>
                        {isEditingId ? 'Update Job' : 'Save Job Card'}
                    </button>
                </div>
            </div>
        </div>

        {/* LIST SECTION - THIS IS THE PART THAT WAS TRUNCATED IN THE INPUT */}
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="text-xl">📋</span> Recent Jobs
                    </h3>
                    {selectedJobIds.length > 1 && (
                        <button onClick={handleMergeJobs} className="bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1 animate-in fade-in zoom-in">
                            <span>⚡ Merge {selectedJobIds.length} Jobs</span>
                        </button>
                    )}
                </div>
                <input placeholder="Search Job..." value={searchJob} onChange={e => setSearchJob(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 outline-none w-full sm:w-48 focus:ring-2 focus:ring-indigo-100" />
            </div>

            {/* --- MOBILE LIST VIEW (< md) --- */}
            <div className="space-y-3 md:hidden">
                {filteredDispatches.map(d => {
                    // Resolve Party Logic (Updated)
                    let p = data.parties.find(p => p.id === d.partyId);
                    let partyNameDisplay = 'Unknown';

                    if (p) {
                        if (/^\d{3}$/.test(p.name.trim())) {
                            const shortCode = p.name.trim();
                            const relCode = `REL/${shortCode}`;
                            const fullParty = data.parties.find(fp => fp.code === relCode);
                            partyNameDisplay = fullParty ? `${fullParty.name} [${fullParty.code}]` : `[${relCode}]`;
                        } else {
                            partyNameDisplay = p.code ? `${p.name} [${p.code}]` : p.name;
                        }
                    }
                    
                    const isExpanded = expandedId === d.id;
                    const totalBundles = d.rows.reduce((acc, r) => acc + (Number(r.bundle) || 0), 0);
                    const isSelected = selectedJobIds.includes(d.id);
                    const isToday = d.isTodayDispatch;

                    let statusBadge = 'bg-slate-100 text-slate-500';
                    let cardBorder = 'border-slate-200';
                    if (d.status === 'SLITTING') { statusBadge = 'bg-amber-100 text-amber-700 animate-pulse'; cardBorder = 'border-amber-300'; }
                    else if (d.status === 'COMPLETED') { statusBadge = 'bg-emerald-100 text-emerald-700'; cardBorder = 'border-emerald-200'; }
                    else if (d.status === 'DISPATCHED') { statusBadge = 'bg-purple-100 text-purple-600'; cardBorder = 'border-purple-200'; }

                    return (
                        <div key={d.id} className={`rounded-xl border shadow-sm bg-white overflow-hidden transition-all ${cardBorder} ${isSelected ? 'ring-2 ring-indigo-500' : ''}`}>
                           <div className="relative">
                               <div className="absolute top-3 right-3 z-10">
                                   <input type="checkbox" checked={isSelected} onChange={() => toggleJobSelection(d.id)} onClick={(e) => e.stopPropagation()} className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"/>
                               </div>
                               <div onClick={() => setExpandedId(isExpanded ? null : d.id)} className="p-4 cursor-pointer">
                                 <div className="flex flex-col gap-3">
                                    <div className="pr-8">
                                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                                         <span className="text-[10px] font-bold text-slate-400 tracking-wider font-mono">{d.date.substring(5).split('-').reverse().join('/')}</span>
                                         <span className="text-[10px] font-extrabold text-slate-500 font-mono">#{d.dispatchNo}</span>
                                         {isToday && <span className="bg-indigo-500 text-white px-1.5 py-0.5 rounded text-[9px] font-bold">TODAY</span>}
                                         <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${statusBadge}`}>{d.status}</span>
                                      </div>
                                      <div className="bg-indigo-50 px-2 py-1.5 rounded-lg border border-indigo-100 inline-block max-w-full">
                                          <h4 className="text-sm font-bold text-indigo-900 leading-tight break-words">{partyNameDisplay}</h4>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4 border-t border-slate-100 pt-3">
                                       <div><span className="text-[9px] font-bold text-slate-400 uppercase block">Bundles</span><span className="text-sm font-bold text-slate-700">{totalBundles}</span></div>
                                       <div><span className="text-[9px] font-bold text-slate-400 uppercase block">Weight</span><span className="text-sm font-bold text-slate-900">{d.totalWeight.toFixed(3)}</span></div>
                                    </div>
                                 </div>
                               </div>
                           </div>
                           
                           {/* Mobile Expanded View */}
                           {isExpanded && (
                             <div className="bg-slate-50 border-t border-slate-100 p-3">
                                <div className="flex justify-between items-center mb-3">
                                    <button onClick={() => handleRepeatOrder(d)} className="bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded text-xs font-bold shadow-sm">Repeat</button>
                                    <button onClick={() => openShareModal(d)} className="bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm">Share</button>
                                </div>
                                <div className="space-y-3">
                                    {d.rows.map(row => (
                                        <div key={row.id} className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                                            <div className="flex justify-between mb-1">
                                                <span className="font-bold text-slate-800 text-sm">{row.size}</span>
                                                <button onClick={() => { if(confirm("Delete item?")) { const newRows = d.rows.filter(r => r.id !== row.id); const updatedDispatch = { ...d, rows: newRows, totalWeight: newRows.reduce((a,r)=>a+r.weight,0), totalPcs: newRows.reduce((a,r)=>a+r.pcs,0), updatedAt: new Date().toISOString() }; saveDispatch(updatedDispatch); }}} className="text-slate-300 hover:text-red-500">🗑️</button>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                                                <div className="bg-slate-50 p-1 rounded text-center"><div className="text-[8px] text-slate-400 uppercase">Disp</div><div className="font-bold">{row.weight.toFixed(3)}</div></div>
                                                <div className="bg-slate-50 p-1 rounded text-center border border-indigo-100"><div className="text-[8px] text-indigo-400 uppercase">Prod</div><div className="font-bold text-indigo-700">{row.productionWeight?.toFixed(3)||'-'}</div></div>
                                                <div className="bg-slate-50 p-1 rounded text-center"><div className="text-[8px] text-slate-400 uppercase">Pcs</div><div className="font-bold">{row.pcs}</div></div>
                                            </div>
                                            <select value={row.status || DispatchStatus.PENDING} onChange={(e) => handleRowUpdate(d, row.id, 'status', e.target.value)} className="w-full text-[10px] font-bold py-1.5 rounded border border-slate-200 bg-white">
                                                {Object.values(DispatchStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 flex gap-2">
                                    <button onClick={() => handleEdit(d)} className="flex-1 bg-white border border-indigo-200 text-indigo-600 py-2 rounded font-bold text-xs">Edit Job</button>
                                    <button onClick={() => { if(confirm("Delete Job?")) deleteDispatch(d.id); }} className="flex-1 bg-white border border-red-200 text-red-500 py-2 rounded font-bold text-xs">Delete Job</button>
                                </div>
                             </div>
                           )}
                        </div>
                    );
                })}
            </div>

            {/* --- DESKTOP TABLE VIEW (>= md) --- */}
            <div className="hidden md:block bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4 w-12 text-center">
                                <input type="checkbox" onChange={(e) => setSelectedJobIds(e.target.checked ? filteredDispatches.map(d => d.id) : [])} checked={selectedJobIds.length === filteredDispatches.length && filteredDispatches.length > 0} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            </th>
                            <th className="px-4 py-4">Date / Job No</th>
                            <th className="px-4 py-4 w-[35%]">Party Name</th>
                            <th className="px-4 py-4 text-center">Status</th>
                            <th className="px-4 py-4 text-right">Weight</th>
                            <th className="px-4 py-4 text-center">Bundles</th>
                            <th className="px-4 py-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredDispatches.map(d => {
                            // Resolve Party Logic
                            let p = data.parties.find(p => p.id === d.partyId);
                            let partyNameDisplay = 'Unknown';
                            if (p) {
                                if (/^\d{3}$/.test(p.name.trim())) {
                                    const shortCode = p.name.trim();
                                    const relCode = `REL/${shortCode}`;
                                    const fullParty = data.parties.find(fp => fp.code === relCode);
                                    partyNameDisplay = fullParty ? `${fullParty.name} [${fullParty.code}]` : `[${relCode}]`;
                                } else {
                                    partyNameDisplay = p.code ? `${p.name} [${p.code}]` : p.name;
                                }
                            }

                            const isExpanded = expandedId === d.id;
                            const totalBundles = d.rows.reduce((acc, r) => acc + (Number(r.bundle) || 0), 0);
                            const isSelected = selectedJobIds.includes(d.id);
                            
                            let statusColor = 'bg-slate-100 text-slate-500';
                            if (d.status === 'COMPLETED') statusColor = 'bg-emerald-100 text-emerald-700';
                            else if (d.status === 'SLITTING') statusColor = 'bg-amber-100 text-amber-700 animate-pulse';
                            else if (d.status === 'DISPATCHED') statusColor = 'bg-purple-100 text-purple-700';

                            return (
                                <React.Fragment key={d.id}>
                                    <tr onClick={() => setExpandedId(isExpanded ? null : d.id)} className={`cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/30' : 'hover:bg-slate-50'} ${isSelected ? 'bg-indigo-50' : ''}`}>
                                        <td className="px-6 py-4 text-center" onClick={e => e.stopPropagation()}>
                                            <input type="checkbox" checked={isSelected} onChange={() => toggleJobSelection(d.id)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="font-bold text-slate-800 text-sm">{d.date.split('-').reverse().join('/')}</div>
                                            <div className="text-xs font-mono text-slate-500 font-bold">#{d.dispatchNo}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="inline-block bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5">
                                                <div className="font-bold text-indigo-900 text-sm">{partyNameDisplay}</div>
                                            </div>
                                            {d.isTodayDispatch && <span className="ml-2 text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">TODAY</span>}
                                        </td>
                                        <td className="px-4 py-4 text-center" onClick={e => e.stopPropagation()}>
                                            <select 
                                                value={d.status || DispatchStatus.PENDING}
                                                onChange={(e) => handleJobStatusChange(e, d)}
                                                className={`text-[10px] font-bold py-1.5 px-3 rounded-lg border-0 outline-none cursor-pointer transition-colors hover:opacity-80 uppercase ${statusColor}`}
                                            >
                                                {Object.values(DispatchStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="font-bold text-slate-900">{d.totalWeight.toFixed(3)}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">kg</div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div className="font-bold text-slate-700">{totalBundles}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">Box</div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div className="flex justify-center items-center gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); handleEdit(d); }} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-indigo-600 transition-all" title="Edit">✏️</button>
                                                <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete Job?')) deleteDispatch(d.id); }} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-red-200 text-red-500 transition-all" title="Delete">🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr>
                                            <td colSpan={7} className="p-0 border-b border-slate-200">
                                                <div className="bg-slate-50 p-6 shadow-inner animate-in slide-in-from-top-2 duration-200">
                                                    <div className="flex justify-between items-center mb-4">
                                                        <div className="flex gap-2">
                                                            <button onClick={() => handleRepeatOrder(d)} className="bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-2">
                                                                <span>🔄 Repeat Order</span>
                                                            </button>
                                                            <button onClick={() => openShareModal(d)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-colors flex items-center gap-2">
                                                                <span>📱 Share Job Card</span>
                                                            </button>
                                                        </div>
                                                        <button onClick={(e) => toggleToday(e, d)} className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${d.isTodayDispatch ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                                                            {d.isTodayDispatch ? '★ Marked for Today' : 'Mark for Today'}
                                                        </button>
                                                    </div>

                                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                                            <thead className="bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wide">
                                                                <tr>
                                                                    <th className="px-4 py-3 w-[20%]">Size / Item</th>
                                                                    <th className="px-2 py-3 w-[10%]">Type</th>
                                                                    <th className="px-2 py-3 w-16 text-center">Micron</th>
                                                                    <th className="px-4 py-3 text-right text-slate-800">Disp Wt</th>
                                                                    <th className="px-4 py-3 text-right text-indigo-600">Prod Wt</th>
                                                                    <th className="px-4 py-3 text-right text-red-500">Waste</th>
                                                                    <th className="px-4 py-3 text-right">Pcs</th>
                                                                    <th className="px-4 py-3 text-center">Bundle</th>
                                                                    <th className="px-4 py-3 text-center">Status</th>
                                                                    <th className="px-2 py-3 w-10"></th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {d.rows.map(row => {
                                                                    const rowStatusColor = row.status === DispatchStatus.COMPLETED ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-500';
                                                                    return (
                                                                        <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                                                            <td className="px-4 py-2">
                                                                                <input value={row.size} onChange={(e) => handleRowUpdate(d, row.id, 'size', e.target.value)} className="w-full font-bold text-slate-800 outline-none border-b border-transparent focus:border-indigo-500 bg-transparent transition-colors" />
                                                                            </td>
                                                                            <td className="px-2 py-2">
                                                                                <select value={row.sizeType || ''} onChange={(e) => handleRowUpdate(d, row.id, 'sizeType', e.target.value)} className="w-full bg-transparent text-xs font-bold text-slate-600 outline-none focus:text-indigo-600 py-1">
                                                                                    {SIZE_TYPES.map(t => <option key={t} value={t}>{t || '-'}</option>)}
                                                                                </select>
                                                                            </td>
                                                                            <td className="px-2 py-2">
                                                                                <input type="number" value={row.micron || ''} onChange={(e) => handleRowUpdate(d, row.id, 'micron', parseFloat(e.target.value)||0)} className="w-full text-center bg-transparent text-xs font-bold text-slate-500 outline-none border-b border-transparent focus:border-indigo-500" placeholder="-" />
                                                                            </td>
                                                                            <td className="px-4 py-2 text-right">
                                                                                <input type="number" value={row.weight === 0 ? '' : row.weight.toFixed(3)} onChange={(e) => handleRowUpdate(d, row.id, 'weight', parseFloat(e.target.value)||0)} className="w-full text-right font-mono font-bold text-slate-800 bg-transparent outline-none border-b border-transparent focus:border-indigo-500" />
                                                                            </td>
                                                                            <td className="px-4 py-2 text-right">
                                                                                <input type="number" value={row.productionWeight === 0 ? '' : row.productionWeight?.toFixed(3)} onChange={(e) => handleRowUpdate(d, row.id, 'productionWeight', parseFloat(e.target.value)||0)} className="w-full text-right font-mono font-bold text-indigo-600 bg-transparent outline-none border-b border-transparent focus:border-indigo-500" placeholder="-" />
                                                                            </td>
                                                                            <td className="px-4 py-2 text-right text-xs font-mono font-bold text-red-500">
                                                                                {row.wastage ? row.wastage.toFixed(3) : '-'}
                                                                            </td>
                                                                            <td className="px-4 py-2 text-right">
                                                                                <input type="number" value={row.pcs === 0 ? '' : row.pcs} onChange={(e) => handleRowUpdate(d, row.id, 'pcs', parseFloat(e.target.value)||0)} className="w-full text-right font-mono font-bold text-slate-700 bg-transparent outline-none border-b border-transparent focus:border-indigo-500" />
                                                                            </td>
                                                                            <td className="px-4 py-2 text-center">
                                                                                <input type="number" value={row.bundle === 0 ? '' : row.bundle} onChange={(e) => handleRowUpdate(d, row.id, 'bundle', parseFloat(e.target.value)||0)} className="w-full text-center font-bold text-slate-700 bg-transparent outline-none border-b border-transparent focus:border-indigo-500" />
                                                                            </td>
                                                                            <td className="px-4 py-2 text-center">
                                                                                <select value={row.status || DispatchStatus.PENDING} onChange={(e) => handleRowUpdate(d, row.id, 'status', e.target.value)} className={`w-full bg-transparent text-[10px] font-bold outline-none border-b border-transparent focus:border-indigo-500 py-1 cursor-pointer text-center ${rowStatusColor}`}>
                                                                                    <option value={DispatchStatus.PENDING}>PENDING</option>
                                                                                    <option value={DispatchStatus.PRINTING}>PRINTING</option>
                                                                                    <option value={DispatchStatus.SLITTING}>SLITTING</option>
                                                                                    <option value={DispatchStatus.CUTTING}>CUTTING</option>
                                                                                    <option value={DispatchStatus.COMPLETED}>COMPLETED</option>
                                                                                    <option value={DispatchStatus.DISPATCHED}>DISPATCHED</option>
                                                                                </select>
                                                                            </td>
                                                                            <td className="px-2 py-2 text-center">
                                                                                <button onClick={() => { if(confirm("Delete this item row?")) { const newRows = d.rows.filter(r => r.id !== row.id); const updatedDispatch = { ...d, rows: newRows, totalWeight: newRows.reduce((a,r)=>a+r.weight,0), totalPcs: newRows.reduce((a,r)=>a+r.pcs,0), updatedAt: new Date().toISOString() }; saveDispatch(updatedDispatch); } }} className="text-slate-300 hover:text-red-500 transition-colors p-1" title="Delete Item">🗑️</button>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        {filteredDispatches.length === 0 && (
                            <tr><td colSpan={7} className="text-center py-10 text-slate-400 font-bold">No jobs found matching your search.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};