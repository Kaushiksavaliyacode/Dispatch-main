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
  const [filterSize, setFilterSize] = useState('');

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
    // Clear inputs but keep Size for faster entry
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

  // --- Action Handlers ---

  const handleEdit = (d: DispatchEntry) => {
    const party = data.parties.find(p => p.id === d.partyId);
    setPartyName(party?.name || '');
    setDate(d.date);
    setCurrentRows(d.rows);
    setIsEditingId(d.id);
    setExpandedJobId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this job permanently?')) {
      await deleteDispatch(id);
      if (expandedJobId === id) setExpandedJobId(null);
    }
  };

  const toggleRowStatus = async (d: DispatchEntry, rowId: string) => {
    const updatedRows = d.rows.map(row => {
      if (row.id !== rowId) return row;
      
      let newStatus = row.status || DispatchStatus.PENDING;
      if (newStatus === DispatchStatus.PENDING) newStatus = DispatchStatus.LOADING;
      else if (newStatus === DispatchStatus.LOADING) newStatus = DispatchStatus.COMPLETED;
      else if (newStatus === DispatchStatus.COMPLETED) newStatus = DispatchStatus.DISPATCHED;
      else newStatus = DispatchStatus.PENDING; // Cycle

      return { ...row, status: newStatus };
    });

    const allPending = updatedRows.every(r => r.status === DispatchStatus.PENDING);
    const allDispatched = updatedRows.every(r => r.status === DispatchStatus.DISPATCHED);
    const allCompleted = updatedRows.every(r => r.status === DispatchStatus.COMPLETED || r.status === DispatchStatus.DISPATCHED);
    
    let newJobStatus = DispatchStatus.LOADING;
    if (allPending) newJobStatus = DispatchStatus.PENDING;
    else if (allDispatched) newJobStatus = DispatchStatus.DISPATCHED;
    else if (allCompleted) newJobStatus = DispatchStatus.COMPLETED;

    const updatedEntry = { ...d, rows: updatedRows, status: newJobStatus };
    await saveDispatch(updatedEntry);
  };

  const toggleExpand = (id: string) => {
    setExpandedJobId(expandedJobId === id ? null : id);
  };

  const getBundleSummary = (rows: DispatchRow[]) => {
    const counts: Record<string, number> = {};
    rows.forEach(r => {
      const key = r.bundle || 'Other';
      counts[key] = (counts[key] || 0) + (r.pcs || 0);
    });
    return Object.entries(counts)
      .map(([type, count]) => `${count} 📦 ${type}`)
      .join(', ');
  };

  const filteredDispatches = data.dispatches.filter(d => {
    const party = data.parties.find(p => p.id === d.partyId)?.name.toLowerCase() || '';
    const dateMatch = filterDate ? d.date === filterDate : true;
    const partyMatch = filterParty ? party.includes(filterParty.toLowerCase()) : true;
    const sizeMatch = filterSize ? d.rows.some(r => r.size.toLowerCase().includes(filterSize.toLowerCase())) : true;
    return dateMatch && partyMatch && sizeMatch;
  });

  return (
    <div className="space-y-8 pb-10">
      
      {/* --- BIG JOB ENTRY FORM --- */}
      <div className="bg-blue-600 rounded-3xl shadow-xl p-1 text-white">
        <div className="bg-white rounded-[20px] p-5 md:p-8 text-slate-800">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <span className="text-3xl">🚛</span>
              {isEditingId ? 'Edit Job' : 'New Job Entry'}
            </h2>
          </div>

          <div className="space-y-6">
            {/* Header Fields - Large */}
            <div className="flex flex-col gap-4">
               <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Party Name</label>
                  <input 
                    type="text" 
                    list="parties_job"
                    placeholder="SELECT PARTY"
                    value={partyName}
                    onChange={e => setPartyName(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-200 text-slate-900 font-bold rounded-xl px-4 py-4 text-lg outline-none focus:border-blue-600 transition-all placeholder-slate-300 uppercase"
                  />
                  <datalist id="parties_job">
                    {data.parties.map(p => <option key={p.id} value={p.name} />)}
                  </datalist>
               </div>
               <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Date</label>
                  <input 
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-200 text-slate-900 font-bold rounded-xl px-4 py-4 text-lg outline-none focus:border-blue-600 transition-all"
                  />
               </div>
            </div>

            {/* Row Input Section - High Vis */}
            <div className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-100">
              <div className="grid grid-cols-2 gap-3 mb-3">
                 <div className="col-span-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Size Description</label>
                   <input 
                     placeholder="SIZE / ITEM" 
                     value={size} onChange={e => setSize(e.target.value)}
                     className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-3 text-base font-bold outline-none focus:border-blue-600 uppercase" 
                   />
                 </div>
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Weight</label>
                   <input 
                     type="number" placeholder="0.0" 
                     value={weight} onChange={e => setWeight(e.target.value)}
                     className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-3 text-base font-bold outline-none focus:border-blue-600 text-center" 
                   />
                 </div>
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Pcs</label>
                   <input 
                     type="number" placeholder="0" 
                     value={pcs} onChange={e => setPcs(e.target.value)}
                     className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-3 text-base font-bold outline-none focus:border-blue-600 text-center" 
                   />
                 </div>
                 <div className="col-span-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Bundle Type (📦)</label>
                   <input 
                     type="text" placeholder="BOX / ROLL / BUNDLE" 
                     value={bundle} onChange={e => setBundle(e.target.value)}
                     className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-3 text-base font-bold outline-none focus:border-blue-600 text-center uppercase" 
                   />
                 </div>
              </div>
              <button 
                onClick={addRow}
                className="w-full bg-slate-800 hover:bg-black text-white rounded-xl py-4 text-sm font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
               >
                 + Add Item Row
               </button>

              {/* Added Rows Preview */}
              {currentRows.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase px-2">
                    <span>Item</span>
                    <span>Status</span>
                  </div>
                  {currentRows.map((r, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white border-2 border-green-100 rounded-xl px-3 py-3 shadow-sm">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-800 text-sm uppercase">{r.size}</span>
                        <span className="text-[10px] font-bold text-slate-400">{r.weight}kg • {r.pcs}pcs • {r.bundle}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white shadow-md shadow-green-200">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <button onClick={() => removeRow(idx)} className="w-8 h-8 bg-slate-100 rounded-full text-slate-400 hover:bg-red-100 hover:text-red-500 flex items-center justify-center font-bold text-lg">×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button 
              onClick={handleSave}
              className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-500/30 text-lg uppercase tracking-wider flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              {isEditingId ? 'Update Job Entry' : 'Save Job Entry'}
            </button>
          </div>
        </div>
      </div>

      {/* --- FILTER BAR --- */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-3">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Search Active Jobs</h3>
        <div className="flex flex-col gap-3">
           <input 
             type="date" 
             value={filterDate}
             onChange={e => setFilterDate(e.target.value)}
             className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-600 outline-none focus:border-blue-500"
           />
           <input 
             type="text" 
             placeholder="SEARCH PARTY..." 
             value={filterParty}
             onChange={e => setFilterParty(e.target.value)}
             className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-600 outline-none focus:border-blue-500 uppercase"
           />
        </div>
      </div>

      {/* --- ACTIVE JOBS LIST (REDESIGNED) --- */}
      <div className="space-y-6">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest px-1">Active Jobs List ({filteredDispatches.length})</h3>
        
        {filteredDispatches.map(d => {
            const party = data.parties.find(p => p.id === d.partyId);
            const isExpanded = expandedJobId === d.id;
            
            // Status Color Logic
            let statusColor = 'bg-slate-100 text-slate-500';
            let statusText = d.status || 'PENDING';
            if(d.status === DispatchStatus.COMPLETED) { statusColor = 'bg-emerald-100 text-emerald-700'; }
            else if(d.status === DispatchStatus.DISPATCHED) { statusColor = 'bg-purple-100 text-purple-700'; }
            else if(d.status === DispatchStatus.LOADING) { statusColor = 'bg-amber-100 text-amber-700'; }

            return (
              <div key={d.id} className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden transition-all duration-300">
                 
                 {/* --- HEADER CARD (TOP) --- */}
                 <div 
                   onClick={() => toggleExpand(d.id)}
                   className="p-5 bg-slate-50 border-b border-slate-200 cursor-pointer active:bg-slate-100"
                 >
                   <div className="flex justify-between items-start mb-1">
                      <div>
                        <span className="text-xs font-bold text-slate-500 uppercase block mb-1">📅 {d.date}</span>
                        <h4 className="text-2xl font-black text-slate-900 uppercase leading-none tracking-tight">{party?.name}</h4>
                      </div>
                      <span className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm ${statusColor}`}>
                        {statusText}
                      </span>
                   </div>
                   {!isExpanded && (
                      <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wide">
                         <span>{d.rows.length} Items</span>
                         <span>•</span>
                         <span>{d.totalWeight.toFixed(1)} KG</span>
                         <span className="ml-auto text-blue-600">Tap to View Details ↓</span>
                      </div>
                   )}
                 </div>

                 {/* --- EXPANDED DETAILS (SEPARATE BLOCKS) --- */}
                 {isExpanded && (
                   <div className="bg-white p-5 animate-in slide-in-from-top-4 duration-300">
                      <div className="space-y-6">
                        {d.rows.map((row) => {
                           // Row Status Styling
                           let rowStatusColor = 'bg-slate-100 text-slate-500';
                           if(row.status === DispatchStatus.COMPLETED) rowStatusColor = 'bg-emerald-50 text-emerald-600 border-emerald-100';
                           else if(row.status === DispatchStatus.DISPATCHED) rowStatusColor = 'bg-purple-50 text-purple-600 border-purple-100';
                           else if(row.status === DispatchStatus.LOADING) rowStatusColor = 'bg-amber-50 text-amber-600 border-amber-100';
                           
                           return (
                             <div key={row.id} className="relative pb-6 border-b border-slate-100 last:border-0 last:pb-0">
                                {/* Top Row: Size & Status */}
                                <div className="flex justify-between items-start mb-3">
                                   <div className="font-black text-lg text-slate-800 uppercase tracking-tight w-2/3 leading-tight">
                                      {row.size}
                                   </div>
                                   <div className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wide ${rowStatusColor}`}>
                                      {row.status || 'PENDING'}
                                   </div>
                                </div>

                                {/* Data Grid */}
                                <div className="grid grid-cols-3 gap-4 mb-4">
                                   <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                                      <span className="text-[9px] font-black text-slate-400 uppercase block mb-0.5">Weight</span>
                                      <span className="text-sm font-bold text-slate-800">{row.weight}</span>
                                   </div>
                                   <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                                      <span className="text-[9px] font-black text-slate-400 uppercase block mb-0.5">Pcs</span>
                                      <span className="text-sm font-bold text-slate-800">{row.pcs}</span>
                                   </div>
                                   <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                                      <span className="text-[9px] font-black text-slate-400 uppercase block mb-0.5">Bundle</span>
                                      <span className="text-sm font-bold text-slate-800">📦 {row.bundle}</span>
                                   </div>
                                </div>

                                {/* Row Action */}
                                <button 
                                  onClick={(e) => { e.stopPropagation(); toggleRowStatus(d, row.id); }}
                                  className="w-full py-3 rounded-xl bg-blue-50 text-blue-600 font-bold text-xs uppercase hover:bg-blue-100 transition-colors border border-blue-100"
                                >
                                  Cycle Status ↻
                                </button>
                             </div>
                           );
                        })}
                      </div>

                      {/* --- FIXED BOTTOM ACTION BAR (IN CARD) --- */}
                      <div className="mt-8 pt-4 border-t-2 border-slate-100 flex gap-3">
                         <button 
                           onClick={(e) => { e.stopPropagation(); handleEdit(d); }}
                           className="flex-1 bg-slate-800 hover:bg-black text-white py-4 rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                         >
                           Edit Job
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }}
                           className="flex-1 bg-red-100 hover:bg-red-200 text-red-600 py-4 rounded-2xl text-sm font-black uppercase tracking-widest active:scale-95 transition-all"
                         >
                           Delete
                         </button>
                      </div>
                   </div>
                 )}
              </div>
            );
        })}
        
        {filteredDispatches.length === 0 && (
           <div className="text-center py-10 text-slate-400 font-bold bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 uppercase tracking-widest">
             No Active Jobs Found
           </div>
        )}
      </div>
    </div>
  );
};