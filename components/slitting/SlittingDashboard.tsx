
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppData, SlittingJob, SlittingProductionRow, DispatchRow, DispatchEntry, DispatchStatus } from '../../types';
import { saveSlittingJob, saveDispatch, ensurePartyExists } from '../../services/storageService';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

interface BatchRow {
    meter: string;
    gross: string;
    core: string;
}

// --- Helper Component for Editable Rows ---
interface EditableHistoryRowProps {
    row: SlittingProductionRow;
    onSave: (id: string, gross: number, core: number) => void;
    onDelete: (id: string) => void;
}

const EditableHistoryRow: React.FC<EditableHistoryRowProps> = ({ row, onSave, onDelete }) => {
    const [gross, setGross] = useState(row.grossWeight.toFixed(3));
    const [core, setCore] = useState(row.coreWeight.toFixed(3));

    // Sync with external updates
    useEffect(() => {
        setGross(row.grossWeight.toFixed(3));
        setCore(row.coreWeight.toFixed(3));
    }, [row.grossWeight, row.coreWeight]);

    const handleBlur = () => {
        const g = parseFloat(gross) || 0;
        const c = parseFloat(core) || 0;
        
        // Auto-format display on blur
        setGross(g.toFixed(3));
        setCore(c.toFixed(3));

        // Only save if values changed and are valid
        if ((g !== row.grossWeight || c !== row.coreWeight) && g > 0) {
            onSave(row.id, g, c);
        }
    };

    return (
        <tr className="bg-slate-50 hover:bg-white transition-colors group">
            <td className="py-2 font-mono text-slate-400 text-center text-[10px] sm:text-xs">{row.srNo}</td>
            <td className="py-2 font-mono text-center text-slate-600 font-bold text-[10px] sm:text-xs">{row.meter}</td>
            <td className="py-1 px-1">
                <input 
                   type="number" 
                   value={gross} 
                   onChange={e => setGross(e.target.value)}
                   onBlur={handleBlur}
                   className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded px-1 py-1 text-center font-bold text-slate-900 outline-none transition-all text-xs"
                />
            </td>
            <td className="py-1 px-1">
                <input 
                   type="number" 
                   value={core} 
                   onChange={e => setCore(e.target.value)}
                   onBlur={handleBlur}
                   className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded px-1 py-1 text-center font-bold text-slate-500 outline-none transition-all text-xs"
                />
            </td>
            <td className="py-2 font-bold text-emerald-600 text-center text-[10px] sm:text-xs">{row.netWeight.toFixed(3)}</td>
            <td className="py-2 text-center">
                <button onClick={() => onDelete(row.id)} className="text-slate-300 hover:text-red-500 px-2 font-bold transition-colors text-lg leading-none">×</button>
            </td>
        </tr>
    );
};

export const SlittingDashboard: React.FC<Props> = ({ data, onUpdate }) => {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [activeCoilId, setActiveCoilId] = useState<string>('');
  const [batchRows, setBatchRows] = useState<BatchRow[]>(
      Array(5).fill({ meter: '', gross: '', core: '' })
  );
  const [coilBundles, setCoilBundles] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // --- FILTERS STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const selectedJob = data.slittingJobs.find(j => j.id === selectedJobId);

  // Initialize Coil Selection
  useEffect(() => {
    if (selectedJob && !activeCoilId && selectedJob.coils.length > 0) {
        setActiveCoilId(selectedJob.coils[0].id);
    }
  }, [selectedJobId, selectedJob]);

  // Load Bundles
  useEffect(() => {
      if (selectedJob && activeCoilId) {
          const coil = selectedJob.coils.find(c => c.id === activeCoilId);
          setCoilBundles(coil?.producedBundles?.toString() || '0');
          // Reset batch rows only on coil change to keep data clean
          setBatchRows(Array(5).fill({ meter: '', gross: '', core: '' }));
      }
  }, [activeCoilId, selectedJob]);

  // Helper: Get Next Sr No
  const historyRows = useMemo(() => {
      if (!selectedJob || !activeCoilId) return [];
      return selectedJob.rows
        .filter(r => r.coilId === activeCoilId)
        .sort((a, b) => a.srNo - b.srNo);
  }, [selectedJob, activeCoilId]);

  const startSrNo = useMemo(() => {
      if (historyRows.length === 0) return 1;
      return historyRows[historyRows.length - 1].srNo + 1;
  }, [historyRows]);

  // Handle Input Changes
  const handleBatchChange = (index: number, field: keyof BatchRow, value: string) => {
      const newRows = [...batchRows];
      
      // Update the specific field
      newRows[index] = { ...newRows[index], [field]: value };

      // Auto-fill Core Weight logic
      // If user is editing the first row's core, propagate to ALL subsequent rows in batch
      if (index === 0 && field === 'core') {
          for (let i = 1; i < newRows.length; i++) {
              newRows[i] = { ...newRows[i], core: value };
          }
      }

      // Recalculate Meter & Logic for changed rows
      newRows.forEach((row, idx) => {
          // Only recalc if we have gross and core
          if (row.gross && row.core) {
              const gross = parseFloat(row.gross) || 0;
              const core = parseFloat(row.core) || 0;
              const net = Math.max(0, gross - core);
              
              if (selectedJob && activeCoilId) {
                 const coil = selectedJob.coils.find(c => c.id === activeCoilId);
                 const sizeVal = parseFloat(coil?.size || '0');
                 const micron = selectedJob.planMicron;
                 
                 if (net > 0 && sizeVal > 0 && micron > 0) {
                     // New Formula: Net / Micron / 0.00139 / (Size in Meters)
                     const sizeInMeters = sizeVal / 1000;
                     const calculatedMeter = net / micron / 0.00139 / sizeInMeters;
                     
                     // Round to nearest 10 (e.g. 1236 -> 1240)
                     const roundedMeter = Math.round(calculatedMeter / 10) * 10;
                     newRows[idx].meter = roundedMeter.toString();
                 } else {
                     newRows[idx].meter = '';
                 }
              }
          }
      });

      setBatchRows(newRows);
  };

  const handleBatchBlur = (index: number, field: 'gross' | 'core') => {
      const val = parseFloat(batchRows[index][field]);
      if (!isNaN(val)) {
          const newRows = [...batchRows];
          newRows[index][field] = val.toFixed(3);
          setBatchRows(newRows);
      }
      saveSingleRow(index); 
  };

  // AUTO SAVE LOGIC
  const saveSingleRow = async (index: number) => {
      if (!selectedJob || !activeCoilId || isSaving) return;
      const row = batchRows[index];
      
      const gross = parseFloat(row.gross) || 0;
      const core = parseFloat(row.core); 

      // Validation: Gross must be > 0, Core must be valid number
      if (gross <= 0 || isNaN(core)) return;

      setIsSaving(true);
      try {
          const selectedCoilIndex = selectedJob.coils.findIndex(c => c.id === activeCoilId);
          const selectedCoil = selectedJob.coils[selectedCoilIndex];
          const currentSr = startSrNo + index; // Use calculated SR based on history

          const netWeight = gross - core;

          const newEntry: SlittingProductionRow = {
              id: `slit-row-${Date.now()}`,
              coilId: activeCoilId,
              srNo: currentSr, // Note: This might shift if multiple people edit, but for single op it's fine
              size: selectedCoil.size,
              micron: selectedJob.planMicron,
              grossWeight: gross,
              coreWeight: core,
              netWeight: netWeight,
              meter: parseFloat(row.meter) || 0
          };

          // 1. Add to Job Rows
          const updatedRows = [...selectedJob.rows, newEntry];
          
          // 2. Clear this specific batch row
          const newBatchRows = [...batchRows];
          newBatchRows[index] = { meter: '', gross: '', core: '' };
          setBatchRows(newBatchRows);

          // 3. Save Job
          const updatedJob: SlittingJob = {
              ...selectedJob,
              rows: updatedRows,
              status: 'IN_PROGRESS', 
              updatedAt: new Date().toISOString()
          };

          await saveSlittingJob(updatedJob);
          await syncWithDispatch(updatedJob, updatedRows);
      } catch (e) {
          console.error("Auto Save Failed", e);
      } finally {
          setIsSaving(false);
      }
  };

  const updateHistoryRow = async (rowId: string, newGross: number, newCore: number) => {
      if (!selectedJob) return;
      
      const oldRow = selectedJob.rows.find(r => r.id === rowId);
      if(!oldRow) return;

      const net = Math.max(0, newGross - newCore);
      let newMeter = oldRow.meter;

      // Recalculate Meter with new formula
      const coil = selectedJob.coils.find(c => c.id === oldRow.coilId);
      const sizeVal = parseFloat(coil?.size || '0');
      const micron = selectedJob.planMicron;
      
      if (net > 0 && sizeVal > 0 && micron > 0) {
          const sizeInMeters = sizeVal / 1000;
          const calculatedMeter = net / micron / 0.00139 / sizeInMeters;
          newMeter = Math.round(calculatedMeter / 10) * 10;
      }

      const updatedRow = { 
          ...oldRow, 
          grossWeight: newGross, 
          coreWeight: newCore, 
          netWeight: net, 
          meter: newMeter 
      };

      const newRows = selectedJob.rows.map(r => r.id === rowId ? updatedRow : r);
      const updatedJob = { ...selectedJob, rows: newRows, updatedAt: new Date().toISOString() };

      await saveSlittingJob(updatedJob);
      await syncWithDispatch(updatedJob, newRows);
  };

  const handleBundleSave = async () => {
      if (!selectedJob || !activeCoilId) return;
      const selectedCoilIndex = selectedJob.coils.findIndex(c => c.id === activeCoilId);
      if (selectedCoilIndex === -1) return;

      const newBundleCount = parseInt(coilBundles) || 0;
      const selectedCoil = selectedJob.coils[selectedCoilIndex];

      if (newBundleCount === selectedCoil.producedBundles) return; // No change

      const updatedCoils = [...selectedJob.coils];
      updatedCoils[selectedCoilIndex] = { ...selectedCoil, producedBundles: newBundleCount };

      const updatedJob = { ...selectedJob, coils: updatedCoils, updatedAt: new Date().toISOString() };
      await saveSlittingJob(updatedJob);
      await syncWithDispatch(updatedJob, selectedJob.rows);
  };

  const handleDeleteRow = async (rowId: string) => {
      if (!selectedJob) return;
      if (!confirm("Delete this entry?")) return;

      const updatedRows = selectedJob.rows.filter(r => r.id !== rowId);
      const updatedJob = { ...selectedJob, rows: updatedRows, updatedAt: new Date().toISOString() };
      
      await saveSlittingJob(updatedJob);
      await syncWithDispatch(updatedJob, updatedRows);
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>, job: SlittingJob) => {
      e.stopPropagation();
      const newStatus = e.target.value as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
      const updatedJob = { ...job, status: newStatus, updatedAt: new Date().toISOString() };
      await saveSlittingJob(updatedJob);
  };

  const syncWithDispatch = async (job: SlittingJob, updatedRows: SlittingProductionRow[]) => {
      const existingDispatch = data.dispatches.find(d => d.dispatchNo === job.jobNo);
      const coilAggregates: Record<string, { weight: number, pcs: number }> = {};
      
      job.coils.forEach(c => { coilAggregates[c.size] = { weight: 0, pcs: 0 }; });

      updatedRows.forEach(r => {
          if (r.netWeight > 0) {
              const coil = job.coils.find(c => c.id === r.coilId);
              if (coil) {
                  coilAggregates[coil.size].weight += r.netWeight;
                  coilAggregates[coil.size].pcs += 1;
              }
          }
      });

      const dispatchRows: DispatchRow[] = job.coils.map(c => {
          const agg = coilAggregates[c.size];
          return {
              id: `slit-row-${c.id}`, 
              size: c.size,
              sizeType: 'ROLL',
              micron: job.planMicron,
              weight: parseFloat(agg.weight.toFixed(3)),
              productionWeight: 0,
              wastage: 0,
              pcs: agg.pcs, 
              bundle: c.producedBundles || 0, // SYNC BUNDLES
              status: DispatchStatus.SLITTING,
              isCompleted: false,
              isLoaded: false
          };
      });

      // --- INTELLIGENT PARTY RESOLUTION ---
      let partyId = existingDispatch?.partyId;
      const searchKey = job.jobCode.trim().toLowerCase();
      let needsResolution = !partyId;
      if (partyId) {
          const linkedParty = data.parties.find(p => p.id === partyId);
          if (linkedParty && linkedParty.name.toLowerCase() === searchKey && !linkedParty.code) {
              needsResolution = true;
          }
      }

      if (needsResolution) {
          const matchedParty = data.parties.find(p => 
              (p.code && p.code.toLowerCase() === searchKey) || 
              p.name.toLowerCase() === searchKey
          );

          if (matchedParty) {
              partyId = matchedParty.id;
          } else if (!partyId) {
              partyId = await ensurePartyExists(data.parties, job.jobCode);
          }
      }

      const totalWt = parseFloat(Object.values(coilAggregates).reduce((s, a) => s + a.weight, 0).toFixed(3));
      const commonData = {
          rows: dispatchRows,
          totalWeight: totalWt,
          totalPcs: Object.values(coilAggregates).reduce((s, a) => s + a.pcs, 0),
          updatedAt: new Date().toISOString(),
          isTodayDispatch: true,
          status: DispatchStatus.SLITTING,
          partyId: partyId 
      };

      let dispatchEntry: DispatchEntry;
      if (existingDispatch) {
          dispatchEntry = { ...existingDispatch, ...commonData };
      } else {
          if (!partyId) partyId = await ensurePartyExists(data.parties, job.jobCode);
          dispatchEntry = {
              id: `d-slit-${job.id}`,
              dispatchNo: job.jobNo,
              date: new Date().toISOString().split('T')[0],
              partyId: partyId,
              createdAt: new Date().toISOString(),
              ...commonData
          };
      }
      await saveDispatch(dispatchEntry);
  };

  const getPartyName = (job: SlittingJob) => {
      const searchKey = job.jobCode.trim();
      if (/^\d{3}$/.test(searchKey)) {
          const relCode = `REL/${searchKey}`;
          const fullParty = data.parties.find(p => p.code === relCode);
          return fullParty ? `${fullParty.name} [${fullParty.code}]` : relCode;
      }
      const searchKeyLower = searchKey.toLowerCase();
      const p = data.parties.find(p => 
          p.name.toLowerCase() === searchKeyLower || 
          (p.code && p.code.toLowerCase() === searchKeyLower)
      );
      return p ? (p.code ? `${p.name} [${p.code}]` : p.name) : job.jobCode;
  };

  const handleAddMoreRows = () => {
      setBatchRows(prev => [...prev, ...Array(5).fill({ meter: '', gross: '', core: '' })]);
  };

  const shareSlittingJob = async (job: SlittingJob) => {
      const containerId = 'temp-share-container-slitting';
      let container = document.getElementById(containerId);
      if (container) document.body.removeChild(container);
      
      container = document.createElement('div');
      container.id = containerId;
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = '550px'; 
      container.style.backgroundColor = '#ffffff';
      container.style.fontFamily = 'Inter, sans-serif';
      document.body.appendChild(container);

      const partyName = getPartyName(job);
      const totalNet = job.rows.reduce((s, r) => s + r.netWeight, 0);

      // Generate HTML for each coil separately
      let tablesHtml = '';
      
      job.coils.forEach(coil => {
          const coilRows = job.rows.filter(r => r.coilId === coil.id).sort((a,b) => a.srNo - b.srNo);
          if (coilRows.length === 0) return;

          const coilTotal = coilRows.reduce((s,r) => s + r.netWeight, 0);
          
          let displaySize = coil.size;
          if (/^\d+$/.test(displaySize.trim())) {
              displaySize += " MM";
          }

          const rowsHtml = coilRows.map((r, i) => `
            <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                <td style="padding: 6px 8px; text-align: center; border-bottom: 1px solid #e5e7eb; font-size: 11px; color: #374151;">${r.srNo}</td>
                <td style="padding: 6px 8px; text-align: right; border-bottom: 1px solid #e5e7eb; font-size: 11px; font-weight: bold; color: #1f2937;">${r.meter || '-'}</td>
                <td style="padding: 6px 8px; text-align: right; border-bottom: 1px solid #e5e7eb; font-size: 11px; color: #4b5563;">${r.grossWeight.toFixed(3)}</td>
                <td style="padding: 6px 8px; text-align: right; border-bottom: 1px solid #e5e7eb; font-size: 11px; color: #ef4444;">${r.coreWeight.toFixed(3)}</td>
                <td style="padding: 6px 8px; text-align: right; border-bottom: 1px solid #e5e7eb; font-size: 11px; font-weight: bold; color: #059669;">${r.netWeight.toFixed(3)}</td>
            </tr>
          `).join('');

          tablesHtml += `
            <div style="margin-top: 10px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; background: white;">
                <div style="background: #f3f4f6; padding: 6px 10px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: 800; color: #111827; font-size: 12px; text-transform: uppercase;">${displaySize}</div>
                    <div style="font-size: 11px; font-weight: bold; color: #059669;">${coilTotal.toFixed(3)} kg</div>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-family: monospace;">
                    <thead>
                        <tr style="background: #f9fafb; color: #6b7280;">
                            <th style="padding: 5px; text-align: center; font-size: 9px; text-transform: uppercase;">Sr</th>
                            <th style="padding: 5px; text-align: right; font-size: 9px; text-transform: uppercase;">Meter</th>
                            <th style="padding: 5px; text-align: right; font-size: 9px; text-transform: uppercase;">Gross</th>
                            <th style="padding: 5px; text-align: right; font-size: 9px; text-transform: uppercase;">Core</th>
                            <th style="padding: 5px; text-align: right; font-size: 9px; text-transform: uppercase;">Net</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
          `;
      });

      container.innerHTML = `
        <div style="overflow: hidden; background: #ffffff; width: 550px;">
          <div style="background: linear-gradient(135deg, #1e293b, #0f172a); padding: 20px; color: white;">
             <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                   <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.7;">Slitting Report</div>
                   <div style="font-size: 22px; font-weight: bold;">${partyName}</div>
                   <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">Job #${job.jobNo}</div>
                </div>
                <div style="text-align: right;">
                   <div style="font-size: 12px; font-weight: bold; background: rgba(255,255,255,0.1); padding: 4px 8px; rounded: 4px;">${job.date}</div>
                   <div style="font-size: 20px; font-weight: bold; margin-top: 5px; color: #34d399;">${totalNet.toFixed(3)} <span style="font-size:12px;">kg</span></div>
                </div>
             </div>
          </div>
          
          <div style="padding: 15px; background: #f8fafc;">
              ${tablesHtml}
          </div>

          <div style="padding: 10px; background: #ffffff; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
             Generated by RDMS
          </div>
        </div>
      `;

      if ((window as any).html2canvas) {
        try {
          const canvas = await (window as any).html2canvas(container, { backgroundColor: '#ffffff', scale: 2 });
          canvas.toBlob(async (blob: Blob) => {
            if (blob) {
              const file = new File([blob], `Job_${job.jobNo}.png`, { type: 'image/png' });
              if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: `Slitting Job #${job.jobNo}`, text: `Production Report for ${partyName}` });
              } else {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `Job_${job.jobNo}.png`;
                link.click();
              }
            }
            if (document.body.contains(container!)) document.body.removeChild(container!);
          });
        } catch (e) {
          console.error("Image generation failed", e);
          if (document.body.contains(container!)) document.body.removeChild(container!);
        }
      }
  };

  // FILTERED LIST VIEW - Show filtered jobs sorted by Status Priority
  const filteredJobs = useMemo(() => {
      return data.slittingJobs.filter(job => {
          // 1. Search Query (Job No, Job Code, Micron, Coils Size)
          const query = searchQuery.toLowerCase();
          const partyName = getPartyName(job).toLowerCase();
          const coilSizes = job.coils.map(c => c.size.toLowerCase()).join(' ');
          
          const matchesSearch = 
              job.jobNo.toLowerCase().includes(query) ||
              job.jobCode.toLowerCase().includes(query) ||
              partyName.includes(query) ||
              job.planMicron.toString().includes(query) ||
              coilSizes.includes(query);

          // 2. Status Filter
          const matchesStatus = filterStatus === 'ALL' || job.status === filterStatus;

          // 3. Date Range Filter
          let matchesDate = true;
          if (filterStartDate) {
              matchesDate = matchesDate && new Date(job.date) >= new Date(filterStartDate);
          }
          if (filterEndDate) {
              matchesDate = matchesDate && new Date(job.date) <= new Date(filterEndDate);
          }

          return matchesSearch && matchesStatus && matchesDate;
      }).sort((a, b) => {
          const statusOrder: any = { 'IN_PROGRESS': 0, 'PENDING': 1, 'COMPLETED': 2 };
          if (statusOrder[a.status] !== statusOrder[b.status]) {
              return statusOrder[a.status] - statusOrder[b.status];
          }
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [data.slittingJobs, searchQuery, filterStatus, filterStartDate, filterEndDate, data.parties]);

  if (selectedJob) {
      const selectedCoil = selectedJob.coils.find(c => c.id === activeCoilId);
      const totalProduction = selectedJob.rows.reduce((sum, r) => sum + r.netWeight, 0);

      return (
          <div className="max-w-5xl mx-auto p-2 sm:p-4 space-y-4 animate-in slide-in-from-right-4 duration-300">
             
             {/* 1. Compact Header & Job Details */}
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setSelectedJobId(null)} className="bg-slate-100 p-1.5 rounded-lg text-slate-500 hover:text-slate-800">
                            ←
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-slate-800 leading-none">#{selectedJob.jobNo}</h2>
                                <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-500">{selectedJob.date.split('-').reverse().join('/')}</span>
                            </div>
                            <p className="text-xs text-slate-500 font-bold truncate max-w-[200px]">{getPartyName(selectedJob)}</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1.5">
                        <select 
                            value={selectedJob.status} 
                            onChange={(e) => handleStatusChange(e, selectedJob)}
                            className={`text-[10px] font-bold px-2 py-1.5 rounded border outline-none ${
                                selectedJob.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                selectedJob.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                        >
                            <option value="PENDING">PENDING</option>
                            <option value="IN_PROGRESS">RUNNING</option>
                            <option value="COMPLETED">DONE</option>
                        </select>
                        <button 
                            onClick={() => shareSlittingJob(selectedJob)} 
                            className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded flex items-center gap-1 border border-emerald-100 hover:bg-emerald-100 transition-colors shadow-sm"
                        >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-8.683-2.031-.967-.272-.297-.471-.421-.92-.891-.298-.471-.794-.666-1.514-.666-.72 0-1.885.27-2.871 1.336-.986 1.066-3.758 3.515-3.758 8.57 0 5.055 3.684 9.941 4.179 10.662.495.721 7.218 11.025 17.514 11.025 10.296 0 11.757-.692 13.843-2.775 2.086-2.083 2.086-3.89 2.086-3.89.27-.124.544-.272.718-.396.174-.124.322-.272.396-.446.074-.174.198-.644.198-1.336 0-.692-.52-1.238-1.114-1.535z"/></svg>
                            Share
                        </button>
                    </div>
                </div>
                
                {/* Specs Bar */}
                <div className="flex gap-2 text-xs bg-slate-50 p-2 rounded-lg border border-slate-100 overflow-x-auto whitespace-nowrap">
                    <div className="px-2 border-r border-slate-200">
                        <span className="text-[9px] text-slate-400 font-bold uppercase block">Micron</span>
                        <span className="font-bold text-slate-700">{selectedJob.planMicron}</span>
                    </div>
                    <div className="px-2 border-r border-slate-200">
                        <span className="text-[9px] text-slate-400 font-bold uppercase block">Length</span>
                        <span className="font-bold text-slate-700">{selectedJob.planRollLength} m</span>
                    </div>
                    <div className="px-2 border-r border-slate-200">
                        <span className="text-[9px] text-slate-400 font-bold uppercase block">Plan Qty</span>
                        <span className="font-bold text-slate-700">{selectedJob.planQty}</span>
                    </div>
                    <div className="px-2">
                        <span className="text-[9px] text-slate-400 font-bold uppercase block">Total Out</span>
                        <span className="font-bold text-emerald-600">{totalProduction.toFixed(3)}</span>
                    </div>
                </div>
             </div>

             {/* 2. Coil Tabs - Scrollable */}
             <div className="overflow-x-auto pb-1 -mx-2 px-2 sm:mx-0 sm:px-0">
                 <div className="flex gap-2 min-w-max">
                     {selectedJob.coils.map((coil, idx) => {
                         const coilTotal = selectedJob.rows.filter(r => r.coilId === coil.id).reduce((s,r) => s + r.netWeight, 0);
                         return (
                             <button 
                                key={coil.id}
                                onClick={() => setActiveCoilId(coil.id)}
                                className={`flex flex-col items-center px-4 py-2 rounded-lg border-2 transition-all min-w-[80px] ${
                                    activeCoilId === coil.id 
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                                    : 'bg-white border-slate-200 text-slate-500'
                                }`}
                             >
                                 <span className="text-[10px] font-bold uppercase opacity-80">Coil {idx+1}</span>
                                 <span className="text-sm font-bold">{coil.size}</span>
                                 <span className={`text-[10px] ${activeCoilId === coil.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                                     {coilTotal.toFixed(1)} kg
                                 </span>
                             </button>
                         );
                     })}
                 </div>
             </div>

             {/* 3. Unified Excel-Style Data Entry Table */}
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                 {/* Toolbar */}
                 <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100 flex flex-wrap justify-between items-center gap-3 sticky top-0 z-20">
                     <div className="flex items-center gap-2">
                         <span className="text-sm font-bold text-indigo-800 uppercase tracking-wide">{selectedJob.coils.find(c => c.id === activeCoilId)?.size} LOG</span>
                         {isSaving && <span className="text-[10px] font-bold text-amber-600 animate-pulse">Saving...</span>}
                     </div>
                     <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-indigo-100 shadow-sm">
                         <span className="text-[10px] font-bold text-slate-500 uppercase">Bundles:</span>
                         <input 
                            type="number" 
                            value={coilBundles}
                            onChange={(e) => setCoilBundles(e.target.value)}
                            onBlur={handleBundleSave}
                            className="w-16 font-bold text-indigo-700 outline-none border-b border-indigo-200 focus:border-indigo-500 text-center"
                            placeholder="0"
                         />
                     </div>
                 </div>
                 
                 <div className="overflow-x-auto">
                     <table className="w-full text-center text-xs">
                         <thead className="bg-slate-100 text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-10">
                             <tr>
                                 <th className="py-3 w-12 bg-slate-100">Sr</th>
                                 <th className="py-3 w-20 bg-slate-100">Meter</th>
                                 <th className="py-3 w-24 bg-slate-100">Gross</th>
                                 <th className="py-3 w-20 bg-slate-100">Core</th>
                                 <th className="py-3 w-24 text-indigo-600 bg-slate-100">Net Wt</th>
                                 <th className="py-3 w-10 bg-slate-100"></th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100 bg-slate-50/30">
                             {/* HISTORY ROWS (Editable) */}
                             {historyRows.map((row) => (
                                 <EditableHistoryRow 
                                    key={row.id} 
                                    row={row} 
                                    onSave={updateHistoryRow} 
                                    onDelete={handleDeleteRow} 
                                 />
                             ))}

                             {/* SEPARATOR */}
                             {historyRows.length > 0 && (
                                <tr><td colSpan={6} className="bg-white border-y border-indigo-100 py-1"><div className="h-0.5 w-full bg-indigo-50"></div></td></tr>
                             )}

                             {/* BATCH INPUT ROWS */}
                             {batchRows.map((row, idx) => {
                                 const grossVal = parseFloat(row.gross) || 0;
                                 const coreVal = parseFloat(row.core) || 0;
                                 const net = grossVal - coreVal;
                                 
                                 return (
                                     <tr key={`batch-${idx}`} className="bg-white hover:bg-indigo-50/30 transition-colors">
                                         <td className="py-1 font-mono text-indigo-300 font-bold">{startSrNo + idx}</td>
                                         <td className="py-1 px-1">
                                             <input 
                                                 type="number" 
                                                 placeholder="Auto"
                                                 value={row.meter}
                                                 readOnly
                                                 className="w-full bg-slate-50 text-slate-500 border border-slate-200 rounded px-1 py-2 text-center font-bold outline-none cursor-not-allowed"
                                                 tabIndex={-1}
                                             />
                                         </td>
                                         <td className="py-1 px-1">
                                             <input 
                                                 type="number" 
                                                 placeholder="Gross"
                                                 value={row.gross}
                                                 onChange={e => handleBatchChange(idx, 'gross', e.target.value)}
                                                 onBlur={() => handleBatchBlur(idx, 'gross')}
                                                 className="w-full bg-white border border-slate-200 rounded px-1 py-2 text-center font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 text-slate-900"
                                             />
                                         </td>
                                         <td className="py-1 px-1">
                                             <input 
                                                 type="number" 
                                                 placeholder="Core"
                                                 value={row.core}
                                                 onChange={e => handleBatchChange(idx, 'core', e.target.value)}
                                                 onBlur={() => handleBatchBlur(idx, 'core')}
                                                 className="w-full bg-white border border-slate-200 rounded px-1 py-2 text-center font-bold text-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                                             />
                                         </td>
                                         <td className="py-1 font-bold text-indigo-700">
                                             {net > 0 ? net.toFixed(3) : '-'}
                                         </td>
                                         <td></td>
                                     </tr>
                                 );
                             })}
                         </tbody>
                     </table>
                 </div>
                 
                 <div className="p-3 bg-white border-t border-slate-200 flex gap-2 sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                     <button 
                         onClick={handleAddMoreRows}
                         className="flex-1 bg-white border-2 border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 font-bold py-3 rounded-lg transition-all text-xs uppercase tracking-wide"
                     >
                         + 5 Rows
                     </button>
                 </div>
             </div>
          </div>
      );
  }
  
  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
           <div className="flex items-center gap-3">
               <div className="bg-amber-500 text-white p-3 rounded-xl shadow-lg shadow-amber-200">
                   <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               </div>
               <div>
                   <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Operator Dashboard</h1>
                   <p className="text-slate-500 text-xs font-bold">Select a Job Card to Start Production</p>
               </div>
           </div>
           
           {/* FILTER CONTROLS */}
           <div className="flex flex-wrap gap-2 w-full md:w-auto">
               <input 
                   type="text" 
                   placeholder="Search code, size..." 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="flex-1 min-w-[140px] bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-200"
               />
               <select 
                   value={filterStatus}
                   onChange={(e) => setFilterStatus(e.target.value)}
                   className="bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-200"
               >
                   <option value="ALL">Status: All</option>
                   <option value="PENDING">Pending</option>
                   <option value="IN_PROGRESS">Running</option>
                   <option value="COMPLETED">Done</option>
               </select>
               <input 
                   type="date"
                   value={filterStartDate}
                   onChange={(e) => setFilterStartDate(e.target.value)}
                   className="bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-200 w-[110px]"
                   placeholder="Start"
               />
               <input 
                   type="date"
                   value={filterEndDate}
                   onChange={(e) => setFilterEndDate(e.target.value)}
                   className="bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-200 w-[110px]"
                   placeholder="End"
               />
               {(searchQuery || filterStatus !== 'ALL' || filterStartDate || filterEndDate) && (
                   <button 
                       onClick={() => { setSearchQuery(''); setFilterStatus('ALL'); setFilterStartDate(''); setFilterEndDate(''); }}
                       className="bg-slate-100 text-slate-500 px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-200"
                   >
                       Clear
                   </button>
               )}
           </div>
       </div>

       {/* Grid Layout - Compact Cards */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {filteredJobs.map(job => {
               const partyName = getPartyName(job);
               const producedWt = job.rows.reduce((s, r) => s + r.netWeight, 0);
               
               return (
               <div 
                   key={job.id} 
                   className={`bg-white rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-all group relative overflow-hidden ${
                       job.status === 'IN_PROGRESS' ? 'border-amber-400 ring-1 ring-amber-100' : 
                       job.status === 'COMPLETED' ? 'border-slate-200 opacity-80 bg-slate-50' : 'border-slate-200'
                   }`}
                   onClick={() => setSelectedJobId(job.id)}
               >
                   {/* Status Color Stripe */}
                   <div className={`absolute top-0 left-0 w-1.5 h-full ${
                        job.status === 'IN_PROGRESS' ? 'bg-amber-500' : 
                        job.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-slate-300'
                   }`}></div>

                   <div className="pl-5 p-4">
                       {/* Header: Job No & Status */}
                       <div className="flex justify-between items-start mb-2">
                           <div>
                               <div className="flex items-center gap-2 mb-1">
                                   <h3 className="text-lg font-bold text-slate-800 leading-none">#{job.jobNo}</h3>
                                   <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{job.date.split('-').reverse().join('/')}</span>
                               </div>
                               <div className="text-xs font-bold text-slate-600 truncate max-w-[200px]" title={partyName}>
                                   {partyName}
                               </div>
                           </div>
                           
                           <div onClick={e => e.stopPropagation()}>
                               <select 
                                   value={job.status} 
                                   onChange={(e) => handleStatusChange(e, job)}
                                   className={`text-[9px] font-bold px-1.5 py-1 rounded uppercase tracking-wide outline-none border ${
                                       job.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                       job.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                       'bg-slate-50 text-slate-500 border-slate-200'
                                   }`}
                               >
                                   <option value="PENDING">PENDING</option>
                                   <option value="IN_PROGRESS">RUNNING</option>
                                   <option value="COMPLETED">DONE</option>
                               </select>
                           </div>
                       </div>

                       {/* Specs Grid */}
                       <div className="grid grid-cols-3 gap-1 mb-3">
                           <div className="bg-slate-50 rounded p-1.5 text-center border border-slate-100">
                               <div className="text-[8px] text-slate-400 font-bold uppercase">Micron</div>
                               <div className="text-xs font-bold text-slate-700">{job.planMicron}</div>
                           </div>
                           <div className="bg-slate-50 rounded p-1.5 text-center border border-slate-100">
                               <div className="text-[8px] text-slate-400 font-bold uppercase">Length</div>
                               <div className="text-xs font-bold text-slate-700">{job.planRollLength} m</div>
                           </div>
                           <div className="bg-slate-50 rounded p-1.5 text-center border border-slate-100">
                               <div className="text-[8px] text-slate-400 font-bold uppercase">Target</div>
                               <div className="text-xs font-bold text-slate-700">{job.planQty} kg</div>
                           </div>
                       </div>

                       {/* Coils Table - Horizontal Layout */}
                       <div className="mb-3 text-xs border border-slate-200 rounded-md overflow-hidden">
                          <div className="flex bg-slate-100 border-b border-slate-200">
                             <div className="w-10 p-1.5 font-bold text-slate-500 text-[9px] border-r border-slate-200 flex items-center justify-center">Size</div>
                             {job.coils.map(c => <div key={c.id} className="flex-1 p-1.5 text-center font-bold text-slate-800 border-r border-slate-200 last:border-0">{c.size}</div>)}
                          </div>
                          <div className="flex bg-white">
                             <div className="w-10 p-1.5 font-bold text-slate-500 text-[9px] border-r border-slate-200 bg-slate-50 flex items-center justify-center">Rolls</div>
                             {job.coils.map(c => <div key={c.id} className="flex-1 p-1.5 text-center font-bold text-indigo-600 border-r border-slate-200 last:border-0">{c.rolls}</div>)}
                          </div>
                       </div>

                       {/* Footer */}
                       <div className="flex justify-between items-center">
                            <div className="text-xs">
                                <span className="text-[9px] text-slate-400 font-bold uppercase mr-1">Produced:</span>
                                <span className={`font-bold ${producedWt > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                                    {producedWt.toFixed(1)} kg
                                </span>
                            </div>
                            <button className="bg-slate-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow hover:bg-slate-800 transition-colors uppercase tracking-wider">
                                {job.status === 'COMPLETED' ? 'View Report' : 'Open Job'}
                            </button>
                       </div>
                   </div>
               </div>
           )})}
           
           {filteredJobs.length === 0 && (
               <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
                   <p className="text-slate-400 font-bold">No Jobs Found</p>
                   <p className="text-xs text-slate-300 mt-1">Try adjusting the filters or search term</p>
               </div>
           )}
       </div>
    </div>
  );
};
