
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppData, DispatchStatus, SlittingJob } from '../../types';
import { 
    syncAllDataToCloud, triggerDashboardSetup, setGoogleSheetUrl, 
    getGoogleSheetUrl, restoreFullBackup 
} from '../../services/storageService';
// Fixed icon names for lucide-react 0.475.0
import { 
    Cloud, RefreshCw, Download, Settings, CircleCheck, 
    CircleAlert, X, Database, UploadCloud, FileJson 
} from 'lucide-react';

interface Props {
  data: AppData;
}

const PROD_DENSITY = 0.00276;

export const MasterSheet: React.FC<Props> = ({ data }) => {
  const [activeSheet, setActiveSheet] = useState<'production' | 'billing' | 'plant' | 'slitting'>('production');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'done'>('idle');
  
  // Restore State
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState({ step: '', current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');

  useEffect(() => {
      setSheetUrl(getGoogleSheetUrl());
  }, [isSetupOpen]);

  // Data processing logic...
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

  // Handlers for sync, backup, restore...

  const filteredProduction = flatProductionRows.filter(r => 
    r.party.toLowerCase().includes(searchTerm.toLowerCase()) || r.size.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredBilling = flatBillingRows.filter(r => 
    r.party.toLowerCase().includes(searchTerm.toLowerCase()) || r.challanNo.includes(searchTerm)
  );
  const filteredPlant = plantRows.filter(r => r.party.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredSlitting = slittingRows.filter(r => r.party.toLowerCase().includes(searchTerm.toLowerCase()) || r.coilSize.includes(searchTerm));

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Cloud & Maintenance Hub UI... */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
          {/* Sheet Navigation... */}
          <div className="flex-1 overflow-auto relative bg-slate-50/50">
            {activeSheet === 'production' && (
                <table className="min-w-full text-left text-[11px] table-auto">
                    <thead className="sticky top-0 z-10 bg-slate-100/80 backdrop-blur-md font-black uppercase tracking-tighter border-b border-slate-300">
                        <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Party</th><th className="px-4 py-3">Size</th><th className="px-4 py-3 text-right">Weight</th><th className="px-4 py-3 text-center">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredProduction.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-2 font-mono text-slate-500">{r.date}</td>
                                <td className="px-4 py-2 font-black text-slate-800">{r.party}</td>
                                <td className="px-4 py-2 font-bold text-indigo-600">{r.size}</td>
                                <td className="px-4 py-2 text-right font-mono font-bold">{r.weight.toFixed(3)}</td>
                                <td className="px-4 py-2 text-center uppercase font-black text-[9px] text-slate-400">{r.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {/* Other sheets logic... */}
          </div>
      </div>
    </div>
  );
};
