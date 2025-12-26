
import React, { useState, useMemo, useEffect } from 'react';
import { AppData, DispatchStatus, SlittingJob } from '../../types';
import { syncAllDataToCloud, triggerDashboardSetup, setGoogleSheetUrl, getGoogleSheetUrl } from '../../services/storageService';
// Fixed icon names for lucide-react 0.475.0
import { Cloud, RefreshCw, Download, Settings, CircleCheck, CircleAlert, X } from 'lucide-react';

interface Props {
  data: AppData;
}

const PROD_DENSITY = 0.00276;

export const MasterSheet: React.FC<Props> = ({ data }) => {
  const [activeSheet, setActiveSheet] = useState<'production' | 'billing' | 'plant' | 'slitting'>('production');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'done'>('idle');
  
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');

  useEffect(() => {
      setSheetUrl(getGoogleSheetUrl());
  }, [isSetupOpen]);

  // Data processing logic
  const plantRows = useMemo(() => {
    return data.slittingJobs.map(job => {
        const sizer = job.planSizer || job.coils.reduce((s, c) => s + parseFloat(c.size), 0);
        const mic = job.planMicron;
        const slitLen = job.planRollLength;
        const tube1mtrWeight = sizer * mic * PROD_DENSITY;
        const tubeRollLen = slitLen / 2;
        const oneRollWeight = (tube1mtrWeight / 1000) * tubeRollLen;
        const totalRolls = Math.max(...job.coils.map(c => c.rolls));

        return {
            id: job.id, date: job.date, party: job.jobCode, srNo: job.jobNo.split('-').pop(),
            sizer, micron: mic, rollLength: slitLen, totalRolls, tube1mtrWeight, oneRollWeight,
        };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.slittingJobs]);

  const slittingRows = useMemo(() => {
    return data.slittingJobs.flatMap(job => {
        const combinedSize = job.coils.reduce((s, c) => s + parseFloat(c.size), 0);
        return job.coils.map((coil, idx) => {
            const coilWeight = (parseFloat(coil.size) * job.planMicron * PROD_DENSITY / 2 * job.planRollLength) / 1000;
            const totalCoilWeight = coilWeight * coil.rolls;
            return {
                id: `${job.id}-${idx}`, date: job.date, party: job.jobCode, srNo: job.jobNo.split('-').pop(),
                combinedSize, coilSize: coil.size, rolls: coil.rolls, totalWeight: totalCoilWeight
            };
        });
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.slittingJobs]);

  const flatProductionRows = useMemo(() => {
    return data.dispatches.flatMap(d => {
      const party = data.parties.find(p => p.id === d.partyId)?.name || 'Unknown';
      return d.rows.map(row => ({
        dispatchId: d.id, date: d.date, party: party, size: row.size,
        sizeType: row.sizeType || "-", micron: row.micron || 0, weight: row.weight,
        productionWeight: row.productionWeight || 0, wastage: row.wastage || 0,
        pcs: row.pcs, bundle: row.bundle, status: row.status || DispatchStatus.PENDING,
        jobStatus: d.status
      }));
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.dispatches, data.parties]);

  const flatBillingRows = useMemo(() => {
    return data.challans.flatMap(c => {
      const party = data.parties.find(p => p.id === c.partyId)?.name || 'Unknown';
      return c.lines.map((line, idx) => ({
        id: `${c.id}_${idx}`, date: c.date, challanNo: c.challanNumber, party: party,
        size: line.size, sizeType: line.sizeType || "-", micron: line.micron || 0,
        weight: line.weight, rate: line.rate, amount: line.amount, paymentMode: c.paymentMode
      }));
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.challans, data.parties]);

  const handleSyncAll = async () => {
      if (isSyncing) return;
      if (!confirm("This will overwrite/update all records in Google Sheets. Proceed?")) return;
      
      setIsSyncing(true);
      setSyncStatus('running');
      try {
          await triggerDashboardSetup();
          await syncAllDataToCloud(data, (curr, total) => {
              setSyncProgress({ current: curr, total });
          });
          setSyncStatus('done');
          setTimeout(() => setSyncStatus('idle'), 5000);
      } catch (err) {
          console.error(err);
          alert("Sync Failed. Check Script Connection.");
          setSyncStatus('idle');
      } finally {
          setIsSyncing(false);
      }
  };

  const filteredProduction = flatProductionRows.filter(r => 
    r.party.toLowerCase().includes(searchTerm.toLowerCase()) || r.size.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredBilling = flatBillingRows.filter(r => 
    r.party.toLowerCase().includes(searchTerm.toLowerCase()) || r.challanNo.includes(searchTerm)
  );
  const filteredPlant = plantRows.filter(r => r.party.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredSlitting = slittingRows.filter(r => r.party.toLowerCase().includes(searchTerm.toLowerCase()) || r.coilSize.includes(searchTerm));

  const downloadCSV = () => {
    let headers: string[] = [];
    let rows: any[] = [];
    const filename = `Export_${activeSheet}_${new Date().toISOString().split('T')[0]}.csv`;

    if (activeSheet === 'plant') {
        headers = ["Date", "Party", "Sr.No", "Sizer", "Micron", "Roll Length", "Total Rolls", "1m Wt", "1r Wt"];
        rows = filteredPlant.map(r => [r.date, r.party, r.srNo, r.sizer, r.micron, r.rollLength, r.totalRolls, r.tube1mtrWeight.toFixed(3), r.oneRollWeight.toFixed(3)]);
    } else if (activeSheet === 'slitting') {
        headers = ["Date", "Party", "Sr.No", "Combined Size", "Coil Size", "Rolls", "Total Weight"];
        rows = filteredSlitting.map(r => [r.date, r.party, r.srNo, r.combinedSize, r.coilSize, r.rolls, r.totalWeight.toFixed(3)]);
    } else if (activeSheet === 'production') {
        headers = ["Date", "Party", "Size", "Type", "Micron", "Weight", "Status"];
        rows = filteredProduction.map(r => [r.date, r.party, r.size, r.sizeType, r.micron, r.weight, r.status]);
    } else {
        headers = ["Date", "Bill No", "Party", "Item", "Weight", "Amount", "Mode"];
        rows = filteredBilling.map(r => [r.date, r.challanNo, r.party, r.size, r.weight, r.amount, r.paymentMode]);
    }

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const syncPercent = syncProgress.total > 0 ? Math.round((syncProgress.current / syncProgress.total) * 100) : 0;

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      
      {/* Cloud Sync Control Center */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-indigo-600/20 transition-all"></div>
         <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-5">
               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all duration-500 ${isSyncing ? 'bg-indigo-600 animate-pulse rotate-12' : 'bg-slate-800'}`}>
                  {isSyncing ? <RefreshCw size={28} className="animate-spin" /> : <Cloud size={28} />}
               </div>
               <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Cloud Integration Hub</h3>
                  <div className="flex items-center gap-2 mt-1">
                      {syncStatus === 'running' ? (
                          <span className="text-indigo-400 text-xs font-black uppercase tracking-widest animate-pulse">Syncing Database...</span>
                      ) : syncStatus === 'done' ? (
                          <span className="text-emerald-400 text-xs font-black uppercase tracking-widest flex items-center gap-1"><CircleCheck size={12}/> All Data Securely Synced</span>
                      ) : (
                          <p className="text-slate-400 text-xs font-medium">Automatic mirroring to Google Sheets enabled.</p>
                      )}
                  </div>
               </div>
            </div>

            <div className="flex flex-wrap gap-3 w-full lg:w-auto">
               <button 
                  onClick={handleSyncAll} 
                  disabled={isSyncing}
                  className={`flex-1 lg:flex-none px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg ${isSyncing ? 'bg-slate-800 text-slate-500' : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'}`}
               >
                  {isSyncing ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Auto Sync All
               </button>
               <button 
                  onClick={() => setIsSetupOpen(true)} 
                  className="flex-1 lg:flex-none bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
               >
                  <Settings size={16} /> Connection
               </button>
            </div>
         </div>

         {/* SYNC PROGRESS OVERLAY */}
         {isSyncing && (
             <div className="mt-8 space-y-3 animate-in slide-in-from-top-2">
                 <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Data Push Progress</span>
                    <span className="text-sm font-black text-indigo-400 font-mono">{syncProgress.current} / {syncProgress.total}</span>
                 </div>
                 <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700 p-0.5">
                    <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500 ease-out shadow-[0_0_15px_rgba(99,102,241,0.5)]" 
                        style={{ width: `${syncPercent}%` }}
                    ></div>
                 </div>
             </div>
         )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
          <div className="bg-slate-50 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-slate-200">
             <div className="flex bg-slate-200 p-1 rounded-xl w-full sm:w-auto">
                {(['production', 'billing', 'plant', 'slitting'] as const).map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setActiveSheet(tab)} 
                        className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${activeSheet === tab ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        {tab}
                    </button>
                ))}
             </div>
             <div className="flex gap-2 w-full sm:w-auto">
                 <input type="text" placeholder="Quick search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100 transition-all w-full sm:w-64" />
                 <button onClick={downloadCSV} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 p-2 rounded-xl transition-all shadow-sm" title="Download Local CSV">
                    <Download size={18} />
                 </button>
             </div>
          </div>

          <div className="flex-1 overflow-auto relative bg-slate-50/50">
            {activeSheet === 'plant' && (
                <table className="min-w-full text-left text-[11px] table-auto border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-100/80 backdrop-blur-md text-slate-500 font-black uppercase tracking-tighter border-b border-slate-300">
                        <tr><th className="px-4 py-3">Party Code</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Sr.No</th><th className="px-4 py-3 text-center">Sizer</th><th className="px-4 py-3 text-center">Micron</th><th className="px-4 py-3 text-center">Roll Len</th><th className="px-4 py-3 text-center">Total Rolls</th><th className="px-4 py-3 text-right">1 Mtr Wt</th><th className="px-4 py-3 text-right">1 Roll Wt</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredPlant.map((r) => (
                            <tr key={r.id} className="hover:bg-indigo-50/50 transition-colors">
                                <td className="px-4 py-2 font-black text-slate-900 uppercase truncate max-w-[150px]">{r.party}</td>
                                <td className="px-4 py-2 font-bold text-slate-500 font-mono">{r.date.substring(5).split('-').reverse().join('/')}</td>
                                <td className="px-4 py-2 font-black text-indigo-600 font-mono">#{r.srNo}</td>
                                <td className="px-4 py-2 text-center font-bold text-slate-700">{r.sizer}</td>
                                <td className="px-4 py-2 text-center font-bold text-slate-700">{r.micron}</td>
                                <td className="px-4 py-2 text-center font-bold text-slate-700">{r.rollLength}</td>
                                <td className="px-4 py-2 text-center font-black text-indigo-700 bg-indigo-50/30">{r.totalRolls}</td>
                                <td className="px-4 py-2 text-right font-mono font-bold text-slate-500">{r.tube1mtrWeight.toFixed(3)}</td>
                                <td className="px-4 py-2 text-right font-mono font-bold text-emerald-600">{r.oneRollWeight.toFixed(3)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {activeSheet === 'slitting' && (
                <table className="min-w-full text-left text-[11px] table-auto border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-100/80 backdrop-blur-md text-slate-500 font-black uppercase tracking-tighter border-b border-slate-300">
                        <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Party Code</th><th className="px-4 py-3">Sr.No</th><th className="px-4 py-3 text-center">Combined Size</th><th className="px-4 py-3 text-center">Coil Size</th><th className="px-4 py-3 text-center">Rolls</th><th className="px-4 py-3 text-right">Total Weight</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredSlitting.map((r) => (
                            <tr key={r.id} className="hover:bg-purple-50/50 transition-colors">
                                <td className="px-4 py-2 font-bold text-slate-500 font-mono">{r.date.substring(5).split('-').reverse().join('/')}</td>
                                <td className="px-4 py-2 font-black text-slate-900 uppercase truncate max-w-[150px]">{r.party}</td>
                                <td className="px-4 py-2 font-black text-purple-600 font-mono">#{r.srNo}</td>
                                <td className="px-4 py-2 text-center font-bold text-slate-700">{r.combinedSize}</td>
                                <td className="px-4 py-2 text-center font-black text-slate-900 bg-slate-50">{r.coilSize}</td>
                                <td className="px-4 py-2 text-center font-bold text-slate-700">{r.rolls}</td>
                                <td className="px-4 py-2 text-right font-mono font-black text-emerald-600">{r.totalWeight.toFixed(3)} KG</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {activeSheet === 'production' && (
                <table className="min-w-full text-left text-[11px] table-auto">
                    <thead className="sticky top-0 z-10 bg-slate-100/80 backdrop-blur-md font-black uppercase tracking-tighter border-b border-slate-300">
                        <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Party</th><th className="px-4 py-3">Size</th><th className="px-4 py-3 text-right">Weight</th><th className="px-4 py-3 text-center">Sts</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredProduction.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-2 font-mono text-slate-500">{r.date}</td>
                                <td className="px-4 py-2 font-black text-slate-800">{r.party}</td>
                                <td className="px-4 py-2 font-bold text-indigo-600">{r.size}</td>
                                <td className="px-4 py-2 text-right font-mono font-bold">{r.weight.toFixed(3)}</td>
                                <td className="px-4 py-2 text-center uppercase font-black text-[9px] text-slate-400">{r.status.slice(0,4)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {activeSheet === 'billing' && (
                <table className="min-w-full text-left text-[11px] table-auto">
                    <thead className="sticky top-0 z-10 bg-slate-100/80 backdrop-blur-md font-black uppercase tracking-tighter border-b border-slate-300">
                        <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Bill</th><th className="px-4 py-3">Party</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-center">Mode</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredBilling.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-2 font-mono text-slate-500">{r.date}</td>
                                <td className="px-4 py-2 font-mono font-black text-indigo-600">#{r.challanNo}</td>
                                <td className="px-4 py-2 font-black text-slate-800">{r.party}</td>
                                <td className="px-4 py-2 text-right font-mono font-bold text-emerald-600">₹{r.amount.toFixed(0)}</td>
                                <td className="px-4 py-2 text-center uppercase font-black text-[9px] text-slate-400">{r.paymentMode}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
          </div>
      </div>
      
      {/* Setup Modal */}
      {isSetupOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300 border border-slate-100">
                  <div className="bg-slate-900 px-6 py-5 flex justify-between items-center text-white">
                      <div className="flex items-center gap-2"><Settings size={18} className="text-indigo-400" /><h3 className="font-black uppercase tracking-widest text-sm">Sheet Connection</h3></div>
                      <button onClick={() => setIsSetupOpen(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                  </div>
                  <div className="p-8 space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Google Script Web App URL</label>
                        <textarea 
                            value={sheetUrl} 
                            onChange={e => setSheetUrl(e.target.value)} 
                            rows={3}
                            className="w-full border-2 border-slate-100 bg-slate-50 rounded-2xl p-4 text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all resize-none" 
                            placeholder="https://script.google.com/macros/s/..."
                        />
                        <div className="flex items-start gap-2 bg-amber-50 p-3 rounded-xl border border-amber-100">
                            <CircleAlert size={14} className="text-amber-600 mt-0.5 shrink-0" />
                            <p className="text-[10px] text-amber-800 font-bold leading-tight">If blank, the system uses the permanent factory default deployment link.</p>
                        </div>
                      </div>
                      <button onClick={() => { setGoogleSheetUrl(sheetUrl); setIsSetupOpen(false); alert("Connection Updated!"); }} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95">Save & Secure Connection</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
