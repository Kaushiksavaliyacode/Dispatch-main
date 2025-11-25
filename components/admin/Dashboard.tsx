import React, { useMemo, useState } from 'react';
import { AppData, DispatchStatus, PaymentMode } from '../../types';
import { deleteDispatch, deleteChallan } from '../../services/storageService';

interface Props {
  data: AppData;
}

export const Dashboard: React.FC<Props> = ({ data }) => {
  // Separate Search States
  const [jobSearch, setJobSearch] = useState('');
  const [challanSearch, setChallanSearch] = useState('');

  // --- Stats Calculation ---
  const stats = useMemo(() => {
    const revenue = data.challans.reduce((s, c) => s + c.totalAmount, 0);
    const weight = data.dispatches.reduce((s, d) => s + d.totalWeight, 0);
    
    // Top Party
    const partyCounts: Record<string, number> = {};
    data.challans.forEach(c => { partyCounts[c.partyId] = (partyCounts[c.partyId] || 0) + c.totalAmount; });
    const topPartyId = Object.keys(partyCounts).sort((a,b) => partyCounts[b] - partyCounts[a])[0];
    const topParty = data.parties.find(p => p.id === topPartyId);
    
    // Top Size (based on jobs)
    const sizeCounts: Record<string, number> = {};
    data.dispatches.forEach(d => { 
        d.rows.forEach(r => { sizeCounts[r.size] = (sizeCounts[r.size] || 0) + 1; });
    });
    const topSize = Object.keys(sizeCounts).sort((a,b) => sizeCounts[b] - sizeCounts[a])[0];

    return { revenue, weight, topParty, topSize, topPartyVal: partyCounts[topPartyId] || 0 };
  }, [data]);

  // --- Filter Logic ---
  const filteredChallans = data.challans.filter(c => {
    const party = data.parties.find(p => p.id === c.partyId)?.name.toLowerCase() || '';
    return party.includes(challanSearch.toLowerCase()) || 
           c.challanNumber.toLowerCase().includes(challanSearch.toLowerCase());
  });

  const filteredJobs = data.dispatches.filter(d => {
    const party = data.parties.find(p => p.id === d.partyId)?.name.toLowerCase() || '';
    const sizes = d.rows.map(r => r.size).join(' ').toLowerCase();
    return party.includes(jobSearch.toLowerCase()) || 
           sizes.includes(jobSearch.toLowerCase());
  });

  // --- Handlers ---
  const handleDeleteJob = async (id: string) => {
    if (confirm("Are you sure you want to permanently delete this JOB ENTRY?")) {
      await deleteDispatch(id);
    }
  };

  const handleDeleteChallan = async (id: string) => {
    if (confirm("Are you sure you want to permanently delete this BILL?")) {
      await deleteChallan(id);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/50 pb-20 font-['Plus_Jakarta_Sans']">
      
      {/* --- STATS HEADER --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-32">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Revenue</div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">₹{stats.revenue.toLocaleString()}</div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-indigo-600 h-full w-2/3 rounded-full"></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-32">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Weight</div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">{stats.weight.toFixed(2)} <span className="text-lg text-slate-400">kg</span></div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full w-1/2 rounded-full"></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-32">
           <div className="flex justify-between items-start">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Top Party</div>
              <span className="bg-green-100 text-green-700 text-[9px] font-bold px-2 py-1 rounded-full">LEADER</span>
           </div>
           <div>
             <div className="text-lg font-black text-slate-900 truncate">{stats.topParty?.name || 'N/A'}</div>
             <div className="text-[10px] font-bold text-slate-400">Vol: ₹{stats.topPartyVal.toLocaleString()}</div>
           </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-32">
           <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Top Item</div>
           <div className="text-xl font-black text-slate-900 truncate">{stats.topSize || 'N/A'}</div>
           <div className="text-[10px] font-bold text-slate-400">Most frequent dispatch</div>
        </div>
      </div>

      {/* --- DUAL CARD LAYOUT --- */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        
        {/* LEFT CARD: JOBS (Logistics) */}
        <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 p-2 md:p-6">
           {/* Header & Search */}
           <div className="flex flex-col gap-4 mb-6 px-2 pt-2">
              <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                      <span className="text-3xl">🚛</span>
                      <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest leading-none">Live Dispatch</h2>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Operations Feed</span>
                      </div>
                  </div>
                  <span className="bg-blue-100 text-blue-700 text-sm font-black px-3 py-1 rounded-xl">{filteredJobs.length}</span>
              </div>
              <input 
                type="text" 
                placeholder="SEARCH DISPATCH..." 
                value={jobSearch}
                onChange={e => setJobSearch(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors uppercase"
              />
           </div>

           {/* Jobs List */}
           <div className="space-y-4 max-h-[800px] overflow-y-auto custom-scrollbar pr-2">
             {filteredJobs.map(d => {
               const partyName = data.parties.find(p => p.id === d.partyId)?.name || 'Unknown';
               return (
                 <div key={d.id} className="bg-slate-50 rounded-3xl p-5 border border-slate-200 relative group transition-all hover:bg-white hover:shadow-lg">
                    {/* Delete Button */}
                    <button 
                      onClick={() => handleDeleteJob(d.id)}
                      className="absolute top-4 right-4 p-2 bg-white text-slate-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors border border-slate-200 opacity-0 group-hover:opacity-100 z-10"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>

                    <div className="mb-4 pr-10">
                       <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase bg-white px-2 py-0.5 rounded-md border border-slate-100">{d.date}</span>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                            d.status === DispatchStatus.COMPLETED ? 'bg-emerald-100 text-emerald-600' : 
                            d.status === DispatchStatus.DISPATCHED ? 'bg-purple-100 text-purple-600' : 
                            d.status === DispatchStatus.LOADING ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'
                          }`}>
                            {d.status}
                          </span>
                       </div>
                       <h3 className="text-lg font-black text-slate-800 uppercase leading-none">{partyName}</h3>
                    </div>

                    {/* Compact Table */}
                    <div className="bg-white rounded-2xl p-2 border border-slate-100 mb-2">
                      <table className="w-full text-[10px]">
                         <tbody className="divide-y divide-slate-100">
                           {d.rows.map((r, i) => (
                             <tr key={i}>
                               <td className="py-1.5 pl-1 font-bold text-slate-700 w-1/3 truncate">{r.size}</td>
                               <td className="py-1.5 text-center text-slate-500">{r.weight}kg</td>
                               <td className="py-1.5 text-center text-slate-500">{r.pcs}pc</td>
                               <td className="py-1.5 text-center text-slate-500">📦{r.bundle}</td>
                               <td className="py-1.5 text-right pr-1">
                                 <div className={`w-2 h-2 rounded-full inline-block ${
                                    r.status === DispatchStatus.DISPATCHED ? 'bg-purple-500' : 
                                    r.status === DispatchStatus.COMPLETED ? 'bg-emerald-500' : 'bg-slate-300'
                                 }`}></div>
                               </td>
                             </tr>
                           ))}
                         </tbody>
                      </table>
                    </div>
                 </div>
               );
             })}
             {filteredJobs.length === 0 && (
               <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-bold uppercase tracking-widest">No Active Jobs</div>
             )}
           </div>
        </div>

        {/* RIGHT CARD: CHALLANS (Billing) */}
        <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 p-2 md:p-6">
           {/* Header & Search */}
           <div className="flex flex-col gap-4 mb-6 px-2 pt-2">
              <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                      <span className="text-3xl">🧾</span>
                      <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest leading-none">Transactions</h2>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Billing History</span>
                      </div>
                  </div>
                  <span className="bg-red-100 text-red-700 text-sm font-black px-3 py-1 rounded-xl">{filteredChallans.length}</span>
              </div>
              <input 
                type="text" 
                placeholder="SEARCH BILLS..." 
                value={challanSearch}
                onChange={e => setChallanSearch(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-red-500 transition-colors uppercase"
              />
           </div>

           {/* Challans List */}
           <div className="space-y-4 max-h-[800px] overflow-y-auto custom-scrollbar pr-2">
             {filteredChallans.map(c => {
               const partyName = data.parties.find(p => p.id === c.partyId)?.name || 'Unknown';
               return (
                 <div key={c.id} className="bg-slate-50 rounded-3xl p-5 border border-slate-200 relative group transition-all hover:bg-white hover:shadow-lg">
                    {/* Delete Button */}
                    <button 
                      onClick={() => handleDeleteChallan(c.id)}
                      className="absolute top-4 right-4 p-2 bg-white text-slate-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors border border-slate-200 opacity-0 group-hover:opacity-100 z-10"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>

                    <div className="mb-4 pr-10">
                       <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase bg-white px-2 py-0.5 rounded-md border border-slate-100">{c.date}</span>
                          <span className="text-[10px] font-black text-slate-500 uppercase bg-white px-2 py-0.5 rounded-md border border-slate-100">#{c.challanNumber}</span>
                       </div>
                       <h3 className="text-lg font-black text-slate-800 uppercase leading-none">{partyName}</h3>
                    </div>

                    {/* Compact Table */}
                    <div className="bg-white rounded-2xl p-2 border border-slate-100 mb-3">
                      <table className="w-full text-[10px]">
                         <tbody className="divide-y divide-slate-100">
                           {c.lines.map((l, i) => (
                             <tr key={i}>
                               <td className="py-1.5 pl-1 font-bold text-slate-700 w-1/3 truncate">{l.size}</td>
                               <td className="py-1.5 text-center text-slate-500">{l.weight}</td>
                               <td className="py-1.5 text-center text-slate-500">{l.rate}</td>
                               <td className="py-1.5 text-right pr-1 font-bold text-slate-800">{l.amount}</td>
                             </tr>
                           ))}
                         </tbody>
                      </table>
                    </div>

                    <div className="flex justify-between items-center px-1">
                       <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wide ${
                          c.paymentMode === PaymentMode.UNPAID ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                       }`}>
                         {c.paymentMode}
                       </span>
                       <div className="font-black text-lg text-slate-900">
                          ₹{c.totalAmount.toLocaleString()}
                       </div>
                    </div>
                 </div>
               );
             })}
             {filteredChallans.length === 0 && (
               <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-bold uppercase tracking-widest">No Transactions</div>
             )}
           </div>
        </div>

      </div>
    </div>
  );
};