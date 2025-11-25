import React, { useMemo, useState } from 'react';
import { AppData, DispatchStatus, PaymentMode } from '../../types';
import { deleteDispatch, deleteChallan } from '../../services/storageService';

interface Props {
  data: AppData;
}

export const Dashboard: React.FC<Props> = ({ data }) => {
  const [jobSearch, setJobSearch] = useState('');
  const [challanSearch, setChallanSearch] = useState('');

  const filteredJobs = data.dispatches.filter(d => {
    const party = data.parties.find(p => p.id === d.partyId)?.name.toLowerCase() || '';
    return party.includes(jobSearch.toLowerCase());
  });

  const filteredChallans = data.challans.filter(c => {
    const party = data.parties.find(p => p.id === c.partyId)?.name.toLowerCase() || '';
    return party.includes(challanSearch.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         {/* Live Dispatch */}
         <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-800 px-4 py-3 flex justify-between items-center text-white">
               <h3 className="text-xs font-bold uppercase tracking-wide">Live Jobs ({filteredJobs.length})</h3>
               <input 
                 className="bg-slate-700 border-none text-xs rounded px-2 py-1 outline-none text-white placeholder-slate-400" 
                 placeholder="Search..."
                 value={jobSearch} onChange={e => setJobSearch(e.target.value)}
               />
            </div>
            <div className="max-h-[500px] overflow-auto">
               {filteredJobs.map(d => {
                 const party = data.parties.find(p => p.id === d.partyId)?.name || '';
                 const statusText = d.status === DispatchStatus.LOADING ? 'RUNNING' : (d.status || 'PENDING');
                 let statusClass = 'bg-slate-100 text-slate-500';
                 if(d.status === DispatchStatus.LOADING) statusClass = 'bg-amber-100 text-amber-600';
                 if(d.status === DispatchStatus.COMPLETED) statusClass = 'bg-emerald-100 text-emerald-600';
                 if(d.status === DispatchStatus.DISPATCHED) statusClass = 'bg-purple-100 text-purple-600';

                 return (
                   <div key={d.id} className="p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <div className="flex justify-between mb-1">
                         <span className="text-xs font-bold uppercase text-slate-800">{party}</span>
                         <span className={`text-[9px] font-bold px-1.5 rounded uppercase ${statusClass}`}>{statusText}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mb-2">{d.date} • {d.totalWeight.toFixed(3)} kg</div>
                      <div className="flex flex-wrap gap-1">
                        {d.rows.map((r,i) => (
                          <span key={i} className="text-[9px] bg-slate-100 text-slate-600 px-1 rounded border border-slate-200">
                             {r.size} ({r.weight.toFixed(3)})
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 text-right">
                         <button onClick={() => deleteDispatch(d.id)} className="text-[9px] text-red-400 hover:text-red-600 font-bold uppercase">Delete</button>
                      </div>
                   </div>
                 );
               })}
            </div>
         </div>

         {/* Billing */}
         <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-800 px-4 py-3 flex justify-between items-center text-white">
               <h3 className="text-xs font-bold uppercase tracking-wide">Transactions ({filteredChallans.length})</h3>
               <input 
                 className="bg-slate-700 border-none text-xs rounded px-2 py-1 outline-none text-white placeholder-slate-400" 
                 placeholder="Search..."
                 value={challanSearch} onChange={e => setChallanSearch(e.target.value)}
               />
            </div>
            <div className="max-h-[500px] overflow-auto">
               {filteredChallans.map(c => {
                 const party = data.parties.find(p => p.id === c.partyId)?.name || '';
                 const isUnpaid = c.paymentMode === PaymentMode.UNPAID;
                 return (
                   <div key={c.id} className="p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 flex justify-between items-center">
                      <div>
                         <div className="text-xs font-bold uppercase text-slate-800">{party}</div>
                         <div className="text-[10px] text-slate-400">#{c.challanNumber} • {c.date}</div>
                      </div>
                      <div className="text-right">
                         <div className="text-sm font-bold text-slate-900">₹{c.totalAmount.toLocaleString()}</div>
                         <div className="flex items-center justify-end gap-2">
                            <span className={`text-[9px] uppercase font-bold px-1 rounded ${isUnpaid?'text-red-500 bg-red-50':'text-green-500 bg-green-50'}`}>{c.paymentMode}</span>
                            <button onClick={() => deleteChallan(c.id)} className="text-[9px] text-slate-300 hover:text-red-500">×</button>
                         </div>
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