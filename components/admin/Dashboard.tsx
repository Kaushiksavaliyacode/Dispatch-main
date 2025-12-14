
import React, { useMemo, useState } from 'react';
import { AppData, DispatchStatus, PaymentMode, Challan, DispatchEntry } from '../../types';
import { saveChallan } from '../../services/storageService'; // Keeping saveChallan if needed for other things, but removing edit logic
import { MasterSheet } from './MasterSheet';
import { PartyDashboard } from './PartyDashboard';
import { AnalyticsDashboard } from './AnalyticsDashboard'; 
import { ChemicalManager } from './ChemicalManager';
import { ProductionPlanner } from './ProductionPlanner';

interface Props {
  data: AppData;
}

export const Dashboard: React.FC<Props> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'master' | 'parties' | 'planning' | 'chemical'>('overview');
  const [jobSearch, setJobSearch] = useState('');
  const [challanSearch, setChallanSearch] = useState('');
  const [expandedChallanId, setExpandedChallanId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const formatDateNoYear = (dateStr: string) => {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}`;
  };

  const filteredDispatches = useMemo(() => {
    const search = jobSearch.toLowerCase();
    return data.dispatches.filter(d => {
      const party = data.parties.find(p => p.id === d.partyId)?.name.toLowerCase() || '';
      const dateMatch = d.date.includes(search);
      const partyMatch = party.includes(search);
      const itemMatch = d.rows.some(r => r.size.toLowerCase().includes(search));
      
      return partyMatch || dateMatch || itemMatch;
    }).sort((a, b) => {
        // Custom Sort Order: 
        // 0. Today OR (Cutting/Printing/Slitting) -> Top Priority
        // 1. Pending
        // 2. Completed
        // 3. Dispatched
        const getPriority = (d: DispatchEntry) => {
            if (d.isTodayDispatch) return 0;
            if (['CUTTING', 'PRINTING', 'SLITTING'].includes(d.status)) return 0;
            if (d.status === 'PENDING') return 1;
            if (d.status === 'COMPLETED') return 2;
            if (d.status === 'DISPATCHED') return 3;
            return 4;
        };
        const pA = getPriority(a);
        const pB = getPriority(b);
        
        if (pA !== pB) return pA - pB;
        
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [data, jobSearch]);

  const filteredChallans = data.challans.filter(c => {
     const party = data.parties.find(p => p.id === c.partyId)?.name.toLowerCase() || '';
     return party.includes(challanSearch.toLowerCase()) || c.challanNumber.toLowerCase().includes(challanSearch.toLowerCase());
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Removed handleTogglePayment and handleToggleToday to enforce Read-Only mode for Admin

  const shareJobImage = async (d: DispatchEntry) => {
      const containerId = 'temp-share-container-admin';
      let container = document.getElementById(containerId);
      if (container) document.body.removeChild(container);
      container = document.createElement('div');
      container.id = containerId;
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = '600px';
      container.style.backgroundColor = '#ffffff';
      container.style.padding = '0'; 
      container.style.fontFamily = 'Inter, sans-serif';
      container.style.color = '#000';
      document.body.appendChild(container);
  
      const party = data.parties.find(p => p.id === d.partyId)?.name || 'Unknown';
      const totalBundles = d.rows.reduce((acc, r) => acc + (Number(r.bundle) || 0), 0);
  
      const rowsHtml = d.rows.map((r, index) => {
        const isLabel = r.sizeType?.toUpperCase() === 'LABEL';
        const micronText = isLabel && r.micron ? ` <span style="font-size:11px; color:#64748b;">(${r.micron} mic)</span>` : '';

        return `
        <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 12px 15px; font-weight: bold; color: #334155;">
             ${r.size}${micronText} 
             <span style="font-size:10px; color:#6366f1; background:#eef2ff; padding: 2px 4px; border-radius: 4px; text-transform: uppercase;">${r.sizeType || ''}</span>
          </td>
          <td style="padding: 12px 15px; text-align: right; color: #475569;">${r.weight.toFixed(3)}</td>
          <td style="padding: 12px 15px; text-align: right; color: #475569;">${r.pcs}</td>
          <td style="padding: 12px 15px; text-align: right; color: #475569;">${r.bundle}</td>
        </tr>
      `}).join('');
  
      container.innerHTML = `
        <div style="overflow: hidden; border-radius: 0;">
          <div style="background: linear-gradient(135deg, #4f46e5, #6366f1); padding: 25px; color: white;">
             <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                   <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8;">Dispatch Note</div>
                   <div style="font-size: 24px; font-weight: bold; margin-top: 5px;">${party}</div>
                </div>
                <div style="text-align: right;">
                   <div style="background: rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 8px; backdrop-filter: blur(5px);">
                      <div style="font-size: 11px; font-weight: bold;">${d.date}</div>
                   </div>
                   <div style="font-size: 11px; margin-top: 5px; opacity: 0.9;">Job #${d.dispatchNo}</div>
                </div>
             </div>
          </div>
          <div style="padding: 20px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <thead style="background: #f1f5f9;">
                  <tr>
                  <th style="padding: 10px 15px; text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase;">Size</th>
                  <th style="padding: 10px 15px; text-align: right; color: #64748b; font-size: 11px; text-transform: uppercase;">Weight</th>
                  <th style="padding: 10px 15px; text-align: right; color: #64748b; font-size: 11px; text-transform: uppercase;">Pcs</th>
                  <th style="padding: 10px 15px; text-align: right; color: #64748b; font-size: 11px; text-transform: uppercase;">Bundle</th>
                  </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
              <tfoot style="background: #f8fafc; font-weight: bold; border-top: 2px solid #e2e8f0;">
                  <tr>
                  <td style="padding: 15px; color: #334155;">TOTAL</td>
                  <td style="padding: 15px; text-align: right; color: #334155;">${d.totalWeight.toFixed(3)}</td>
                  <td style="padding: 15px; text-align: right; color: #334155;">${d.totalPcs}</td>
                  <td style="padding: 15px; text-align: right; color: #334155;">${totalBundles}</td>
                  </tr>
              </tfoot>
              </table>
          </div>
        </div>
      `;
  
      if ((window as any).html2canvas) {
        try {
          const canvas = await (window as any).html2canvas(container, { backgroundColor: '#ffffff', scale: 2 });
          canvas.toBlob(async (blob: Blob) => {
            if (blob) {
              const file = new File([blob], `Job_${d.dispatchNo}.png`, { type: 'image/png' });
              if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: `Job #${d.dispatchNo}`, text: `Dispatch Details for ${party}` });
              } else {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `Job_${d.dispatchNo}.png`;
                link.click();
                alert("Image downloaded! You can now send it via WhatsApp Web.");
              }
            }
            if (document.body.contains(container!)) document.body.removeChild(container!);
          });
        } catch (e) {
          console.error("Image generation failed", e);
          if (document.body.contains(container!)) document.body.removeChild(container!);
        }
      } else {
          if (document.body.contains(container!)) document.body.removeChild(container!);
      }
  };

  const shareChallanImage = async (challanId: string, challanNo: string) => {
      const element = document.getElementById(`challan-card-${challanId}`);
      if (element && (window as any).html2canvas) {
        try {
          const canvas = await (window as any).html2canvas(element, { backgroundColor: '#ffffff', scale: 2 });
          canvas.toBlob(async (blob: Blob) => {
            if (blob) {
              const file = new File([blob], `Challan_${challanNo}.png`, { type: 'image/png' });
              if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: `Challan #${challanNo}`, text: `Details for Challan #${challanNo}` });
              } else {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `Challan_${challanNo}.png`;
                link.click();
                alert("Image downloaded! You can now send it via WhatsApp Web.");
              }
            }
          });
        } catch (e) { console.error(e); }
      }
  };

  return (
    <div className="space-y-4 sm:space-y-8 pb-12">
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 sm:gap-4">
          <button onClick={() => setActiveTab('overview')} className={`relative overflow-hidden p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left transition-all duration-300 transform hover:scale-[1.01] ${activeTab === 'overview' ? 'shadow-xl shadow-indigo-200 ring-2 ring-indigo-300 scale-[1.02]' : 'shadow-md opacity-90'}`}>
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-blue-600"></div>
             <div className="relative z-10 text-white flex flex-col items-center">
                <span className="text-xl sm:text-2xl mb-1">📊</span><span className="text-[10px] sm:text-xs font-bold">Overview</span>
             </div>
          </button>
          
          <button onClick={() => setActiveTab('analytics')} className={`relative overflow-hidden p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left transition-all duration-300 transform hover:scale-[1.01] ${activeTab === 'analytics' ? 'shadow-xl shadow-blue-200 ring-2 ring-blue-300 scale-[1.02]' : 'shadow-md opacity-90'}`}>
             <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-cyan-600"></div>
             <div className="relative z-10 text-white flex flex-col items-center">
                <span className="text-xl sm:text-2xl mb-1">📈</span><span className="text-[10px] sm:text-xs font-bold">Analytics</span>
             </div>
          </button>

          <button onClick={() => setActiveTab('parties')} className={`relative overflow-hidden p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left transition-all duration-300 transform hover:scale-[1.01] ${activeTab === 'parties' ? 'shadow-xl shadow-purple-200 ring-2 ring-purple-300 scale-[1.02]' : 'shadow-md opacity-90'}`}>
             <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-600"></div>
             <div className="relative z-10 text-white flex flex-col items-center">
                <span className="text-xl sm:text-2xl mb-1">👥</span><span className="text-[10px] sm:text-xs font-bold">Directory</span>
             </div>
          </button>

          <button onClick={() => setActiveTab('planning')} className={`relative overflow-hidden p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left transition-all duration-300 transform hover:scale-[1.01] ${activeTab === 'planning' ? 'shadow-xl shadow-amber-200 ring-2 ring-amber-300 scale-[1.02]' : 'shadow-md opacity-90'}`}>
             <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-600"></div>
             <div className="relative z-10 text-white flex flex-col items-center">
                <span className="text-xl sm:text-2xl mb-1">📝</span><span className="text-[10px] sm:text-xs font-bold">Planning</span>
             </div>
          </button>

          <button onClick={() => setActiveTab('chemical')} className={`relative overflow-hidden p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left transition-all duration-300 transform hover:scale-[1.01] ${activeTab === 'chemical' ? 'shadow-xl shadow-cyan-200 ring-2 ring-cyan-300 scale-[1.02]' : 'shadow-md opacity-90'}`}>
             <div className="absolute inset-0 bg-gradient-to-br from-cyan-600 to-blue-700"></div>
             <div className="relative z-10 text-white flex flex-col items-center">
                <span className="text-xl sm:text-2xl mb-1">🧪</span><span className="text-[10px] sm:text-xs font-bold">Chemical</span>
             </div>
          </button>

          <button onClick={() => setActiveTab('master')} className={`relative overflow-hidden p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left transition-all duration-300 transform hover:scale-[1.01] ${activeTab === 'master' ? 'shadow-xl shadow-emerald-200 ring-2 ring-emerald-300 scale-[1.02]' : 'shadow-md opacity-90'}`}>
             <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 to-teal-600"></div>
             <div className="relative z-10 text-white flex flex-col items-center">
                <span className="text-xl sm:text-2xl mb-1">📑</span><span className="text-[10px] sm:text-xs font-bold">Records</span>
             </div>
          </button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Live Feed */}
            <div className="space-y-3">
               <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200">
                  <div className="flex items-center gap-2 w-full sm:w-auto"><span className="text-lg sm:text-xl">🚛</span><h3 className="text-sm sm:text-lg font-bold text-slate-800">Live Feed</h3></div>
                  <input type="text" placeholder="Search Jobs..." value={jobSearch} onChange={e => setJobSearch(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-100 w-full sm:max-w-xs" />
               </div>

               {filteredDispatches.map(d => {
                  const party = data.parties.find(p => p.id === d.partyId);
                  const isExpanded = expandedJobId === d.id;
                  const totalBundles = d.rows.reduce((acc, r) => acc + (Number(r.bundle) || 0), 0);
                  let statusColor = 'bg-slate-100 text-slate-500 border-l-slate-300';
                  let statusText = d.status || 'PENDING';
                  let cardAnimation = '';
                  if(d.status === DispatchStatus.COMPLETED) { statusColor = 'bg-emerald-50 text-emerald-600 border-l-emerald-500'; }
                  else if(d.status === DispatchStatus.DISPATCHED) { statusColor = 'bg-purple-50 text-purple-600 border-l-purple-500'; }
                  else if(d.status === DispatchStatus.PRINTING) { statusColor = 'bg-indigo-50 text-indigo-600 border-l-indigo-500'; }
                  else if(d.status === DispatchStatus.SLITTING) { statusColor = 'bg-amber-50 text-amber-600 border-l-amber-500'; cardAnimation = 'ring-2 ring-amber-100 animate-pulse'; }
                  else if(d.status === DispatchStatus.CUTTING) { statusColor = 'bg-blue-50 text-blue-600 border-l-blue-500'; cardAnimation = 'ring-2 ring-blue-100 animate-pulse'; }
                  const isToday = d.isTodayDispatch;

                  return (
                    <div key={d.id} id={`job-card-${d.id}`} className={`bg-white rounded-lg border shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 group ${isToday ? 'border-indigo-300 ring-1 ring-indigo-50' : 'border-slate-200'} ${cardAnimation} mb-1.5`}>
                       <div onClick={() => setExpandedJobId(isExpanded ? null : d.id)} className={`relative p-2 cursor-pointer border-l-4 ${statusColor.split(' ').pop()} transition-colors`}>
                         <div className="flex justify-between items-start gap-1">
                            {/* LEFT SIDE: DATE, PARTY, JOB NO */}
                            <div className="w-[60%] min-w-0">
                              <div className="text-[9px] font-bold text-slate-400 font-mono leading-none mb-1">
                                {d.date.substring(5).split('-').reverse().join('/')}
                              </div>
                              <h4 className="text-xs font-bold text-slate-800 leading-tight break-words whitespace-normal">{party?.name}</h4>
                              <div className="text-[9px] text-slate-400 font-mono mt-0.5 font-bold">#{d.dispatchNo}</div>
                            </div>

                            {/* RIGHT SIDE: STATUS & STATS */}
                            <div className="flex flex-col items-end gap-1.5 w-[40%]">
                                <div className="flex items-center gap-1 justify-end flex-wrap">
                                    {isToday && <span className="bg-indigo-600 text-white px-1 py-0.5 rounded-[3px] text-[8px] font-bold leading-none">TODAY</span>}
                                    <span className={`px-1.5 py-0.5 rounded-[3px] text-[8px] font-bold uppercase leading-none border ${statusColor.replace('border-l-4','').replace('border-l-','')}`}>{statusText}</span>
                                </div>
                                <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-1 rounded border border-slate-100">
                                    <div className="text-center">
                                        <div className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-0.5">Box</div>
                                        <div className="text-[10px] font-bold text-slate-700 leading-none">{totalBundles > 0 ? totalBundles : '-'}</div>
                                    </div>
                                    <div className="w-px h-3 bg-slate-200"></div>
                                    <div className="text-center">
                                        <div className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-0.5">Wt</div>
                                        <div className="text-[10px] font-bold text-slate-700 leading-none">{d.totalWeight > 0 ? d.totalWeight.toFixed(0) : '-'}</div>
                                    </div>
                                </div>
                            </div>
                         </div>
                       </div>
                       
                       {isExpanded && (
                         <div className="bg-slate-50 border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
                             <div className="px-2 py-1.5 bg-white border-b border-slate-200 flex justify-between items-center">
                                <span className={`text-[9px] font-bold px-2 py-1 rounded border ${isToday ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                    {isToday ? '★ Scheduled Today' : 'Standard Priority'}
                                </span>
                                <button onClick={() => shareJobImage(d)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded text-[9px] font-bold flex items-center gap-1 shadow-sm">Share</button>
                             </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left whitespace-nowrap bg-white border-b border-slate-200">
                                 <thead className="bg-slate-100/50 border-b border-slate-200 text-[8px] font-bold text-slate-500 uppercase tracking-wide">
                                    <tr>
                                       <th className="px-1 py-1 w-[25%]">Size</th>
                                       <th className="px-1 py-1 w-[10%]">Type</th>
                                       <th className="px-1 py-1 w-[8%] text-center">Mic</th>
                                       <th className="px-1 py-1 text-right w-[10%] text-slate-800">D.Wt</th>
                                       {/* Show these columns on desktop, hidden on mobile */}
                                       <th className="px-1 py-1 text-right w-[10%] text-indigo-600 hidden sm:table-cell">P.Wt</th>
                                       <th className="px-1 py-1 text-right w-[8%] text-red-500 hidden sm:table-cell">Wst</th>
                                       <th className="px-1 py-1 text-right w-[8%]">Pcs</th>
                                       <th className="px-1 py-1 text-center w-[8%]">Box</th>
                                       <th className="px-1 py-1 text-center w-[12%]">Sts</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-100">
                                    {d.rows.map(row => {
                                        let rowStatusText = row.status?.substring(0,4) || 'PEND';
                                        let rowStatusColor = 'bg-white border-slate-200 text-slate-500';
                                        if(row.status === DispatchStatus.COMPLETED) rowStatusColor = 'bg-emerald-50 border-emerald-200 text-emerald-600';
                                        else if(row.status === DispatchStatus.DISPATCHED) rowStatusColor = 'bg-purple-50 border-purple-200 text-purple-600';
                                        else if(row.status === DispatchStatus.PRINTING) rowStatusColor = 'bg-indigo-50 border-indigo-200 text-indigo-600';
                                        
                                        return (
                                           <tr key={row.id} className="hover:bg-slate-50">
                                              <td className="px-1 py-1 text-[9px] font-bold text-slate-700">
                                                  {row.size}
                                              </td>
                                              <td className="px-1 py-1 text-[8px] font-bold text-slate-500">
                                                  {row.sizeType || '-'}
                                              </td>
                                              <td className="px-1 py-1 text-[9px] font-bold text-slate-500 text-center">
                                                  {row.micron || '-'}
                                              </td>
                                              <td className="px-1 py-1 text-right text-[9px] font-mono font-bold text-slate-800">
                                                {row.weight > 0 ? row.weight.toFixed(3) : '-'}
                                              </td>
                                              {/* Read-Only Values for Production Weight & Wastage */}
                                              <td className="px-1 py-1 text-right text-[9px] font-mono font-bold text-indigo-700 hidden sm:table-cell">
                                                 {row.productionWeight && row.productionWeight > 0 ? row.productionWeight.toFixed(3) : '-'}
                                              </td>
                                              <td className="px-1 py-1 text-right font-mono font-bold text-red-500 text-[8px] hidden sm:table-cell">
                                                 {row.wastage && row.wastage > 0 ? row.wastage.toFixed(3) : '-'}
                                              </td>
                                              <td className="px-1 py-1 text-right text-[9px] font-mono font-medium text-slate-600">
                                                  {row.pcs || '-'}
                                              </td>
                                              <td className="px-1 py-1 text-center text-[9px] font-bold text-slate-700">
                                                 {row.bundle || '-'}
                                              </td>
                                              <td className="px-1 py-1 text-center">
                                                <span className={`px-1 py-0.5 rounded text-[8px] font-bold tracking-wide block border ${rowStatusColor}`}>{rowStatusText}</span>
                                              </td>
                                           </tr>
                                        );
                                    })}
                                 </tbody>
                              </table>
                            </div>
                         </div>
                       )}
                    </div>
                  );
               })}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden mt-4">
                {/* Transaction History Table */}
                <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-3 py-2 sm:px-4 sm:py-3 flex flex-col sm:flex-row justify-between items-center gap-2">
                   <div className="flex items-center gap-2 text-white w-full sm:w-auto">
                      <div className="p-1 bg-white/20 rounded-lg backdrop-blur-sm"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg></div>
                      <h3 className="text-xs sm:text-sm font-bold tracking-wide uppercase">Transactions</h3>
                   </div>
                   <input type="text" placeholder="Search Bill..." value={challanSearch} onChange={e => setChallanSearch(e.target.value)} className="bg-white/10 border border-white/20 text-white placeholder-emerald-100 rounded-lg px-2 py-1 text-[10px] sm:text-xs font-semibold outline-none focus:bg-white/20 transition-all w-full sm:w-48" />
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left text-[9px] sm:text-xs table-auto">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wide border-b border-slate-200">
                         <tr>
                            <th className="px-2 py-2 whitespace-nowrap">Date</th>
                            <th className="px-2 py-2 whitespace-nowrap">Bill</th>
                            <th className="px-2 py-2 whitespace-nowrap">Party</th>
                            <th className="px-2 py-2 whitespace-nowrap">Items</th>
                            <th className="px-2 py-2 text-right whitespace-nowrap">Amt</th>
                            <th className="px-2 py-2 text-center whitespace-nowrap">Mode</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {filteredChallans.slice(0, 30).map(c => {
                             const party = data.parties.find(p => p.id === c.partyId)?.name || 'Unknown';
                             const isUnpaid = c.paymentMode === PaymentMode.UNPAID;
                             const itemSummary = c.lines.map(l => l.size).join(', ');
                             const isExpanded = expandedChallanId === c.id;
                             const textColor = isUnpaid ? 'text-red-600' : 'text-emerald-600';

                             return (
                                 <React.Fragment key={c.id}>
                                     <tr onClick={() => setExpandedChallanId(isExpanded ? null : c.id)} className={`transition-colors cursor-pointer border-b border-slate-50 ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50'}`}>
                                        <td className={`px-2 py-2 font-medium ${textColor} whitespace-nowrap`}>{formatDateNoYear(c.date)}</td>
                                        <td className={`px-2 py-2 font-mono font-bold ${textColor} whitespace-nowrap`}>#{c.challanNumber}</td>
                                        <td className={`px-2 py-2 font-bold ${textColor} break-words min-w-[100px]`} title={party}>
                                            <div className="line-clamp-2 leading-tight">{party}</div>
                                        </td>
                                        <td className={`px-2 py-2 text-[9px] font-semibold ${textColor} break-words min-w-[80px]`} title={itemSummary}>
                                            <div className="line-clamp-2 leading-tight opacity-80">{itemSummary}</div>
                                        </td>
                                        <td className={`px-2 py-2 text-right font-bold ${textColor} whitespace-nowrap`}>₹{Math.round(c.totalAmount).toLocaleString()}</td>
                                        <td className="px-2 py-2 text-center whitespace-nowrap">
                                           <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide border ${isUnpaid ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>{c.paymentMode.slice(0,4)}</span>
                                        </td>
                                     </tr>
                                     {isExpanded && (
                                         <tr className="bg-slate-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                             <td colSpan={6} className="p-2 border-b border-slate-100 shadow-inner">
                                                <div id={`challan-card-${c.id}`} className="bg-white rounded border border-slate-200 p-2 max-w-full mx-auto shadow-sm">
                                                    <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-2">
                                                        <div>
                                                            <h4 className="text-[10px] font-bold text-slate-800 flex items-center gap-1">Challan #{c.challanNumber}</h4>
                                                            <div className="text-[9px] text-slate-500">{party} • {c.date}</div>
                                                        </div>
                                                        <button onClick={() => shareChallanImage(c.id, c.challanNumber)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded text-[9px] font-bold flex items-center gap-1 shadow-sm">Share</button>
                                                    </div>
                                                    <table className="w-full text-[9px] text-left">
                                                        <thead className="text-slate-500 font-semibold border-b border-slate-100 bg-slate-50/50"><tr><th className="py-1 pl-1">Item</th><th className="py-1 text-right">Wt</th><th className="py-1 text-right">Rate</th><th className="py-1 text-right pr-1">Amt</th></tr></thead>
                                                        <tbody className="divide-y divide-slate-50">
                                                            {c.lines.map((line, idx) => (
                                                                <tr key={idx} className="hover:bg-slate-50/50">
                                                                    <td className="py-1 pl-1 font-bold text-slate-700">{line.size}</td>
                                                                    <td className="py-1 text-right text-slate-700 font-mono">{line.weight.toFixed(3)}</td>
                                                                    <td className="py-1 text-right text-slate-700 font-mono">{line.rate}</td>
                                                                    <td className="py-1 text-right pr-1 font-bold text-slate-800">₹{line.amount.toFixed(0)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot className="border-t border-slate-100 bg-slate-50/30"><tr><td colSpan={3} className="py-1 text-right font-bold text-slate-600">Total</td><td className="py-1 text-right pr-1 font-bold text-slate-900">₹{Math.round(c.totalAmount).toLocaleString()}</td></tr></tfoot>
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

      {activeTab === 'analytics' && (
        <AnalyticsDashboard data={data} />
      )}

      {activeTab === 'parties' && (
        <PartyDashboard data={data} />
      )}

      {activeTab === 'planning' && (
        <ProductionPlanner data={data} />
      )}

      {activeTab === 'chemical' && (
        <ChemicalManager data={data} />
      )}

      {activeTab === 'master' && (
        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
           <MasterSheet data={data} />
        </div>
      )}
    </div>
  );
};
