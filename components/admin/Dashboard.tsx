import React, { useMemo, useState, useRef } from 'react';
import { AppData, DispatchStatus, PaymentMode } from '../../types';
import { createBackup, restoreBackup } from '../../services/storageService';

interface Props {
  data: AppData;
}

export const Dashboard: React.FC<Props> = ({ data }) => {
  const [tableView, setTableView] = useState<'challans' | 'jobs'>('challans');
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleBackup = () => {
    const json = createBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RDMS_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = restoreBackup(content);
        if (success) {
          alert("Data restored successfully! The page will now reload.");
          window.location.reload();
        } else {
          alert("Failed to restore data. Invalid file format.");
        }
      }
    };
    reader.readAsText(file);
  };

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
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
           </div>
           <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Top Performer</div>
           <div className="text-xl font-bold text-slate-800 truncate mb-1">{stats.topParty?.name || 'N/A'}</div>
           <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
              ₹{stats.topPartyVal.toLocaleString()} Volume
           </div>
        </div>

        {/* Top Size */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/40 relative group hover:border-emerald-200 transition-colors">
           <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-5 text-emerald-600 border border-emerald-100">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
           </div>
           <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Top Product</div>
           <div className="text-2xl font-bold text-slate-800 font-mono tracking-tight">{stats.topSize || 'N/A'}</div>
           <div className="text-[10px] text-emerald-600 font-bold mt-1">High Demand</div>
        </div>
      </div>

      {/* Main Data Section */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Modern Tab Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex bg-slate-100/80 p-1.5 rounded-xl self-start">
              <button 
                onClick={() => setTableView('challans')}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                  tableView === 'challans' 
                  ? 'bg-white text-indigo-600 shadow-md shadow-slate-200' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                Challans
              </button>
              <button 
                onClick={() => setTableView('jobs')}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                  tableView === 'jobs' 
                  ? 'bg-white text-blue-600 shadow-md shadow-slate-200' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                Jobs
              </button>
            </div>

            {/* Functional Search Bar */}
            <div className="relative group w-full md:w-72">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
               </div>
               <input 
                 type="text" 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl leading-5 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                 placeholder={`Search ${tableView}...`}
               />
            </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto min-h-[400px]">
          {tableView === 'challans' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">No</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Party</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Weight</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Total</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredChallans.map(c => (
                  <tr key={c.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-500">{c.date}</td>
                    <td className="px-6 py-4 text-sm text-slate-400 font-mono">#{c.challanNumber.replace('CH-', '')}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-800">{data.parties.find(p => p.id === c.partyId)?.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{c.lines.length} Items</td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-mono text-right">{c.totalWeight.toFixed(3)}</td>
                    <td className="px-6 py-4 text-sm font-black text-slate-800 text-right">₹{c.totalAmount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                       <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${c.paymentMode === PaymentMode.UNPAID ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                         {c.paymentMode}
                       </span>
                    </td>
                  </tr>
                ))}
                {filteredChallans.length === 0 && (
                   <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">No challans found matching your search.</td></tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Party</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Size</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Weight</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Pcs</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredJobs.map(d => (
                  <tr key={d.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-500 whitespace-nowrap">{d.date}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-800 whitespace-nowrap">{data.parties.find(p => p.id === d.partyId)?.name}</td>
                    {/* Removed truncation/max-width to show all sizes */}
                    <td className="px-6 py-4 text-sm text-slate-600 font-mono" title={d.rows.map(r => r.size).join(', ')}>
                      {d.rows.map(r => r.size).join(', ')}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 font-mono font-bold">{d.totalWeight.toFixed(3)}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 font-mono">{d.totalPcs}</td>
                    <td className="px-6 py-4 text-center">
                       <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                         d.status === DispatchStatus.COMPLETED ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                         d.status === DispatchStatus.DISPATCHED ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                         d.status === DispatchStatus.LOADING ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                         'bg-blue-50 text-blue-600 border border-blue-100'
                       }`}>
                         {d.status}
                       </span>
                    </td>
                  </tr>
                ))}
                {filteredJobs.length === 0 && (
                   <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">No jobs found matching your search.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Data Management Section */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
         <div>
            <h3 className="text-lg font-bold text-slate-800">Data Management</h3>
            <p className="text-sm text-slate-500">Securely backup your system data or restore from a previous file.</p>
         </div>
         <div className="flex gap-3">
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileChange}
            />
            <button 
              onClick={handleRestoreClick}
              className="px-5 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold rounded-xl text-sm transition-all shadow-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              Restore Data
            </button>
            <button 
              onClick={handleBackup}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-slate-200 flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download Backup
            </button>
         </div>
      </div>
    </div>
  );
};