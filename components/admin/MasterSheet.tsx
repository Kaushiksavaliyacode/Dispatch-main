import React, { useState, useMemo } from 'react';
import { AppData, DispatchStatus } from '../../types';

interface Props {
  data: AppData;
}

export const MasterSheet: React.FC<Props> = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Flatten the dispatch data: 1 Row per Item
  const flatRows = useMemo(() => {
    return data.dispatches.flatMap(d => {
      const party = data.parties.find(p => p.id === d.partyId)?.name || 'Unknown';
      return d.rows.map(row => ({
        dispatchId: d.id,
        date: d.date,
        party: party,
        size: row.size,
        weight: row.weight,
        pcs: row.pcs,
        bundle: row.bundle,
        status: row.status || DispatchStatus.PENDING,
        jobStatus: d.status
      }));
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data]);

  const filteredRows = flatRows.filter(r => 
    r.party.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.size.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.date.includes(searchTerm)
  );

  const downloadCSV = () => {
    const headers = ["Date", "Party Name", "Size", "Weight", "Pcs/Rolls", "Bundle", "Status"];
    const csvContent = [
      headers.join(","),
      ...filteredRows.map(r => [
        r.date,
        `"${r.party}"`, // Quote party name to handle commas
        `"${r.size}"`,
        r.weight.toFixed(3),
        r.pcs,
        r.bundle,
        r.status
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `rdms_master_sheet_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-4 py-3 sm:px-6 sm:py-5 flex flex-col sm:flex-row justify-between items-center gap-3">
             <div className="flex items-center gap-2 sm:gap-3 text-white w-full sm:w-auto">
                <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                   <svg className="w-4 h-4 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <h3 className="text-sm sm:text-lg font-bold tracking-wide">Master Data</h3>
                  <p className="text-[10px] sm:text-xs text-emerald-100 font-medium">Complete History</p>
                </div>
             </div>
             
             <div className="flex gap-2 w-full sm:w-auto">
                <input 
                  type="text" 
                  placeholder="Filter..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white/10 border border-white/20 text-white placeholder-emerald-100 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold outline-none focus:bg-white/20 transition-all w-full sm:w-64"
                />
                <button 
                  onClick={downloadCSV}
                  className="bg-white text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"
                >
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  <span className="hidden sm:inline">Export CSV</span>
                  <span className="sm:hidden">CSV</span>
                </button>
             </div>
          </div>

          <div className="overflow-hidden">
            {/* Table Fixed to prevent horizontal scroll */}
            <table className="w-full text-left text-[10px] sm:text-sm table-fixed">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-[10px] sm:text-xs tracking-wide border-b border-slate-200">
                <tr>
                  <th className="px-2 py-2 sm:px-4 sm:py-4 w-[12%]">Date</th>
                  <th className="px-2 py-2 sm:px-4 sm:py-4 w-[25%]">Party</th>
                  <th className="px-2 py-2 sm:px-4 sm:py-4 w-[23%]">Size</th>
                  <th className="px-2 py-2 sm:px-4 sm:py-4 w-[10%] text-right">Wt</th>
                  <th className="px-2 py-2 sm:px-4 sm:py-4 w-[10%] text-right">Pcs</th>
                  <th className="px-2 py-2 sm:px-4 sm:py-4 w-[10%] text-center">📦</th>
                  <th className="px-2 py-2 sm:px-4 sm:py-4 w-[10%] text-center">Sts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.length === 0 && (
                  <tr>
                     <td colSpan={7} className="px-6 py-8 text-center text-slate-400 italic">No records found.</td>
                  </tr>
                )}
                {filteredRows.map((row, index) => {
                  let statusColor = 'bg-slate-100 text-slate-600';
                  if(row.status === DispatchStatus.COMPLETED) statusColor = 'bg-emerald-100 text-emerald-700';
                  else if(row.status === DispatchStatus.DISPATCHED) statusColor = 'bg-purple-100 text-purple-700';
                  else if(row.status === DispatchStatus.LOADING) statusColor = 'bg-amber-100 text-amber-700';
                  
                  const isMm = row.size.toLowerCase().includes('mm');

                  return (
                    <tr key={`${row.dispatchId}-${index}`} className="hover:bg-indigo-50/40 transition-colors">
                      <td className="px-2 py-1 sm:px-4 sm:py-3 font-medium text-slate-600 truncate">{row.date}</td>
                      <td className="px-2 py-1 sm:px-4 sm:py-3 font-bold text-slate-800 truncate" title={row.party}>{row.party}</td>
                      <td className="px-2 py-1 sm:px-4 sm:py-3 font-semibold text-slate-700 truncate">{row.size}</td>
                      <td className="px-2 py-1 sm:px-4 sm:py-3 text-right font-mono text-slate-600">{row.weight.toFixed(3)}</td>
                      <td className="px-2 py-1 sm:px-4 sm:py-3 text-right font-mono text-slate-600 truncate">{row.pcs} <span className="text-[9px] sm:text-xs text-slate-400">{isMm ? 'R' : 'P'}</span></td>
                      <td className="px-2 py-1 sm:px-4 sm:py-3 text-center text-slate-600 font-medium">{row.bundle}</td>
                      <td className="px-2 py-1 sm:px-4 sm:py-3 text-center">
                         <span className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[9px] sm:text-[10px] font-bold tracking-wide ${statusColor}`}>
                           {row.status === DispatchStatus.LOADING ? 'RUNNING' : row.status.slice(0,4)}
                         </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
      </div>
    </div>
  );
};