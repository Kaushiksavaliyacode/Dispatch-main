import React, { useMemo, useState } from 'react';
import { AppData, DispatchStatus, PaymentMode, Challan } from '../../types';
import { deleteDispatch, deleteChallan, saveChallan } from '../../services/storageService';
import { MasterSheet } from './MasterSheet';
import { PartyDashboard } from './PartyDashboard';

interface Props {
  data: AppData;
}

export const Dashboard: React.FC<Props> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'master' | 'parties'>('overview');
  const [jobSearch, setJobSearch] = useState('');
  const [challanSearch, setChallanSearch] = useState('');
  const [expandedChallanId, setExpandedChallanId] = useState<string | null>(null);

  // Flatten Dispatches for Excel-like Live Feed
  const flatDispatchItems = useMemo(() => {
    return data.dispatches.flatMap(d => {
      const party = data.parties.find(p => p.id === d.partyId)?.name || 'Unknown';
      return d.rows.map((row, idx) => ({
        uniqueKey: `${d.id}-${idx}`,
        parentId: d.id,
        date: d.date,
        party,
        ...row,
        parentStatus: d.status
      }));
    }).filter(item => {
        const search = jobSearch.toLowerCase();
        return item.party.toLowerCase().includes(search) || item.size.toLowerCase().includes(search) || item.date.includes(search);
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data, jobSearch]);

  const filteredChallans = data.challans.filter(c => {
     const party = data.parties.find(p => p.id === c.partyId)?.name.toLowerCase() || '';
     return party.includes(challanSearch.toLowerCase()) || c.challanNumber.toLowerCase().includes(challanSearch.toLowerCase());
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleTogglePayment = async (c: Challan) => {
    const newMode = c.paymentMode === PaymentMode.UNPAID ? PaymentMode.CASH : PaymentMode.UNPAID;
    const updatedChallan = { ...c, paymentMode: newMode };
    await saveChallan(updatedChallan);
  };

  return (
    <div className="space-y-8 pb-12">
      
      {/* --- BIG GRADIENT TABS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`relative overflow-hidden p-6 rounded-3xl text-left transition-all duration-300 transform hover:scale-[1.01] ${activeTab === 'overview' ? 'shadow-2xl shadow-indigo-200 ring-2 ring-indigo-400 ring-offset-2' : 'bg-white border border-slate-200 hover:shadow-lg'}`}
          >
             {/* Background Gradient for Active State */}
             {activeTab === 'overview' && (
                 <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-600"></div>
             )}
             
             <div className="relative z-10 flex items-center justify-between">
                <div>
                   <div className={`p-3 w-14 h-14 rounded-2xl flex items-center justify-center mb-3 text-2xl shadow-md ${activeTab === 'overview' ? 'bg-white/20 text-white backdrop-blur-md' : 'bg-indigo-50 text-indigo-600'}`}>
                     📊
                   </div>
                   <h2 className={`text-xl font-bold ${activeTab === 'overview' ? 'text-white' : 'text-slate-800'}`}>Dashboard Overview</h2>
                   <p className={`text-sm font-medium mt-1 ${activeTab === 'overview' ? 'text-indigo-100' : 'text-slate-500'}`}>Live tracking & recent bills</p>
                </div>
                {activeTab === 'overview' && (
                  <div className="text-white opacity-20 transform scale-[2.5] -rotate-12 translate-y-4">
                    <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M3 3h18v18H3V3zm16 16V5H5v14h14zM7 11h4v6H7v-6zm6 0h4v6h-4v-6zm-6-4h10v2H7V7z"/></svg>
                  </div>
                )}
             </div>
          </button>

          <button 
            onClick={() => setActiveTab('parties')}
            className={`relative overflow-hidden p-6 rounded-3xl text-left transition-all duration-300 transform hover:scale-[1.01] ${activeTab === 'parties' ? 'shadow-2xl shadow-amber-200 ring-2 ring-amber-400 ring-offset-2' : 'bg-white border border-slate-200 hover:shadow-lg'}`}
          >
             {/* Background Gradient for Active State */}
             {activeTab === 'parties' && (
                 <div className="absolute inset-0 bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600"></div>
             )}

             <div className="relative z-10 flex items-center justify-between">
                <div>
                   <div className={`p-3 w-14 h-14 rounded-2xl flex items-center justify-center mb-3 text-2xl shadow-md ${activeTab === 'parties' ? 'bg-white/20 text-white backdrop-blur-md' : 'bg-orange-50 text-orange-600'}`}>
                     👥
                   </div>
                   <h2 className={`text-xl font-bold ${activeTab === 'parties' ? 'text-white' : 'text-slate-800'}`}>Party Directory</h2>
                   <p className={`text-sm font-medium mt-1 ${activeTab === 'parties' ? 'text-orange-100' : 'text-slate-500'}`}>Customer profiles & ledger</p>
                </div>
                {activeTab === 'parties' && (
                  <div className="text-white opacity-20 transform scale-[2.5] -rotate-12 translate-y-4">
                    <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  </div>
                )}
             </div>
          </button>

          <button 
            onClick={() => setActiveTab('master')}
            className={`relative overflow-hidden p-6 rounded-3xl text-left transition-all duration-300 transform hover:scale-[1.01] ${activeTab === 'master' ? 'shadow-2xl shadow-emerald-200 ring-2 ring-emerald-400 ring-offset-2' : 'bg-white border border-slate-200 hover:shadow-lg'}`}
          >
             {/* Background Gradient for Active State */}
             {activeTab === 'master' && (
                 <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600"></div>
             )}

             <div className="relative z-10 flex items-center justify-between">
                <div>
                   <div className={`p-3 w-14 h-14 rounded-2xl flex items-center justify-center mb-3 text-2xl shadow-md ${activeTab === 'master' ? 'bg-white/20 text-white backdrop-blur-md' : 'bg-emerald-50 text-emerald-600'}`}>
                     📑
                   </div>
                   <h2 className={`text-xl font-bold ${activeTab === 'master' ? 'text-white' : 'text-slate-800'}`}>Master Data Sheet</h2>
                   <p className={`text-sm font-medium mt-1 ${activeTab === 'master' ? 'text-emerald-100' : 'text-slate-500'}`}>Full records & CSV export</p>
                </div>
                {activeTab === 'master' && (
                  <div className="text-white opacity-20 transform scale-[2.5] -rotate-12 translate-y-4">
                    <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h5v5h5v11H6z"/></svg>
                  </div>
                )}
             </div>
          </button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* --- LIVE DISPATCH FEED (EXCEL STYLE) --- */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-5 flex flex-col md:flex-row justify-between items-center gap-4">
                   <div className="flex items-center gap-3 text-white">
                      <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm animate-pulse">
                         <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold tracking-wide">Live Dispatch Feed</h3>
                        <p className="text-xs text-blue-100 font-medium">Real-time production floor activity</p>
                      </div>
                   </div>
                   <input 
                      type="text" 
                      placeholder="Search Job, Party, Size..." 
                      value={jobSearch}
                      onChange={e => setJobSearch(e.target.value)}
                      className="bg-white/10 border border-white/20 text-white placeholder-blue-200 rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:bg-white/20 transition-all w-full md:w-64"
                   />
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-600 font-semibold text-xs tracking-wide border-b border-slate-200">
                           <tr>
                              <th className="px-6 py-4">Date</th>
                              <th className="px-6 py-4">Party Name</th>
                              <th className="px-6 py-4">Item Size</th>
                              <th className="px-6 py-4 text-center">📦</th>
                              <th className="px-6 py-4 text-right">Pcs / Rolls</th>
                              <th className="px-6 py-4 text-right">Weight</th>
                              <th className="px-6 py-4 text-center">Status</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {flatDispatchItems.slice(0, 50).map((row) => {
                               let statusBadge = "bg-slate-100 text-slate-500";
                               if(row.status === DispatchStatus.COMPLETED) statusBadge = "bg-emerald-100 text-emerald-600";
                               else if(row.status === DispatchStatus.DISPATCHED) statusBadge = "bg-purple-100 text-purple-600";
                               else if(row.status === DispatchStatus.LOADING) statusBadge = "bg-amber-100 text-amber-600 animate-pulse";
                               
                               const isMm = row.size.toLowerCase().includes('mm');

                               return (
                                   <tr key={row.uniqueKey} className="hover:bg-indigo-50/30 transition-colors group">
                                      <td className="px-6 py-3 font-medium text-slate-600">{row.date}</td>
                                      <td className="px-6 py-3 font-semibold text-slate-800">{row.party}</td>
                                      <td className="px-6 py-3 font-semibold text-slate-700">{row.size}</td>
                                      <td className="px-6 py-3 text-center font-medium text-slate-600">{row.bundle}</td>
                                      <td className="px-6 py-3 text-right font-mono text-slate-700">{row.pcs} <span className="text-xs text-slate-500">{isMm ? 'Rolls' : 'Pcs'}</span></td>
                                      <td className="px-6 py-3 text-right font-mono font-bold text-slate-700">{row.weight.toFixed(3)}</td>
                                      <td className="px-6 py-3 text-center">
                                         <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wide border border-transparent ${statusBadge}`}>
                                            {row.status === DispatchStatus.LOADING ? 'RUNNING' : row.status}
                                         </span>
                                      </td>
                                   </tr>
                               )
                           })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- TRANSACTION HISTORY (WITH SIZE COLUMN & EXPANDABLE) --- */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-6 py-5 flex flex-col md:flex-row justify-between items-center gap-4">
                   <div className="flex items-center gap-3 text-white">
                      <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                         <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                      </div>
                      <h3 className="text-lg font-bold tracking-wide">Transaction History</h3>
                   </div>
                   <input 
                      type="text" 
                      placeholder="Search Bill..." 
                      value={challanSearch}
                      onChange={e => setChallanSearch(e.target.value)}
                      className="bg-white/10 border border-white/20 text-white placeholder-emerald-100 rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:bg-white/20 transition-all w-full md:w-64"
                   />
                </div>
                
                <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 text-slate-600 font-semibold text-xs tracking-wide border-b border-slate-200">
                         <tr>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Challan #</th>
                            <th className="px-6 py-4">Party Name</th>
                            <th className="px-6 py-4">Items / Sizes</th>
                            <th className="px-6 py-4 text-right">Amount</th>
                            <th className="px-6 py-4 text-center">Mode (Click to change)</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {filteredChallans.slice(0, 30).map(c => {
                             const party = data.parties.find(p => p.id === c.partyId)?.name || 'Unknown';
                             const isUnpaid = c.paymentMode === PaymentMode.UNPAID;
                             const itemSummary = c.lines.map(l => l.size).join(', ');
                             const isExpanded = expandedChallanId === c.id;

                             return (
                                 <React.Fragment key={c.id}>
                                     <tr 
                                        onClick={() => setExpandedChallanId(isExpanded ? null : c.id)}
                                        className={`transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                                     >
                                        <td className="px-6 py-3 font-medium text-slate-600">{c.date}</td>
                                        <td className="px-6 py-3 font-mono font-bold text-slate-800">{c.challanNumber}</td>
                                        <td className="px-6 py-3 font-bold text-slate-800">{party}</td>
                                        <td className="px-6 py-3 text-xs font-semibold text-slate-600 max-w-xs truncate" title={itemSummary}>
                                            {itemSummary}
                                        </td>
                                        <td className="px-6 py-3 text-right font-bold text-slate-900">₹{c.totalAmount.toLocaleString()}</td>
                                        <td className="px-6 py-3 text-center">
                                           <button 
                                              onClick={(e) => { e.stopPropagation(); handleTogglePayment(c); }}
                                              className={`px-3 py-1.5 rounded-md text-xs font-bold tracking-wide border transition-all ${isUnpaid ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'}`}
                                              title="Toggle Status"
                                           >
                                              {c.paymentMode}
                                           </button>
                                        </td>
                                     </tr>
                                     {isExpanded && (
                                         <tr className="bg-slate-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                             <td colSpan={6} className="p-4 sm:p-6 border-b border-slate-100 shadow-inner">
                                                <div className="bg-white rounded-xl border border-slate-200 p-4 max-w-4xl mx-auto shadow-sm">
                                                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                                                        <h4 className="text-sm font-bold text-slate-500 flex items-center gap-2">
                                                          <span className="text-lg">🧾</span> Challan Details
                                                        </h4>
                                                        <div className="text-xs font-bold text-slate-500">Total Items: {c.lines.length}</div>
                                                    </div>
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="text-xs text-slate-500 font-semibold border-b border-slate-100 bg-slate-50/50">
                                                            <tr>
                                                                <th className="py-2 pl-3">Item Description</th>
                                                                <th className="py-2 text-right">Weight (kg)</th>
                                                                <th className="py-2 text-right">Rate</th>
                                                                <th className="py-2 text-right pr-3">Amount</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-50">
                                                            {c.lines.map((line, idx) => (
                                                                <tr key={idx} className="hover:bg-slate-50/50">
                                                                    <td className="py-2 pl-3 font-bold text-slate-700 text-sm">{line.size}</td>
                                                                    <td className="py-2 text-right text-slate-700 font-mono text-sm">{line.weight.toFixed(3)}</td>
                                                                    <td className="py-2 text-right text-slate-700 font-mono text-sm">{line.rate}</td>
                                                                    <td className="py-2 text-right pr-3 font-bold text-slate-800 text-sm">₹{line.amount.toFixed(2)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot className="border-t border-slate-100 bg-slate-50/30">
                                                            <tr>
                                                                <td colSpan={3} className="py-3 text-right text-sm font-bold text-slate-600">Grand Total (Rounded)</td>
                                                                <td className="py-3 text-right pr-3 font-bold text-lg text-slate-900">₹{Math.round(c.totalAmount).toLocaleString()}</td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                             </td>
                                         </tr>
                                     )}
                                 </React.Fragment>
                             );
                         })}
                      </tbody>
                   </table>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'parties' && (
        <PartyDashboard data={data} />
      )}

      {activeTab === 'master' && (
        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
           <MasterSheet data={data} />
        </div>
      )}
    </div>
  );
};