import React, { useState, useMemo, useEffect } from 'react';
import { AppData, DispatchStatus, PaymentMode } from '../../types';
import { syncAllDataToCloud, triggerDashboardSetup, setGoogleSheetUrl, getGoogleSheetUrl } from '../../services/storageService';
import { GOOGLE_SCRIPT_CODE } from '../../services/googleScriptSource';

interface Props {
  data: AppData;
}

export const MasterSheet: React.FC<Props> = ({ data }) => {
  const [activeSheet, setActiveSheet] = useState<'production' | 'billing'>('production');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  
  // Setup Modal State
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');

  useEffect(() => {
      setSheetUrl(getGoogleSheetUrl());
  }, [isSetupOpen]);

  // --- 1. FLATTEN PRODUCTION DATA (JOBS) ---
  const flatProductionRows = useMemo(() => {
    return data.dispatches.flatMap(d => {
      const party = data.parties.find(p => p.id === d.partyId)?.name || 'Unknown';
      return d.rows.map(row => ({
        dispatchId: d.id,
        date: d.date,
        party: party,
        size: row.size,
        sizeType: row.sizeType || "-", 
        micron: row.micron || 0,       
        weight: row.weight,
        productionWeight: row.productionWeight || 0,
        wastage: row.wastage || 0,
        pcs: row.pcs,
        bundle: row.bundle,
        status: row.status || DispatchStatus.PENDING,
        jobStatus: d.status
      }));
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.dispatches, data.parties]);

  // --- 2. FLATTEN BILLING DATA (CHALLANS) ---
  const flatBillingRows = useMemo(() => {
    return data.challans.flatMap(c => {
      const party = data.parties.find(p => p.id === c.partyId)?.name || 'Unknown';
      return c.lines.map((line, idx) => ({
        id: `${c.id}_${idx}`,
        date: c.date,
        challanNo: c.challanNumber,
        party: party,
        size: line.size,
        sizeType: line.sizeType || "-", // Added Type
        micron: line.micron || 0, 
        weight: line.weight,
        rate: line.rate,
        amount: line.amount,
        paymentMode: c.paymentMode
      }));
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.challans, data.parties]);

  // --- FILTERING ---
  const filteredProduction = flatProductionRows.filter(r => 
    r.party.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.size.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.date.includes(searchTerm)
  );

  const filteredBilling = flatBillingRows.filter(r => 
    r.party.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.challanNo.includes(searchTerm) ||
    r.date.includes(searchTerm)
  );

  // --- EXPORT FUNCTIONS ---
  const downloadProductionCSV = () => {
    const headers = ["Date", "Party Name", "Size", "Type", "Micron", "Dispatch Wt", "Prod Wt", "Wastage", "Pcs/Rolls", "Bundle", "Status"];
    const csvContent = [
      headers.join(","),
      ...filteredProduction.map(r => [
        r.date,
        `"${r.party}"`,
        `"${r.size}"`,
        r.sizeType,
        r.micron,
        r.weight.toFixed(3),
        r.productionWeight.toFixed(3),
        r.wastage.toFixed(3),
        r.pcs,
        r.bundle,
        r.status
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Production_Data_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const downloadBillingCSV = () => {
    const headers = ["Date", "Challan No", "Party Name", "Item Size", "Type", "Micron", "Weight", "Rate", "Amount", "Mode"];
    const csvContent = [
      headers.join(","),
      ...filteredBilling.map(r => [
        r.date,
        r.challanNo,
        `"${r.party}"`,
        `"${r.size}"`,
        r.sizeType,
        r.micron,
        r.weight.toFixed(3),
        r.rate,
        r.amount.toFixed(2),
        r.paymentMode
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Billing_Data_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleSyncHistory = async () => {
    if (!getGoogleSheetUrl()) return alert("Please configure the Google Sheet URL in Setup first.");
    if (!confirm("This will send ALL existing Jobs and Bills to the Google Sheet. It may take a few minutes. Continue?")) return;
    
    setIsSyncing(true);
    setSyncProgress({ current: 0, total: 0 });
    
    await syncAllDataToCloud(data, (current, total) => {
        setSyncProgress({ current, total });
    });
    
    alert("Sync Completed Successfully!");
    setIsSyncing(false);
  };
  
  const copyScriptToClipboard = () => {
      navigator.clipboard.writeText(GOOGLE_SCRIPT_CODE).then(() => {
          alert("Script copied! Paste it into Google Apps Script editor.");
      }, (err) => {
          console.error("Could not copy text: ", err);
      });
  };

  const saveUrl = () => {
      setGoogleSheetUrl(sheetUrl);
      setIsSetupOpen(false);
      alert("URL Saved Successfully");
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      
      {/* SETUP MODAL */}
      {isSetupOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                  <div className="bg-slate-800 px-6 py-4 flex justify-between items-center">
                      <h3 className="text-lg font-bold text-white">⚙️ Google Cloud Dashboard Setup</h3>
                      <button onClick={() => setIsSetupOpen(false)} className="text-slate-400 hover:text-white">✕</button>
                  </div>
                  <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                      
                      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                          <h4 className="font-bold text-indigo-800 mb-2">Step 1: Get the Script</h4>
                          <button onClick={copyScriptToClipboard} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors">
                              📋 Copy Google Apps Script Code
                          </button>
                          <p className="text-xs text-indigo-600 mt-2">Click above to copy the backend code.</p>
                      </div>

                      <div className="space-y-3">
                          <h4 className="font-bold text-slate-800">Step 2: Deploy in Google Sheets</h4>
                          <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-600">
                              <li>Open a new or existing <strong>Google Sheet</strong>.</li>
                              <li>Go to <strong>Extensions {'>'} Apps Script</strong>.</li>
                              <li>Paste the copied code into the editor (replace existing code).</li>
                              <li>Click <strong>Save</strong> (💾 icon).</li>
                              <li>Click <strong>Deploy {'>'} New Deployment</strong>.</li>
                              <li>Select type: <strong>Web App</strong>.</li>
                              <li>Set <strong>Execute as: Me</strong>.</li>
                              <li>Set <strong>Who has access: Anyone</strong> (Important!).</li>
                              <li>Click <strong>Deploy</strong> and copy the <strong>Web App URL</strong>.</li>
                          </ol>
                      </div>

                      <div className="space-y-2">
                          <h4 className="font-bold text-slate-800">Step 3: Connect App</h4>
                          <label className="text-xs font-bold text-slate-500 uppercase">Paste Web App URL Here</label>
                          <input 
                              type="text" 
                              value={sheetUrl} 
                              onChange={e => setSheetUrl(e.target.value)} 
                              placeholder="https://script.google.com/macros/s/..." 
                              className="w-full border-2 border-slate-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-800 focus:border-indigo-500 outline-none"
                          />
                      </div>
                  </div>
                  <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200">
                      <button onClick={() => setIsSetupOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
                      <button onClick={saveUrl} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg transition-all">Save Connection</button>
                  </div>
              </div>
          </div>
      )}

      {/* Cloud Integration Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-6">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center text-white text-2xl shadow-lg shadow-green-100">
               ☁️
            </div>
            <div>
               <h3 className="text-lg font-bold text-slate-800">Google Cloud Dashboard</h3>
               <p className="text-xs text-slate-500 font-medium max-w-sm">
                  Sync data to Google Sheets to view the Ultra-Professional Analytics Dashboard with Sparklines & Reports.
               </p>
            </div>
         </div>
         <div className="flex flex-wrap gap-3 w-full lg:w-auto">
            <button 
               onClick={() => setIsSetupOpen(true)}
               className="flex-1 lg:flex-none bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
               <span>⚙️ Setup & Instructions</span>
            </button>
            <button 
               onClick={triggerDashboardSetup}
               className="flex-1 lg:flex-none bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-slate-200 transition-all flex items-center justify-center gap-2"
            >
               <span>🚀 Re-Build Dashboard</span>
            </button>
            <button 
               onClick={handleSyncHistory}
               disabled={isSyncing}
               className={`flex-1 lg:flex-none bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 ${isSyncing ? 'opacity-50' : ''}`}
            >
               <span>{isSyncing ? `Syncing ${Math.round((syncProgress.current/syncProgress.total)*100)}%` : '🔄 Sync History'}</span>
            </button>
         </div>
      </div>

      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
          
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-4 py-3 sm:px-6 sm:py-5 flex flex-col sm:flex-row justify-between items-center gap-3">
             <div className="flex items-center gap-2 sm:gap-3 text-white w-full sm:w-auto">
                <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                   <svg className="w-4 h-4 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <h3 className="text-sm sm:text-lg font-bold tracking-wide">Master Records</h3>
                </div>
             </div>
             
             <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center">
                <div className="flex bg-black/20 p-1 rounded-lg">
                    <button onClick={() => setActiveSheet('production')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeSheet === 'production' ? 'bg-white text-emerald-700 shadow-sm' : 'text-emerald-100 hover:text-white'}`}>Production</button>
                    <button onClick={() => setActiveSheet('billing')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeSheet === 'billing' ? 'bg-white text-emerald-700 shadow-sm' : 'text-emerald-100 hover:text-white'}`}>Billing</button>
                </div>
                <div className="h-4 w-px bg-white/20 hidden sm:block"></div>
                <input type="text" placeholder="Filter Data..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-white/10 border border-white/20 text-white placeholder-emerald-100 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold outline-none focus:bg-white/20 transition-all w-full sm:w-48" />
                <button onClick={activeSheet === 'production' ? downloadProductionCSV : downloadBillingCSV} className="bg-white text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm w-full sm:w-auto"><span>Export CSV</span></button>
             </div>
          </div>

          <div className="flex-1 overflow-x-auto sm:overflow-hidden bg-slate-50 relative">
            
            {activeSheet === 'production' && (
                <div className="absolute inset-0 overflow-auto">
                    <table className="min-w-full text-left text-[10px] sm:text-sm table-auto sm:table-fixed border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm text-slate-600 font-semibold text-[10px] sm:text-xs tracking-wide border-b border-slate-200">
                        <tr>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[10%] whitespace-nowrap bg-slate-50">Date</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[20%] whitespace-nowrap bg-slate-50">Party</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[15%] whitespace-nowrap bg-slate-50">Size</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[10%] text-right whitespace-nowrap bg-slate-50 text-indigo-600">Prod Wt</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[10%] text-right whitespace-nowrap bg-slate-50 text-red-500">Wastage</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[10%] text-right whitespace-nowrap bg-slate-50">Pcs</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[8%] text-center whitespace-nowrap bg-slate-50">📦</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[7%] text-center whitespace-nowrap bg-slate-50">Sts</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredProduction.map((row, index) => {
                        let statusColor = 'bg-slate-100 text-slate-600';
                        if(row.status === DispatchStatus.COMPLETED) statusColor = 'bg-emerald-100 text-emerald-700';
                        else if(row.status === DispatchStatus.DISPATCHED) statusColor = 'bg-purple-100 text-purple-700';
                        else if(row.status === DispatchStatus.PRINTING) statusColor = 'bg-indigo-100 text-indigo-700';
                        else if(row.status === DispatchStatus.SLITTING) statusColor = 'bg-amber-100 text-amber-700 animate-pulse';
                        else if(row.status === DispatchStatus.CUTTING) statusColor = 'bg-blue-100 text-blue-700 animate-pulse';
                        
                        const isMm = row.size.toLowerCase().includes('mm');

                        return (
                            <tr key={`${row.dispatchId}-${index}`} className="hover:bg-indigo-50/40 transition-colors">
                            <td className="px-2 py-1 sm:px-4 sm:py-3 font-medium text-slate-600 truncate">{row.date}</td>
                            <td className="px-2 py-1 sm:px-4 sm:py-3 font-bold text-slate-800 truncate" title={row.party}>{row.party}</td>
                            <td className="px-2 py-1 sm:px-4 sm:py-3 font-semibold text-slate-700 truncate">
                                {row.size}
                                {row.sizeType !== '-' && <span className="ml-1 text-[9px] text-slate-400">({row.sizeType})</span>}
                            </td>
                            <td className="px-2 py-1 sm:px-4 sm:py-3 text-right font-mono text-indigo-600 font-medium">{row.productionWeight > 0 ? row.productionWeight.toFixed(3) : '-'}</td>
                            <td className="px-2 py-1 sm:px-4 sm:py-3 text-right font-mono text-red-500 font-medium">{row.wastage > 0 ? row.wastage.toFixed(3) : '-'}</td>
                            <td className="px-2 py-1 sm:px-4 sm:py-3 text-right font-mono text-slate-600 truncate">{row.pcs} <span className="text-[9px] sm:text-xs text-slate-400">{isMm ? 'R' : 'P'}</span></td>
                            <td className="px-2 py-1 sm:px-4 sm:py-3 text-center text-slate-600 font-medium">{row.bundle}</td>
                            <td className="px-2 py-1 sm:px-4 sm:py-3 text-center">
                                <span className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[9px] sm:text-[10px] font-bold tracking-wide ${statusColor}`}>
                                {row.status.slice(0,4)}
                                </span>
                            </td>
                            </tr>
                        );
                        })}
                    </tbody>
                    </table>
                </div>
            )}

            {activeSheet === 'billing' && (
                <div className="absolute inset-0 overflow-auto">
                    <table className="min-w-full text-left text-[10px] sm:text-sm table-auto sm:table-fixed border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm text-slate-600 font-semibold text-[10px] sm:text-xs tracking-wide border-b border-slate-200">
                        <tr>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[10%] whitespace-nowrap bg-slate-50">Date</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[10%] whitespace-nowrap bg-slate-50">Challan</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[25%] whitespace-nowrap bg-slate-50">Party</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[20%] whitespace-nowrap bg-slate-50">Item</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[10%] text-right whitespace-nowrap bg-slate-50">Weight</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[10%] text-right whitespace-nowrap bg-slate-50 text-indigo-600">Rate</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[10%] text-right whitespace-nowrap bg-slate-50">Amount</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[5%] text-center whitespace-nowrap bg-slate-50">Mode</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredBilling.map((row, index) => {
                        const isUnpaid = row.paymentMode === PaymentMode.UNPAID;
                        return (
                            <tr key={row.id} className="hover:bg-purple-50/40 transition-colors">
                            <td className="px-2 py-1 sm:px-4 sm:py-3 font-medium text-slate-600 truncate">{row.date}</td>
                            <td className="px-2 py-1 sm:px-4 sm:py-3 font-mono font-bold text-slate-800 truncate">#{row.challanNo}</td>
                            <td className="px-2 py-1 sm:px-4 sm:py-3 font-bold text-slate-800 truncate" title={row.party}>{row.party}</td>
                            <td className="px-2 py-1 sm:px-4 sm:py-3 font-medium text-slate-700 truncate">
                                {row.size}
                                {row.micron > 0 && <span className="ml-1 text-[9px] text-slate-400">({row.micron}m)</span>}
                            </td>
                            <td className="px-2 py-1 sm:px-4 sm:py-3 text-right font-mono text-slate-600">{row.weight.toFixed(3)}</td>
                            <td className="px-2 py-1 sm:px-4 sm:py-3 text-right font-mono text-indigo-600">{row.rate}</td>
                            <td className="px-2 py-1 sm:px-4 sm:py-3 text-right font-bold text-slate-800">₹{row.amount.toFixed(2)}</td>
                            <td className="px-2 py-1 sm:px-4 sm:py-3 text-center">
                                <span className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[9px] sm:text-[10px] font-bold tracking-wide ${isUnpaid ? 'text-red-500 bg-red-50' : 'text-emerald-600 bg-emerald-50'}`}>
                                {row.paymentMode.slice(0,1)}
                                </span>
                            </td>
                            </tr>
                        );
                        })}
                    </tbody>
                    </table>
                </div>
            )}
          </div>
      </div>
    </div>
  );
};