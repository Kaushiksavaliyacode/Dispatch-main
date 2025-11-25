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
  
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  // Filter State
  const [filterDate, setFilterDate] = useState('');
  const [filterParty, setFilterParty] = useState('');
  const [filterSize, setFilterSize] = useState('');

  // Computed Labels
  const qtyLabel = size.toLowerCase().includes('mm') ? 'Rolls' : 'Pcs';

  // --- Handlers ---

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
  };

  const handleSave = async () => {
    if (!partyName) return alert("Party Name is required");
    if (currentRows.length === 0) return alert("Add at least one item");

    const partyId = await ensurePartyExists(data.parties, partyName);

    const totalWeight = currentRows.reduce((acc, r) => acc + r.weight, 0);
    const totalPcs = currentRows.reduce((acc, r) => acc + r.pcs, 0);

    const entry: DispatchEntry = {
      id: `d-${Date.now()}`,
      dispatchNo: `JOB-${Math.floor(1000 + Math.random() * 9000)}`,
      date: date,
      partyId,
      status: DispatchStatus.PENDING,
      rows: currentRows,
      totalWeight,
      totalPcs,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await saveDispatch(entry);
    resetForm();
  };

  const toggleRowStatus = async (d: DispatchEntry, rowId: string) => {
    const updatedRows = d.rows.map(row => {
      if (row.id !== rowId) return row;
      let newStatus = row.status || DispatchStatus.PENDING;
      // Cycle: Pending -> Running (Loading) -> Completed -> Dispatched -> Pending
      if (newStatus === DispatchStatus.PENDING) newStatus = DispatchStatus.LOADING;
      else if (newStatus === DispatchStatus.LOADING) newStatus = DispatchStatus.COMPLETED;
      else if (newStatus === DispatchStatus.COMPLETED) newStatus = DispatchStatus.DISPATCHED;
      else newStatus = DispatchStatus.PENDING; 
      return { ...row, status: newStatus };
    });

    await updateJobStatus(d, updatedRows);
  };

  // Inline Edit Handler
  const handleRowUpdate = async (d: DispatchEntry, rowId: string, field: keyof DispatchRow, value: string) => {
    const updatedRows = d.rows.map(row => {
      if (row.id !== rowId) return row;
      
      let finalValue: any = value;
      if (field === 'weight' || field === 'pcs') {
         finalValue = parseFloat(value);
         if (isNaN(finalValue)) finalValue = 0;
      }
      return { ...row, [field]: finalValue };
    });

    await updateJobStatus(d, updatedRows);
  };

  const updateJobStatus = async (d: DispatchEntry, updatedRows: DispatchRow[]) => {
    const totalWeight = updatedRows.reduce((acc, r) => acc + r.weight, 0);
    const totalPcs = updatedRows.reduce((acc, r) => acc + r.pcs, 0);

    const allPending = updatedRows.every(r => r.status === DispatchStatus.PENDING);
    const allDispatched = updatedRows.every(r => r.status === DispatchStatus.DISPATCHED);
    const anyRunning = updatedRows.some(r => r.status === DispatchStatus.LOADING);
    
    let newJobStatus = DispatchStatus.PENDING;
    if (allDispatched) newJobStatus = DispatchStatus.DISPATCHED;
    else if (anyRunning) newJobStatus = DispatchStatus.LOADING;
    else if (!allPending) newJobStatus = DispatchStatus.COMPLETED; // Mixed but not running

    const updatedEntry = { 
      ...d, 
      rows: updatedRows, 
      status: newJobStatus,
      totalWeight,
      totalPcs
    };
    await saveDispatch(updatedEntry);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Permanently delete this job?')) {
      await deleteDispatch(id);
      if (expandedJobId === id) setExpandedJobId(null);
    }
  };

  const filteredDispatches = data.dispatches.filter(d => {
    const party = data.parties.find(p => p.id === d.partyId)?.name.toLowerCase() || '';
    const dateMatch = filterDate ? d.date === filterDate : true;
    const partyMatch = filterParty ? party.includes(filterParty.toLowerCase()) : true;
    const sizeMatch = filterSize ? d.rows.some(r => r.size.toLowerCase().includes(filterSize.toLowerCase())) : true;
    return dateMatch && partyMatch && sizeMatch;
  });

  return (
    <div className="space-y-6">
      
      {/* --- COMPACT JOB FORM --- */}
      <div className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden">
        <div className="bg-blue-600 px-4 py-3 flex justify-between items-center">
           <h2 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
             <span>🚛</span> New Job Entry
           </h2>
        </div>
        
        <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Party Name</label>
                  <input 
                    list="parties_job"
                    value={partyName} onChange={e => setPartyName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 uppercase"
                    placeholder="Select Party"
                  />
                  <datalist id="parties_job">{data.parties.map(p => <option key={p.id} value={p.name} />)}</datalist>
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Date</label>
                  <input 
                    type="date"
                    value={date} onChange={e => setDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
                  />
               </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <div className="grid grid-cols-4 gap-2 mb-3">
                 <div className="col-span-4 md:col-span-1">
                   <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Size</label>
                   <input 
                     placeholder="Item Size" 
                     value={size} onChange={e => setSize(e.target.value)}
                     className="w-full border border-slate-200 rounded px-2 py-2 text-sm font-medium outline-none focus:border-blue-500 uppercase" 
                   />
                 </div>
                 <div className="col-span-1">
                   <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Wt (.000)</label>
                   <input 
                     type="number" step="0.001" placeholder="0.000" 
                     value={weight} onChange={e => setWeight(e.target.value)}
                     className="w-full border border-slate-200 rounded px-2 py-2 text-sm font-medium outline-none focus:border-blue-500 text-center" 
                   />
                 </div>
                 <div className="col-span-1">
                   <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">{qtyLabel}</label>
                   <input 
                     type="number" placeholder="0" 
                     value={pcs} onChange={e => setPcs(e.target.value)}
                     className="w-full border border-slate-200 rounded px-2 py-2 text-sm font-medium outline-none focus:border-blue-500 text-center" 
                   />
                 </div>
                 <div className="col-span-2 md:col-span-1">
                   <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Bundle (📦)</label>
                   <input 
                     placeholder="Type" 
                     value={bundle} onChange={e => setBundle(e.target.value)}
                     className="w-full border border-slate-200 rounded px-2 py-2 text-sm font-medium outline-none focus:border-blue-500 text-center uppercase" 
                   />
                 </div>
              </div>
              <button 
                onClick={addRow}
                className="w-full bg-slate-800 text-white rounded-lg py-2.5 text-xs font-bold uppercase tracking-wide hover:bg-slate-700"
               >
                 + Add
               </button>

              {currentRows.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {currentRows.map((r, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 rounded px-3 py-2 shadow-sm">
                      <div className="text-xs">
                        <span className="font-bold text-slate-800 uppercase mr-2">{r.size}</span>
                        <span className="text-slate-500">{r.weight.toFixed(3)} kg • {r.pcs} {r.size.includes('mm')?'Rolls':'Pcs'} • {r.bundle}</span>
                      </div>
                      <button onClick={() => removeRow(idx)} className="text-slate-300 hover:text-red-500 font-bold px-2">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button 
              onClick={handleSave}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 text-sm uppercase tracking-wide"
            >
              Save Job
            </button>
        </div>
      </div>

      {/* --- SEARCH --- */}
      <div className="flex gap-2">
         <input 
           type="text" placeholder="Search Party..." 
           value={filterParty} onChange={e => setFilterParty(e.target.value)}
           className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none uppercase"
         />
         <input 
           type="date" 
           value={filterDate} onChange={e => setFilterDate(e.target.value)}
           className="w-1/3 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none"
         />
      </div>

      {/* --- ACTIVE JOBS --- */}
      <div className="space-y-4">
        {filteredDispatches.map(d => {
            const party = data.parties.find(p => p.id === d.partyId);
            const isExpanded = expandedJobId === d.id;
            
            // Status Logic
            let statusColor = 'bg-slate-100 text-slate-600 border-slate-200';
            let statusText = d.status === DispatchStatus.LOADING ? 'RUNNING' : (d.status || 'PENDING');
            if(d.status === DispatchStatus.COMPLETED) { statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200'; }
            else if(d.status === DispatchStatus.DISPATCHED) { statusColor = 'bg-purple-50 text-purple-700 border-purple-200'; }
            else if(d.status === DispatchStatus.LOADING) { statusColor = 'bg-amber-50 text-amber-700 border-amber-200'; }

            return (
              <div key={d.id} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                 
                 {/* Header */}
                 <div 
                   onClick={() => setExpandedJobId(isExpanded ? null : d.id)}
                   className="p-4 cursor-pointer hover:bg-slate-50 transition-colors flex justify-between items-center"
                 >
                   <div>
                      <h4 className="text-sm font-bold text-slate-800 uppercase">{party?.name}</h4>
                      <div className="text-[10px] font-semibold text-slate-400 mt-1 flex gap-2">
                         <span>{d.date}</span>
                         <span>•</span>
                         <span>{d.rows.length} Items</span>
                         <span>•</span>
                         <span>{d.totalWeight.toFixed(3)} kg</span>
                      </div>
                   </div>
                   <span className={`px-2 py-1 rounded text-[9px] font-bold border uppercase tracking-wider ${statusColor}`}>
                     {statusText}
                   </span>
                 </div>

                 {/* Editable Rows */}
                 {isExpanded && (
                   <div className="bg-slate-50 border-t border-slate-100 p-3 space-y-3">
                      {d.rows.map((row) => {
                           let rowStatusText = row.status === DispatchStatus.LOADING ? 'RUNNING' : (row.status || 'PENDING');
                           let rowColor = row.status === DispatchStatus.DISPATCHED ? 'border-purple-300 bg-purple-50/50' : 
                                          row.status === DispatchStatus.COMPLETED ? 'border-emerald-300 bg-emerald-50/50' :
                                          row.status === DispatchStatus.LOADING ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-white';
                           
                           return (
                             <div key={row.id} className={`rounded-lg border p-3 ${rowColor}`}>
                                <div className="flex justify-between items-start mb-2">
                                   {/* Editable Size */}
                                   <input 
                                     value={row.size}
                                     onChange={(e) => handleRowUpdate(d, row.id, 'size', e.target.value)}
                                     className="bg-transparent font-bold text-sm text-slate-800 uppercase w-2/3 outline-none focus:bg-white focus:ring-1 focus:ring-blue-200 rounded px-1"
                                     placeholder="Size"
                                   />
                                   <button 
                                     onClick={() => toggleRowStatus(d, row.id)}
                                     className="text-[9px] font-bold uppercase px-2 py-1 bg-white border border-slate-200 rounded hover:bg-slate-100 shadow-sm"
                                   >
                                     {rowStatusText} ↻
                                   </button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                   <div>
                                     <label className="text-[8px] font-bold text-slate-400 uppercase block">Weight</label>
                                     <input 
                                        type="number" step="0.001"
                                        value={row.weight}
                                        onChange={(e) => handleRowUpdate(d, row.id, 'weight', e.target.value)}
                                        onBlur={(e) => handleRowUpdate(d, row.id, 'weight', parseFloat(e.target.value).toFixed(3))}
                                        className="w-full bg-transparent border-b border-slate-300 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 py-0.5"
                                     />
                                   </div>
                                   <div>
                                     <label className="text-[8px] font-bold text-slate-400 uppercase block">{row.size.includes('mm') ? 'Rolls' : 'Pcs'}</label>
                                     <input 
                                        type="number"
                                        value={row.pcs}
                                        onChange={(e) => handleRowUpdate(d, row.id, 'pcs', e.target.value)}
                                        className="w-full bg-transparent border-b border-slate-300 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 py-0.5"
                                     />
                                   </div>
                                   <div>
                                     <label className="text-[8px] font-bold text-slate-400 uppercase block">Bundle</label>
                                     <input 
                                        value={row.bundle}
                                        onChange={(e) => handleRowUpdate(d, row.id, 'bundle', e.target.value)}
                                        className="w-full bg-transparent border-b border-slate-300 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 py-0.5 uppercase"
                                     />
                                   </div>
                                </div>
                             </div>
                           );
                      })}
                      <div className="flex justify-end pt-2">
                        <button onClick={() => handleDelete(d.id)} className="text-red-500 text-[10px] font-bold uppercase hover:bg-red-50 px-3 py-1.5 rounded">
                          Delete Job
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