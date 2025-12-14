import React, { useState, useEffect } from 'react';
import { AppData, DispatchEntry, DispatchStatus, DispatchRow } from '../../types';
import { saveDispatch, deleteDispatch, ensurePartyExists } from '../../services/storageService';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

const SIZE_TYPES = ["", "INTAS", "OPEN", "ROUND", "ST.SEAL", "LABEL", "WINDER", "ROLL"];

export const DispatchManager: React.FC<Props> = ({ data, onUpdate }) => {
  const [activeDispatch, setActiveDispatch] = useState<Partial<DispatchEntry>>({
    date: new Date().toISOString().split('T')[0],
    dispatchNo: '',
    status: DispatchStatus.PENDING,
    rows: []
  });
  
  const [partyInput, setPartyInput] = useState('');
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);

  // Auto-gen Dispatch No
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

  const handleRowUpdate = (dispatch: Partial<DispatchEntry>, rowId: string, field: keyof DispatchRow, value: any) => {
      const newRows = dispatch.rows?.map(r => {
          if (r.id === rowId) {
              return { ...r, [field]: value };
          }
          return r;
      }) || [];
      
      // Recalculate totals
      const totalWeight = newRows.reduce((acc, r) => acc + (r.weight || 0), 0);
      const totalPcs = newRows.reduce((acc, r) => acc + (r.pcs || 0), 0);
      
      setActiveDispatch({ ...dispatch, rows: newRows, totalWeight, totalPcs });
  };

  const addRow = () => {
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
      setActiveDispatch(prev => ({ ...prev, rows: [newRow, ...(prev.rows || [])] }));
  };

  const deleteRow = (rowId: string) => {
      const newRows = activeDispatch.rows?.filter(r => r.id !== rowId) || [];
      const totalWeight = newRows.reduce((acc, r) => acc + (r.weight || 0), 0);
      const totalPcs = newRows.reduce((acc, r) => acc + (r.pcs || 0), 0);
      setActiveDispatch(prev => ({ ...prev, rows: newRows, totalWeight, totalPcs }));
  };

  const handleSave = async () => {
      if (!partyInput) return alert("Party Name Required");
      if (!activeDispatch.dispatchNo) return alert("Dispatch No Required");
      
      const partyId = await ensurePartyExists(data.parties, partyInput);
      
      const entry: DispatchEntry = {
          id: activeDispatch.id || `d-${Date.now()}`,
          dispatchNo: activeDispatch.dispatchNo,
          date: activeDispatch.date || new Date().toISOString().split('T')[0],
          partyId,
          status: activeDispatch.status || DispatchStatus.PENDING,
          rows: activeDispatch.rows || [],
          totalWeight: activeDispatch.totalWeight || 0,
          totalPcs: activeDispatch.totalPcs || 0,
          isTodayDispatch: true,
          createdAt: activeDispatch.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
      };
      
      await saveDispatch(entry);
      resetForm();
  };

  const resetForm = () => {
      setPartyInput('');
      setIsEditingId(null);
      setActiveDispatch({
        date: new Date().toISOString().split('T')[0],
        dispatchNo: '',
        status: DispatchStatus.PENDING,
        rows: []
      });
  };

  const handleEdit = (d: DispatchEntry) => {
      const party = data.parties.find(p => p.id === d.partyId);
      setPartyInput(party ? party.name : '');
      setActiveDispatch({ ...d });
      setIsEditingId(d.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredDispatches = data.dispatches.filter(d => {
      const party = data.parties.find(p => p.id === d.partyId);
      const pName = party?.name.toLowerCase() || '';
      const query = searchQuery.toLowerCase();
      return d.dispatchNo.includes(query) || pName.includes(query);
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Alias activeDispatch as 'd' for compatibility with previous snippets
  const d = activeDispatch;

  return (
      <div className="space-y-6">
          {/* Editor Section */}
          <div className={`bg-white rounded-2xl shadow-sm border ${isEditingId ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'} overflow-hidden transition-all`}>
              <div className={`px-6 py-4 flex justify-between items-center ${isEditingId ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                  <div className="flex items-center gap-3">
                      <span className="text-2xl">{isEditingId ? '✏️' : '🚛'}</span>
                      <h3 className="text-base font-bold text-white tracking-wide">
                          {isEditingId ? 'Edit Job Card' : 'New Job Card'}
                      </h3>
                  </div>
                  <div className="text-xs font-bold text-slate-300 bg-white/10 px-3 py-1 rounded-lg">
                      {d.rows?.length || 0} Items
                  </div>
              </div>

              <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Job No</label>
                          <input 
                              type="text" 
                              value={d.dispatchNo} 
                              onChange={e => setActiveDispatch({ ...d, dispatchNo: e.target.value })} 
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500"
                              placeholder="Auto"
                          />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Date</label>
                          <input 
                              type="date" 
                              value={d.date} 
                              onChange={e => setActiveDispatch({ ...d, date: e.target.value })} 
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500"
                          />
                      </div>
                      <div className="relative">
                          <label className="text-xs font-bold text-slate-700 block mb-1">Party Name</label>
                          <input 
                              type="text" 
                              value={partyInput}
                              onChange={e => { setPartyInput(e.target.value); setShowPartyDropdown(true); }}
                              onFocus={() => setShowPartyDropdown(true)}
                              onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500"
                              placeholder="Search..."
                          />
                          {showPartyDropdown && (
                              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto custom-scrollbar">
                                  {partySuggestions.map(p => (
                                      <div key={p.id} className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm border-b border-slate-50 last:border-0" onClick={() => { setPartyInput(p.name); setShowPartyDropdown(false); }}>
                                          <div className="font-bold text-slate-800">{p.name}</div>
                                          {p.code && <div className="text-[10px] font-bold text-indigo-600">{p.code}</div>}
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                      <div className="flex justify-between items-center p-3 border-b border-slate-200">
                           <h4 className="text-xs font-bold text-slate-500 uppercase">Items</h4>
                           <button onClick={addRow} className="text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 transition-colors shadow-sm">+ Add Item</button>
                      </div>
                      
                      {/* Desktop Table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap bg-white">
                            <thead className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                            <tr>
                                <th className="px-3 py-2 w-[20%]">Size</th>
                                <th className="px-2 py-2 w-[10%]">Type</th>
                                <th className="px-2 py-2 w-12 text-center">Mic</th>
                                <th className="px-2 py-2 text-right w-20">Wt</th>
                                <th className="px-2 py-2 text-right w-16">Pcs</th>
                                <th className="px-2 py-2 text-center w-16">Bdl</th>
                                <th className="px-2 py-2 w-[15%] text-center">Status</th>
                                <th className="px-2 py-2 w-10"></th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {d.rows?.map((row, idx) => (
                                    <tr key={row.id} className="hover:bg-slate-50">
                                        <td className="p-2"><input value={row.size} onChange={e => handleRowUpdate(d, row.id, 'size', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-bold" /></td>
                                        <td className="p-2">
                                            <select value={row.sizeType || ''} onChange={e => handleRowUpdate(d, row.id, 'sizeType', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-1 text-[10px] font-bold">
                                                {SIZE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-2"><input type="number" value={row.micron || ''} onChange={e => handleRowUpdate(d, row.id, 'micron', parseFloat(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-1 text-xs font-bold text-center" /></td>
                                        <td className="p-2"><input type="number" value={row.weight || ''} onChange={e => handleRowUpdate(d, row.id, 'weight', parseFloat(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-1 text-xs font-bold text-right" /></td>
                                        <td className="p-2"><input type="number" value={row.pcs || ''} onChange={e => handleRowUpdate(d, row.id, 'pcs', parseFloat(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-1 text-xs font-bold text-right" /></td>
                                        <td className="p-2"><input type="number" value={row.bundle || ''} onChange={e => handleRowUpdate(d, row.id, 'bundle', parseFloat(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-1 text-xs font-bold text-center" /></td>
                                        <td className="p-2">
                                            <select value={row.status || DispatchStatus.PENDING} onChange={e => handleRowUpdate(d, row.id, 'status', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-1 text-[10px] font-bold">
                                                {Object.values(DispatchStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-2 text-center"><button onClick={() => deleteRow(row.id)} className="text-red-400 hover:text-red-600 font-bold">×</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                      </div>

                      {/* Mobile Card List */}
                      <div className="block sm:hidden space-y-2 p-2">
                          {d.rows?.map((row) => (
                              <div key={row.id} className="bg-white border border-slate-200 rounded p-2 text-xs">
                                  <div className="flex justify-between mb-2">
                                      <input value={row.size} onChange={e => handleRowUpdate(d, row.id, 'size', e.target.value)} className="bg-slate-50 border border-slate-200 rounded px-2 py-1 font-bold w-[60%]" placeholder="Size" />
                                      <button onClick={() => deleteRow(row.id)} className="text-red-500 font-bold px-2">Delete</button>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 mb-2">
                                      <input type="number" placeholder="Wt" value={row.weight || ''} onChange={e => handleRowUpdate(d, row.id, 'weight', parseFloat(e.target.value))} className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-center" />
                                      <input type="number" placeholder="Pcs" value={row.pcs || ''} onChange={e => handleRowUpdate(d, row.id, 'pcs', parseFloat(e.target.value))} className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-center" />
                                      <input type="number" placeholder="Bundle" value={row.bundle || ''} onChange={e => handleRowUpdate(d, row.id, 'bundle', parseFloat(e.target.value))} className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-center" />
                                  </div>
                                  <select value={row.status || DispatchStatus.PENDING} onChange={e => handleRowUpdate(d, row.id, 'status', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 font-bold">
                                      {Object.values(DispatchStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                              </div>
                          ))}
                      </div>
                  </div>

                  <div className="flex gap-2">
                      {isEditingId && <button onClick={resetForm} className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>}
                      <button onClick={handleSave} className={`flex-[2] text-white font-bold py-3 rounded-xl shadow-lg transition-transform active:scale-[0.98] ${isEditingId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-900 hover:bg-black'}`}>
                          {isEditingId ? 'Update Job Card' : 'Create Job Card'}
                      </button>
                  </div>
              </div>
          </div>

          {/* List Section */}
          <div className="space-y-4">
              <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-slate-800">Recent Jobs</h3>
                  <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredDispatches.slice(0, 20).map(job => {
                      const party = data.parties.find(p => p.id === job.partyId);
                      const isExpanded = expandedId === job.id;
                      const statusColor = job.status === DispatchStatus.COMPLETED ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500';

                      return (
                          <div key={job.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
                              <div onClick={() => setExpandedId(isExpanded ? null : job.id)} className="p-4 cursor-pointer">
                                  <div className="flex justify-between items-start">
                                      <div>
                                          <div className="flex items-center gap-2 mb-1">
                                              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">#{job.dispatchNo}</span>
                                              <span className="text-[10px] font-bold text-slate-400">{job.date}</span>
                                          </div>
                                          <h4 className="text-sm font-bold text-slate-800">{party?.name || 'Unknown'}</h4>
                                      </div>
                                      <div className="text-right">
                                          <div className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${statusColor}`}>{job.status}</div>
                                          <div className="text-xs font-bold text-slate-600 mt-1">{job.totalWeight.toFixed(0)} kg</div>
                                      </div>
                                  </div>
                              </div>
                              {isExpanded && (
                                  <div className="bg-slate-50 border-t border-slate-100 p-3 animate-in slide-in-from-top-2">
                                      <div className="space-y-1 mb-3">
                                          {job.rows.map((r, i) => (
                                              <div key={i} className="flex justify-between text-[10px]">
                                                  <span className="font-bold text-slate-700">{r.size}</span>
                                                  <span className="font-mono text-slate-500">{r.weight}kg / {r.pcs}pcs</span>
                                              </div>
                                          ))}
                                      </div>
                                      <div className="flex justify-end gap-2">
                                          <button onClick={() => handleEdit(job)} className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded hover:bg-indigo-100">Edit</button>
                                          <button onClick={() => { if(confirm('Delete Job?')) deleteDispatch(job.id); }} className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded hover:bg-red-100">Delete</button>
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
