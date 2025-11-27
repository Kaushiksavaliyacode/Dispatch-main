import React, { useMemo, useState } from 'react';
import { AppData, DispatchStatus, PaymentMode } from '../../types';
import { deleteDispatch, deleteChallan } from '../../services/storageService';

interface Props {
  data: AppData;
}

export const Dashboard: React.FC<Props> = ({ data }) => {
  const [jobSearch, setJobSearch] = useState('');
  const [challanSearch, setChallanSearch] = useState('');

  const stats = useMemo(() => {
    const revenue = data.challans.reduce((s, c) => s + c.totalAmount, 0);
    const weight = data.dispatches.reduce((s, d) => s + d.totalWeight, 0);
    const pendingJobs = data.dispatches.filter(d => d.status !== DispatchStatus.DISPATCHED).length;
    const unpaidAmt = data.challans.filter(c => c.paymentMode === PaymentMode.UNPAID).reduce((s, c) => s + c.totalAmount, 0);
    return { revenue, weight, pendingJobs, unpaidAmt };
  }, [data]);

  const filteredJobs = data.dispatches.filter(d => {
    const party = data.parties.find(p => p.id === d.partyId)?.name.toLowerCase() || '';
    return party.includes(jobSearch.toLowerCase());
  });

  const filteredChallans = data.challans.filter(c => {
     const party = data.parties.find(p => p.id === c.partyId)?.name.toLowerCase() || '';
     return party.includes(challanSearch.toLowerCase()) || c.challanNumber.toLowerCase().includes(challanSearch.toLowerCase());
  });

  return (
    <div className="space-y-6">
      
      {/* Stats Cards - 4 Column Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Revenue</div>
                <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
            </div>
            <div className="text-2xl lg:text-3xl font-bold text-slate-900">₹{stats.revenue.toLocaleString()}</div>
         </div>
         <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Weight</div>
                <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg></div>
            </div>
            <div className="text-2xl lg:text-3xl font-bold text-slate-900">{stats.weight.toFixed(3)} <span className="text-sm text-slate-400 font-medium">kg</span></div>
         </div>
         <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Jobs</div>
                <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg></div>
            </div>
            <div className="text-2xl lg:text-3xl font-bold text-slate-900">{stats.pendingJobs}</div>
         </div>
         <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unpaid Credit</div>
                <div className="p-1.5 bg-red-50 rounded-lg text-red-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
            </div>
            <div className="text-2xl lg:text-3xl font-bold text-red-500">₹{stats.unpaidAmt.toLocaleString()}</div>
         </div>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-[600px]">
         
         {/* Live Dispatch Feed */}
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <div className="flex items-center gap-2">
                    <span className="text-xl">🚛</span>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Live Dispatch Feed</h3>
                 </div>
                 <div className="flex items-center gap-2">
                    <input 
                        placeholder="Search Party..." 
                        value={jobSearch} 
                        onChange={e => setJobSearch(e.target.value)} 
                        className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold outline-none uppercase focus:ring-2 focus:ring-indigo-100 w-48 transition-all" 
                    />
                 </div>
             </div>
             <div className="flex-1 overflow-auto bg-slate-50/50 p-0">
                <table className="w-full text-left border-collapse">
                   <thead className="bg-slate-100 sticky top-0 z-10">
                      <tr>
                         <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                         <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Party</th>
                         <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Items</th>
                         <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Status</th>
                         <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {filteredJobs.length === 0 && (
                          <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm font-medium">No active jobs found</td></tr>
                      )}
                      {filteredJobs.map(d => {
                         const party = data.parties.find(p => p.id === d.partyId)?.name || 'Unknown';
                         let statusText = d.status === DispatchStatus.LOADING ? 'RUNNING' : (d.status || 'PENDING');
                         let statusColor = 'bg-slate-100 text-slate-600';
                         if(d.status === DispatchStatus.COMPLETED) statusColor = 'bg-emerald-100 text-emerald-700';
                         else if(d.status === DispatchStatus.DISPATCHED) statusColor = 'bg-purple-100 text-purple-700';
                         else if(d.status === DispatchStatus.LOADING) statusColor = 'bg-amber-100 text-amber-700';

                         return (
                           <React.Fragment key={d.id}>
                               <tr className="bg-white hover:bg-indigo-50/30 transition-colors group">
                                  <td className="px-4 py-3 text-xs font-medium text-slate-500 whitespace-nowrap">{d.date}</td>
                                  <td className="px-4 py-3 text-sm font-bold text-slate-800 uppercase">{party}</td>
                                  <td className="px-4 py-3 text-xs text-slate-600">
                                     <div className="flex flex-col gap-0.5">
                                        {d.rows.map((r, i) => (
                                           <div key={i} className="flex gap-2">
                                              <span className="font-bold uppercase w-16">{r.size}</span>
                                              <span className="text-slate-400">|</span>
                                              <span className="w-16 text-right font-mono">{r.weight.toFixed(3)}kg</span>
                                              <span className="text-slate-400">|</span>
                                              <span className="text-slate-500">{r.pcs} {r.size.toLowerCase().includes('mm')?'Roll':'Pcs'}</span>
                                              <span className="text-slate-400">|</span>
                                              <span className="text-slate-500 uppercase">{r.bundle}</span>
                                           </div>
                                        ))}
                                     </div>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                     <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${statusColor}`}>{statusText}</span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                     <button 
                                        onClick={() => { if(confirm('Permanently delete this job?')) deleteDispatch(d.id) }} 
                                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                        title="Delete Job"
                                     >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                     </button>
                                  </td>
                               </tr>
                           </React.Fragment>
                         );
                      })}
                   </tbody>
                </table>
             </div>
         </div>

         {/* Transaction History */}
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <div className="flex items-center gap-2">
                    <span className="text-xl">🧾</span>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Transaction History</h3>
                 </div>
                 <div className="flex items-center gap-2">
                    <input 
                        placeholder="Search Challan/Party..." 
                        value={challanSearch} 
                        onChange={e => setChallanSearch(e.target.value)} 
                        className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold outline-none uppercase focus:ring-2 focus:ring-indigo-100 w-48 transition-all" 
                    />
                 </div>
             </div>
             <div className="flex-1 overflow-auto bg-slate-50/50 p-0">
                <table className="w-full text-left border-collapse">
                   <thead className="bg-slate-100 sticky top-0 z-10">
                      <tr>
                         <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date / No</th>
                         <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Party Name</th>
                         <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                         <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Mode</th>
                         <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {filteredChallans.length === 0 && (
                          <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm font-medium">No transactions found</td></tr>
                      )}
                      {filteredChallans.slice(0, 50).map(c => {
                         const party = data.parties.find(p => p.id === c.partyId)?.name || 'Unknown';
                         const isUnpaid = c.paymentMode === PaymentMode.UNPAID;

                         return (
                           <tr key={c.id} className="bg-white hover:bg-indigo-50/30 transition-colors group">
                              <td className="px-4 py-3">
                                 <div className="text-xs font-medium text-slate-900">{c.date}</div>
                                 <div className="text-[10px] font-bold text-slate-400">#{c.challanNumber}</div>
                              </td>
                              <td className="px-4 py-3 text-sm font-bold text-slate-800 uppercase">{party}</td>
                              <td className="px-4 py-3 text-right font-bold text-slate-800">₹{c.totalAmount.toLocaleString()}</td>
                              <td className="px-4 py-3 text-right">
                                 <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${isUnpaid ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>{c.paymentMode}</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                 <button 
                                    onClick={() => { if(confirm('Delete this bill?')) deleteChallan(c.id) }} 
                                    className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                    title="Delete Bill"
                                 >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                 </button>
                              </td>
                           </tr>
                         );
                      })}
                   </tbody>
                </table>
             </div>
         </div>
      </div>
    </div>
  );
};