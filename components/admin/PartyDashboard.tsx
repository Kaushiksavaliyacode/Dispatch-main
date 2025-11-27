import React, { useState, useMemo } from 'react';
import { AppData, DispatchStatus, PaymentMode, Party } from '../../types';
import { deleteDispatch, deleteChallan } from '../../services/storageService';

interface Props {
  data: AppData;
}

export const PartyDashboard: React.FC<Props> = ({ data }) => {
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [directoryTab, setDirectoryTab] = useState<'production' | 'billing'>('billing');
  const [filterDate, setFilterDate] = useState('');
  const [expandedChallanId, setExpandedChallanId] = useState<string | null>(null);

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
        lastJobDate: pDispatches.length > 0 ? pDispatches[0].date : null,
        lastBillDate: pChallans.length > 0 ? pChallans[0].date : null
      };
    }).sort((a, b) => b.totalOutstanding - a.totalOutstanding); 
  }, [data]);

  const filteredParties = useMemo(() => {
    return partyStats.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Strict separation based on user request
      let matchesTab = false;
      if (directoryTab === 'production') {
        matchesTab = p.jobCount > 0;
      } else {
        matchesTab = p.challanCount > 0;
      }

      return matchesSearch && matchesTab;
    });
  }, [partyStats, searchTerm, directoryTab]);

  // --- Detailed View Logic ---
  const selectedParty = useMemo(() => 
    partyStats.find(p => p.id === selectedPartyId), 
  [partyStats, selectedPartyId]);

  // Determine which "View Mode" to show based on data presence
  const viewMode = useMemo(() => {
    if (!selectedParty) return null;
    // Default to the directory tab context, but fallback to data presence
    if (directoryTab === 'production') return 'jobs';
    return 'bills';
  }, [selectedParty, directoryTab]);

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
  const exportCSV = () => {
    if (!selectedParty || !viewMode) return;
    
    let content = '';
    let filename = '';

    if (viewMode === 'jobs') {
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
      deleteDispatch(id);
    }
  };

  const handleDeleteChallan = (id: string) => {
    if (window.confirm("Are you sure you want to delete this bill? This action cannot be undone.")) {
      deleteChallan(id);
    }
  };

  const handleOpenParty = (partyId: string, type: 'production' | 'billing') => {
      setSelectedPartyId(partyId);
      setSearchTerm('');
      setExpandedChallanId(null);
  };

  // 1. DIRECTORY VIEW
  if (!selectedPartyId) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          {/* Header & Toggle */}
          <div className="bg-white px-6 py-6 flex flex-col gap-6">
             <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Party Directory</h2>
                  <p className="text-slate-400 font-medium">Customer & Vendor Management</p>
                </div>
                <input 
                  type="text" 
                  placeholder="Search Name..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full md:w-72 bg-slate-50 border border-slate-200 text-slate-700 placeholder-slate-400 rounded-xl px-5 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-100 transition-all shadow-inner"
                />
             </div>
             
             {/* Mode Toggle */}
             <div className="flex p-1 bg-slate-100 rounded-xl w-full md:w-fit self-center md:self-start">
                <button 
                  onClick={() => setDirectoryTab('billing')}
                  className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${directoryTab === 'billing' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <span>🧾</span> Billing Parties
                </button>
                <button 
                  onClick={() => setDirectoryTab('production')}
                  className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${directoryTab === 'production' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <span>🚛</span> Production Parties
                </button>
             </div>
          </div>
          
          <div className="p-6 bg-slate-50/50 min-h-[400px]">
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
               {filteredParties.map(party => (
                 <div 
                   key={party.id} 
                   onClick={() => handleOpenParty(party.id, directoryTab)}
                   className={`group relative bg-white rounded-2xl p-6 border transition-all cursor-pointer overflow-hidden flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 ${directoryTab === 'production' ? 'border-slate-200 hover:border-indigo-200' : 'border-slate-200 hover:border-orange-200'}`}
                 >
                    {/* Top Stripe */}
                    <div className={`absolute top-0 left-0 w-full h-1 ${directoryTab === 'production' ? 'bg-indigo-500' : 'bg-orange-500'}`}></div>

                    <div className="relative z-10">
                       <div className="flex justify-between items-start mb-6">
                          <div>
                            <h3 className="text-lg font-bold text-slate-800 uppercase tracking-tight">{party.name}</h3>
                            <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                                {directoryTab === 'production' ? 'Last Job: ' : 'Last Bill: '}
                                {directoryTab === 'production' ? (party.lastJobDate || 'N/A') : (party.lastBillDate || 'N/A')}
                            </div>
                          </div>
                          {directoryTab === 'billing' && party.totalOutstanding > 0 && (
                            <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase border border-red-100 animate-pulse">
                              Due
                            </span>
                          )}
                       </div>
                       
                       {/* SPECIFIC CARD STATS */}
                       {directoryTab === 'production' ? (
                           // PRODUCTION CARD
                           <div className="grid grid-cols-2 gap-3">
                               <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100 text-center">
                                  <div className="text-[10px] font-bold text-indigo-400 uppercase">Jobs</div>
                                  <div className="text-lg font-bold text-slate-700">{party.jobCount}</div>
                               </div>
                               <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100 text-center">
                                  <div className="text-[10px] font-bold text-indigo-400 uppercase">Weight</div>
                                  <div className="text-lg font-bold text-slate-700">{party.totalWeight.toFixed(1)}</div>
                               </div>
                           </div>
                       ) : (
                           // BILLING CARD
                           <div className="space-y-3">
                               <div className="flex justify-between items-center bg-orange-50/50 p-3 rounded-xl border border-orange-100">
                                   <span className="text-xs font-bold text-orange-400 uppercase">Revenue</span>
                                   <span className="text-base font-bold text-slate-700">₹{party.totalRevenue.toLocaleString()}</span>
                               </div>
                               <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100">
                                   <span className="text-xs font-bold text-slate-400 uppercase">Outstanding</span>
                                   <span className={`text-base font-bold ${party.totalOutstanding > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                      ₹{party.totalOutstanding.toLocaleString()}
                                   </span>
                               </div>
                           </div>
                       )}
                    </div>
                 </div>
               ))}
             </div>
             
             {filteredParties.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                   <div className="bg-slate-100 p-4 rounded-full mb-4">
                     {directoryTab === 'production' ? (
                       <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                     ) : (
                       <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                     )}
                   </div>
                   <p className="text-sm font-semibold">No {directoryTab} parties found.</p>
                </div>
             )}
          </div>
        </div>
      </div>
    );
  }

  // 2. DETAILED VIEW (MUTUALLY EXCLUSIVE - NO TABS)
  if (!selectedParty || !viewMode) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
       
       {/* Header & Stats */}
       <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
             <button 
               onClick={() => setSelectedPartyId(null)}
               className="bg-white p-3 rounded-xl border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm group"
             >
                <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
             </button>
             <div>
                <h1 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">{selectedParty.name}</h1>
                <div className="flex items-center gap-2">
                   <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded ${viewMode === 'jobs' ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'}`}>
                     {viewMode === 'jobs' ? 'Production Client' : 'Billing Client'}
                   </span>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             {viewMode === 'bills' && (
               <>
                 <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-5 text-white shadow-lg shadow-red-200">
                    <div className="text-xs font-bold text-red-100 uppercase mb-1">Total Outstanding</div>
                    <div className="text-2xl font-bold">₹{selectedParty.totalOutstanding.toLocaleString()}</div>
                 </div>
                 <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Total Billed</div>
                    <div className="text-2xl font-bold text-slate-800">₹{selectedParty.totalRevenue.toLocaleString()}</div>
                 </div>
               </>
             )}
             
             {viewMode === 'jobs' && (
               <>
                 <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Total Weight</div>
                    <div className="text-2xl font-bold text-slate-800">{selectedParty.totalWeight.toFixed(3)} <span className="text-sm text-slate-400">kg</span></div>
                 </div>
                 <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Jobs Completed</div>
                    <div className="text-2xl font-bold text-slate-800">{selectedParty.jobCount}</div>
                 </div>
               </>
             )}
          </div>
       </div>

       {/* CONTENT AREA */}
       <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden min-h-[600px]">
          <div className="border-b border-slate-200 flex flex-col md:flex-row justify-between items-center px-6 py-4 gap-4 bg-slate-50/50">
             
             <h3 className="text-lg font-bold text-slate-700 uppercase">
                {viewMode === 'jobs' ? 'Production History' : 'Billing Transactions'}
             </h3>
             
             <div className="flex gap-2 w-full md:w-auto">
                 <input 
                   type="date" 
                   value={filterDate} 
                   onChange={e => setFilterDate(e.target.value)} 
                   className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-indigo-300" 
                 />
                 <input 
                   type="text" 
                   placeholder={viewMode === 'jobs' ? "Search Size..." : "Search Bill..."}
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold w-full md:w-48 outline-none focus:border-indigo-300"
                 />
                 <button 
                   onClick={exportCSV}
                   className="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors flex items-center gap-2"
                 >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Export
                 </button>
             </div>
          </div>

          {/* TABLE CONTENT */}
          <div className="overflow-x-auto">
             {viewMode === 'jobs' ? (
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
                            <tr key={job.uniqueId} className="hover:bg-indigo-50/20 transition-colors">
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
                         const isExpanded = expandedChallanId === challan.id;

                         return (
                            <React.Fragment key={challan.id}>
                                <tr 
                                  onClick={() => setExpandedChallanId(isExpanded ? null : challan.id)}
                                  className={`transition-colors cursor-pointer ${isExpanded ? 'bg-orange-50/50' : 'hover:bg-orange-50/20'}`}
                                >
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
                                      <button onClick={(e) => { e.stopPropagation(); handleDeleteChallan(challan.id); }} className="text-red-300 hover:text-red-500 transition-colors">
                                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                      </button>
                                   </td>
                                </tr>
                                {isExpanded && (
                                     <tr className="bg-slate-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                         <td colSpan={7} className="p-4 sm:p-6 border-b border-slate-100 shadow-inner">
                                            <div className="bg-white rounded-xl border border-slate-200 p-4 max-w-3xl mx-auto shadow-sm">
                                                <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                                      <span className="text-lg">🧾</span> Challan Details
                                                    </h4>
                                                    <div className="text-xs font-bold text-slate-500">Total Items: {challan.lines.length}</div>
                                                </div>
                                                <table className="w-full text-sm text-left">
                                                    <thead className="text-[10px] text-slate-400 font-bold uppercase border-b border-slate-100 bg-slate-50/50">
                                                        <tr>
                                                            <th className="py-2 pl-3">Item Description</th>
                                                            <th className="py-2 text-right">Weight (kg)</th>
                                                            <th className="py-2 text-right">Rate</th>
                                                            <th className="py-2 text-right pr-3">Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {challan.lines.map((line, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50/50">
                                                                <td className="py-2 pl-3 font-bold text-slate-700 uppercase text-xs">{line.size}</td>
                                                                <td className="py-2 text-right text-slate-600 font-mono text-xs">{line.weight.toFixed(3)}</td>
                                                                <td className="py-2 text-right text-slate-600 font-mono text-xs">{line.rate}</td>
                                                                <td className="py-2 text-right pr-3 font-bold text-slate-800 text-xs">₹{line.amount.toFixed(2)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot className="border-t border-slate-100 bg-slate-50/30">
                                                        <tr>
                                                            <td colSpan={3} className="py-3 text-right text-xs font-bold text-slate-500 uppercase">Grand Total (Rounded)</td>
                                                            <td className="py-3 text-right pr-3 font-bold text-base text-slate-900">₹{Math.round(challan.totalAmount).toLocaleString()}</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                         </td>
                                     </tr>
                                 )}
                            </React.Fragment>
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