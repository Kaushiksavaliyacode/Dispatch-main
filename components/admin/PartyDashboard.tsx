import React, { useState, useMemo } from 'react';
import { AppData, DispatchStatus, PaymentMode, Party } from '../../types';
import { deleteDispatch, deleteChallan } from '../../services/storageService';

interface Props {
  data: AppData;
}

export const PartyDashboard: React.FC<Props> = ({ data }) => {
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [detailTab, setDetailTab] = useState<'jobs' | 'bills'>('jobs');
  const [filterDate, setFilterDate] = useState('');

  // --- Aggregate Data per Party ---
  const partyStats = useMemo(() => {
    return data.parties.map(party => {
      const pDispatches = data.dispatches.filter(d => d.partyId === party.id);
      const pChallans = data.challans.filter(c => c.partyId === party.id);

      const totalRevenue = pChallans.reduce((sum, c) => sum + c.totalAmount, 0);
      const totalOutstanding = pChallans
        .filter(c => c.paymentMode === PaymentMode.UNPAID)
        .reduce((sum, c) => sum + c.totalAmount, 0);
      
      const totalWeight = pDispatches.reduce((sum, d) => sum + d.totalWeight, 0);

      return {
        ...party,
        jobCount: pDispatches.length,
        challanCount: pChallans.length,
        totalRevenue,
        totalOutstanding,
        totalWeight,
        lastActive: pDispatches.length > 0 ? pDispatches[0].date : (pChallans.length > 0 ? pChallans[0].date : 'N/A')
      };
    }).sort((a, b) => b.totalOutstanding - a.totalOutstanding); // Sort by highest outstanding first
  }, [data]);

  const filteredParties = partyStats.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- Detailed View Logic ---
  const selectedParty = useMemo(() => 
    partyStats.find(p => p.id === selectedPartyId), 
  [partyStats, selectedPartyId]);

  const partyJobs = useMemo(() => {
    if (!selectedPartyId) return [];
    return data.dispatches
      .filter(d => d.partyId === selectedPartyId)
      .flatMap(d => d.rows.map((r, idx) => ({
        ...r,
        uniqueId: `${d.id}_${idx}`,
        parentId: d.id,
        dispatchNo: d.dispatchNo,
        date: d.date,
        parentStatus: d.status,
        updatedAt: d.updatedAt
      })))
      .filter(item => {
         const matchesSearch = item.dispatchNo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                               item.size.toLowerCase().includes(searchTerm.toLowerCase());
         const matchesDate = filterDate ? item.date === filterDate : true;
         return matchesSearch && matchesDate;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.dispatches, selectedPartyId, searchTerm, filterDate]);

  const partyChallans = useMemo(() => {
    if (!selectedPartyId) return [];
    return data.challans
      .filter(c => c.partyId === selectedPartyId)
      .filter(c => {
         const matchesSearch = c.challanNumber.toLowerCase().includes(searchTerm.toLowerCase());
         const matchesDate = filterDate ? c.date === filterDate : true;
         return matchesSearch && matchesDate;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.challans, selectedPartyId, searchTerm, filterDate]);

  // --- Actions ---
  const exportCSV = (type: 'jobs' | 'bills') => {
    if (!selectedParty) return;
    
    let content = '';
    let filename = '';

    if (type === 'jobs') {
       const headers = ["Job ID", "Date", "Size", "Weight", "Pcs", "Bundle", "Status", "Notes"];
       const rows = partyJobs.map(j => [
         j.dispatchNo, j.date, `"${j.size}"`, j.weight, j.pcs, j.bundle, j.status, "" 
       ]);
       content = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
       filename = `${selectedParty.name}_Jobs.csv`;
    } else {
       const headers = ["Challan No", "Date", "Items", "Total Weight", "Total Amount", "Mode"];
       const rows = partyChallans.map(c => [
         c.challanNumber, c.date, `"${c.lines.map(l => l.size).join(' | ')}"`, c.totalWeight, c.totalAmount, c.paymentMode
       ]);
       content = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
       filename = `${selectedParty.name}_Bills.csv`;
    }

    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const handleDeleteJob = (id: string) => {
    if (window.confirm("Are you sure you want to delete this job? This action cannot be undone.")) {
      console.log(`AUDIT: Job ${id} deleted by ADMIN at ${new Date().toISOString()}`);
      deleteDispatch(id);
    }
  };

  const handleDeleteChallan = (id: string) => {
    if (window.confirm("Are you sure you want to delete this bill? This action cannot be undone.")) {
      console.log(`AUDIT: Challan ${id} deleted by ADMIN at ${new Date().toISOString()}`);
      deleteChallan(id);
    }
  };

  // --- RENDER ---
  
  // 1. DIRECTORY VIEW
  if (!selectedPartyId) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-4 text-white">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                   <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Party Directory</h2>
                  <p className="text-orange-100 font-medium">Manage customer profiles & histories</p>
                </div>
             </div>
             <input 
               type="text" 
               placeholder="Search Party Name..." 
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               className="w-full md:w-72 bg-white/10 border border-white/20 text-white placeholder-orange-100 rounded-xl px-5 py-3 text-sm font-bold outline-none focus:bg-white/20 transition-all shadow-inner"
             />
          </div>
          
          <div className="p-6 bg-slate-50/50 min-h-[400px]">
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
               {filteredParties.map(party => (
                 <div 
                   key={party.id} 
                   onClick={() => { setSelectedPartyId(party.id); setSearchTerm(''); }}
                   className="group relative bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer overflow-hidden"
                 >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                       <svg className="w-24 h-24 text-orange-500 transform rotate-12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
                    </div>

                    <div className="relative z-10">
                       <div className="flex justify-between items-start mb-4">
                          <h3 className="text-lg font-bold text-slate-800 uppercase tracking-tight group-hover:text-orange-600 transition-colors">{party.name}</h3>
                          {party.totalOutstanding > 0 && (
                            <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase border border-red-100 animate-pulse">
                              Credit Due
                            </span>
                          )}
                       </div>
                       
                       <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                             <div className="text-[10px] font-bold text-slate-400 uppercase">Outstanding</div>
                             <div className={`text-lg font-bold ${party.totalOutstanding > 0 ? 'text-red-500' : 'text-slate-700'}`}>₹{party.totalOutstanding.toLocaleString()}</div>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                             <div className="text-[10px] font-bold text-slate-400 uppercase">Total Revenue</div>
                             <div className="text-lg font-bold text-emerald-600">₹{party.totalRevenue.toLocaleString()}</div>
                          </div>
                       </div>

                       <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 border-t border-slate-100 pt-4">
                          <div className="flex items-center gap-1.5">
                             <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                             {party.jobCount} Jobs
                          </div>
                          <div className="flex items-center gap-1.5">
                             <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                             {party.challanCount} Bills
                          </div>
                          <div className="ml-auto text-[10px] bg-slate-100 px-2 py-1 rounded">
                             Active: {party.lastActive}
                          </div>
                       </div>
                    </div>
                 </div>
               ))}
             </div>
             {filteredParties.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                   <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                   <p className="text-sm font-semibold">No parties found.</p>
                </div>
             )}
          </div>
        </div>
      </div>
    );
  }

  // 2. DETAILED VIEW
  if (!selectedParty) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
       
       {/* Header & Stats */}
       <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
             <button 
               onClick={() => setSelectedPartyId(null)}
               className="bg-white p-3 rounded-xl border border-slate-200 text-slate-500 hover:text-orange-600 hover:border-orange-200 transition-all shadow-sm group"
             >
                <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
             </button>
             <div>
                <h1 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">{selectedParty.name}</h1>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Customer Dashboard</p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-5 text-white shadow-lg shadow-red-200">
                <div className="text-xs font-bold text-red-100 uppercase mb-1">Total Outstanding</div>
                <div className="text-2xl font-bold">₹{selectedParty.totalOutstanding.toLocaleString()}</div>
             </div>
             <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="text-xs font-bold text-slate-400 uppercase mb-1">Total Billed</div>
                <div className="text-2xl font-bold text-slate-800">₹{selectedParty.totalRevenue.toLocaleString()}</div>
             </div>
             <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="text-xs font-bold text-slate-400 uppercase mb-1">Total Weight</div>
                <div className="text-2xl font-bold text-slate-800">{selectedParty.totalWeight.toFixed(3)} <span className="text-sm text-slate-400">kg</span></div>
             </div>
             <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                   <div className="text-xs font-bold text-slate-400 uppercase mb-1">Total Jobs</div>
                   <div className="text-2xl font-bold text-slate-800">{selectedParty.jobCount}</div>
                </div>
                <div>
                   <div className="text-xs font-bold text-slate-400 uppercase mb-1">Bills</div>
                   <div className="text-2xl font-bold text-slate-800">{selectedParty.challanCount}</div>
                </div>
             </div>
          </div>
       </div>

       {/* Tabs & Controls */}
       <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden min-h-[600px]">
          <div className="border-b border-slate-200 flex flex-col md:flex-row justify-between items-center px-6 py-4 gap-4 bg-slate-50/50">
             <div className="flex bg-slate-200/50 p-1 rounded-xl">
                <button 
                  onClick={() => setDetailTab('jobs')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${detailTab === 'jobs' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Job History
                </button>
                <button 
                  onClick={() => setDetailTab('bills')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${detailTab === 'bills' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Bill History
                </button>
             </div>
             
             <div className="flex gap-2 w-full md:w-auto">
                 <input 
                   type="date" 
                   value={filterDate} 
                   onChange={e => setFilterDate(e.target.value)} 
                   className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-orange-300" 
                 />
                 <input 
                   type="text" 
                   placeholder={detailTab === 'jobs' ? "Search Size, Job ID..." : "Search Bill No..."}
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold w-full md:w-48 outline-none focus:border-orange-300"
                 />
                 <button 
                   onClick={() => exportCSV(detailTab)}
                   className="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors flex items-center gap-2"
                 >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Export
                 </button>
             </div>
          </div>

          {/* TABLE CONTENT */}
          <div className="overflow-x-auto">
             {detailTab === 'jobs' ? (
                <table className="w-full text-left text-sm whitespace-nowrap">
                   <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200">
                      <tr>
                         <th className="px-6 py-4">Date</th>
                         <th className="px-6 py-4">Job ID</th>
                         <th className="px-6 py-4">Size / Desc</th>
                         <th className="px-6 py-4 text-right">Weight</th>
                         <th className="px-6 py-4 text-right">Pcs</th>
                         <th className="px-6 py-4 text-center">Bundle</th>
                         <th className="px-6 py-4 text-center">Status</th>
                         <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {partyJobs.length === 0 && (
                        <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-400 italic">No job records found.</td></tr>
                      )}
                      {partyJobs.map((job) => {
                         let statusBadge = "bg-slate-100 text-slate-500";
                         if(job.status === DispatchStatus.COMPLETED) statusBadge = "bg-emerald-100 text-emerald-600";
                         else if(job.status === DispatchStatus.DISPATCHED) statusBadge = "bg-purple-100 text-purple-600";
                         else if(job.status === DispatchStatus.LOADING) statusBadge = "bg-amber-100 text-amber-600";

                         return (
                            <tr key={job.uniqueId} className="hover:bg-orange-50/20 transition-colors">
                               <td className="px-6 py-3 font-medium text-slate-500">{job.date}</td>
                               <td className="px-6 py-3 font-mono text-xs text-slate-400">{job.dispatchNo}</td>
                               <td className="px-6 py-3 font-bold text-slate-700 uppercase">{job.size}</td>
                               <td className="px-6 py-3 text-right font-mono text-slate-600">{job.weight.toFixed(3)}</td>
                               <td className="px-6 py-3 text-right font-mono text-slate-600">{job.pcs}</td>
                               <td className="px-6 py-3 text-center text-slate-500 uppercase text-xs font-bold">{job.bundle}</td>
                               <td className="px-6 py-3 text-center">
                                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${statusBadge}`}>
                                     {job.status === DispatchStatus.LOADING ? 'RUNNING' : job.status}
                                  </span>
                               </td>
                               <td className="px-6 py-3 text-right">
                                  <button onClick={() => handleDeleteJob(job.parentId)} className="text-red-300 hover:text-red-500 transition-colors">
                                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                               </td>
                            </tr>
                         )
                      })}
                   </tbody>
                </table>
             ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                   <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200">
                      <tr>
                         <th className="px-6 py-4">Date</th>
                         <th className="px-6 py-4">Challan No</th>
                         <th className="px-6 py-4">Items Summary</th>
                         <th className="px-6 py-4 text-right">Total Weight</th>
                         <th className="px-6 py-4 text-right">Total Amount</th>
                         <th className="px-6 py-4 text-center">Payment</th>
                         <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {partyChallans.length === 0 && (
                        <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400 italic">No bill records found.</td></tr>
                      )}
                      {partyChallans.map((challan) => {
                         const isUnpaid = challan.paymentMode === PaymentMode.UNPAID;
                         const itemSummary = challan.lines.map(l => l.size).join(', ');
                         return (
                            <tr key={challan.id} className="hover:bg-orange-50/20 transition-colors">
                               <td className="px-6 py-3 font-medium text-slate-500">{challan.date}</td>
                               <td className="px-6 py-3 font-mono font-bold text-slate-700">{challan.challanNumber}</td>
                               <td className="px-6 py-3 text-xs text-slate-500 uppercase max-w-xs truncate" title={itemSummary}>{itemSummary}</td>
                               <td className="px-6 py-3 text-right font-mono text-slate-600">{challan.totalWeight.toFixed(3)}</td>
                               <td className="px-6 py-3 text-right font-bold text-slate-800">₹{challan.totalAmount.toLocaleString()}</td>
                               <td className="px-6 py-3 text-center">
                                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${isUnpaid ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                     {challan.paymentMode}
                                  </span>
                               </td>
                               <td className="px-6 py-3 text-right">
                                  <button onClick={() => handleDeleteChallan(challan.id)} className="text-red-300 hover:text-red-500 transition-colors">
                                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                               </td>
                            </tr>
                         )
                      })}
                   </tbody>
                </table>
             )}
          </div>
       </div>
    </div>
  );
};
