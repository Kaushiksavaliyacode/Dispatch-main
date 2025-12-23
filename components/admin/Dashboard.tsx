import React, { useMemo, useState } from 'react';
import { AppData, DispatchStatus, PaymentMode, Challan, DispatchEntry } from '../../types';
import { saveChallan } from '../../services/storageService'; 
import { MasterSheet } from './MasterSheet';
import { PartyDashboard } from './PartyDashboard';
import { AnalyticsDashboard } from './AnalyticsDashboard'; 
import { ChemicalManager } from './ChemicalManager';
import { ProductionPlanner } from './ProductionPlanner';
import { CheckSquare, Square, Share2, X, MessageCircle } from 'lucide-react';

interface Props {
  data: AppData;
}

export const Dashboard: React.FC<Props> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'master' | 'parties' | 'planning' | 'chemical'>('overview');
  const [jobSearch, setJobSearch] = useState('');
  const [challanSearch, setChallanSearch] = useState('');
  const [expandedChallanId, setExpandedChallanId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [selectedRowsForShare, setSelectedRowsForShare] = useState<Record<string, string[]>>({});
  
  // Share Form State
  const [shareFormData, setShareFormData] = useState<{
      dispatch: DispatchEntry;
      rows: { id: string; size: string; pcs: string; bundle: string }[];
  } | null>(null);

  const formatDateNoYear = (dateStr: string) => {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}`;
  };

  const filteredDispatches = useMemo(() => {
    const search = jobSearch.toLowerCase();
    return data.dispatches.filter(d => {
      const party = data.parties.find(p => p.id === d.partyId)?.name.toLowerCase() || '';
      return party.includes(search) || d.dispatchNo.includes(search) || d.rows.some(r => r.size.toLowerCase().includes(search));
    }).sort((a, b) => {
        const getPriority = (d: DispatchEntry) => {
            if (d.isTodayDispatch) return 0;
            if (['CUTTING', 'PRINTING', 'SLITTING'].includes(d.status)) return 0;
            return d.status === 'PENDING' ? 1 : 2;
        };
        const pA = getPriority(a);
        const pB = getPriority(b);
        if (pA !== pB) return pA - pB;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [data, jobSearch]);

  const toggleRowSelectionForShare = (dispatchId: string, rowId: string) => {
      setSelectedRowsForShare(prev => {
          const current = prev[dispatchId] || [];
          const updated = current.includes(rowId) ? current.filter(id => id !== rowId) : [...current, rowId];
          return { ...prev, [dispatchId]: updated };
      });
  };

  const toggleAllRowsForShare = (d: DispatchEntry) => {
      const current = selectedRowsForShare[d.id] || [];
      setSelectedRowsForShare(prev => ({ ...prev, [d.id]: current.length === d.rows.length ? [] : d.rows.map(r => r.id) }));
  };

  const initiateShare = (d: DispatchEntry) => {
      const markedIds = selectedRowsForShare[d.id] || [];
      const rowsToProcess = markedIds.length > 0 ? d.rows.filter(r => markedIds.includes(r.id)) : d.rows;
      setShareFormData({
          dispatch: d,
          rows: rowsToProcess.map(r => ({ id: r.id, size: r.size, pcs: r.pcs.toString(), bundle: r.bundle.toString() }))
      });
  };

  const executeShare = async () => {
      if (!shareFormData) return;
      const { dispatch, rows } = shareFormData;
      const party = data.parties.find(p => p.id === dispatch.partyId)?.name || 'Unknown';
      
      const totalPcs = rows.reduce((acc, r) => acc + (Number(r.pcs) || 0), 0);
      const totalBundles = rows.reduce((acc, r) => acc + (Number(r.bundle) || 0), 0);
      
      let textMessage = `*Job Card: ${party}*\n#${dispatch.dispatchNo} - ${dispatch.date.split('-').reverse().join('/')}\n\n`;
      rows.forEach(r => { textMessage += `${r.size} ${r.pcs} Pcs ${r.bundle} Bdl\n`; });
      textMessage += `\n*Total: ${totalPcs} Pcs | ${totalBundles} 📦*\n`;

      const containerId = 'temp-share-container-admin';
      let container = document.getElementById(containerId);
      if (container) document.body.removeChild(container);
      container = document.createElement('div');
      container.id = containerId;
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.width = '900px';
      container.style.background = '#fff';
      document.body.appendChild(container);

      const markedIds = selectedRowsForShare[dispatch.id] || [];
      const imageRows = markedIds.length > 0 ? dispatch.rows.filter(r => markedIds.includes(r.id)) : dispatch.rows;

      const rowsHtml = imageRows.map((r, idx) => {
          const formRow = rows.find(fr => fr.id === r.id);
          return `
            <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f0f9ff'}; border-bottom: 2px solid #e0f2fe;">
                <td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e;">${r.size}</td>
                <td style="padding: 16px 12px; font-size: 20px; color: #0284c7; text-align: center; font-weight: bold;">${r.sizeType || '-'}</td>
                <td style="padding: 16px 12px; font-size: 20px; color: #64748b; text-align: center; font-weight: bold;">${r.micron || '-'}</td>
                <td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e; text-align: right;">${r.weight.toFixed(3)}</td>
                <td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e; text-align: right;">${formRow?.pcs || r.pcs}</td>
                <td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e; text-align: right;">${formRow?.bundle || r.bundle}</td>
            </tr>
          `;
      }).join('');

      container.innerHTML = `
        <div style="font-family: 'Inter', sans-serif; border: 4px solid #0c4a6e; background: #fff;">
            <div style="background: linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%); padding: 32px; color: white;">
                <div style="font-size: 18px; text-transform: uppercase; letter-spacing: 3px; color: #bae6fd; font-weight: bold;">Job Card</div>
                <div style="font-size: 40px; font-weight: bold; margin-top: 8px;">${party}</div>
                <div style="margin-top: 24px; display: flex; justify-content: space-between; border-top: 1px solid #7dd3fc; padding-top: 20px;">
                    <span style="font-size: 28px; background: rgba(255,255,255,0.2); padding: 8px 20px; rounded: 10px;">#${dispatch.dispatchNo}</span>
                    <span style="font-size: 24px;">${dispatch.date}</span>
                </div>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #e0f2fe; color: #0c4a6e; font-size: 18px; text-transform: uppercase; border-bottom: 3px solid #0284c7;">
                        <th style="padding: 16px 12px; text-align: left;">Size</th>
                        <th style="padding: 16px 12px; text-align: center;">Type</th>
                        <th style="padding: 16px 12px; text-align: center;">Mic</th>
                        <th style="padding: 16px 12px; text-align: right;">Weight</th>
                        <th style="padding: 16px 12px; text-align: right;">Pcs</th>
                        <th style="padding: 16px 12px; text-align: right;">Box</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
      `;

      try {
          const canvas = await (window as any).html2canvas(container, { scale: 2 });
          canvas.toBlob(async (blob: Blob) => {
              if (blob) {
                  const file = new File([blob], `Job_${dispatch.dispatchNo}.png`, { type: 'image/png' });
                  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                      await navigator.share({ files: [file], title: party, text: textMessage });
                  } else {
                      const link = document.createElement('a');
                      link.href = URL.createObjectURL(blob);
                      link.download = `Job_${dispatch.dispatchNo}.png`;
                      link.click();
                      alert("Downloaded. Text:\n" + textMessage);
                  }
              }
              document.body.removeChild(container!);
              setShareFormData(null);
          });
      } catch (e) { alert("Failed to share."); }
  };

  return (
    <div className="space-y-4 sm:space-y-8 pb-12">
      
      {/* --- SHARE FORM POPUP --- */}
      {shareFormData && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
                    <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white">
                        <div className="flex items-center gap-2">
                            <MessageCircle size={20} />
                            <h3 className="font-bold uppercase tracking-widest text-sm">Admin Share Control</h3>
                        </div>
                        <button onClick={() => setShareFormData(null)}><X size={20} /></button>
                    </div>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        {shareFormData.rows.map((row, idx) => (
                            <div key={row.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                                <div className="text-xs font-black text-indigo-700 uppercase">{row.size}</div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Pcs</label>
                                        <input type="number" value={row.pcs} onChange={e => {
                                            const updated = [...shareFormData.rows];
                                            updated[idx].pcs = e.target.value;
                                            setShareFormData({ ...shareFormData, rows: updated });
                                        }} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Box</label>
                                        <input type="number" value={row.bundle} onChange={e => {
                                            const updated = [...shareFormData.rows];
                                            updated[idx].bundle = e.target.value;
                                            setShareFormData({ ...shareFormData, rows: updated });
                                        }} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold outline-none" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-6 bg-slate-50 border-t border-slate-200">
                        <button onClick={executeShare} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 uppercase tracking-widest text-sm">
                            <Share2 size={18} /> Share to WhatsApp
                        </button>
                    </div>
                </div>
            </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 sm:gap-4">
          <button onClick={() => setActiveTab('overview')} className={`relative overflow-hidden p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left transition-all duration-300 ${activeTab === 'overview' ? 'shadow-xl ring-2 ring-indigo-300 scale-[1.02]' : 'shadow-md opacity-90'}`}>
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-blue-600"></div>
             <div className="relative z-10 text-white flex flex-col items-center">
                <span className="text-xl sm:text-2xl mb-1">📊</span><span className="text-[10px] sm:text-xs font-bold">Overview</span>
             </div>
          </button>
          {/* ... other buttons remain same ... */}
          <button onClick={() => setActiveTab('analytics')} className={`relative overflow-hidden p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left transition-all duration-300 ${activeTab === 'analytics' ? 'shadow-xl ring-2 ring-blue-300 scale-[1.02]' : 'shadow-md opacity-90'}`}>
             <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-cyan-600"></div>
             <div className="relative z-10 text-white flex flex-col items-center">
                <span className="text-xl sm:text-2xl mb-1">📈</span><span className="text-[10px] sm:text-xs font-bold">Analytics</span>
             </div>
          </button>
          <button onClick={() => setActiveTab('parties')} className={`relative overflow-hidden p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left transition-all duration-300 ${activeTab === 'parties' ? 'shadow-xl ring-2 ring-purple-300 scale-[1.02]' : 'shadow-md opacity-90'}`}>
             <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-600"></div>
             <div className="relative z-10 text-white flex flex-col items-center">
                <span className="text-xl sm:text-2xl mb-1">👥</span><span className="text-[10px] sm:text-xs font-bold">Directory</span>
             </div>
          </button>
          <button onClick={() => setActiveTab('planning')} className={`relative overflow-hidden p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left transition-all duration-300 ${activeTab === 'planning' ? 'shadow-xl ring-2 ring-amber-300 scale-[1.02]' : 'shadow-md opacity-90'}`}>
             <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-600"></div>
             <div className="relative z-10 text-white flex flex-col items-center">
                <span className="text-xl sm:text-2xl mb-1">📝</span><span className="text-[10px] sm:text-xs font-bold">Planning</span>
             </div>
          </button>
          <button onClick={() => setActiveTab('chemical')} className={`relative overflow-hidden p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left transition-all duration-300 ${activeTab === 'chemical' ? 'shadow-xl ring-2 ring-cyan-300 scale-[1.02]' : 'shadow-md opacity-90'}`}>
             <div className="absolute inset-0 bg-gradient-to-br from-cyan-600 to-blue-700"></div>
             <div className="relative z-10 text-white flex flex-col items-center">
                <span className="text-xl sm:text-2xl mb-1">🧪</span><span className="text-[10px] sm:text-xs font-bold">Chemical</span>
             </div>
          </button>
          <button onClick={() => setActiveTab('master')} className={`relative overflow-hidden p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left transition-all duration-300 ${activeTab === 'master' ? 'shadow-xl ring-2 ring-emerald-300 scale-[1.02]' : 'shadow-md opacity-90'}`}>
             <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 to-teal-600"></div>
             <div className="relative z-10 text-white flex flex-col items-center">
                <span className="text-xl sm:text-2xl mb-1">📑</span><span className="text-[10px] sm:text-xs font-bold">Records</span>
             </div>
          </button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4 sm:space-y-8 animate-in fade-in">
            <div className="space-y-3">
               <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                  <div className="flex items-center gap-2"><span className="text-lg">🚛</span><h3 className="text-sm font-bold text-slate-800">Live Dispatch Feed</h3></div>
                  <input type="text" placeholder="Search Jobs..." value={jobSearch} onChange={e => setJobSearch(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100 w-full sm:max-w-xs" />
               </div>

               {filteredDispatches.map(d => {
                  const party = data.parties.find(p => p.id === d.partyId);
                  const isExpanded = expandedJobId === d.id;
                  const markedCount = (selectedRowsForShare[d.id] || []).length;
                  const isToday = d.isTodayDispatch;

                  return (
                    <div key={d.id} className={`bg-white rounded-lg border shadow-sm overflow-hidden transition-all ${isToday ? 'border-indigo-300' : 'border-slate-200'} mb-1.5`}>
                       <div onClick={() => setExpandedJobId(isExpanded ? null : d.id)} className="p-2 cursor-pointer">
                         <div className="flex justify-between items-start">
                            <div className="min-w-0">
                              <div className="text-[9px] font-bold text-slate-400 mb-0.5">{d.date.substring(5).split('-').reverse().join('/')}</div>
                              <h4 className="text-xs font-bold text-slate-800 truncate">{party?.name}</h4>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] font-bold text-slate-700">{d.totalWeight.toFixed(1)}kg</div>
                                <span className={`text-[8px] font-bold px-1 rounded ${d.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{d.status}</span>
                            </div>
                         </div>
                       </div>
                       
                       {isExpanded && (
                         <div className="bg-slate-50 border-t border-slate-100 animate-in slide-in-from-top-2">
                             <div className="px-2 py-1.5 bg-white border-b border-slate-200 flex justify-between items-center">
                                <button onClick={() => toggleAllRowsForShare(d)} className="text-[9px] font-bold text-indigo-600">Select All</button>
                                <button onClick={() => initiateShare(d)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1">
                                    <Share2 size={12}/> {markedCount > 0 ? `Share Marked (${markedCount})` : 'Share All'}
                                </button>
                             </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left whitespace-nowrap bg-white">
                                 <thead className="bg-slate-100/50 border-b border-slate-200 text-[8px] font-bold text-slate-500 uppercase">
                                    <tr>
                                       <th className="px-2 py-1 w-6">Mark</th>
                                       <th className="px-1 py-1">Size</th>
                                       <th className="px-1 py-1 text-right">Wt</th>
                                       <th className="px-1 py-1 text-right">Pcs</th>
                                       <th className="px-1 py-1 text-center">Box</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-100">
                                    {d.rows.map(row => {
                                        const isMarked = (selectedRowsForShare[d.id] || []).includes(row.id);
                                        return (
                                           <tr key={row.id} className={isMarked ? 'bg-indigo-50/40' : ''}>
                                              <td className="px-2 py-1 text-center">
                                                  <button onClick={() => toggleRowSelectionForShare(d.id, row.id)} className={isMarked ? 'text-indigo-600' : 'text-slate-300'}>
                                                      {isMarked ? <CheckSquare size={14} /> : <Square size={14} />}
                                                  </button>
                                              </td>
                                              <td className="px-1 py-1 text-[9px] font-bold text-slate-700">{row.size}</td>
                                              <td className="px-1 py-1 text-right text-[9px] font-bold text-slate-800">{row.weight.toFixed(3)}</td>
                                              <td className="px-1 py-1 text-right text-[9px] font-bold text-slate-600">{row.pcs}</td>
                                              <td className="px-1 py-1 text-center text-[9px] font-bold text-slate-700">{row.bundle}</td>
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
        </div>
      )}
      {/* ... other tabs continue ... */}
      {activeTab === 'analytics' && <AnalyticsDashboard data={data} />}
      {activeTab === 'parties' && <PartyDashboard data={data} />}
      {activeTab === 'planning' && <ProductionPlanner data={data} />}
      {activeTab === 'chemical' && <ChemicalManager data={data} />}
      {activeTab === 'master' && <MasterSheet data={data} />}
    </div>
  );
};
