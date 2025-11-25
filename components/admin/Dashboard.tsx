import React, { useMemo, useState } from 'react';
import { AppData, DispatchStatus, PaymentMode } from '../../types';

interface Props {
  data: AppData;
}

export const Dashboard: React.FC<Props> = ({ data }) => {
  const [tableView, setTableView] = useState<'challans' | 'jobs'>('challans');
  const [searchTerm, setSearchTerm] = useState('');

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

  // Search Logic
  const filteredChallans = data.challans.filter(c => {
    const party = data.parties.find(p => p.id === c.partyId)?.name.toLowerCase() || '';
    const match = party.includes(searchTerm.toLowerCase()) || 
                  c.challanNumber.toLowerCase().includes(searchTerm.toLowerCase());
    return match;
  });

  const filteredJobs = data.dispatches.filter(d => {
    const party = data.parties.find(p => p.id === d.partyId)?.name.toLowerCase() || '';
    const sizes = d.rows.map(r => r.size).join(' ').toLowerCase();
    const match = party.includes(searchTerm.toLowerCase()) || 
                  sizes.includes(searchTerm.toLowerCase());
    return match;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* 4 Card Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Revenue */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200/50 relative overflow-hidden group">
           <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-white opacity-5 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
           <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-5 border border-white/10">
             <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
           </div>
           <div className="text-[11px] font-bold text-indigo-100 uppercase tracking-widest mb-1 opacity-80">Total Revenue</div>
           <div className="text-3xl font-bold tracking-tight">₹{stats.revenue.toLocaleString()}</div>
        </div>

        {/* Weight */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/40 relative group hover:border-blue-200 transition-colors">
           <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-5 text-blue-600 border border-blue-100">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
           </div>
           <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Weight</div>
           <div className="text-3xl font-bold text-slate-800 tracking-tight font-mono">{stats.weight.toFixed(3)}<span className="text-lg text-slate-400 ml-1">kg</span></div>
        </div>

        {/* Top Party */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/40 relative group hover:border-amber-200 transition-colors">
           <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mb-5 text-amber-600 border border-amber-100">
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
           </div>
           <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Top Party</div>
           <div className="text-xl font-bold text-slate-800 truncate mb-1">{stats.topParty?.name || 'N/A'}</div>
           <div className="text-[10px] font-bold text-green-500 bg-green-50 inline-block px-2 py-0.5 rounded-full">₹{stats.topPartyVal.toLocaleString()} vol</div>
        </div>

        {/* Top Size */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/40 relative group hover:border-emerald-200 transition-colors">
           <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-5 text-emerald-600 border border-emerald-100">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
           </div>
           <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Top Size</div>
           <div className="text-2xl font-bold text-slate-800 tracking-tight">{stats.topSize || 'N/A'}</div>
           <div className="text-[10px] text-slate-400 mt-1 font-medium">Most dispatched item</div>
        </div>
      </div>

      {/* Main Table Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Toggle & Search Header */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
           <div className="flex bg-slate-200/50 p-1 rounded-xl">
              <button 
                onClick={() => setTableView('challans')}
                className={`px-6 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${tableView === 'challans' ? 'bg-white text-slate-800 shadow-md' : 'text-slate-500 hover:bg-white/50'}`}
              >
                Challans
              </button>
              <button 
                onClick={() => setTableView('jobs')}
                className={`px-6 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${tableView === 'jobs' ? 'bg-white text-slate-800 shadow-md' : 'text-slate-500 hover:bg-white/50'}`}
              >
                Jobs
              </button>
           </div>

           <div className="relative w-full sm:w-64">
              <input 
                type="text" 
                placeholder="Search records..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-indigo-500 transition-colors"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
           </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
           {tableView === 'challans' ? (
             <table className="w-full text-left text-xs">
               <thead className="bg-white text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                 <tr>
                   <th className="px-6 py-4">Date</th>
                   <th className="px-6 py-4">No</th>
                   <th className="px-6 py-4">Party</th>
                   <th className="px-6 py-4 text-center">Items</th>
                   <th className="px-6 py-4 text-right">Total</th>
                   <th className="px-6 py-4 text-center">Pay</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {filteredChallans.map(c => {
                   const partyName = data.parties.find(p => p.id === c.partyId)?.name || 'Unknown';
                   return (
                     <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                       <td className="px-6 py-4 text-slate-500 font-medium">{c.date}</td>
                       <td className="px-6 py-4 text-slate-400 font-mono text-[10px]">#{c.challanNumber.replace('CH-','')}</td>
                       <td className="px-6 py-4 font-bold text-slate-700">{partyName}</td>
                       <td className="px-6 py-4 text-center text-slate-500">{c.lines.length} Items</td>
                       <td className="px-6 py-4 text-right font-bold text-slate-800">₹{c.totalAmount.toLocaleString()}</td>
                       <td className="px-6 py-4 text-center">
                         <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${c.paymentMode === PaymentMode.UNPAID ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                           {c.paymentMode}
                         </span>
                       </td>
                     </tr>
                   )
                 })}
                 {filteredChallans.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No records found.</td></tr>}
               </tbody>
             </table>
           ) : (
             <table className="w-full text-left text-xs">
               <thead className="bg-white text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                 <tr>
                   <th className="px-6 py-4">Date</th>
                   <th className="px-6 py-4">Party</th>
                   <th className="px-6 py-4">Size (All)</th>
                   <th className="px-6 py-4 text-center">Weight</th>
                   <th className="px-6 py-4 text-center">Pcs</th>
                   <th className="px-6 py-4 text-center">Status</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {filteredJobs.map(d => {
                   const partyName = data.parties.find(p => p.id === d.partyId)?.name || 'Unknown';
                   const allSizes = d.rows.map(r => r.size).join(', ');
                   return (
                     <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                       <td className="px-6 py-4 text-slate-500 font-medium">{d.date}</td>
                       <td className="px-6 py-4 font-bold text-slate-700">{partyName}</td>
                       <td className="px-6 py-4 text-slate-600 max-w-xs">{allSizes}</td>
                       <td className="px-6 py-4 text-center font-mono text-slate-600">{d.totalWeight.toFixed(3)}</td>
                       <td className="px-6 py-4 text-center text-slate-600">{d.totalPcs}</td>
                       <td className="px-6 py-4 text-center">
                         <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase 
                            ${d.status === DispatchStatus.COMPLETED ? 'bg-emerald-100 text-emerald-600' : 
                              d.status === DispatchStatus.DISPATCHED ? 'bg-purple-100 text-purple-600' : 
                              d.status === DispatchStatus.LOADING ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                           {d.status}
                         </span>
                       </td>
                     </tr>
                   )
                 })}
                 {filteredJobs.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No jobs found.</td></tr>}
               </tbody>
             </table>
           )}
        </div>
      </div>

      {/* Data Management Section */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200">
         <h4 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Data Management</h4>
         <p className="text-xs text-slate-500 mb-4">
           Your data is securely stored in Google Cloud Firestore. You can export a local copy of your raw data JSON for backup or external analysis.
         </p>
         <div className="flex gap-3">
            <button 
              onClick={() => {
                const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
                const link = document.createElement("a");
                link.href = jsonString;
                link.download = `rdms_backup_${new Date().toISOString().split('T')[0]}.json`;
                link.click();
              }}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download Full Backup (JSON)
            </button>
         </div>
      </div>
    </div>
  );
};