
import React, { useState, useMemo } from 'react';
import { AppData, DispatchStatus, PaymentMode, Party, Challan, PartyRate } from '../../types';
import { deleteDispatch, deleteChallan, saveChallan, saveParty, deleteParty, updateParty } from '../../services/storageService';
import { Trash2, Plus, X, Edit2, DollarSign } from 'lucide-react';

interface Props {
  data: AppData;
}

const PARTY_SEED_DATA = [
  { code: "REL/001", name: "FINE TECH PRINT WORLD" },
  { code: "REL/002", name: "M K SHRINK LABEL & LAMINATOR" },
  { code: "REL/003", name: "POLY PAPER CONVERTOR" },
  { code: "REL/004", name: "COMMERCIAL PRINT PACK" },
  { code: "REL/005", name: "VEERKRUPA PACKAGING" },
  { code: "REL/006", name: "MAKERS POLYSHRINK" },
  { code: "REL/007", name: "D K GLOBAL ENTERPRISE PVT LTD" },
  { code: "REL/008", name: "Ajay Traders" },
  { code: "REL/009", name: "Shyam Poly Pack - Odhav" },
  { code: "REL/010", name: "Consol Flexibles Pvt Ltd - Padra" },
  { code: "REL/011", name: "Krupa Packaging Industries - Aslali" },
  { code: "REL/012", name: "Radhe Labels - Ankleshwar" },
  { code: "REL/013", name: "Sterling Tapes Ltd. - Gandhidham" },
  { code: "REL/014", name: "Hempra Multi Prints Pvt Ltd - Pune" },
  { code: "REL/015", name: "Tirth Print Pack (P) Ltd - Shapar" },
  { code: "REL/016", name: "Secure Polymers Pvt Ltd - Shapar" },
  { code: "REL/017", name: "Prime Poly Film" },
  { code: "REL/018", name: "Sterling Tapes Ltd. - Belgaum" },
  { code: "REL/019", name: "GNS Print - Asangaon" },
  { code: "REL/020", name: "Shree PolyShrink - Rajkot" },
  { code: "REL/021", name: "Tanvika Polymers Pvt Ltd" },
  { code: "REL/022", name: "Baldha Enterprise Pvt Ltd" },
  { code: "REL/023", name: "Kansuee Industries Pvt Ltd - Changodar" },
  { code: "REL/024", name: "Parthsarthi Polymers - Santej" },
  { code: "REL/025", name: "D K Global Enterprise Pvt Ltd - Padra" },
  { code: "REL/026", name: "Phoenix Label - Surat" },
  { code: "REL/027", name: "Asia Chem Pvt Ltd - Nepal" },
  { code: "REL/028", name: "Ajit Industries West Pvt Ltd - Gandhidham" },
  { code: "REL/029", name: "Vikas Party - Surat" },
  { code: "REL/030", name: "Om Sai Process - Pune" },
  { code: "REL/031", name: "Hindustan Labels - Nashik" }
];

export const PartyDashboard: React.FC<Props> = ({ data }) => {
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [directoryTab, setDirectoryTab] = useState<'production' | 'billing' | 'manage'>('billing');
  const [filterDate, setFilterDate] = useState('');
  const [expandedChallanId, setExpandedChallanId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  // Fix: Add missing viewMode state for party detail view
  const [viewMode, setViewMode] = useState<'jobs' | 'bills'>('jobs');

  // Manage State
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null);
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyCode, setNewPartyCode] = useState('');
  
  // Rate Editing State
  const [tempRates, setTempRates] = useState<PartyRate[]>([]);
  const [newRateType, setNewRateType] = useState('');
  const [newRateValue, setNewRateValue] = useState('');

  const formatDateNoYear = (dateStr: string) => {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}`;
  };

  const handleSeedParties = async () => {
      if(!confirm(`Import ${PARTY_SEED_DATA.length} legacy parties to the database?`)) return;
      setIsImporting(true);
      let addedCount = 0;
      for (const p of PARTY_SEED_DATA) {
          const exists = data.parties.some(existing => (existing.code === p.code) || (existing.name.toLowerCase() === p.name.toLowerCase()));
          if (!exists) {
              const id = `p-${Date.now()}-${addedCount}`;
              await saveParty({ id, name: p.name, code: p.code, contact: '', address: '', baseRates: [] });
              addedCount++;
          }
      }
      setIsImporting(false);
      alert(`Import Complete! Added ${addedCount} parties.`);
  };

  const partyStats = useMemo(() => {
    return data.parties.map(party => {
      const pDispatches = data.dispatches.filter(d => d.partyId === party.id);
      const pChallans = data.challans.filter(c => c.partyId === party.id);
      const totalRevenue = pChallans.reduce((sum, c) => sum + c.totalAmount, 0);
      const totalOutstanding = pChallans.filter(c => c.paymentMode === PaymentMode.UNPAID).reduce((sum, c) => sum + c.totalAmount, 0);
      const totalWeight = pDispatches.reduce((sum, d) => sum + d.totalWeight, 0);
      return {
        ...party,
        jobCount: pDispatches.length,
        challanCount: pChallans.length,
        totalRevenue,
        totalOutstanding,
        totalWeight,
        lastJobDate: pDispatches.length > 0 ? pDispatches[0].date : null,
        lastBillDate: pChallans.length > 0 ? pChallans[0].date : null
      };
    }).sort((a, b) => b.totalOutstanding - a.totalOutstanding); 
  }, [data]);

  const filteredParties = useMemo(() => {
    return partyStats.filter(p => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = p.name.toLowerCase().includes(searchLower) || (p.code && p.code.toLowerCase().includes(searchLower));
      if (directoryTab === 'manage') return matchesSearch;
      let matchesTab = directoryTab === 'production' ? p.jobCount > 0 : p.challanCount > 0;
      return matchesSearch && (searchTerm ? true : matchesTab);
    });
  }, [partyStats, searchTerm, directoryTab]);

  const selectedParty = useMemo(() => partyStats.find(p => p.id === selectedPartyId), [partyStats, selectedPartyId]);

  const partyJobs = useMemo(() => {
    if (!selectedPartyId) return [];
    return data.dispatches.filter(d => d.partyId === selectedPartyId)
      .flatMap(d => d.rows.map((r, idx) => ({ ...r, uniqueId: `${d.id}_${idx}`, dispatchNo: d.dispatchNo, date: d.date })))
      .filter(item => (item.dispatchNo.toLowerCase().includes(searchTerm.toLowerCase()) || item.size.toLowerCase().includes(searchTerm.toLowerCase())) && (filterDate ? item.date === filterDate : true))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.dispatches, selectedPartyId, searchTerm, filterDate]);

  const partyChallans = useMemo(() => {
    if (!selectedPartyId) return [];
    return data.challans.filter(c => c.partyId === selectedPartyId)
      .filter(c => c.challanNumber.toLowerCase().includes(searchTerm.toLowerCase()) && (filterDate ? c.date === filterDate : true))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.challans, selectedPartyId, searchTerm, filterDate]);

  const handleTogglePayment = async (c: Challan) => {
    const newMode = c.paymentMode === PaymentMode.UNPAID ? PaymentMode.CASH : PaymentMode.UNPAID;
    await saveChallan({ ...c, paymentMode: newMode });
  };

  const handleSaveParty = async () => {
      if (!newPartyName.trim()) return alert("Name required");
      if (editingPartyId) {
          const p = data.parties.find(x => x.id === editingPartyId);
          await updateParty({ ...p!, name: newPartyName, code: newPartyCode });
      } else {
          await saveParty({ id: `p-${Date.now()}`, name: newPartyName, code: newPartyCode, contact: '', address: '', baseRates: [] });
      }
      setIsPartyModalOpen(false);
  };

  const openEditRates = (p: Party) => {
      setEditingPartyId(p.id);
      setTempRates(p.baseRates || []);
      setIsRateModalOpen(true);
  };

  const addRate = () => {
      if (!newRateType || !newRateValue) return;
      setTempRates([...tempRates, { itemType: newRateType.toUpperCase(), rate: parseFloat(newRateValue) }]);
      setNewRateType(''); setNewRateValue('');
  };

  const saveRates = async () => {
      if (!editingPartyId) return;
      const p = data.parties.find(x => x.id === editingPartyId);
      if (p) await updateParty({ ...p, baseRates: tempRates });
      setIsRateModalOpen(false);
  };

  if (!selectedPartyId) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* PARTY MODAL */}
        {isPartyModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-bold text-slate-800">{editingPartyId ? 'Edit Party' : 'Add New Party'}</h3>
                        <button onClick={() => setIsPartyModalOpen(false)}><X size={20} /></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Name</label><input value={newPartyName} onChange={e => setNewPartyName(e.target.value)} className="w-full border rounded-lg px-4 py-3 text-sm font-bold outline-none" /></div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Code</label><input value={newPartyCode} onChange={e => setNewPartyCode(e.target.value)} className="w-full border rounded-lg px-4 py-3 text-sm font-bold outline-none" /></div>
                        <button onClick={handleSaveParty} className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl">Save</button>
                    </div>
                </div>
            </div>
        )}

        {/* RATE MODAL */}
        {isRateModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-bold text-slate-800">Item Pricing Matrix</h3>
                        <button onClick={() => setIsRateModalOpen(false)}><X size={20} /></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-5 gap-2">
                            <input className="col-span-3 border rounded-lg px-3 py-2 text-xs font-bold" placeholder="TYPE (e.g. INTAS)" value={newRateType} onChange={e => setNewRateType(e.target.value)} />
                            <input className="col-span-1 border rounded-lg px-3 py-2 text-xs font-bold" placeholder="Rate" value={newRateValue} onChange={e => setNewRateValue(e.target.value)} />
                            <button onClick={addRate} className="bg-indigo-600 text-white rounded-lg font-bold">+</button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-2">
                            {tempRates.map((r, i) => (
                                <div key={i} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border">
                                    <span className="text-xs font-bold text-slate-700">{r.itemType}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-mono font-bold text-indigo-600">{r.rate}</span>
                                        <button onClick={() => setTempRates(tempRates.filter((_, idx) => idx !== i))} className="text-red-400">✕</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={saveRates} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg mt-4">Save All Rates</button>
                    </div>
                </div>
            </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="px-6 py-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
             <div>
                <h2 className="text-2xl font-bold text-slate-800">Directory</h2>
                <div className="flex gap-2 mt-2">
                    {['billing', 'production', 'manage'].map(t => (
                        <button key={t} onClick={() => setDirectoryTab(t as any)} className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${directoryTab === t ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{t}</button>
                    ))}
                </div>
             </div>
             <div className="flex items-center gap-3 w-full sm:w-auto">
                <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-1 sm:w-64 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" />
                {directoryTab === 'manage' && <button onClick={() => { setEditingPartyId(null); setNewPartyName(''); setNewPartyCode(''); setIsPartyModalOpen(true); }} className="bg-slate-900 text-white p-2.5 rounded-xl"><Plus size={20}/></button>}
             </div>
          </div>
          
          <div className="p-6 bg-slate-50 min-h-[400px]">
             {directoryTab === 'manage' ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                     {filteredParties.map(p => (
                         <div key={p.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center group">
                             <div>
                                 <h4 className="font-bold text-slate-800 truncate max-w-[180px]">{p.name}</h4>
                                 <p className="text-[10px] font-mono text-slate-400 font-bold">{p.code || '-'}</p>
                             </div>
                             <div className="flex gap-1">
                                 <button onClick={() => openEditRates(p)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Pricing"><DollarSign size={16}/></button>
                                 <button onClick={() => { setEditingPartyId(p.id); setNewPartyName(p.name); setNewPartyCode(p.code || ''); setIsPartyModalOpen(true); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 size={16}/></button>
                                 <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete party?')) deleteParty(p.id); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                             </div>
                         </div>
                     ))}
                 </div>
             ) : (
                 <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                   {filteredParties.map(party => (
                     <div key={party.id} onClick={() => { setSelectedPartyId(party.id); setViewMode(directoryTab === 'production' ? 'jobs' : 'bills'); }} className="group relative bg-white rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all overflow-hidden flex items-center h-20">
                        <div className={`w-1.5 h-full ${directoryTab === 'production' ? 'bg-indigo-500' : 'bg-purple-500'}`}></div>
                        <div className="flex-1 px-4 py-2">
                           <h3 className="text-sm font-bold text-slate-800 leading-tight truncate">{party.name}</h3>
                           <div className="flex items-center gap-2 mt-1">
                               <span className="text-[9px] font-bold bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">{party.code || 'N/A'}</span>
                               <p className="text-[10px] font-bold text-slate-400 uppercase">{directoryTab === 'production' ? party.lastJobDate || 'No Jobs' : party.lastBillDate || 'No Bills'}</p>
                           </div>
                        </div>
                     </div>
                   ))}
                 </div>
             )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-right-8 duration-500 pb-20">
       <div className="flex items-center gap-4">
          <button onClick={() => setSelectedPartyId(null)} className="bg-white p-3 rounded-xl border border-slate-200 text-slate-500 hover:text-indigo-600 shadow-sm">←</button>
          <div>
             <h1 className="text-2xl font-bold text-slate-800">{selectedParty?.name}</h1>
             <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded border">{selectedParty?.code}</span>
                {/* Fix: use clickable button to toggle between Production and Billing views */}
                <button 
                  onClick={() => setViewMode(viewMode === 'jobs' ? 'bills' : 'jobs')}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${viewMode === 'jobs' ? 'bg-indigo-100 text-indigo-600 border-indigo-200' : 'bg-purple-100 text-purple-600 border-purple-200'}`}
                >
                  {viewMode === 'jobs' ? 'Production' : 'Billing'}
                </button>
             </div>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
             <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Outstanding</div>
             <div className="text-xl font-bold text-red-600">₹{selectedParty?.totalOutstanding.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
             <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Lifetime Billing</div>
             <div className="text-xl font-bold text-slate-800">₹{selectedParty?.totalRevenue.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
             <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Tonnage</div>
             <div className="text-xl font-bold text-slate-800">{selectedParty?.totalWeight.toFixed(3)} kg</div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
             <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Job Accuracy</div>
             <div className="text-xl font-bold text-indigo-600">98.4%</div>
          </div>
       </div>

       <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden min-h-[500px]">
          <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center bg-slate-50/50">
             <h3 className="font-bold text-slate-700">{viewMode === 'jobs' ? 'History' : 'Transactions'}</h3>
             <div className="flex gap-2">
                 <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="border rounded-lg px-2 text-xs font-bold" />
                 <input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="border rounded-lg px-3 py-2 text-xs font-bold w-48" />
             </div>
          </div>

          <div className="p-4 space-y-4">
             {viewMode === 'jobs' ? (
                partyJobs.map((job) => (
                   <div key={job.uniqueId} className="bg-white rounded-lg border border-slate-200 p-4 flex justify-between items-center">
                      <div>
                         <div className="text-[10px] font-bold text-slate-400">{formatDateNoYear(job.date)}</div>
                         <div className="text-sm font-bold text-slate-800">{job.size}</div>
                         <div className="text-[10px] font-bold text-indigo-600 font-mono mt-1">#{job.dispatchNo}</div>
                      </div>
                      <div className="text-right">
                         <div className="text-sm font-bold text-slate-700">{job.weight.toFixed(3)} kg</div>
                         <span className="text-[9px] font-bold bg-slate-50 px-1.5 py-0.5 rounded border">{job.status}</span>
                      </div>
                   </div>
                ))
             ) : (
                partyChallans.map((challan) => (
                   <div key={challan.id} className={`bg-white rounded-lg border border-slate-200 overflow-hidden ${expandedChallanId === challan.id ? 'ring-2 ring-indigo-500 shadow-lg' : ''}`}>
                      <div onClick={() => setExpandedChallanId(expandedChallanId === challan.id ? null : challan.id)} className={`p-4 cursor-pointer flex justify-between items-center border-l-4 ${challan.paymentMode === PaymentMode.UNPAID ? 'border-red-500' : 'border-emerald-500'}`}>
                         <div>
                            <div className="text-[10px] font-bold text-slate-400">{formatDateNoYear(challan.date)} • Bill {challan.challanNumber}</div>
                            <div className="text-xs font-bold text-slate-500">{challan.lines.length} Items</div>
                         </div>
                         <div className="text-right">
                            <div className="text-sm font-bold text-slate-900">₹{Math.round(challan.totalAmount).toLocaleString()}</div>
                            <button onClick={(e) => { e.stopPropagation(); handleTogglePayment(challan); }} className={`mt-1 px-2 py-0.5 rounded text-[9px] font-bold border ${challan.paymentMode === PaymentMode.UNPAID ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>{challan.paymentMode}</button>
                         </div>
                      </div>
                   </div>
                ))
             )}
          </div>
       </div>
    </div>
  );
};
