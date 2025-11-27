import React, { useState, useMemo } from 'react';
import { AppData, DispatchStatus, PaymentMode, Party, Challan } from '../../types';
import { deleteDispatch, deleteChallan, saveChallan } from '../../services/storageService';

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

  const handleOpenParty = (partyId: string, type: 'production' | 'billing') => {
      setSelectedPartyId(partyId);
      setSearchTerm('');
      setExpandedChallanId(null);
  };

  const handleTogglePayment = async (c: Challan) => {
    const newMode = c.paymentMode === PaymentMode.UNPAID ? PaymentMode.CASH : PaymentMode.UNPAID;
    const updatedChallan = { ...c, paymentMode: newMode };
    await saveChallan(updatedChallan);
  };

  // 1. DIRECTORY VIEW
  if (!selectedPartyId) {
    return (
      <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          {/* Header & Toggle */}
          <div className="bg-white px-4 py-4 md:px-6 md:py-6 flex flex-col gap-4 md:gap-6">
             <div className="flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="text-center md:text-left">
                  <h2 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">Directory</h2>
                  <p className="text-xs md:text-sm text-slate-500 font-medium">Customer & Vendor Management</p>
                </div>
                <input 
                  type="text" 
                  placeholder="Search..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full md:w-72 bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 text-xs md:text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100 transition-all shadow-inner"
                />
             </div>
             
             {/* Mode Toggle Tabs (Always Colored) */}
             <div className="grid grid-cols-2 gap-2 md:gap-4 w-full">
                <button 
                  onClick={() => setDirectoryTab('billing')}
                  className={`relative overflow-hidden p-3 md:p-5 rounded-xl md:rounded-2xl text-left transition-all duration-300 transform hover:scale-[1.01] ${directoryTab === 'billing' ? 'shadow-xl shadow-purple-200 ring-2 md:ring-4 ring-purple-300 ring-offset-1 scale-[1.01]' : 'shadow-md opacity-90 hover:opacity-100'}`}
                >
                   {/* Purple Gradient for Billing */}
                   <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-indigo-600"></div>
                   
                   <div className="relative z-10 flex items-center gap-2 md:gap-4 text-white">
                      <span className="text-lg md:text-2xl p-1.5 md:p-2 rounded-lg bg-white/20 backdrop-blur-md">🧾</span>
                      <div>
                        <h3 className="text-xs md:text-lg font-bold">Billing</h3>
                      </div>
                   </div>
                </button>

                <button 
                  onClick={() => setDirectoryTab('production')}
                  className={`relative overflow-hidden p-3 md:p-5 rounded-xl md:rounded-2xl text-left transition-all duration-300 transform hover:scale-[1.01] ${directoryTab === 'production' ? 'shadow-xl shadow-indigo-100 ring-2 md:ring-4 ring-indigo-300 ring-offset-1 scale-[1.01]' : 'shadow-md opacity-90 hover:opacity-100'}`}
                >
                   {/* Indigo Gradient for Production */}
                   <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-blue-600"></div>

                   <div className="relative z-10 flex items-center gap-2 md:gap-4 text-white">
                      <span className="text-lg md:text-2xl p-1.5 md:p-2 rounded-lg bg-white/20 backdrop-blur-md">🚛</span>
                      <div>
                         <h3 className="text-xs md:text-lg font-bold">Production</h3>
                      </div>
                   </div>
                </button>
             </div>
          </div>
          
          <div className="p-4 md:p-6 bg-slate-50/50 min-h-[400px]">
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-6">
               {filteredParties.map(party => (
                 <div 
                   key={party.id} 
                   onClick={() => handleOpenParty(party.id, directoryTab)}
                   className={`group relative bg-white rounded-xl md:rounded-2xl border transition-all cursor-pointer overflow-hidden flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 ${directoryTab === 'production' ? 'border-indigo-100' : 'border-purple-100'}`}
                 >
                    {/* Header with Permanent Color */}
                    <div className={`px-4 py-3 md:px-6 md:py-4 flex justify-between items-start ${directoryTab === 'production' ? 'bg-gradient-to-r from-indigo-600 to-blue-600' : 'bg-gradient-to-r from-purple-500 to-indigo-600'}`}>
                        <div>
                          <h3 className="text-sm md:text-lg font-bold text-white tracking-tight">{party.name}</h3>
                          <div className="text-[10px] md:text-xs font-medium text-white/80 mt-0.5">
                              {directoryTab === 'production' ? 'Last Job: ' : 'Last Bill: '}
                              {directoryTab === 'production' ? (party.lastJobDate || 'N/A') : (party.lastBillDate || 'N/A')}
                          </div>
                        </div>
                        {directoryTab === 'billing' && party.totalOutstanding > 0 && (
                          <span className="bg-white/20 backdrop-blur-md text-white px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-xs font-bold border border-white/30">
                            Due
                          </span>
                        )}
                    </div>

                    <div className="p-4 md:p-6">
                       {/* SPECIFIC CARD STATS */}
                       {directoryTab === 'production' ? (
                           <div className="flex items-center justify-center py-2 md:py-4 bg-indigo-50/50 rounded-lg md:rounded-xl border border-indigo-100 border-dashed">
                              <span className="text-xs md:text-sm font-bold text-indigo-600 flex items-center gap-2">
                                📄 View History
                              </span>
                           </div>
                       ) : (
                           // BILLING CARD (Purple Theme)
                           <div className="space-y-2 md:space-y-3">
                               <div className="flex justify-between items-center bg-purple-50/50 p-2 md:p-3 rounded-lg md:rounded-xl border border-purple-100">
                                   <span className="text-[10px] md:text-xs font-semibold text-purple-600">Revenue</span>
                                   <span className="text-sm md:text-base font-bold text-slate-800">₹{party.totalRevenue.toLocaleString()}</span>
                               </div>
                               <div className="flex justify-between items-center bg-white p-2 md:p-3 rounded-lg md:rounded-xl border border-slate-100">
                                   <span className="text-[10px] md:text-xs font-semibold text-slate-500">Outstd.</span>
                                   <span className={`text-sm md:text-base font-bold ${party.totalOutstanding > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
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
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
       
       {/* Header & Stats */}
       <div className="flex flex-col gap-4 md:gap-6">
          <div className="flex items-center gap-3 md:gap-4">
             <button 
               onClick={() => setSelectedPartyId(null)}
               className="bg-white p-2 md:p-3 rounded-xl border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm group"
             >
                <svg className="w-4 h-4 md:w-5 md:h-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
             </button>
             <div>
                <h1 className="text-lg md:text-2xl font-bold text-slate-800 tracking-tight">{selectedParty.name}</h1>
                <div className="flex items-center gap-2">
                   <span className={`text-[10px] md:text-xs font-bold tracking-wide px-2 py-0.5 rounded ${viewMode === 'jobs' ? 'bg-indigo-100 text-indigo-600' : 'bg-purple-100 text-purple-600'}`}>
                     {viewMode === 'jobs' ? 'Production' : 'Billing'}
                   </span>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
             {viewMode === 'bills' && (
               <>
                 {/* Purple for Total Outstanding */}
                 <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl md:rounded-2xl p-4 md:p-5 text-white shadow-lg shadow-purple-200">
                    <div className="text-[10px] md:text-xs font-bold text-purple-100 mb-1">Outstanding</div>
                    <div className="text-lg md:text-2xl font-bold">₹{selectedParty.totalOutstanding.toLocaleString()}</div>
                 </div>
                 <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-5 border border-slate-200 shadow-sm">
                    <div className="text-[10px] md:text-xs font-bold text-slate-400 mb-1">Billed</div>
                    <div className="text-lg md:text-2xl font-bold text-slate-800">₹{selectedParty.totalRevenue.toLocaleString()}</div>
                 </div>
               </>
             )}
             
             {viewMode === 'jobs' && (
               <>
                 {/* Production Detailed Stats */}
                 <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-5 border border-slate-200 shadow-sm">
                    <div className="text-[10px] md:text-xs font-bold text-slate-400 mb-1">Total Weight</div>
                    <div className="text-lg md:text-2xl font-bold text-slate-800">{selectedParty.totalWeight.toFixed(3)} <span className="text-sm text-slate-400">kg</span></div>
                 </div>
                 <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-5 border border-slate-200 shadow-sm">
                    <div className="text-[10px] md:text-xs font-bold text-slate-400 mb-1">Completed</div>
                    <div className="text-lg md:text-2xl font-bold text-slate-800">{selectedParty.jobCount}</div>
                 </div>
               </>
             )}
          </div>
       </div>

       {/* CONTENT AREA */}
       <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 shadow-xl overflow-hidden min-h-[500px]">
          <div className="border-b border-slate-200 flex flex-col md:flex-row justify-between items-center px-4 py-3 md:px-6 md:py-4 gap-3 bg-slate-50/50">
             
             <h3 className="text-sm md:text-lg font-bold text-slate-700 w-full md:w-auto">
                {viewMode === 'jobs' ? 'History' : 'Transactions'}
             </h3>
             
             <div className="flex gap-2 w-full md:w-auto">
                 <input 
                   type="date" 
                   value={filterDate} 
                   onChange={e => setFilterDate(e.target.value)} 
                   className="bg-white border border-slate-200 rounded-lg md:rounded-xl px-2 py-1.5 md:px-3 md:py-2 text-[10px] md:text-xs font-bold text-slate-700 outline-none focus:border-indigo-300 w-1/3" 
                 />
                 <input 
                   type="text" 
                   placeholder="Search..."
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   className="bg-white border border-slate-200 rounded-lg md:rounded-xl px-3 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs font-bold w-full md:w-48 outline-none focus:border-indigo-300"
                 />
                 <button 
                   onClick={exportCSV}
                   className="bg-slate-800 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold hover:bg-slate-900 transition-colors flex items-center gap-2"
                 >
                    <span className="hidden md:inline">Export</span>
                    <span className="md:hidden">⬇</span>
                 </button>
             </div>
          </div>

          {/* TABLE CONTENT */}
          <div className="overflow-x-auto">
             {viewMode === 'jobs' ? (
                <table className="w-full text-left text-[10px] md:text-sm whitespace-nowrap">
                   <thead className="bg-slate-50 text-slate-600 font-semibold text-[10px] md:text-xs tracking-wide border-b border-slate-200">
                      <tr>
                         <th className="px-2 py-2 md:px-6 md:py-4">Date</th>
                         <th className="px-2 py-2 md:px-6 md:py-4">Size</th>
                         <th className="px-2 py-2 md:px-6 md:py-4 text-right">Wt</th>
                         <th className="px-2 py-2 md:px-6 md:py-4 text-right">Pcs/Rolls</th>
                         <th className="px-2 py-2 md:px-6 md:py-4 text-center">Bundle</th>
                         <th className="px-2 py-2 md:px-6 md:py-4 text-center">Sts</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {partyJobs.length === 0 && (
                        <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic">No job records found.</td></tr>
                      )}
                      {partyJobs.map((job) => {
                         let statusBadge = "bg-slate-100 text-slate-500";
                         if(job.status === DispatchStatus.COMPLETED) statusBadge = "bg-emerald-100 text-emerald-600";
                         else if(job.status === DispatchStatus.DISPATCHED) statusBadge = "bg-purple-100 text-purple-600";
                         else if(job.status === DispatchStatus.LOADING) statusBadge = "bg-amber-100 text-amber-600";
                         
                         const isMm = job.size.toLowerCase().includes('mm');

                         return (
                            <tr key={job.uniqueId} className="hover:bg-indigo-50/20 transition-colors">
                               <td className="px-2 py-1 md:px-6 md:py-3 font-medium text-slate-600">{job.date}</td>
                               <td className="px-2 py-1 md:px-6 md:py-3 font-bold text-slate-800">{job.size}</td>
                               <td className="px-2 py-1 md:px-6 md:py-3 text-right font-mono text-slate-700">{job.weight.toFixed(3)}</td>
                               <td className="px-2 py-1 md:px-6 md:py-3 text-right font-mono text-slate-700">{job.pcs} <span className="text-[9px] md:text-xs text-slate-400">{isMm ? 'R' : 'P'}</span></td>
                               <td className="px-2 py-1 md:px-6 md:py-3 text-center text-slate-600 font-bold">{job.bundle}</td>
                               <td className="px-2 py-1 md:px-6 md:py-3 text-center">
                                  <span className={`px-1.5 py-0.5 md:px-2 md:py-1 rounded text-[9px] md:text-[10px] font-bold tracking-wide ${statusBadge}`}>
                                     {job.status === DispatchStatus.LOADING ? 'RUNNING' : job.status.slice(0,4)}
                                  </span>
                               </td>
                            </tr>
                         )
                      })}
                   </tbody>
                </table>
             ) : (
                <table className="w-full text-left text-[10px] md:text-sm whitespace-nowrap">
                   <thead className="bg-slate-50 text-slate-600 font-semibold text-[10px] md:text-xs tracking-wide border-b border-slate-200">
                      <tr>
                         <th className="px-2 py-2 md:px-6 md:py-4">Date</th>
                         <th className="px-2 py-2 md:px-6 md:py-4">Challan</th>
                         <th className="px-2 py-2 md:px-6 md:py-4">Items</th>
                         <th className="px-2 py-2 md:px-6 md:py-4 text-right">Weight</th>
                         <th className="px-2 py-2 md:px-6 md:py-4 text-right">Amt</th>
                         <th className="px-2 py-2 md:px-6 md:py-4 text-center">Payment</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {partyChallans.length === 0 && (
                        <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic">No bill records found.</td></tr>
                      )}
                      {partyChallans.map((challan) => {
                         const isUnpaid = challan.paymentMode === PaymentMode.UNPAID;
                         const itemSummary = challan.lines.map(l => l.size).join(', ');
                         const isExpanded = expandedChallanId === challan.id;

                         return (
                            <React.Fragment key={challan.id}>
                                <tr 
                                  onClick={() => setExpandedChallanId(isExpanded ? null : challan.id)}
                                  className={`transition-colors cursor-pointer ${isExpanded ? 'bg-purple-50/50' : 'hover:bg-purple-50/20'}`}
                                >
                                   <td className="px-2 py-1 md:px-6 md:py-3 font-medium text-slate-600">{challan.date}</td>
                                   <td className="px-2 py-1 md:px-6 md:py-3 font-mono font-bold text-slate-800">#{challan.challanNumber}</td>
                                   <td className="px-2 py-1 md:px-6 md:py-3 text-[9px] md:text-xs text-slate-500 max-w-[80px] md:max-w-xs truncate" title={itemSummary}>{itemSummary}</td>
                                   <td className="px-2 py-1 md:px-6 md:py-3 text-right font-mono text-slate-700">{challan.totalWeight.toFixed(3)}</td>
                                   <td className="px-2 py-1 md:px-6 md:py-3 text-right font-bold text-slate-900">₹{challan.totalAmount.toLocaleString()}</td>
                                   <td className="px-2 py-1 md:px-6 md:py-3 text-center">
                                      <button 
                                         onClick={(e) => { e.stopPropagation(); handleTogglePayment(challan); }}
                                         className={`px-1.5 py-0.5 md:px-3 md:py-1.5 rounded-md text-[9px] md:text-xs font-bold tracking-wide border transition-all ${isUnpaid ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'}`}
                                      >
                                         {challan.paymentMode}
                                      </button>
                                   </td>
                                </tr>
                                {isExpanded && (
                                     <tr className="bg-slate-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                         <td colSpan={6} className="p-2 md:p-6 border-b border-slate-100 shadow-inner">
                                            <div className="bg-white rounded-lg border border-slate-200 p-2 md:p-4 max-w-3xl mx-auto shadow-sm">
                                                <div className="flex justify-between items-center mb-2 md:mb-4 border-b border-slate-100 pb-2">
                                                    <h4 className="text-[10px] md:text-sm font-bold text-slate-500 flex items-center gap-2">
                                                      <span className="text-sm md:text-lg">🧾</span> Challan Details
                                                    </h4>
                                                    <div className="text-[10px] md:text-xs font-bold text-slate-500">Items: {challan.lines.length}</div>
                                                </div>
                                                <table className="w-full text-[10px] md:text-sm text-left">
                                                    <thead className="text-[10px] md:text-xs text-slate-500 font-semibold border-b border-slate-100 bg-slate-50/50">
                                                        <tr>
                                                            <th className="py-1 md:py-2 pl-2 md:pl-3">Item</th>
                                                            <th className="py-1 md:py-2 text-right">Wt</th>
                                                            <th className="py-1 md:py-2 text-right">Rate</th>
                                                            <th className="py-1 md:py-2 text-right pr-2 md:pr-3">Amt</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {challan.lines.map((line, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50/50">
                                                                <td className="py-1 md:py-2 pl-2 md:pl-3 font-bold text-slate-800">{line.size}</td>
                                                                <td className="py-1 md:py-2 text-right text-slate-700 font-mono">{line.weight.toFixed(3)}</td>
                                                                <td className="py-1 md:py-2 text-right text-slate-700 font-mono">{line.rate}</td>
                                                                <td className="py-1 md:py-2 text-right pr-2 md:pr-3 font-bold text-slate-900">₹{line.amount.toFixed(2)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot className="border-t border-slate-100 bg-slate-50/30">
                                                        <tr>
                                                            <td colSpan={3} className="py-2 md:py-3 text-right text-[10px] md:text-sm font-bold text-slate-600">Total (Rounded)</td>
                                                            <td className="py-2 md:py-3 text-right pr-2 md:pr-3 font-bold text-sm md:text-lg text-slate-900">₹{Math.round(challan.totalAmount).toLocaleString()}</td>
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