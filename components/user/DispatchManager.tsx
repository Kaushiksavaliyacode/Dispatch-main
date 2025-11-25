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

    // Async party check
    const partyId = await ensurePartyExists(data.parties, partyName);

    const totalWeight = currentRows.reduce((acc, r) => acc + r.weight, 0);
    const totalPcs = currentRows.reduce((acc, r) => acc + r.pcs, 0);

    // Calculate initial aggregate status
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
    
    // Save to Firebase
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
    // 1. Update the specific row
    const updatedRows = d.rows.map(row => {
      if (row.id !== rowId) return row;
      
      let newStatus = row.status || DispatchStatus.PENDING;
      if (newStatus === DispatchStatus.PENDING) newStatus = DispatchStatus.LOADING;
      else if (newStatus === DispatchStatus.LOADING) newStatus = DispatchStatus.COMPLETED;
      else if (newStatus === DispatchStatus.COMPLETED) newStatus = DispatchStatus.DISPATCHED;
      else newStatus = DispatchStatus.PENDING; // Cycle

      return { ...row, status: newStatus };
    });

    // 2. Recalculate Job Status
    const allPending = updatedRows.every(r => r.status === DispatchStatus.PENDING);
    const allDispatched = updatedRows.every(r => r.status === DispatchStatus.DISPATCHED);
    const allCompleted = updatedRows.every(r => r.status === DispatchStatus.COMPLETED || r.status === DispatchStatus.DISPATCHED);
    
    let newJobStatus = DispatchStatus.LOADING;
    if (allPending) newJobStatus = DispatchStatus.PENDING;
    else if (allDispatched) newJobStatus = DispatchStatus.DISPATCHED;
    else if (allCompleted) newJobStatus = DispatchStatus.COMPLETED;

    const updatedEntry = { ...d, rows: updatedRows, status: newJobStatus };
    
    // Save Update to Firebase
    await saveDispatch(updatedEntry);
  };

  const toggleExpand = (id: string) => {
    setExpandedJobId(expandedJobId === id ? null : id);
  };

  // Helper for bundle string like "23 📦 Box"
  const getBundleSummary = (rows: DispatchRow[]) => {
    const counts: Record<string, number> = {};
    rows.forEach(r => {
      const key = r.bundle || 'Other';
      counts[key] = (counts[key] || 0) + (r.pcs || 0); // Sum pcs per bundle type, or just count? Prompt said "23 📦"
      // Assuming user enters total PCS for the row. If "bundle" is just a label, we might just sum occurrences or use PCS.
      // Let's use PCS count as quantity associated with that package type.
    });
    return Object.entries(counts)
      .map(([type, count]) => `${count} 📦 ${type}`)
      .join(', ');
  };

  // --- Filtering ---
  
  const filteredDispatches = data.dispatches.filter(d => {
    const party = data.parties.find(p => p.id === d.partyId)?.name.toLowerCase() || '';
    const dateMatch = filterDate ? d.date === filterDate : true;
    const partyMatch = filterParty ? party.includes(filterParty.toLowerCase()) : true;
    const sizeMatch = filterSize ? d.rows.some(r => r.size.toLowerCase().includes(filterSize.toLowerCase())) : true;
    return dateMatch && partyMatch && sizeMatch;
  });

  return (
    <div className="space-y-6">
      
      {/* --- Job Entry Form --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             </div>
             <h2 className="text-sm font-extrabold text-slate-800 tracking-wide uppercase">{isEditingId ? 'Edit Job' : 'New Job Entry'}</h2>
          </div>
          <div className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded border border-blue-100 uppercase">
             Logistics
          </div>
        </div>

        <div className="space-y-4">
          {/* Header Fields */}
          <div className="flex flex-col md:flex-row gap-4">
             <div className="w-full md:w-1/3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Date</label>
                <input 
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-semibold rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 transition-all appearance-none"
                />
             </div>
             <div className="w-full md:w-2/3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Party</label>
                <input 
                  type="text" 
                  list="parties_job"
                  placeholder="Select Party"
                  value={partyName}
                  onChange={e => setPartyName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-semibold rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 transition-all placeholder-slate-400"
                />
                <datalist id="parties_job">
                  {data.parties.map(p => <option key={p.id} value={p.name} />)}
                </datalist>
             </div>
          </div>

          {/* Row Input Section */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-4">
                 <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Size</label>
                 <input 
                   placeholder="e.g. 500mm" 
                   value={size} onChange={e => setSize(e.target.value)}
                   className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-blue-500" 
                 />
              </div>
              <div className="col-span-2">
                 <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Wt</label>
                 <input 
                   type="number" placeholder="0.0" 
                   value={weight} onChange={e => setWeight(e.target.value)}
                   className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-blue-500 text-center" 
                 />
              </div>
              <div className="col-span-2">
                 <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Pcs</label>
                 <input 
                   type="number" placeholder="0" 
                   value={pcs} onChange={e => setPcs(e.target.value)}
                   className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-blue-500 text-center" 
                 />
              </div>
              <div className="col-span-2">
                 <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">📦</label>
                 <input 
                   type="text" placeholder="Box" 
                   value={bundle} onChange={e => setBundle(e.target.value)}
                   className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-blue-500 text-center" 
                 />
              </div>
              <div className="col-span-2">
                 <button 
                  onClick={addRow}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-xs font-bold transition-colors"
                 >
                   Add +
                 </button>
              </div>
            </div>

            {/* Added Rows Preview */}
            {currentRows.length > 0 && (
              <div className="mt-3 space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                {currentRows.map((r, idx) => (
                  <div key={idx} className="flex items-center text-[11px] bg-white border border-slate-100 rounded px-2 py-1.5">
                    <span className="w-1/3 font-medium text-slate-700 truncate">{r.size}</span>
                    <span className="w-1/6 text-center text-slate-500">{r.weight}kg</span>
                    <span className="w-1/6 text-center text-slate-500">{r.pcs}pcs</span>
                    <span className="w-1/6 text-center text-slate-500">📦 {r.bundle}</span>
                    <button onClick={() => removeRow(idx)} className="w-1/6 text-right text-red-400 hover:text-red-600 font-bold">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button 
            onClick={handleSave}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] transition-all text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/20 text-sm uppercase tracking-wide flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
            {isEditingId ? 'Update Job' : 'Save Job'}
          </button>
        </div>
      </div>

      {/* --- Filter Bar --- */}
      <div className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 flex-1 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
           <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
           <input 
             type="date" 
             value={filterDate}
             onChange={e => setFilterDate(e.target.value)}
             className="bg-transparent text-xs font-semibold text-slate-600 outline-none w-full"
           />
           {filterDate && <button onClick={() => setFilterDate('')} className="text-slate-400 hover:text-red-500">×</button>}
        </div>
        <div className="flex items-center gap-2 flex-1 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
           <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
           <input 
             type="text" 
             placeholder="Filter Party..." 
             value={filterParty}
             onChange={e => setFilterParty(e.target.value)}
             className="bg-transparent text-xs font-semibold text-slate-600 outline-none w-full placeholder-slate-400"
           />
        </div>
        <div className="flex items-center gap-2 flex-1 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
           <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
           <input 
             type="text" 
             placeholder="Filter Size..." 
             value={filterSize}
             onChange={e => setFilterSize(e.target.value)}
             className="bg-transparent text-xs font-semibold text-slate-600 outline-none w-full placeholder-slate-400"
           />
        </div>
      </div>

      {/* --- Active Jobs Table --- */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
           <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active Jobs</h3>
           <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{filteredDispatches.length} Entries</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Party Name</th>
                <th className="px-4 py-3">Items (Size)</th>
                <th className="px-4 py-3 text-center">Wt</th>
                <th className="px-4 py-3 text-center">Pcs</th>
                <th className="px-4 py-3 text-center">📦 Summary</th>
                <th className="px-4 py-3 text-center">Job Status</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredDispatches.map(d => {
                const party = data.parties.find(p => p.id === d.partyId);
                const isExpanded = expandedJobId === d.id;
                const bundleSummary = getBundleSummary(d.rows);

                return (
                  <React.Fragment key={d.id}>
                    {/* Main Summary Row - Clickable */}
                    <tr 
                      onClick={() => toggleExpand(d.id)}
                      className={`transition-colors cursor-pointer group ${isExpanded ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-4 py-3 text-xs font-medium text-slate-500 whitespace-nowrap">{d.date}</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-800">{party?.name}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 font-mono max-w-[150px] truncate" title={d.rows.map(r => r.size).join(', ')}>
                        {d.rows.map(r => r.size).join(', ')}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 text-center font-bold">{d.totalWeight.toFixed(3)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 text-center">{d.totalPcs}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 text-center truncate max-w-[100px]" title={bundleSummary}>
                         <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold">{bundleSummary}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase whitespace-nowrap
                          ${d.status === DispatchStatus.COMPLETED ? 'bg-emerald-100 text-emerald-600' : 
                            d.status === DispatchStatus.DISPATCHED ? 'bg-purple-100 text-purple-600' :
                            d.status === DispatchStatus.LOADING ? 'bg-amber-100 text-amber-600' :
                            'bg-blue-50 text-blue-500'}`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center flex items-center justify-center gap-2">
                         {/* Edit Button */}
                         <button 
                            onClick={(e) => { e.stopPropagation(); handleEdit(d); }}
                            className="text-slate-300 hover:text-blue-500"
                            title="Edit"
                         >
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                         </button>
                         {/* Delete Button */}
                         <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }}
                            className="text-slate-300 hover:text-red-500"
                            title="Delete"
                         >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                         </button>
                      </td>
                    </tr>

                    {/* Expanded Details Row */}
                    {isExpanded && (
                      <tr className="bg-slate-50/50 animate-in fade-in duration-200">
                        <td colSpan={8} className="p-0 border-b border-slate-200">
                          <div className="p-4 shadow-inner">
                            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                                  <tr>
                                    <th className="px-4 py-2">Size / Description</th>
                                    <th className="px-4 py-2 text-center">Weight</th>
                                    <th className="px-4 py-2 text-center">Pcs</th>
                                    <th className="px-4 py-2 text-center">📦 Type</th>
                                    <th className="px-4 py-2 text-center">Item Status</th>
                                    <th className="px-4 py-2 text-center">Toggle</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {d.rows.map((row, idx) => (
                                    <tr key={idx}>
                                      <td className="px-4 py-2 font-medium text-slate-700">{row.size}</td>
                                      <td className="px-4 py-2 text-center text-slate-600">{row.weight}</td>
                                      <td className="px-4 py-2 text-center text-slate-600">{row.pcs}</td>
                                      <td className="px-4 py-2 text-center text-slate-600">{row.bundle}</td>
                                      <td className="px-4 py-2 text-center">
                                        <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase
                                           ${row.status === DispatchStatus.DISPATCHED ? 'bg-purple-100 text-purple-700' :
                                             row.status === DispatchStatus.COMPLETED ? 'bg-emerald-100 text-emerald-700' :
                                             row.status === DispatchStatus.LOADING ? 'bg-amber-100 text-amber-700' :
                                             'bg-slate-100 text-slate-500'}`}>
                                           {row.status || DispatchStatus.PENDING}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 text-center">
                                         <button 
                                           onClick={(e) => { e.stopPropagation(); toggleRowStatus(d, row.id); }}
                                           title="Advance Item Status"
                                           className="w-6 h-6 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-colors mx-auto"
                                         >
                                           <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                                         </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="bg-slate-50 border-t border-slate-100">
                                  <tr>
                                    <td colSpan={6} className="px-4 py-3 text-right space-x-3">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleEdit(d); }}
                                        className="text-blue-600 font-bold hover:underline text-[11px]"
                                      >
                                        Edit Job Details
                                      </button>
                                      <span className="text-slate-300">|</span>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }}
                                        className="text-red-500 font-bold hover:underline text-[11px]"
                                      >
                                        Delete Job
                                      </button>
                                    </td>
                                  </tr>
                                </tfoot>
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
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-xs text-slate-400 italic">No jobs found matching filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};