
import React, { useState, useMemo, useEffect } from 'react';
import { AppData, DispatchStatus, PaymentMode, SlittingJob } from '../../types';
import { syncAllDataToCloud, triggerDashboardSetup, setGoogleSheetUrl, getGoogleSheetUrl } from '../../services/storageService';
import { GOOGLE_SCRIPT_CODE } from '../../services/googleScriptSource';

interface Props {
  data: AppData;
}

const PROD_DENSITY = 0.00276;

export const MasterSheet: React.FC<Props> = ({ data }) => {
  const [activeSheet, setActiveSheet] = useState<'production' | 'billing' | 'plant' | 'slitting'>('production');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');

  useEffect(() => {
      setSheetUrl(getGoogleSheetUrl());
  }, [isSetupOpen]);

  // --- 1. INDUSTRIAL PRODUCTION LOG (PLANT) ---
  const plantRows = useMemo(() => {
    return data.slittingJobs.map(job => {
        const sizer = job.planSizer || job.coils.reduce((s, c) => s + parseFloat(c.size), 0);
        const mic = job.planMicron;
        const slitLen = job.planRollLength;
        
        // Calculations
        const tube1mtrWeight = sizer * mic * PROD_DENSITY;
        const tubeRollLen = slitLen / 2;
        const oneRollWeight = (tube1mtrWeight / 1000) * tubeRollLen;
        const totalRolls = Math.max(...job.coils.map(c => c.rolls));

        return {
            id: job.id,
            date: job.date,
            party: job.jobCode,
            srNo: job.jobNo.split('-').pop(),
            sizer,
            micron: mic,
            rollLength: slitLen,
            totalRolls,
            tube1mtrWeight,
            oneRollWeight,
        };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.slittingJobs]);

  // --- 2. SLITTING SUMMARY LOG ---
  const slittingRows = useMemo(() => {
    return data.slittingJobs.flatMap(job => {
        const combinedSize = job.coils.reduce((s, c) => s + parseFloat(c.size), 0);
        return job.coils.map((coil, idx) => {
            const coilWeight = (parseFloat(coil.size) * job.planMicron * PROD_DENSITY / 2 * job.planRollLength) / 1000;
            const totalCoilWeight = coilWeight * coil.rolls;

            return {
                id: `${job.id}-${idx}`,
                date: job.date,
                party: job.jobCode,
                srNo: job.jobNo.split('-').pop(),
                combinedSize,
                coilSize: coil.size,
                rolls: coil.rolls,
                totalWeight: totalCoilWeight
            };
        });
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.slittingJobs]);

  // --- 3. FLATTEN PRODUCTION DATA (JOBS) ---
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

  // --- 4. FLATTEN BILLING DATA (CHALLANS) ---
  const flatBillingRows = useMemo(() => {
    return data.challans.flatMap(c => {
      const party = data.parties.find(p => p.id === c.partyId)?.name || 'Unknown';
      return c.lines.map((line, idx) => ({
        id: `${c.id}_${idx}`,
        date: c.date,
        challanNo: c.challanNumber,
        party: party,
        size: line.size,
        sizeType: line.sizeType || "-", 
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
    let filename = `Export_${activeSheet}_${new Date().toISOString().split('T')[0]}.csv`;

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

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      
      {/* Cloud Integration Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-4">
         <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xl">☁️</div>
            <div>
               <h3 className="text-base font-bold text-slate-800 leading-none">Record Archive</h3>
               <p className="text-[10px] text-slate-500 font-medium mt-1">Unified view of all industrial and financial operations.</p>
            </div>
         </div>
         <div className="flex gap-2 w-full lg:w-auto">
            <button onClick={() => setIsSetupOpen(true)} className="flex-1 lg:flex-none bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold">Setup</button>
            <button onClick={downloadCSV} className="flex-1 lg:flex-none bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md">Export Current Tab</button>
         </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
          
          <div className="bg-slate-900 px-4 py-3 flex flex-col sm:flex-row justify-between items-center gap-3">
             <div className="flex bg-white/10 p-1 rounded-lg w-full sm:w-auto">
                {(['production', 'billing', 'plant', 'slitting'] as const).map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setActiveSheet(tab)} 
                        className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${activeSheet === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                        {tab}
                    </button>
                ))}
             </div>
             <input type="text" placeholder="Filter records..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:bg-white/20 transition-all w-full sm:w-64" />
          </div>

          <div className="flex-1 overflow-auto relative bg-slate-50">
            {/* PLANT PRODUCTION TABLE */}
            {activeSheet === 'plant' && (
                <table className="min-w-full text-left text-[11px] table-auto border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-100 text-slate-500 font-black uppercase tracking-tighter border-b border-slate-300">
                        <tr>
                            <th className="px-4 py-3">Party Code</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Sr.No</th>
                            <th className="px-4 py-3 text-center">Sizer</th>
                            <th className="px-4 py-3 text-center">Micron</th>
                            <th className="px-4 py-3 text-center">Roll Len</th>
                            <th className="px-4 py-3 text-center">Total Rolls</th>
                            <th className="px-4 py-3 text-right">1 Mtr Wt</th>
                            <th className="px-4 py-3 text-right">1 Roll Wt</th>
                        </tr>
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

            {/* SLITTING SUMMARY TABLE */}
            {activeSheet === 'slitting' && (
                <table className="min-w-full text-left text-[11px] table-auto border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-100 text-slate-500 font-black uppercase tracking-tighter border-b border-slate-300">
                        <tr>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Party Code</th>
                            <th className="px-4 py-3">Sr.No</th>
                            <th className="px-4 py-3 text-center">Combined Size</th>
                            <th className="px-4 py-3 text-center">Coil Size</th>
                            <th className="px-4 py-3 text-center">Rolls</th>
                            <th className="px-4 py-3 text-right">Total Weight</th>
                        </tr>
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

            {/* Existing Tables (Simplified) */}
            {activeSheet === 'production' && (
                <table className="min-w-full text-left text-[11px] table-auto">
                    <thead className="sticky top-0 z-10 bg-slate-100 font-black uppercase tracking-tighter border-b border-slate-300">
                        <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Party</th><th className="px-4 py-3">Size</th><th className="px-4 py-3 text-right">Weight</th><th className="px-4 py-3 text-center">Sts</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredProduction.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="px-4 py-2">{r.date}</td>
                                <td className="px-4 py-2 font-bold">{r.party}</td>
                                <td className="px-4 py-2 font-bold text-indigo-600">{r.size}</td>
                                <td className="px-4 py-2 text-right font-mono font-bold">{r.weight.toFixed(3)}</td>
                                <td className="px-4 py-2 text-center uppercase font-black text-[9px]">{r.status.slice(0,4)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {activeSheet === 'billing' && (
                <table className="min-w-full text-left text-[11px] table-auto">
                    <thead className="sticky top-0 z-10 bg-slate-100 font-black uppercase tracking-tighter border-b border-slate-300">
                        <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Bill</th><th className="px-4 py-3">Party</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-center">Mode</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredBilling.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="px-4 py-2">{r.date}</td>
                                <td className="px-4 py-2 font-mono font-bold">#{r.challanNo}</td>
                                <td className="px-4 py-2 font-bold">{r.party}</td>
                                <td className="px-4 py-2 text-right font-mono font-bold text-emerald-600">₹{r.amount.toFixed(0)}</td>
                                <td className="px-4 py-2 text-center uppercase font-black text-[9px]">{r.paymentMode}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
          </div>
      </div>
      
      {/* Setup Modal - Already handled in previous versions */}
      {isSetupOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
                  <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white"><h3 className="font-bold">Google Sheet Setup</h3><button onClick={() => setIsSetupOpen(false)}>✕</button></div>
                  <div className="p-6 space-y-4">
                      <label className="text-xs font-black uppercase text-slate-400">Sheet Web App URL</label>
                      <input type="text" value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} className="w-full border-2 border-slate-200 rounded-lg p-3 text-xs font-bold outline-none focus:border-indigo-600" />
                      <button onClick={() => { setGoogleSheetUrl(sheetUrl); setIsSetupOpen(false); alert("Saved!"); }} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl">Save Connection</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
