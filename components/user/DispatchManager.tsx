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
    // Clear inputs but keep Size for faster entry workflow
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

  return (
    <div className="space-y-6">
      
      {/* --- JOB ENTRY FORM (Desktop Grid Optimized) --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 overflow-hidden">
        <div className="bg-indigo-600 px-6 py-4 flex items-center gap-3">
            <span className="text-2xl">🚛</span>
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              {isEditingId ? 'Edit Job' : 'New Job Entry'}
            </h2>
        </div>

        <div className="p-6 space-y-6">
            {/* Header Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
               <div className="md:col-span-8">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Party Name</label>
                  <input 
                    type="text" list="parties_job"
                    value={partyName} onChange={e => setPartyName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-semibold outline-none focus:border-indigo-500 uppercase transition-all focus:ring-2 focus:ring-indigo-50"
                    placeholder="Select Party"
                  />
                  <datalist id="parties_job">{data.parties.map(p => <option key={p.id} value={p.name} />)}</datalist>
               </div>
               <div className="md:col-span-4">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Date</label>
                  <input 
                    type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-semibold outline-none focus:border-indigo-500 transition-all"
                  />
               </div>
            </div>

            {/* Input Row for Items - Horizontal on Desktop */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="grid grid-cols-12 gap-3 items-end">
                 <div className="col-span-4 md:col-span-4">
                   <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Size</label>
                   <input placeholder="Size" value={size} onChange={e => setSize(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium uppercase outline-none focus:border-indigo-500" />
                 </div>
                 <div className="col-span-2 md:col-span-2">
                   <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Weight</label>
                   <input type="number" placeholder="0.000" value={weight} onChange={e => setWeight(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-center outline-none focus:border-indigo-500" />
                 </div>
                 <div className="col-span-2 md:col-span-2">
                   <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                       {size.toLowerCase().includes('mm') ? 'Rolls' : 'Pcs'}
                   </label>
                   <input type="number" placeholder="0" value={pcs} onChange={e => setPcs(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-center outline-none focus:border-indigo-500" />
                 </div>
                 <div className="col-span-2 md:col-span-2">
                   <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Bundle</label>
                   <input placeholder="Box" value={bundle} onChange={e => setBundle(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium uppercase outline-none focus:border-indigo-500 text-center" />
                 </div>
                 <div className="col-span-2 md:col-span-2">
                   <button onClick={addRow} className="w-full bg-slate-800 text-white rounded-lg py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-black transition-colors shadow-md">Add</button>
                 </div>
              </div>
            </div>

            {/* Preview Rows - Horizontal List */}
            {currentRows.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {currentRows.map((r, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-indigo-50 px-4 py-3 rounded-lg border border-indigo-100 shadow-sm">
                      <div className="text-xs font-bold text-indigo-900 uppercase">
                          {r.size} <span className="text-indigo-400 font-normal mx-1">|</span> {formatWeight(r.weight)}kg
                          <span className="block text-[10px] text-indigo-600 mt-0.5">{r.pcs} {r.size.toLowerCase().includes('mm')?'Rolls':'Pcs'} • {r.bundle}</span>
                      </div>
                      <button onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600 font-bold px-2 py-1 hover:bg-red-50 rounded">×</button>
                    </div>
                  ))}
                </div>
            )}

            <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 text-sm uppercase tracking-wider transition-all transform active:scale-[0.99]">
              {isEditingId ? 'Update Job' : 'Save Job Entry'}
            </button>
        </div>
      </div>

      {/* --- FILTERS & LIST --- */}
      <div className="flex gap-4 items-center">
         <h3 className="text-lg font-bold text-slate-700 uppercase hidden md:block">Active Jobs</h3>
         <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-1/3 md:w-48 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none" />
         <input type="text" placeholder="Filter Party..." value={filterParty} onChange={e => setFilterParty(e.target.value)} className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs font-bold outline-none uppercase" />
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredDispatches.map(d => {
            const party = data.parties.find(p => p.id === d.partyId);
            const isExpanded = expandedJobId === d.id;
            
            let statusColor = 'bg-slate-100 text-slate-500';
            let statusText = d.status === DispatchStatus.LOADING ? 'RUNNING' : (d.status || 'PENDING');
            if(d.status === DispatchStatus.COMPLETED) { statusColor = 'bg-emerald-100 text-emerald-700'; }
            else if(d.status === DispatchStatus.DISPATCHED) { statusColor = 'bg-purple-100 text-purple-700'; }
            else if(d.status === DispatchStatus.LOADING) { statusColor = 'bg-amber-100 text-amber-700'; }

            return (
              <div key={d.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                 <div onClick={() => setExpandedJobId(isExpanded ? null : d.id)} className="p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div className="flex items-center gap-4">
                        <div className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded uppercase">{d.date}</div>
                        <h4 className="text-base font-bold text-slate-800 uppercase leading-tight">{party?.name}</h4>
                      </div>
                      <div className="flex items-center gap-3">
                         <div className="text-[10px] font-bold text-slate-400 uppercase hidden md:block">
                            {d.rows.length} Items • {formatWeight(d.totalWeight)} KG
                         </div>
                         <span className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${statusColor}`}>{statusText}</span>
                      </div>
                   </div>
                 </div>

                 {isExpanded && (
                   <div className="bg-slate-50 border-t border-slate-100 p-4">
                      {/* Desktop Table View for Expanded Items */}
                      <div className="hidden md:block">
                          <table className="w-full text-left text-sm mb-4">
                              <thead>
                                  <tr className="text-slate-400 text-[10px] font-bold uppercase border-b border-slate-200">
                                      <th className="pb-2 pl-2">Size</th>
                                      <th className="pb-2">Weight</th>
                                      <th className="pb-2">Pcs/Rolls</th>
                                      <th className="pb-2">Bundle</th>
                                      <th className="pb-2">Status</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                  {d.rows.map(row => {
                                      let rowStatusText = row.status === DispatchStatus.LOADING ? 'RUNNING' : (row.status || 'PENDING');
                                      let rowStatusColor = 'bg-white border-slate-200 text-slate-500';
                                      if(row.status === DispatchStatus.COMPLETED) rowStatusColor = 'bg-emerald-50 border-emerald-200 text-emerald-600';
                                      else if(row.status === DispatchStatus.DISPATCHED) rowStatusColor = 'bg-purple-50 border-purple-200 text-purple-600';
                                      else if(row.status === DispatchStatus.LOADING) rowStatusColor = 'bg-amber-50 border-amber-200 text-amber-600';

                                      return (
                                          <tr key={row.id} className="group hover:bg-white transition-colors">
                                              <td className="py-2 pl-2">
                                                  <input 
                                                      className="font-bold text-slate-800 uppercase bg-transparent outline-none w-32" 
                                                      value={row.size} 
                                                      onChange={(e) => handleRowUpdate(d, row.id, 'size', e.target.value)} 
                                                  />
                                              </td>
                                              <td className="py-2">
                                                  <input 
                                                      type="number" className="font-mono text-slate-600 bg-transparent outline-none w-20" 
                                                      defaultValue={row.weight}
                                                      onBlur={(e) => handleRowUpdate(d, row.id, 'weight', parseFloat(e.target.value))}
                                                  />
                                              </td>
                                              <td className="py-2">
                                                  <input 
                                                      type="number" className="font-mono text-slate-600 bg-transparent outline-none w-20" 
                                                      defaultValue={row.pcs}
                                                      onBlur={(e) => handleRowUpdate(d, row.id, 'pcs', parseFloat(e.target.value))}
                                                  />
                                              </td>
                                              <td className="py-2">
                                                  <input 
                                                      type="text" className="text-slate-600 bg-transparent outline-none w-20 uppercase" 
                                                      defaultValue={row.bundle}
                                                      onBlur={(e) => handleRowUpdate(d, row.id, 'bundle', e.target.value)}
                                                  />
                                              </td>
                                              <td className="py-2">
                                                  <button 
                                                    onClick={() => toggleRowStatus(d, row.id)}
                                                    className={`px-2 py-1 rounded border text-[9px] font-bold uppercase tracking-wide hover:brightness-95 ${rowStatusColor}`}
                                                  >
                                                      {rowStatusText}
                                                  </button>
                                              </td>
                                          </tr>
                                      )
                                  })}
                              </tbody>
                          </table>
                      </div>

                      {/* Mobile Card View for Expanded Items */}
                      <div className="md:hidden space-y-3">
                        {d.rows.map((row) => {
                             let rowStatusText = row.status === DispatchStatus.LOADING ? 'RUNNING' : (row.status || 'PENDING');
                             let rowStatusColor = 'bg-white border-slate-200 text-slate-500';
                             if(row.status === DispatchStatus.COMPLETED) rowStatusColor = 'bg-emerald-50 border-emerald-200 text-emerald-600';
                             else if(row.status === DispatchStatus.DISPATCHED) rowStatusColor = 'bg-purple-50 border-purple-200 text-purple-600';
                             else if(row.status === DispatchStatus.LOADING) rowStatusColor = 'bg-amber-50 border-amber-200 text-amber-600';
                             
                             return (
                               <div key={row.id} className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                                  <div className="flex justify-between items-start mb-2">
                                     <input 
                                       className="font-bold text-sm text-slate-800 uppercase bg-transparent outline-none border-b border-transparent focus:border-indigo-300 w-2/3"
                                       value={row.size}
                                       onChange={(e) => handleRowUpdate(d, row.id, 'size', e.target.value)}
                                     />
                                     <button 
                                       onClick={() => toggleRowStatus(d, row.id)}
                                       className={`px-2 py-1 rounded border text-[9px] font-bold uppercase tracking-wide ${rowStatusColor}`}
                                     >
                                        {rowStatusText}
                                     </button>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                     <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                                        <label className="text-[8px] font-bold text-slate-400 uppercase block">Wt</label>
                                        <input type="number" className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none" defaultValue={row.weight} onBlur={(e) => handleRowUpdate(d, row.id, 'weight', parseFloat(e.target.value))} />
                                     </div>
                                     <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                                        <label className="text-[8px] font-bold text-slate-400 uppercase block">{row.size.toLowerCase().includes('mm')?'Rol':'Pcs'}</label>
                                        <input type="number" className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none" defaultValue={row.pcs} onBlur={(e) => handleRowUpdate(d, row.id, 'pcs', parseFloat(e.target.value))} />
                                     </div>
                                     <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                                        <label className="text-[8px] font-bold text-slate-400 uppercase block">Pkg</label>
                                        <input type="text" className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none uppercase" defaultValue={row.bundle} onBlur={(e) => handleRowUpdate(d, row.id, 'bundle', e.target.value)} />
                                     </div>
                                  </div>
                               </div>
                             );
                          })}
                      </div>

                      <div className="flex justify-end pt-2 border-t border-slate-200 mt-2">
                          <button onClick={() => { if(confirm('Delete entire job?')) deleteDispatch(d.id) }} className="text-red-500 hover:text-red-700 text-xs font-bold uppercase px-4 py-2 hover:bg-red-50 rounded-lg transition-colors">Delete Job</button>
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