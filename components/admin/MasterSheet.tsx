import React, { useState, useMemo } from 'react';
import { AppData, DispatchStatus, PaymentMode } from '../../types';
import { syncAllDataToCloud } from '../../services/storageService';

interface Props {
  data: AppData;
}

export const MasterSheet: React.FC<Props> = ({ data }) => {
  const [activeSheet, setActiveSheet] = useState<'production' | 'billing'>('production');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });

  // --- 1. FLATTEN PRODUCTION DATA (JOBS) ---
  const flatProductionRows = useMemo(() => {
    return data.dispatches.flatMap(d => {
      const party = data.parties.find(p => p.id === d.partyId)?.name || 'Unknown';
      return d.rows.map(row => ({
        dispatchId: d.id,
        date: d.date,
        party: party,
        size: row.size + (row.sizeType ? ` ${row.sizeType}` : ''), // Append Type for display
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
    const headers = ["Date", "Party Name", "Size", "Dispatch Wt", "Prod Wt", "Wastage", "Pcs/Rolls", "Bundle", "Status"];
    const csvContent = [
      headers.join(","),
      ...filteredProduction.map(r => [
        r.date,
        `"${r.party}"`,
        `"${r.size}"`,
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
    const headers = ["Date", "Challan No", "Party Name", "Item Size", "Weight", "Rate", "Amount", "Mode"];
    const csvContent = [
      headers.join(","),
      ...filteredBilling.map(r => [
        r.date,
        r.challanNo,
        `"${r.party}"`,
        `"${r.size}"`,
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
    if (!confirm("This will send ALL existing Jobs and Bills to the Google Sheet. It may take a few minutes. Continue?")) return;
    
    setIsSyncing(true);
    setSyncProgress({ current: 0, total: 0 });
    
    await syncAllDataToCloud(data, (current, total) => {
        setSyncProgress({ current, total });
    });
    
    alert("Sync Completed Successfully!");
    setIsSyncing(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
          
          {/* HEADER SECTION */}
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-4 py-3 sm:px-6 sm:py-5 flex flex-col sm:flex-row justify-between items-center gap-3">
             <div className="flex items-center gap-2 sm:gap-3 text-white w-full sm:w-auto">
                <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                   <svg className="w-4 h-4 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <h3 className="text-sm sm:text-lg font-bold tracking-wide">Master Data</h3>
                  <div className="flex items-center gap-1.5">
                     <span className="relative flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75 ${isSyncing ? 'duration-300' : ''}`}></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                     </span>
                     <p className="text-[10px] sm:text-xs text-emerald-50 font-medium">
                        {isSyncing ? `Syncing ${syncProgress.current}/${syncProgress.total}...` : 'Live Sync Active'}
                     </p>
                  </div>
                </div>
             </div>
             
             {/* TABS & ACTIONS */}
             <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center">
                
                {/* Switcher */}
                <div className="flex bg-black/20 p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveSheet('production')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeSheet === 'production' ? 'bg-white text-emerald-700 shadow-sm' : 'text-emerald-100 hover:text-white'}`}
                    >
                        Production
                    </button>
                    <button 
                        onClick={() => setActiveSheet('billing')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeSheet === 'billing' ? 'bg-white text-emerald-700 shadow-sm' : 'text-emerald-100 hover:text-white'}`}
                    >
                        Billing
                    </button>
                </div>

                <div className="h-4 w-px bg-white/20 hidden sm:block"></div>

                <input 
                  type="text" 
                  placeholder="Filter Data..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white/10 border border-white/20 text-white placeholder-emerald-100 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold outline-none focus:bg-white/20 transition-all w-full sm:w-48"
                />
                
                <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={handleSyncHistory}
                      disabled={isSyncing}
                      className={`bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Send all historical data to Google Sheet"
                    >
                      <svg className={`w-3 h-3 sm:w-4 sm:h-4 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      <span>{isSyncing ? 'Syncing...' : 'Sync History'}</span>
                    </button>

                    <button 
                      onClick={activeSheet === 'production' ? downloadProductionCSV : downloadBillingCSV}
                      className="bg-white text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm w-full sm:w-auto"
                    >
                      <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      <span>Export</span>
                    </button>
                </div>
             </div>
          </div>

          {/* TABLE CONTENT */}
          <div className="flex-1 overflow-x-auto sm:overflow-hidden bg-slate-50 relative">
            
            {/* --- PRODUCTION TABLE --- */}
            {activeSheet === 'production' && (
                <div className="absolute inset-0 overflow-auto">
                    <table className="min-w-full text-left text-[10px] sm:text-sm table-auto sm:table-fixed border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm text-slate-600 font-semibold text-[10px] sm:text-xs tracking-wide border-b border-slate-200">
                        <tr>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[10%] whitespace-nowrap bg-slate-50">Date</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[20%] whitespace-nowrap bg-slate-50">Party</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[15%] whitespace-nowrap bg-slate-50">Size</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[10%] text-right whitespace-nowrap bg-slate-50">Disp Wt</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[10%] text-right whitespace-nowrap bg-slate-50 text-indigo-600">Prod Wt</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[10%] text-right whitespace-nowrap bg-slate-50 text-red-500">Wastage</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[10%] text-right whitespace-nowrap bg-slate-50">Pcs</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[8%] text-center whitespace-nowrap bg-slate-50">📦</th>
                        <th className="px-2 py-2 sm:px-4 sm:py-3 sm:w-[7%] text-center whitespace-nowrap bg-slate-50">Sts</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredProduction.length === 0 && (
                            <tr><td colSpan={9} className="px-6 py-8 text-center text-slate-400 italic">No production records found.</td></tr>
                        )}
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
                            <td className="px-2 py-1 sm:px-4 sm:py-3 font-semibold text-slate-700 truncate">{row.size}</td>
                            <td className="px-2 py-1 sm:px-4 sm:py-3 text-right font-mono text-slate-600">{row.weight.toFixed(3)}</td>
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

            {/* --- BILLING TABLE --- */}
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
                        {filteredBilling.length === 0 && (
                            <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-400 italic">No billing records found.</td></tr>
                        )}
                        {filteredBilling.map((row, index) => {
                        const isUnpaid = row.paymentMode === PaymentMode.UNPAID;
                        return (
                            <tr key={row.id} className="hover:bg-purple-50/40 transition-colors">
                            <td className="px-2 py-1 sm:px-4 sm:py-3 font-medium text-slate-600 truncate">{row.date}</td>
                            <td className="px-2 py-1 sm:px-4 sm:py-3 font-mono font-bold text-slate-800 truncate">#{row.challanNo}</td>
                            <td className="px-2 py-1 sm:px-4 sm:py-3 font-bold text-slate-800 truncate" title={row.party}>{row.party}</td>
                            <td className="px-2 py-1 sm:px-4 sm:py-3 font-medium text-slate-700 truncate">{row.size}</td>
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