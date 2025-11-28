
import React, { useMemo, useState } from 'react';
import { AppData, DispatchStatus, PaymentMode, Challan, DispatchEntry } from '../../types';
import { deleteDispatch, deleteChallan, saveChallan, saveDispatch } from '../../services/storageService';
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

  // Helper to remove year
  const formatDateNoYear = (dateStr: string) => {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}`;
  };

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
        parentStatus: d.status,
        isTodayDispatch: d.isTodayDispatch
      }));
    }).filter(item => {
        const search = jobSearch.toLowerCase();
        return item.party.toLowerCase().includes(search) || item.size.toLowerCase().includes(search) || item.date.includes(search);
    }).sort((a, b) => {
        // 1. Priority: Today's Dispatch (Top)
        if (a.isTodayDispatch && !b.isTodayDispatch) return -1;
        if (!a.isTodayDispatch && b.isTodayDispatch) return 1;
        // 2. Secondary: Date (Newest first)
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
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

  const handleToggleToday = async (dispatchId: string, currentStatus: boolean | undefined) => {
    const dispatch = data.dispatches.find(d => d.id === dispatchId);
    if (dispatch) {
      const updatedDispatch = { ...dispatch, isTodayDispatch: !currentStatus };
      await saveDispatch(updatedDispatch);
    }
  };

  const shareChallanImage = async (challanId: string, challanNo: string) => {
    const element = document.getElementById(`challan-card-${challanId}`);
    if (element && (window as any).html2canvas) {
      try {
        const canvas = await (window as any).html2canvas(element, { 
          backgroundColor: '#ffffff',
          scale: 2 // High resolution
        });
        
        canvas.toBlob(async (blob: Blob) => {
          if (blob) {
            const file = new File([blob], `Challan_${challanNo}.png`, { type: 'image/png' });
            
            // Try native sharing (Mobile)
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
              try {
                await navigator.share({
                  files: [file],
                  title: `Challan #${challanNo}`,
                  text: `Details for Challan #${challanNo}`
                });
              } catch (err) {
                console.log("Share failed/cancelled", err);
              }
            } else {
              // Fallback to download (Desktop)
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = `Challan_${challanNo}.png`;
              link.click();
              alert("Image downloaded! You can now send it via WhatsApp Web.");
            }
          }
        });
      } catch (e) {
        console.error("Image generation failed", e);
        alert("Failed to generate image.");
      }
    } else {
      alert("Image generator not ready. Please refresh.");
    }
  };

  return (
    <div className="space-y-4 md:space-y-8 pb-12">
      
      {/* --- BIG GRADIENT TABS (ALWAYS COLORED) --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`relative overflow-hidden p-4 md:p-6 rounded-2xl md:rounded-3xl text-left transition-all duration-300 transform hover:scale-[1.01] ${activeTab === 'overview' ? 'shadow-2xl shadow-indigo-200 ring-2 md:ring-4 ring-indigo-300 ring-offset-2 scale-[1.02]' : 'shadow-md opacity-90 hover:opacity-100'}`}
          >
             {/* Always Visible Gradient */}
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-600"></div>
             
             <div className="relative z-10 flex items-center justify-between text-white">
                <div>
                   <div className="p-2 md:p-3 w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-3 text-lg md:text-2xl shadow-md bg-white/20 backdrop-blur-md">
                     📊
                   </div>
                   <h2 className="text-base md:text-xl font-bold">Overview</h2>
                   <p className="text-[10px] md:text-sm font-medium mt-1 text-indigo-100">Live tracking</p>
                </div>
                {/* Always visible icon, slightly faded if inactive */}
                <div className={`text-white transform scale-[2.5] -rotate-12 translate-y-4 transition-opacity ${activeTab === 'overview' ? 'opacity-20' : 'opacity-10'}`}>
                    <svg className="w-16 h-16 md:w-24 md:h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M3 3h18v18H3V3zm16 16V5H5v14h14zM7 11h4v6H7v-6zm6 0h4v6h-4v-6zm-6-4h10v2H7V7z"/></svg>
                </div>
             </div>
          </button>

          <button 
            onClick={() => setActiveTab('parties')}
            className={`relative overflow-hidden p-4 md:p-6 rounded-2xl md:rounded-3xl text-left transition-all duration-300 transform hover:scale-[1.01] ${activeTab === 'parties' ? 'shadow-2xl shadow-purple-200 ring-2 md:ring-4 ring-purple-300 ring-offset-2 scale-[1.02]' : 'shadow-md opacity-90 hover:opacity-100'}`}
          >
             {/* Always Visible Gradient */}
             <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-600"></div>

             <div className="relative z-10 flex items-center justify-between text-white">
                <div>
                   <div className="p-2 md:p-3 w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-3 text-lg md:text-2xl shadow-md bg-white/20 backdrop-blur-md">
                     👥
                   </div>
                   <h2 className="text-base md:text-xl font-bold">Directory</h2>
                   <p className="text-[10px] md:text-sm font-medium mt-1 text-purple-100">Customers</p>
                </div>
                <div className={`text-white transform scale-[2.5] -rotate-12 translate-y-4 transition-opacity ${activeTab === 'parties' ? 'opacity-20' : 'opacity-10'}`}>
                    <svg className="w-16 h-16 md:w-24 md:h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
             </div>
          </button>

          <button 
            onClick={() => setActiveTab('master')}
            className={`relative overflow-hidden p-4 md:p-6 rounded-2xl md:rounded-3xl text-left transition-all duration-300 transform hover:scale-[1.01] ${activeTab === 'master' ? 'shadow-2xl shadow-emerald-200 ring-2 md:ring-4 ring-emerald-300 ring-offset-2 scale-[1.02]' : 'shadow-md opacity-90 hover:opacity-100'}`}
          >
             {/* Always Visible Gradient */}
             <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600"></div>

             <div className="relative z-10 flex items-center justify-between text-white">
                <div>
                   <div className="p-2 md:p-3 w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-3 text-lg md:text-2xl shadow-md bg-white/20 backdrop-blur-md">
                     📑
                   </div>
                   <h2 className="text-base md:text-xl font-bold">Master Data</h2>
                   <p className="text-[10px] md:text-sm font-medium mt-1 text-emerald-100">Full Records</p>
                </div>
                <div className={`text-white transform scale-[2.5] -rotate-12 translate-y-4 transition-opacity ${activeTab === 'master' ? 'opacity-20' : 'opacity-10'}`}>
                    <svg className="w-16 h-16 md:w-24 md:h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h5v5h5v11H6z"/></svg>
                </div>
             </div>
          </button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* --- LIVE DISPATCH FEED (EXCEL STYLE) --- */}
            <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-3 md:px-6 md:py-5 flex flex-col md:flex-row justify-between items-center gap-3">
                   <div className="flex items-center gap-2 text-white w-full md:w-auto">
                      <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm animate-pulse">
                         <svg className="w-4 h-4 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </div>
                      <div>
                        <h3 className="text-sm md:text-lg font-bold tracking-wide">Live Feed</h3>
                      </div>
                   </div>
                   <input 
                      type="text" 
                      placeholder="Search..." 
                      value={jobSearch}
                      onChange={e => setJobSearch(e.target.value)}
                      className="bg-white/10 border border-white/20 text-white placeholder-blue-200 rounded-lg px-3 py-1.5 text-xs md:text-sm font-semibold outline-none focus:bg-white/20 transition-all w-full md:w-64"
                   />
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px] sm:text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-600 font-semibold text-[10px] sm:text-xs tracking-wide border-b border-slate-200">
                           <tr>
                              <th className="px-2 py-2 sm:px-6 sm:py-4">Date</th>
                              <th className="px-2 py-2 sm:px-6 sm:py-4">Party</th>
                              <th className="px-2 py-2 sm:px-6 sm:py-4">Size</th>
                              <th className="px-2 py-2 sm:px-6 sm:py-4 text-center">📦</th>
                              <th className="px-2 py-2 sm:px-6 sm:py-4 text-right">Pcs/Rolls</th>
                              <th className="px-2 py-2 sm:px-6 sm:py-4 text-right">Wt</th>
                              <th className="px-2 py-2 sm:px-6 sm:py-4 text-center">Today</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {flatDispatchItems.slice(0, 50).map((row, index) => {
                               const isMm = row.size.toLowerCase().includes('mm');

                               // Compare with previous row to see if party changed
                               const prevRow = index > 0 ? flatDispatchItems[index - 1] : null;
                               const isNewParty = prevRow && prevRow.party !== row.party;

                               // Determine Color based on Status
                               let textColor = 'text-slate-600';
                               if (row.status === DispatchStatus.COMPLETED) textColor = 'text-emerald-600 font-bold'; // Green for Complete
                               else if (row.status === DispatchStatus.LOADING) textColor = 'text-blue-600 font-bold'; // Blue for Running
                               else if (row.status === DispatchStatus.PENDING || !row.status) textColor = 'text-red-500 font-bold'; // Red for Pending
                               else if (row.status === DispatchStatus.DISPATCHED) textColor = 'text-slate-900 font-bold'; // Black for Dispatched

                               return (
                                   <tr key={row.uniqueKey} className={`hover:bg-indigo-50/30 transition-colors group border-b border-slate-100 ${isNewParty ? 'border-t-4 border-t-blue-600' : ''}`}>
                                      <td className={`px-2 py-3 sm:px-6 sm:py-4 font-medium ${textColor} ${isNewParty ? 'pt-5 sm:pt-7' : ''}`}>{formatDateNoYear(row.date)}</td>
                                      <td className={`px-2 py-3 sm:px-6 sm:py-4 font-semibold ${textColor} max-w-[100px] sm:max-w-none truncate ${isNewParty ? 'pt-5 sm:pt-7' : ''}`}>
                                        <div className="flex items-center gap-1">
                                          {row.party}
                                        </div>
                                      </td>
                                      <td className={`px-2 py-3 sm:px-6 sm:py-4 font-semibold ${textColor} ${isNewParty ? 'pt-5 sm:pt-7' : ''}`}>{row.size}</td>
                                      <td className={`px-2 py-3 sm:px-6 sm:py-4 text-center font-medium ${textColor} ${isNewParty ? 'pt-5 sm:pt-7' : ''}`}>{row.bundle}</td>
                                      <td className={`px-2 py-3 sm:px-6 sm:py-4 text-right font-mono ${textColor} ${isNewParty ? 'pt-5 sm:pt-7' : ''}`}>{row.pcs} <span className="text-[9px] sm:text-xs text-slate-400">{isMm ? 'R' : 'P'}</span></td>
                                      <td className={`px-2 py-3 sm:px-6 sm:py-4 text-right font-mono font-bold ${textColor} ${isNewParty ? 'pt-5 sm:pt-7' : ''}`}>{row.weight.toFixed(3)}</td>
                                      <td className={`px-2 py-3 sm:px-6 sm:py-4 text-center ${isNewParty ? 'pt-5 sm:pt-7' : ''}`}>
                                         <button 
                                            onClick={() => handleToggleToday(row.parentId, row.isTodayDispatch)}
                                            className={`p-1.5 rounded-full transition-all ${row.isTodayDispatch ? 'bg-indigo-100 text-indigo-600 ring-2 ring-indigo-200' : 'text-slate-300 hover:bg-slate-100'}`}
                                            title="Toggle Today's Dispatch"
                                         >
                                            <svg className="w-4 h-4 md:w-5 md:h-5" fill={row.isTodayDispatch ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                            </svg>
                                         </button>
                                      </td>
                                   </tr>
                               )
                           })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- TRANSACTION HISTORY (WITH SIZE COLUMN & EXPANDABLE) --- */}
            <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-4 py-3 md:px-6 md:py-5 flex flex-col md:flex-row justify-between items-center gap-3">
                   <div className="flex items-center gap-2 text-white w-full md:w-auto">
                      <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                         <svg className="w-4 h-4 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                      </div>
                      <h3 className="text-sm md:text-lg font-bold tracking-wide">Transactions</h3>
                   </div>
                   <input 
                      type="text" 
                      placeholder="Search Bill..." 
                      value={challanSearch}
                      onChange={e => setChallanSearch(e.target.value)}
                      className="bg-white/10 border border-white/20 text-white placeholder-emerald-100 rounded-lg px-3 py-1.5 text-xs md:text-sm font-semibold outline-none focus:bg-white/20 transition-all w-full md:w-64"
                   />
                </div>
                
                <div className="overflow-x-auto">
                   <table className="w-full text-left text-[10px] sm:text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 text-slate-600 font-semibold text-[10px] sm:text-xs tracking-wide border-b border-slate-200">
                         <tr>
                            <th className="px-2 py-2 sm:px-6 sm:py-4">Date</th>
                            <th className="px-2 py-2 sm:px-6 sm:py-4">Challan</th>
                            <th className="px-2 py-2 sm:px-6 sm:py-4">Party</th>
                            <th className="px-2 py-2 sm:px-6 sm:py-4">Items</th>
                            <th className="px-2 py-2 sm:px-6 sm:py-4 text-right">Amt</th>
                            <th className="px-2 py-2 sm:px-6 sm:py-4 text-center">Mode</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {filteredChallans.slice(0, 30).map(c => {
                             const party = data.parties.find(p => p.id === c.partyId)?.name || 'Unknown';
                             const isUnpaid = c.paymentMode === PaymentMode.UNPAID;
                             const itemSummary = c.lines.map(l => l.size).join(', ');
                             const isExpanded = expandedChallanId === c.id;

                             // Payment Color Logic
                             const textColor = isUnpaid ? 'text-red-600' : 'text-emerald-600';

                             return (
                                 <React.Fragment key={c.id}>
                                     <tr 
                                        onClick={() => setExpandedChallanId(isExpanded ? null : c.id)}
                                        className={`transition-colors cursor-pointer border-b border-slate-50 ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                                     >
                                        <td className={`px-2 py-3 sm:px-6 sm:py-4 font-medium ${textColor}`}>{formatDateNoYear(c.date)}</td>
                                        <td className={`px-2 py-3 sm:px-6 sm:py-4 font-mono font-bold ${textColor}`}>#{c.challanNumber}</td>
                                        <td className={`px-2 py-3 sm:px-6 sm:py-4 font-bold ${textColor} max-w-[100px] sm:max-w-none truncate`}>{party}</td>
                                        <td className={`px-2 py-3 sm:px-6 sm:py-4 text-[9px] sm:text-xs font-semibold ${textColor} max-w-[80px] sm:max-w-xs truncate`} title={itemSummary}>
                                            {itemSummary}
                                        </td>
                                        <td className={`px-2 py-3 sm:px-6 sm:py-4 text-right font-bold ${textColor}`}>₹{c.totalAmount.toLocaleString()}</td>
                                        <td className="px-2 py-3 sm:px-6 sm:py-4 text-center">
                                           <button 
                                              onClick={(e) => { e.stopPropagation(); handleTogglePayment(c); }}
                                              className={`px-2 py-1 rounded md:px-3 md:py-1.5 text-[9px] sm:text-xs font-bold tracking-wide border transition-all ${isUnpaid ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'}`}
                                              title="Toggle Status"
                                           >
                                              {c.paymentMode}
                                           </button>
                                        </td>
                                     </tr>
                                     {isExpanded && (
                                         <tr className="bg-slate-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                             <td colSpan={6} className="p-2 md:p-6 border-b border-slate-100 shadow-inner">
                                                <div id={`challan-card-${c.id}`} className="bg-white rounded-lg border border-slate-200 p-3 md:p-5 max-w-4xl mx-auto shadow-sm">
                                                    <div className="flex justify-between items-center mb-3 md:mb-5 border-b border-slate-100 pb-3">
                                                        <div>
                                                            <h4 className="text-xs md:text-sm font-bold text-slate-800 flex items-center gap-2">
                                                              <span className="text-sm md:text-lg">🧾</span> Challan #{c.challanNumber}
                                                            </h4>
                                                            <div className="text-[10px] md:text-xs text-slate-500 mt-1">{party} • {c.date}</div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                          <button 
                                                            onClick={() => shareChallanImage(c.id, c.challanNumber)}
                                                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded-md text-[10px] md:text-xs font-bold flex items-center gap-1 transition-colors shadow-sm"
                                                          >
                                                            <svg className="w-3 h-3 md:w-4 md:h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-8.683-2.031-.967-.272-.297-.471-.421-.92-.891-.298-.471-.794-.666-1.514-.666-.72 0-1.885.27-2.871 1.336-.986 1.066-3.758 3.515-3.758 8.57 0 5.055 3.684 9.941 4.179 10.662.495.721 7.218 11.025 17.514 11.025 10.296 0 11.757-.692 13.843-2.775 2.086-2.083 2.086-3.89 2.086-3.89.27-.124.544-.272.718-.396.174-.124.322-.272.396-.446.074-.174.198-.644.198-1.336 0-.692-.52-1.238-1.114-1.535z"/></svg>
                                                            Share Bill
                                                          </button>
                                                          <div className="text-[10px] md:text-xs font-bold text-slate-500">Items: {c.lines.length}</div>
                                                        </div>
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
                                                            {c.lines.map((line, idx) => (
                                                                <tr key={idx} className="hover:bg-slate-50/50">
                                                                    <td className="py-1 md:py-2 pl-2 md:pl-3 font-bold text-slate-700">{line.size}</td>
                                                                    <td className="py-1 md:py-2 text-right text-slate-700 font-mono">{line.weight.toFixed(3)}</td>
                                                                    <td className="py-1 md:py-2 text-right text-slate-700 font-mono">{line.rate}</td>
                                                                    <td className="py-1 md:py-2 text-right pr-2 md:pr-3 font-bold text-slate-800">₹{line.amount.toFixed(2)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot className="border-t border-slate-100 bg-slate-50/30">
                                                            <tr>
                                                                <td colSpan={3} className="py-2 md:py-3 text-right text-[10px] md:text-sm font-bold text-slate-600">Total (Rounded)</td>
                                                                <td className="py-2 md:py-3 text-right pr-2 md:pr-3 font-bold text-sm md:text-lg text-slate-900">₹{Math.round(c.totalAmount).toLocaleString()}</td>
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
