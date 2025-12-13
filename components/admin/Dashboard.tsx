
import React, { useMemo, useState } from 'react';
import { AppData, DispatchStatus, PaymentMode, Challan, DispatchEntry, DispatchRow } from '../../types';
import { deleteDispatch, deleteChallan, saveChallan, saveDispatch } from '../../services/storageService';
import { MasterSheet } from './MasterSheet';
import { PartyDashboard } from './PartyDashboard';
import { AnalyticsDashboard } from './AnalyticsDashboard'; 
import { ChemicalManager } from './ChemicalManager';
import { ProductionPlanner } from './ProductionPlanner'; // New Import

interface Props {
  data: AppData;
}

const SIZE_TYPES = ["", "INTAS", "OPEN", "ROUND", "ST.SEAL", "LABEL"];

export const Dashboard: React.FC<Props> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'master' | 'parties' | 'planning' | 'chemical'>('overview');
  const [jobSearch, setJobSearch] = useState('');
  const [challanSearch, setChallanSearch] = useState('');
  const [expandedChallanId, setExpandedChallanId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  // ... (Keep existing formatting helpers and logic filters)
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
        if (a.isTodayDispatch && !b.isTodayDispatch) return -1;
        if (!a.isTodayDispatch && b.isTodayDispatch) return 1;
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

  const handleToggleToday = async (e: React.MouseEvent, dispatchId: string, currentStatus: boolean | undefined) => {
    e.stopPropagation();
    const dispatch = data.dispatches.find(d => d.id === dispatchId);
    if (dispatch) {
      const updatedDispatch = { ...dispatch, isTodayDispatch: !currentStatus };
      await saveDispatch(updatedDispatch);
    }
  };

  // ... (Keep existing share functions)
  const shareJobImage = async (d: DispatchEntry) => {
      // (Keep existing implementation)
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
      // (Keep existing implementation)
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

  const handleRowUpdate = async (d: DispatchEntry, rowId: string, field: keyof DispatchRow, value: string | number) => {
      // (Keep existing logic)
      const updatedRows = d.rows.map(r => {
        if (r.id === rowId) {
          const updatedRow = { ...r, [field]: value };
          if (field === 'weight' || field === 'productionWeight') {
               const dispatchWt = field === 'weight' ? Number(value) : (r.weight || 0);
               const prodWt = field === 'productionWeight' ? Number(value) : (r.productionWeight || 0);
               updatedRow.wastage = prodWt > 0 ? (prodWt - dispatchWt) : 0;
          }
          return updatedRow;
        }
        return r;
      });
      const totalWeight = updatedRows.reduce((acc, r) => acc + Number(r.weight), 0);
      const totalPcs = updatedRows.reduce((acc, r) => acc + Number(r.pcs), 0);
      const updatedEntry = { ...d, rows: updatedRows, totalWeight, totalPcs, updatedAt: new Date().toISOString() };
      await saveDispatch(updatedEntry);
  };

  return (
    <div className="space-y-4 sm:space-y-8 pb-12">
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 sm:gap-4">
          <button onClick={() => setActiveTab('overview')} className={`relative overflow-hidden p-4 rounded-2xl text-left transition-all duration-300 transform hover:scale-[1.01] ${activeTab === 'overview' ? 'shadow-xl shadow-indigo-200 ring-2 ring-indigo-300 scale-[1.02]' : 'shadow-md opacity-90'}`}>
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-blue-600"></div>
             <div className="relative z-10 text-white flex flex-col items-center">
                <span className="text-2xl mb-1">📊</span><span className="text-xs font-bold">Overview</span>
             </div>
          </button>
          
          <button onClick={() => setActiveTab('analytics')} className={`relative overflow-hidden p-4 rounded-2xl text-left transition-all duration-300 transform hover:scale-[1.01] ${activeTab === 'analytics' ? 'shadow-xl shadow-blue-200 ring-2 ring-blue-300 scale-[1.02]' : 'shadow-md opacity-90'}`}>
             <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-cyan-600"></div>
             <div className="relative z-10 text-white flex flex-col items-center">
                <span className="text-2xl mb-1">📈</span><span className="text-xs font-bold">Analytics</span>
             </div>
          </button>

          <button onClick={() => setActiveTab('parties')} className={`relative overflow-hidden p-4 rounded-2xl text-left transition-all duration-300 transform hover:scale-[1.01] ${activeTab === 'parties' ? 'shadow-xl shadow-purple-200 ring-2 ring-purple-300 scale-[1.02]' : 'shadow-md opacity-90'}`}>
             <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-600"></div>
             <div className="relative z-10 text-white flex flex-col items-center">
                <span className="text-2xl mb-1">👥</span><span className="text-xs font-bold">Directory</span>
             </div>
          </button>

          <button onClick={() => setActiveTab('planning')} className={`relative overflow-hidden p-4 rounded-2xl text-left transition-all duration-300 transform hover:scale-[1.01] ${activeTab === 'planning' ? 'shadow-xl shadow-amber-200 ring-2 ring-amber-300 scale-[1.02]' : 'shadow-md opacity-90'}`}>
             <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-600"></div>
             <div className="relative z-10 text-white flex flex-col items-center">
                <span className="text-2xl mb-1">📝</span><span className="text-xs font-bold">Planning</span>
             </div>
          </button>

          <button onClick={() => setActiveTab('chemical')} className={`relative overflow-hidden p-4 rounded-2xl text-left transition-all duration-300 transform hover:scale-[1.01] ${activeTab === 'chemical' ? 'shadow-xl shadow-cyan-200 ring-2 ring-cyan-300 scale-[1.02]' : 'shadow-md opacity-90'}`}>
             <div className="absolute inset-0 bg-gradient-to-br from-cyan-600 to-blue-700"></div>
             <div className="relative z-10 text-white flex flex-col items-center">
                <span className="text-2xl mb-1">🧪</span><span className="text-xs font-bold">Chemical</span>
             </div>
          </button>

          <button onClick={() => setActiveTab('master')} className={`relative overflow-hidden p-4 rounded-2xl text-left transition-all duration-300 transform hover:scale-[1.01] ${activeTab === 'master' ? 'shadow-xl shadow-emerald-200 ring-2 ring-emerald-300 scale-[1.02]' : 'shadow-md opacity-90'}`}>
             <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 to-teal-600"></div>
             <div className="relative z-10 text-white flex flex-col items-center">
                <span className="text-2xl mb-1">📑</span><span className="text-xs font-bold">Records</span>
             </div>
          </button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Live Feed and Transaction History code goes here (Kept same as before) */}
            <div className="space-y-4">
               <div className="flex justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex items-center gap-2"><span className="text-xl">🚛</span><h3 className="text-lg font-bold text-slate-800">Live Feed</h3></div>
                  <input type="text" placeholder="Search Jobs..." value={jobSearch} onChange={e => setJobSearch(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-100 w-full max-w-xs" />
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
                    <div key={d.id} id={`job-card-${d.id}`} className={`bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-all duration-300 group ${isToday ? 'border-indigo-300 ring-2 ring-indigo-50' : 'border-slate-100'} ${cardAnimation}`}>
                       <div onClick={() => setExpandedJobId(isExpanded ? null : d.id)} className={`relative p-5 cursor-pointer border-l-4 ${statusColor.split(' ').pop()} transition-colors`}>
                         <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-3 mb-1">
                                 <span className="text-[10px] font-bold text-slate-400 tracking-wider bg-slate-50 px-2 py-1 rounded-md border border-slate-100">{d.date}</span>
                                 <span className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wide ${statusColor.replace('border-l-4','').replace('border-l-','')} bg-opacity-50`}>{statusText}</span>
                                 {isToday && <span className="bg-indigo-600 text-white px-2 py-1 rounded-md text-[10px] font-bold tracking-wide flex items-center gap-1 shadow-sm animate-pulse">📅 TODAY</span>}
                              </div>
                              <h4 className="text-lg font-bold text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors">{party?.name}</h4>
                            </div>
                            <div className="flex items-center gap-3">
                               <button onClick={(e) => handleToggleToday(e, d.id, d.isTodayDispatch)} className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 ${isToday ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}><span>{isToday ? '★ Scheduled' : '☆ Mark Today'}</span></button>
                               <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                                  <div className="text-center"><div className="text-[10px] font-bold text-slate-400">📦</div><div className="text-sm font-bold text-slate-700">{totalBundles}</div></div>
                                  <div className="w-px h-6 bg-slate-200"></div>
                                  <div className="text-center"><div className="text-[10px] font-bold text-slate-400">Weight</div><div className="text-sm font-bold text-slate-700">{d.totalWeight.toFixed(3)}</div></div>
                               </div>
                            </div>
                         </div>
                       </div>
                       {isExpanded && (
                         <div className="bg-slate-50 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                             <div className="px-6 py-4 border-b border-slate-200 bg-white flex justify-end">
                                <button onClick={() => shareJobImage(d)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-sm">Share Job</button>
                             </div>
                            <div className="p-4 sm:p-6 overflow-x-auto">
                              <table className="w-full text-left text-sm whitespace-nowrap bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                 <thead className="bg-slate-100/50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wide">
                                    <tr>
                                       <th className="px-4 py-3 min-w-[100px]">Size</th>
                                       <th className="px-4 py-3 w-20">Type</th>
                                       <th className="px-4 py-3 w-16">Micro</th>
                                       <th className="px-4 py-3 text-right w-24 text-slate-800">Disp Wt</th>
                                       <th className="px-4 py-3 text-right w-24 text-indigo-600">Prod Wt</th>
                                       <th className="px-4 py-3 text-right w-24 text-red-500">Wastage</th>
                                       <th className="px-4 py-3 text-right w-20">Pcs</th>
                                       <th className="px-4 py-3 text-center w-20">📦</th>
                                       <th className="px-4 py-3 text-center w-32">Status</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-100">
                                    {d.rows.map(row => {
                                        let rowStatusText = row.status || 'PENDING';
                                        let rowStatusColor = 'bg-white border-slate-200 text-slate-500';
                                        if(row.status === DispatchStatus.COMPLETED) rowStatusColor = 'bg-emerald-50 border-emerald-200 text-emerald-600';
                                        else if(row.status === DispatchStatus.DISPATCHED) rowStatusColor = 'bg-purple-50 border-purple-200 text-purple-600';
                                        else if(row.status === DispatchStatus.PRINTING) rowStatusColor = 'bg-indigo-50 border-indigo-200 text-indigo-600';
                                        else if(row.status === DispatchStatus.SLITTING) rowStatusColor = 'bg-amber-50 border-amber-200 text-amber-600 animate-pulse';
                                        else if(row.status === DispatchStatus.CUTTING) rowStatusColor = 'bg-blue-50 border-blue-200 text-blue-600 animate-pulse';
                                        const isMm = row.size.toLowerCase().includes('mm');

                                        return (
                                           <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                              <td className="px-4 py-2 font-bold text-slate-700">
                                                  <input value={row.size} onChange={(e) => handleRowUpdate(d, row.id, 'size', e.target.value)} className="w-full bg-transparent font-bold text-slate-700 outline-none border-b border-transparent focus:border-indigo-500 transition-colors py-1" />
                                              </td>
                                              <td className="px-4 py-2">
                                                  <select value={row.sizeType || ''} onChange={(e) => handleRowUpdate(d, row.id, 'sizeType', e.target.value)} className="w-full bg-transparent text-xs font-medium text-slate-600 outline-none border-b border-transparent focus:border-indigo-500 transition-colors py-1">
                                                        {SIZE_TYPES.map(t => <option key={t} value={t}>{t || '-'}</option>)}
                                                    </select>
                                              </td>
                                              <td className="px-4 py-2">
                                                  <input type="number" value={row.micron || ''} placeholder="-" onChange={(e) => handleRowUpdate(d, row.id, 'micron', parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-xs font-medium text-center text-slate-600 outline-none border-b border-transparent focus:border-indigo-500 transition-colors py-1" />
                                              </td>
                                              <td className="px-4 py-2 text-right font-mono font-medium text-slate-800">
                                                <input type="number" value={row.weight === 0 ? '' : row.weight} onChange={(e) => handleRowUpdate(d, row.id, 'weight', parseFloat(e.target.value) || 0)} className="w-full text-right bg-transparent font-mono font-medium text-slate-800 outline-none border-b border-transparent focus:border-indigo-500 transition-colors py-1" />
                                              </td>
                                              <td className="px-4 py-2 text-right font-mono font-bold text-indigo-700">
                                                 <input type="number" value={row.productionWeight === 0 ? '' : row.productionWeight} placeholder="-" onChange={(e) => handleRowUpdate(d, row.id, 'productionWeight', parseFloat(e.target.value) || 0)} className="w-full text-right bg-transparent font-mono font-medium text-indigo-700 outline-none border-b border-transparent focus:border-indigo-300 focus:border-indigo-500 transition-colors py-1" />
                                              </td>
                                              <td className="px-4 py-2 text-right font-mono font-bold text-red-500">{row.wastage ? row.wastage.toFixed(3) : '-'}</td>
                                              <td className="px-4 py-2 text-right font-mono font-medium text-slate-600">
                                                  <input type="number" value={row.pcs === 0 ? '' : row.pcs} onChange={(e) => handleRowUpdate(d, row.id, 'pcs', parseFloat(e.target.value) || 0)} className="w-full text-right bg-transparent font-mono font-medium text-slate-600 outline-none border-b border-transparent focus:border-indigo-500 transition-colors py-1" /> <span className="text-[9px] text-slate-400">{isMm?'R':'P'}</span>
                                              </td>
                                              <td className="px-4 py-2 text-center font-bold text-slate-700">
                                                 <input type="number" value={row.bundle === 0 ? '' : row.bundle} onChange={(e) => handleRowUpdate(d, row.id, 'bundle', parseFloat(e.target.value) || 0)} className="w-full text-center bg-transparent font-bold text-slate-700 outline-none border-b border-transparent focus:border-indigo-500 transition-colors py-1" />
                                              </td>
                                              <td className="px-4 py-2 text-center">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wide w-full block ${rowStatusColor}`}>{rowStatusText}</span>
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

            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                {/* ... (Transaction History Table - kept same) */}
                <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-4 py-3 sm:px-6 sm:py-5 flex flex-col sm:flex-row justify-between items-center gap-3">
                   <div className="flex items-center gap-2 text-white w-full sm:w-auto">
                      <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm"><svg className="w-4 h-4 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg></div>
                      <h3 className="text-sm sm:text-lg font-bold tracking-wide">Transactions</h3>
                   </div>
                   <input type="text" placeholder="Search Bill..." value={challanSearch} onChange={e => setChallanSearch(e.target.value)} className="bg-white/10 border border-white/20 text-white placeholder-emerald-100 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold outline-none focus:bg-white/20 transition-all w-full sm:w-64" />
                </div>
                <div className="overflow-x-auto sm:overflow-hidden">
                   <table className="min-w-full text-left text-[10px] sm:text-sm table-auto sm:table-fixed">
                      {/* ... (Transaction Table Rows - kept same) ... */}
                      <thead className="bg-slate-50 text-slate-600 font-semibold text-[10px] sm:text-xs tracking-wide border-b border-slate-200">
                         <tr>
                            <th className="px-2 py-2 sm:px-4 sm:py-4 sm:w-[15%] whitespace-nowrap">Date</th>
                            <th className="px-2 py-2 sm:px-4 sm:py-4 sm:w-[12%] whitespace-nowrap">Challan</th>
                            <th className="px-2 py-2 sm:px-4 sm:py-4 sm:w-[25%] whitespace-nowrap">Party</th>
                            <th className="px-2 py-2 sm:px-4 sm:py-4 sm:w-[23%] whitespace-nowrap">Items</th>
                            <th className="px-2 py-2 sm:px-4 sm:py-4 text-right sm:w-[15%] whitespace-nowrap">Amt</th>
                            <th className="px-2 py-2 sm:px-4 sm:py-4 text-center sm:w-[10%] whitespace-nowrap">Mode</th>
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
                                        <td className={`px-2 py-3 sm:px-4 sm:py-4 font-medium ${textColor} truncate max-w-[80px] sm:max-w-none`}>{formatDateNoYear(c.date)}</td>
                                        <td className={`px-2 py-3 sm:px-4 sm:py-4 font-mono font-bold ${textColor} truncate`}>#{c.challanNumber}</td>
                                        <td className={`px-2 py-3 sm:px-4 sm:py-4 font-bold ${textColor} truncate max-w-[120px] sm:max-w-none`} title={party}>{party}</td>
                                        <td className={`px-2 py-3 sm:px-4 sm:py-4 text-[9px] sm:text-xs font-semibold ${textColor} truncate max-w-[120px] sm:max-w-none`} title={itemSummary}>{itemSummary}</td>
                                        <td className={`px-2 py-3 sm:px-4 sm:py-4 text-right font-bold ${textColor}`}>₹{c.totalAmount.toLocaleString()}</td>
                                        <td className="px-2 py-3 sm:px-4 sm:py-4 text-center">
                                           <button onClick={(e) => { e.stopPropagation(); handleTogglePayment(c); }} className={`px-2 py-1 rounded sm:px-3 sm:py-1.5 text-[9px] sm:text-xs font-bold tracking-wide border transition-all ${isUnpaid ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'}`} title="Toggle Status">{c.paymentMode}</button>
                                        </td>
                                     </tr>
                                     {isExpanded && (
                                         <tr className="bg-slate-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                             <td colSpan={6} className="p-2 sm:p-6 border-b border-slate-100 shadow-inner">
                                                <div id={`challan-card-${c.id}`} className="bg-white rounded-lg border border-slate-200 p-3 sm:p-5 max-w-4xl mx-auto shadow-sm">
                                                    <div className="flex justify-between items-center mb-3 sm:mb-5 border-b border-slate-100 pb-3">
                                                        <div><h4 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2"><span className="text-sm sm:text-lg">🧾</span> Challan #{c.challanNumber}</h4><div className="text-[10px] sm:text-xs text-slate-500 mt-1">{party} • {c.date}</div></div>
                                                        <div className="flex items-center gap-2">
                                                          <button onClick={() => shareChallanImage(c.id, c.challanNumber)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded-md text-[10px] sm:text-xs font-bold flex items-center gap-1 transition-colors shadow-sm">Share Bill</button>
                                                        </div>
                                                    </div>
                                                    <table className="w-full text-[10px] sm:text-sm text-left">
                                                        <thead className="text-[10px] sm:text-xs text-slate-500 font-semibold border-b border-slate-100 bg-slate-50/50"><tr><th className="py-1 sm:py-2 pl-2 sm:pl-3">Item</th><th className="py-1 sm:py-2 text-right">Wt</th><th className="py-1 sm:py-2 text-right">Rate</th><th className="py-1 sm:py-2 text-right pr-2 sm:pr-3">Amt</th></tr></thead>
                                                        <tbody className="divide-y divide-slate-50">
                                                            {c.lines.map((line, idx) => (
                                                                <tr key={idx} className="hover:bg-slate-50/50">
                                                                    <td className="py-1 sm:py-2 pl-2 sm:pl-3 font-bold text-slate-700">{line.size}</td>
                                                                    <td className="py-1 sm:py-2 text-right text-slate-700 font-mono">{line.weight.toFixed(3)}</td>
                                                                    <td className="py-1 sm:py-2 text-right text-slate-700 font-mono">{line.rate}</td>
                                                                    <td className="py-1 sm:py-2 text-right pr-2 sm:pr-3 font-bold text-slate-800">₹{line.amount.toFixed(2)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot className="border-t border-slate-100 bg-slate-50/30"><tr><td colSpan={3} className="py-2 sm:py-3 text-right text-[10px] sm:text-sm font-bold text-slate-600">Total (Rounded)</td><td className="py-2 sm:py-3 text-right pr-2 sm:pr-3 font-bold text-sm sm:text-lg text-slate-900">₹{Math.round(c.totalAmount).toLocaleString()}</td></tr></tfoot>
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
