
import React, { useState } from 'react';
import { AppData, DispatchEntry, DispatchStatus, DispatchRow } from '../../types';
import { saveDispatch, deleteDispatch, ensurePartyExists } from '../../services/storageService';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const DispatchManager: React.FC<Props> = ({ data, onUpdate }) => {
  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [partyName, setPartyName] = useState('');
  const [currentRows, setCurrentRows] = useState<DispatchRow[]>([]);
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [isToday, setIsToday] = useState(false);
  
  // Row Input State
  const [size, setSize] = useState('');
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

  // --- Form Handlers ---
  const addRow = () => {
    if (!size) return;
    const newRow: DispatchRow = {
      id: `r-${Date.now()}-${Math.random()}`,
      size: size,
      weight: parseFloat(weight) || 0,
      pcs: parseFloat(pcs) || 0,
      bundle: parseFloat(bundle) || 0,
      status: DispatchStatus.PENDING,
      isCompleted: false,
      isLoaded: false
    };
    setCurrentRows([...currentRows, newRow]);
    setWeight('');
    setPcs('');
    setBundle('');
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
    const allDispatched = currentRows.every(r => r.status === DispatchStatus.DISPATCHED);
    const allPending = currentRows.every(r => r.status === DispatchStatus.PENDING);
    
    // Automation: If Today's Dispatch, default to LOADING (Running), otherwise Pending
    let jobStatus = isToday ? DispatchStatus.LOADING : DispatchStatus.PENDING; 
    
    if (allDispatched) jobStatus = DispatchStatus.COMPLETED; 
    else if (allPending && !isToday) jobStatus = DispatchStatus.PENDING;

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

  // --- Inline Edit Handlers ---
  const handleJobDateUpdate = async (d: DispatchEntry, newDate: string) => {
    const updatedEntry = { ...d, date: newDate, updatedAt: new Date().toISOString() };
    await saveDispatch(updatedEntry);
  };

  const handleToggleToday = async (d: DispatchEntry, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card expansion
    const updatedEntry = { ...d, isTodayDispatch: !d.isTodayDispatch, updatedAt: new Date().toISOString() };
    await saveDispatch(updatedEntry);
  };

  const handleRowUpdate = async (d: DispatchEntry, rowId: string, field: keyof DispatchRow, value: string | number) => {
    const updatedRows = d.rows.map(r => {
      if (r.id === rowId) {
        return { ...r, [field]: value };
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
      if (newStatus === DispatchStatus.PENDING) newStatus = DispatchStatus.LOADING;
      else if (newStatus === DispatchStatus.LOADING) newStatus = DispatchStatus.COMPLETED;
      else if (newStatus === DispatchStatus.COMPLETED) newStatus = DispatchStatus.DISPATCHED;
      else newStatus = DispatchStatus.PENDING; 
      return { ...row, status: newStatus };
    });

    const allPending = updatedRows.every(r => r.status === DispatchStatus.PENDING);
    const allDispatched = updatedRows.every(r => r.status === DispatchStatus.DISPATCHED);
    const anyRunning = updatedRows.some(r => r.status === DispatchStatus.LOADING);
    
    let newJobStatus = DispatchStatus.LOADING;
    if (allPending) newJobStatus = DispatchStatus.PENDING;
    else if (allDispatched) newJobStatus = DispatchStatus.COMPLETED; // Automation: Dispatched -> Completed
    else if (anyRunning) newJobStatus = DispatchStatus.LOADING;
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
      // 1. Priority: Today's Dispatch (Top)
      if (a.isTodayDispatch && !b.isTodayDispatch) return -1;
      if (!a.isTodayDispatch && b.isTodayDispatch) return 1;
      // 2. Secondary: Date (Newest first)
      return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const partySuggestions = data.parties.filter(p => 
    p.name.toLowerCase().includes(partyName.toLowerCase())
  );

  return (
    <div className="space-y-8">
      
      {/* --- JOB ENTRY FORM --- */}
      <div className="glass-card rounded-3xl overflow-hidden ring-1 ring-slate-100">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-8 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl bg-white/20 p-2 rounded-xl backdrop-blur-sm">🚛</span>
              <h2 className="text-base font-bold text-white tracking-wide">
                {isEditingId ? 'Edit Job' : 'New Job Entry'}
              </h2>
            </div>
            
            {/* Mark Today Automation in Form */}
            <button 
              onClick={() => setIsToday(!isToday)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${isToday ? 'bg-white text-indigo-600 shadow-md' : 'bg-indigo-700/50 text-indigo-100 hover:bg-indigo-700'}`}
            >
              <span>{isToday ? '★' : '☆'}</span>
              <span>Today's Dispatch</span>
            </button>
        </div>

        <div className="p-6 md:p-8 space-y-8">
            {/* Header Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
               <div className="md:col-span-8 space-y-2 relative">
                  <label className="text-xs font-semibold text-slate-500 ml-1">Party Name</label>
                  <input 
                    type="text" 
                    value={partyName} 
                    onChange={e => {
                      setPartyName(e.target.value);
                      setShowPartyDropdown(true);
                    }}
                    onFocus={() => setShowPartyDropdown(true)}
                    onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)}
                    className="w-full bg-slate-50 border-0 rounded-2xl px-5 py-4 text-sm font-semibold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all shadow-inner"
                    placeholder="Search or Select Party"
                  />
                  {showPartyDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                      {partySuggestions.length > 0 ? (
                        partySuggestions.map(p => (
                          <div 
                            key={p.id}
                            className="px-5 py-3 hover:bg-indigo-50 cursor-pointer text-sm font-medium text-slate-700 transition-colors border-b border-slate-50 last:border-0"
                            onClick={() => {
                              setPartyName(p.name);
                              setShowPartyDropdown(false);
                            }}
                          >
                            {p.name}
                          </div>
                        ))
                      ) : (
                        partyName && <div className="px-5 py-3 text-xs text-slate-400 italic">Press Add to create "{partyName}"</div>
                      )}
                    </div>
                  )}
               </div>
               <div className="md:col-span-4 space-y-2">
                  <label className="text-xs font-semibold text-slate-500 ml-1">Date</label>
                  <input 
                    type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="w-full bg-slate-50 border-0 rounded-2xl px-5 py-4 text-sm font-semibold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all shadow-inner"
                  />
               </div>
            </div>

            {/* Item Input Row */}
            <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-100/50">
              <div className="grid grid-cols-12 gap-4 items-end">
                 <div className="col-span-12 md:col-span-4 space-y-1">
                   <label className="text-[10px] font-semibold text-slate-500 ml-1">Size / Desc</label>
                   <input placeholder="Enter Size" value={size} onChange={e => setSize(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-indigo-500 transition-colors" />
                 </div>
                 <div className="col-span-4 md:col-span-2 space-y-1">
                   <label className="text-[10px] font-semibold text-slate-500 ml-1">Weight</label>
                   <input type="number" placeholder="0.000" value={weight} onChange={e => setWeight(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 text-center outline-none focus:border-indigo-500 transition-colors" />
                 </div>
                 <div className="col-span-4 md:col-span-2 space-y-1">
                   <label className="text-[10px] font-semibold text-slate-500 ml-1">
                       {size.toLowerCase().includes('mm') ? 'Rolls' : 'Pcs'}
                   </label>
                   <input type="number" placeholder="0" value={pcs} onChange={e => setPcs(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 text-center outline-none focus:border-indigo-500 transition-colors" />
                 </div>
                 <div className="col-span-4 md:col-span-2 space-y-1">
                   <label className="text-[10px] font-semibold text-slate-500 ml-1">📦</label>
                   <input type="number" placeholder="0" value={bundle} onChange={e => setBundle(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 text-center outline-none focus:border-indigo-500 transition-colors" />
                 </div>
                 <div className="col-span-12 md:col-span-2">
                   <button onClick={addRow} className="w-full bg-slate-800 hover:bg-slate-900 text-white rounded-xl py-3.5 text-xs font-bold tracking-wider shadow-lg shadow-slate-200 transition-all transform active:scale-95 flex justify-center items-center gap-2">
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                     Add
                   </button>
                 </div>
              </div>
            </div>

            {/* Preview List */}
            {currentRows.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                  {currentRows.map((r, idx) => (
                    <div key={idx} className="relative group bg-white p-4 rounded-xl border border-indigo-50 shadow-sm hover:shadow-md transition-all">
                      <div className="flex justify-between items-start">
                         <div>
                            <div className="text-sm font-bold text-slate-800 tracking-tight">{r.size}</div>
                            <div className="text-xs text-indigo-500 font-semibold mt-1">{formatWeight(r.weight)} kg</div>
                         </div>
                         <div className="text-right">
                            <div className="text-xs font-bold text-slate-500">📦 {r.bundle}</div>
                            <div className="text-[10px] font-bold text-slate-400">{r.pcs} {r.size.toLowerCase().includes('mm')?'Rolls':'Pcs'}</div>
                         </div>
                      </div>
                      <button onClick={() => removeRow(idx)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-50 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-red-100 hover:bg-red-500 hover:text-white">
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

      {/* --- FILTERS & ACTIVE JOBS --- */}
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
            let statusText = d.status === DispatchStatus.LOADING ? 'RUNNING' : (d.status || 'PENDING');
            if(d.status === DispatchStatus.COMPLETED) { statusColor = 'bg-emerald-50 text-emerald-600 border-l-emerald-500'; }
            else if(d.status === DispatchStatus.DISPATCHED) { statusColor = 'bg-purple-50 text-purple-600 border-l-purple-500'; }
            else if(d.status === DispatchStatus.LOADING) { statusColor = 'bg-amber-50 text-amber-600 border-l-amber-500'; }
            
            // Highlight if marked for today
            const isToday = d.isTodayDispatch;

            return (
              <div key={d.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-all duration-300 group ${isToday ? 'border-indigo-300 ring-2 ring-indigo-50' : 'border-slate-100'}`}>
                 {/* Card Header */}
                 <div onClick={() => setExpandedJobId(isExpanded ? null : d.id)} className={`relative p-5 cursor-pointer border-l-4 ${statusColor.split(' ').pop()} transition-colors`}>
                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                           <span className="text-[10px] font-bold text-slate-400 tracking-wider bg-slate-50 px-2 py-1 rounded-md border border-slate-100">{d.date}</span>
                           <span className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wide ${statusColor.replace('border-l-4','').replace('border-l-','')} bg-opacity-50`}>{statusText}</span>
                           {isToday && (
                             <span className="bg-indigo-600 text-white px-2 py-1 rounded-md text-[10px] font-bold tracking-wide flex items-center gap-1 shadow-sm animate-pulse">
                               📅 TODAY
                             </span>
                           )}
                        </div>
                        <h4 className="text-lg font-bold text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors">{party?.name}</h4>
                      </div>
                      
                      <div className="flex items-center gap-3">
                         {/* Mark for Today Button */}
                         <button 
                            onClick={(e) => handleToggleToday(d, e)}
                            className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 ${isToday ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                            title="Mark for Today's Dispatch"
                         >
                            <span>{isToday ? '★ Scheduled' : '☆ Mark Today'}</span>
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

                 {/* Expanded Details Panel */}
                 {isExpanded && (
                   <div className="bg-slate-50 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                      
                      {/* Detailed Edit Header */}
                      <div className="px-6 py-4 border-b border-slate-200 bg-white flex justify-between items-center">
                         <div className="flex items-center gap-2">
                           <span className="text-lg">🛠️</span>
                           <h4 className="text-sm font-bold text-slate-700">Edit Job Details</h4>
                         </div>
                         <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-500">Job Date:</label>
                            <input 
                               type="date" 
                               value={d.date} 
                               onChange={(e) => handleJobDateUpdate(d, e.target.value)}
                               className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-1 text-xs font-bold text-slate-800 outline-none focus:border-indigo-400"
                            />
                         </div>
                      </div>

                      <div className="p-4 sm:p-6 overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                           <thead className="bg-slate-100/50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wide">
                              <tr>
                                 <th className="px-4 py-3 min-w-[150px]">Size / Desc</th>
                                 <th className="px-4 py-3 text-right w-24">Weight</th>
                                 <th className="px-4 py-3 text-right w-20">Pcs</th>
                                 <th className="px-4 py-3 text-center w-20">📦</th>
                                 <th className="px-4 py-3 text-center w-32">Status</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {d.rows.map(row => {
                                  let rowStatusText = row.status === DispatchStatus.LOADING ? 'RUNNING' : (row.status || 'PENDING');
                                  let rowStatusColor = 'bg-white border-slate-200 text-slate-500';
                                  if(row.status === DispatchStatus.COMPLETED) rowStatusColor = 'bg-emerald-50 border-emerald-200 text-emerald-600';
                                  else if(row.status === DispatchStatus.DISPATCHED) rowStatusColor = 'bg-purple-50 border-purple-200 text-purple-600';
                                  else if(row.status === DispatchStatus.LOADING) rowStatusColor = 'bg-amber-50 border-amber-200 text-amber-600';

                                  return (
                                     <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-2">
                                           <input 
                                              value={row.size} 
                                              onChange={(e) => handleRowUpdate(d, row.id, 'size', e.target.value)}
                                              className="w-full bg-transparent font-bold text-slate-700 outline-none border-b border-transparent hover:border-slate-300 focus:border-indigo-500 transition-colors py-1"
                                           />
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                           <input 
                                              type="number"
                                              value={row.weight} 
                                              onChange={(e) => handleRowUpdate(d, row.id, 'weight', parseFloat(e.target.value) || 0)}
                                              className="w-full text-right bg-transparent font-mono font-medium text-slate-600 outline-none border-b border-transparent hover:border-slate-300 focus:border-indigo-500 transition-colors py-1"
                                           />
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                           <input 
                                              type="number"
                                              value={row.pcs} 
                                              onChange={(e) => handleRowUpdate(d, row.id, 'pcs', parseFloat(e.target.value) || 0)}
                                              className="w-full text-right bg-transparent font-mono font-medium text-slate-600 outline-none border-b border-transparent hover:border-slate-300 focus:border-indigo-500 transition-colors py-1"
                                           />
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                           <input 
                                              type="number"
                                              value={row.bundle} 
                                              onChange={(e) => handleRowUpdate(d, row.id, 'bundle', parseFloat(e.target.value) || 0)}
                                              className="w-full text-center bg-transparent font-bold text-slate-700 outline-none border-b border-transparent hover:border-slate-300 focus:border-indigo-500 transition-colors py-1"
                                           />
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                           <button 
                                              onClick={() => toggleRowStatus(d, row.id)}
                                              className={`px-3 py-1 rounded-md border text-[10px] font-bold tracking-wide hover:brightness-95 transition-all w-full ${rowStatusColor}`}
                                           >
                                              {rowStatusText}
                                           </button>
                                        </td>
                                     </tr>
                                  );
                              })}
                           </tbody>
                        </table>
                      </div>

                      <div className="px-6 pb-6 pt-2 flex justify-end">
                          <button 
                            onClick={() => { if(confirm('Are you sure you want to delete this job entry?')) deleteDispatch(d.id); }}
                            className="flex items-center gap-2 text-xs font-bold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl transition-colors"
                          >
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                             Delete Entry
                          </button>
                      </div>
                   </div>
                 )}
              </div>
            );
        })}
      </div>
    </div>
  );
};
