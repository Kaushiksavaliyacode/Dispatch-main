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
    return { revenue, weight };
  }, [data]);

  const filteredJobs = data.dispatches.filter(d => {
    const party = data.parties.find(p => p.id === d.partyId)?.name.toLowerCase() || '';
    return party.includes(jobSearch.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Mini Stats */}
      <div className="grid grid-cols-2 gap-4">
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Revenue</div>
            <div className="text-2xl font-bold text-slate-900">₹{stats.revenue.toLocaleString()}</div>
         </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Weight</div>
            <div className="text-2xl font-bold text-slate-900">{stats.weight.toFixed(3)} <span className="text-sm text-slate-400">kg</span></div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {/* Live Dispatch */}
         <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[500px]">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2">
                    <span className="text-base">🚛</span> Live Jobs
                 </h3>
                 <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded">{filteredJobs.length}</span>
             </div>
             <div className="p-2 border-b border-slate-100">
                <input placeholder="Search Jobs..." value={jobSearch} onChange={e => setJobSearch(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none uppercase" />
             </div>
             <div className="flex-1 overflow-auto p-2 space-y-2">
                {filteredJobs.map(d => {
                   const party = data.parties.find(p => p.id === d.partyId)?.name || 'Unknown';
                   let statusText = d.status === DispatchStatus.LOADING ? 'RUNNING' : (d.status || 'PENDING');
                   let statusColor = 'bg-slate-100 text-slate-500';
                   if(d.status === DispatchStatus.COMPLETED) statusColor = 'bg-emerald-100 text-emerald-700';
                   else if(d.status === DispatchStatus.DISPATCHED) statusColor = 'bg-purple-100 text-purple-700';
                   else if(d.status === DispatchStatus.LOADING) statusColor = 'bg-amber-100 text-amber-700';

                   return (
                     <div key={d.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200 relative group">
                        <div className="flex justify-between items-start mb-2">
                           <div>
                              <div className="text-[9px] font-bold text-slate-400">{d.date}</div>
                              <div className="text-xs font-bold text-slate-800 uppercase">{party}</div>
                           </div>
                           <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${statusColor}`}>{statusText}</span>
                        </div>
                        <table className="w-full text-[9px]">
                           <tbody>
                              {d.rows.map((r, i) => (
                                 <tr key={i} className="text-slate-600">
                                    <td className="font-bold uppercase w-1/2">{r.size}</td>
                                    <td className="text-right">{r.weight.toFixed(3)}kg</td>
                                    <td className="text-right">{r.pcs}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                        <button onClick={() => { if(confirm('Delete?')) deleteDispatch(d.id) }} className="absolute top-2 right-2 hidden group-hover:block bg-white text-red-500 border border-red-100 text-[9px] font-bold px-2 py-0.5 rounded">DEL</button>
                     </div>
                   );
                })}
             </div>
         </div>

         {/* Transactions */}
         <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[500px]">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2">
                    <span className="text-base">🧾</span> History
                 </h3>
             </div>
             <div className="flex-1 overflow-auto p-2 space-y-2">
                {data.challans.slice(0, 30).map(c => {
                   const party = data.parties.find(p => p.id === c.partyId)?.name || 'Unknown';
                   const isUnpaid = c.paymentMode === PaymentMode.UNPAID;
                   return (
                      <div key={c.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex justify-between items-center">
                         <div>
                            <div className="text-[9px] font-bold text-slate-400">{c.date} • #{c.challanNumber}</div>
                            <div className="text-xs font-bold text-slate-800 uppercase">{party}</div>
                         </div>
                         <div className="text-right">
                            <div className="text-xs font-bold text-slate-900">₹{c.totalAmount.toLocaleString()}</div>
                            <span className={`text-[8px] font-bold uppercase ${isUnpaid ? 'text-red-500' : 'text-emerald-500'}`}>{c.paymentMode}</span>
                         </div>
                      </div>
                   );
                })}
             </div>
         </div>
      </div>
    </div>
  );
};