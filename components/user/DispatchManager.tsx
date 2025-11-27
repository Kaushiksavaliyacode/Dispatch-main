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
      bundle: bundle || '',
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
  };

  const handleSave = async () => {
    if (!partyName) return alert("Party Name is required");
    if (currentRows.length === 0) return alert("Please add at least one item row");

    const partyId = await ensurePartyExists(data.parties, partyName);

    const totalWeight = currentRows.reduce((acc, r) => acc + r.weight, 0);
    const totalPcs = currentRows.reduce((acc, r) => acc + r.pcs, 0);
    const allDispatched = currentRows.every(r => r.status === DispatchStatus.DISPATCHED);
    const allPending = currentRows.every(r => r.status === DispatchStatus.PENDING);
    let jobStatus = DispatchStatus.LOADING; 
    if (allPending) jobStatus = DispatchStatus.PENDING;
    if (allDispatched) jobStatus = DispatchStatus.DISPATCHED;

    const entry: DispatchEntry = {
      id: isEditingId || `d-${Date.now()}`,
      dispatchNo: isEditingId ? (data.dispatches.find(d => d.id === isEditingId)?.dispatchNo || '') : `JOB-${Math.floor(1000 + Math.random() * 9000)}`,
      date: date,
      partyId,
      status: jobStatus,
      rows: currentRows,
      totalWeight,
      totalPcs,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await saveDispatch(entry);
    resetForm();
  };

  // --- Inline Edit Handlers ---
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
    else if (allDispatched) newJobStatus = DispatchStatus.DISPATCHED;
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
  });

  const partySuggestions = data.parties.filter(p => 
    p.name.toLowerCase().includes(partyName.toLowerCase())
  );

  return (
    <div className="space-y-8">
      
      {/* --- JOB ENTRY FORM --- */}
      <div className="glass-card rounded-3xl overflow-hidden ring-1 ring-slate-100">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-8 py-5 flex items-center gap-3">
            <span className="text-2xl bg-white/20 p-2 rounded-xl backdrop-blur-sm">🚛</span>
            <h2 className="text-base font-bold text-white uppercase tracking-wider">
              {isEditingId ? 'Edit Job' : 'New Job Entry'}
            </h2>
        </div>

        <div className="p-6 md:p-8 space-y-8">
            {/* Header Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
               <div className="md:col-span-8 space-y-2 relative">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Party Name</label>
                  <input 
                    type="text" 
                    value={partyName} 
                    onChange={e => {
                      setPartyName(e.target.value);
                      setShowPartyDropdown(true);
                    }}
                    onFocus={() => setShowPartyDropdown(true)}
                    onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)}
                    className="w-full bg-slate-50 border-0 rounded-2xl px-5 py-4 text-sm font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all shadow-inner"
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
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Date</label>
                  <input 
                    type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="w-full bg-slate-50 border-0 rounded-2xl px-5 py-4 text-sm font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all shadow-inner"
                  />
               </div>
            </div>

            {/* Item Input Row */}
            <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-100/50">
              <div className="grid grid-cols-12 gap-4 items-end">
                 <div className="col-span-12 md:col-span-4 space-y-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Size / Desc</label>
                   <input placeholder="Enter Size" value={size} onChange={e => setSize(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium uppercase outline-none focus:border-indigo-500 transition-colors" />
                 </div>
                 <div className="col-span-4 md:col-span-2 space-y-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Weight</label>
                   <input type="number" placeholder="0.000" value={weight} onChange={e => setWeight(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-center outline-none focus:border-indigo-500 transition-colors" />
                 </div>
                 <div className="col-span-4 md:col-span-2 space-y-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                       {size.toLowerCase().includes('mm') ? 'Rolls' : 'Pcs'}
                   </label>
                   <input type="number" placeholder="0" value={pcs} onChange={e => setPcs(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-center outline-none focus:border-indigo-500 transition-colors" />
                 </div>
                 <div className="col-span-4 md:col-span-2 space-y-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Bundle</label>
                   <input placeholder="Type" value={bundle} onChange={e => setBundle(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium uppercase text-center outline-none focus:border-indigo-500 transition-colors" />
                 </div>
                 <div className="col-span-12 md:col-span-2">
                   <button onClick={addRow} className="w-full bg-slate-800 hover:bg-slate-900 text-white rounded-xl py-3.5 text-xs font-bold uppercase tracking-wider shadow-lg shadow-slate-200 transition-all transform active:scale-95 flex justify-center items-center gap-2">
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
                            <div className="text-sm font-bold text-slate-800 uppercase tracking-tight">{r.size}</div>
                            <div className="text-xs text-indigo-500 font-semibold mt-1">{formatWeight(r.weight)} kg</div>
                         </div>
                         <div className="text-right">
                            <div className="text-xs font-bold text-slate-500 uppercase">{r.bundle}</div>
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

            <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-200 text-sm uppercase tracking-wider transition-all transform active:scale-[0.99] flex justify-center items-center gap-2">
              <span>{isEditingId ? 'Update Job' : 'Save Job Entry'}</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </button>
        </div>
      </div>

      {/* --- FILTERS & ACTIVE JOBS --- */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between pt-4">
         <h3 className="text-xl font-bold text-slate-700 uppercase tracking-tight pl-2 border-l-4 border-indigo-500">Active Jobs</h3>
         <div className="flex gap-2 w-full md:w-auto">
             <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="bg-white border-0 shadow-sm rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 outline-none ring-1 ring-slate-100 focus:ring-indigo-200" />
             <input type="text" placeholder="Filter Party..." value={filterParty} onChange={e => setFilterParty(e.target.value)} className="flex-1 md:w-64 bg-white border-0 shadow-sm rounded-xl px-4 py-2.5 text-xs font-bold outline-none uppercase ring-1 ring-slate-100 focus:ring-indigo-200" />
         </div>
      </div>

      <div className="space-y-4">
        {filteredDispatches.map(d => {
            const party = data.parties.find(p => p.id === d.partyId);
            const isExpanded = expandedJobId === d.id;
            
            let statusColor = 'bg-slate-100 text-slate-500 border-l-slate-300';
            let statusText = d.status === DispatchStatus.LOADING ? 'RUNNING' : (d.status || 'PENDING');
            if(d.status === DispatchStatus.COMPLETED) { statusColor = 'bg-emerald-50 text-emerald-600 border-l-emerald-500'; }
            else if(d.status === DispatchStatus.DISPATCHED) { statusColor = 'bg-purple-50 text-purple-600 border-l-purple-500'; }
            else if(d.status === DispatchStatus.LOADING) { statusColor = 'bg-amber-50 text-amber-600 border-l-amber-500'; }

            return (
              <div key={d.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-all duration-300 group">
                 {/* Card Header */}
                 <div onClick={() => setExpandedJobId(isExpanded ? null : d.id)} className={`relative p-5 cursor-pointer border-l-4 ${statusColor.split(' ').pop()} transition-colors`}>
                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-2 py-1 rounded-md border border-slate-100">{d.date}</span>
                           <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${statusColor.replace('border-l-4','').replace('border-l-','')} bg-opacity-50`}>{statusText}</span>
                        </div>
                        <h4 className="text-lg font-bold text-slate-800 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{party?.name}</h4>
                      </div>
                      
                      <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                         <div className="text-center">
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Items</div>
                            <div className="text-sm font-bold text-slate-700">{d.rows.length}</div>
                         </div>
                         <div className="w-px h-6 bg-slate-200"></div>
                         <div className="text-center">
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Weight</div>
                            <div className="text-sm font-bold text-slate-700">{formatWeight(d.totalWeight)}</div>
                         </div>
                      </div>
                   </div>
                 </div>

                 {/* Expanded Details Panel */}
                 {isExpanded && (
                   <div className="bg-slate-50/50 border-t border-slate-100 p-4 md:p-6 animate-in slide-in-from-top-2 duration-300">
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                          {d.rows.map(row => {
                              let rowStatusText = row.status === DispatchStatus.LOADING ? 'RUNNING' : (row.status || 'PENDING');
                              let rowStatusColor = 'bg-white border-slate-200 text-slate-500';
                              if(row.status === DispatchStatus.COMPLETED) rowStatusColor = 'bg-emerald-50 border-emerald-200 text-emerald-600';
                              else if(row.status === DispatchStatus.DISPATCHED) rowStatusColor = 'bg-purple-50 border-purple-200 text-purple-600';
                              else if(row.status === DispatchStatus.LOADING) rowStatusColor = 'bg-amber-50 border-amber-200 text-amber-600';

                              return (
                                  <div key={row.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                                      {/* Status Stripe */}
                                      <div className={`absolute top-0 left-0 w-1 h-full ${rowStatusColor.replace('bg-','bg-').split(' ')[0].replace('50','500')}`}></div>
                                      
                                      <div className="flex justify-between items-start mb-3 pl-2">
                                          <input 
                                              className="font-bold text-base text-slate-800 uppercase bg-transparent outline-none border-b border-dashed border-slate-300 hover:border-indigo-400 focus:border-indigo-600 transition-colors w-2/3 pb-0.5" 
                                              value={row.size} 
                                              onChange={(e) => handleRowUpdate(d, row.id, 'size', e.target.value)} 
                                          />
                                          <button 
                                            onClick={() => toggleRowStatus(d, row.id)}
                                            className={`px-3 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wide hover:brightness-95 transition-all ${rowStatusColor}`}
                                          >
                                              {rowStatusText}
                                          </button>
                                      </div>
                                      
                                      <div className="grid grid-cols-3 gap-2 pl-2">
                                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                                              <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Weight</label>
                                              <input 
                                                  className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none text-center" 
                                                  type="number" 
                                                  value={row.weight} 
                                                  onChange={(e) => handleRowUpdate(d, row.id, 'weight', parseFloat(e.target.value) || 0)} 
                                              />
                                          </div>
                                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                                              <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">{row.size.includes('mm')?'Rolls':'Pcs'}</label>
                                              <input 
                                                  className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none text-center" 
                                                  type="number" 
                                                  value={row.pcs} 
                                                  onChange={(e) => handleRowUpdate(d, row.id, 'pcs', parseFloat(e.target.value) || 0)} 
                                              />
                                          </div>
                                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                                              <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Bundle</label>
                                              <input 
                                                  className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none text-center uppercase" 
                                                  type="text" 
                                                  value={row.bundle} 
                                                  onChange={(e) => handleRowUpdate(d, row.id, 'bundle', e.target.value)} 
                                              />
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end">
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