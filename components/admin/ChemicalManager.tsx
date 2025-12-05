
import React from 'react';
import { AppData } from '../../types';

interface Props {
  data: AppData;
}

export const ChemicalManager: React.FC<Props> = ({ data }) => {
  const stock = data.chemicalStock || { dop: 0, stabilizer: 0, epoxy: 0, g161: 0, nbs: 0 };

  // Calculate Total Usage from Logs
  const totalUsed = data.chemicalLogs.reduce((acc, log) => ({
      dop: acc.dop + log.dop,
      stabilizer: acc.stabilizer + log.stabilizer,
      epoxy: acc.epoxy + log.epoxy,
      g161: acc.g161 + (log.g161 || 0),
      nbs: acc.nbs + log.nbs
  }), { dop: 0, stabilizer: 0, epoxy: 0, g161: 0, nbs: 0 });

  const shareStockReport = async () => {
    const containerId = 'chem-share-container';
    let container = document.getElementById(containerId);
    if (container) document.body.removeChild(container);
    
    container = document.createElement('div');
    container.id = containerId;
    container.style.position = 'fixed';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    container.style.width = '600px';
    container.style.backgroundColor = '#ffffff';
    container.style.fontFamily = 'Inter, sans-serif';
    document.body.appendChild(container);

    const date = new Date().toLocaleDateString();

    container.innerHTML = `
      <div style="background: white; overflow: hidden; border-radius: 0;">
         <div style="background: linear-gradient(135deg, #0891b2, #2563eb); padding: 25px; color: white;">
            <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9;">Inventory Report</div>
            <div style="font-size: 24px; font-weight: bold; margin-top: 5px;">Chemical Stock Status</div>
            <div style="font-size: 12px; margin-top: 5px; opacity: 0.9;">Date: ${date}</div>
         </div>

         <div style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">
                <span style="font-weight: bold; color: #64748b; font-size: 12px; text-transform: uppercase;">Item Name</span>
                <span style="font-weight: bold; color: #64748b; font-size: 12px; text-transform: uppercase;">Current Stock (kg)</span>
            </div>
            ${Object.entries(stock).map(([k, v]) => `
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
                    <span style="font-weight: bold; color: #334155; text-transform: uppercase;">${k}</span>
                    <span style="font-family: monospace; font-weight: bold; font-size: 14px; color: ${(v as number) < 100 ? '#ef4444' : '#0891b2'}">${(v as number).toFixed(1)}</span>
                </div>
            `).join('')}
         </div>

         <div style="background: #f8fafc; padding: 20px; border-top: 1px solid #e2e8f0;">
            <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 10px;">Total Consumption (All Time)</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                ${Object.entries(totalUsed).map(([k, v]) => `
                    <div>
                        <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">${k}</div>
                        <div style="font-weight: bold; color: #475569;">${(v as number).toFixed(0)}</div>
                    </div>
                `).join('')}
            </div>
         </div>
      </div>
    `;

    if ((window as any).html2canvas) {
      try {
        const canvas = await (window as any).html2canvas(container, { backgroundColor: '#ffffff', scale: 2 });
        canvas.toBlob(async (blob: Blob) => {
          if (blob) {
            const file = new File([blob], `Stock_Report_${Date.now()}.png`, { type: 'image/png' });
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file], title: `Stock Report`, text: `Chemical Stock Status - ${date}` });
            } else {
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = `Stock_Report_${Date.now()}.png`;
              link.click();
            }
          }
          if (document.body.contains(container!)) document.body.removeChild(container!);
        });
      } catch (e) {
        console.error("Image gen failed", e);
        if (document.body.contains(container!)) document.body.removeChild(container!);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Header Action */}
        <div className="flex justify-end">
            <button onClick={shareStockReport} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-8.683-2.031-.967-.272-.297-.471-.421-.92-.891-.298-.471-.794-.666-1.514-.666-.72 0-1.885.27-2.871 1.336-.986 1.066-3.758 3.515-3.758 8.57 0 5.055 3.684 9.941 4.179 10.662.495.721 7.218 11.025 17.514 11.025 10.296 0 11.757-.692 13.843-2.775 2.086-2.083 2.086-3.89 2.086-3.89.27-.124.544-.272.718-.396.174-.124.322-.272.396-.446.074-.174.198-.644.198-1.336 0-.692-.52-1.238-1.114-1.535z"/></svg>
                Share Stock Report
            </button>
        </div>

        {/* Dual Grid: Current Stock vs Total Used */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Live Stock */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <span className="bg-cyan-100 text-cyan-600 p-1.5 rounded-lg text-sm">📊</span> Live Stock
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(stock).map(([key, val]) => {
                        const numVal = val as number;
                        return (
                        <div key={key} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{key}</h4>
                            <div className={`text-xl font-bold mt-1 ${numVal < 100 ? 'text-red-500' : 'text-slate-700'}`}>
                                {numVal.toFixed(1)}
                            </div>
                        </div>
                        );
                    })}
                </div>
            </div>

            {/* Total Usage */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <span className="bg-purple-100 text-purple-600 p-1.5 rounded-lg text-sm">📉</span> Total Consumed
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(totalUsed).map(([key, val]) => {
                        const numVal = val as number;
                        return (
                        <div key={key} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{key}</h4>
                            <div className="text-xl font-bold mt-1 text-slate-600">
                                {numVal.toFixed(0)} <span className="text-[10px]">kg</span>
                            </div>
                        </div>
                        );
                    })}
                </div>
            </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3 text-white">
                    <span className="text-2xl">🧪</span>
                    <h3 className="text-lg font-bold">Chemical Production Log</h3>
                </div>
                <div className="bg-white/20 px-3 py-1 rounded-lg text-white text-xs font-bold backdrop-blur-sm">
                    Total Entries: {data.chemicalLogs.length}
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Plant</th>
                            <th className="px-6 py-4 text-right">DOP</th>
                            <th className="px-6 py-4 text-right">Stabilizer</th>
                            <th className="px-6 py-4 text-right">Epoxy</th>
                            <th className="px-6 py-4 text-right">G161</th>
                            <th className="px-6 py-4 text-right">NBS</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.chemicalLogs.map(log => (
                            <tr key={log.id} className="hover:bg-cyan-50/30 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-600">{log.date}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${log.plant==='65mm'?'bg-blue-100 text-blue-700': log.plant==='Jumbo'?'bg-purple-100 text-purple-700':'bg-orange-100 text-orange-700'}`}>
                                        {log.plant}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-slate-700">{log.dop}</td>
                                <td className="px-6 py-4 text-right font-mono text-slate-700">{log.stabilizer}</td>
                                <td className="px-6 py-4 text-right font-mono text-slate-700">{log.epoxy}</td>
                                <td className="px-6 py-4 text-right font-mono text-slate-700">{log.g161 || '-'}</td>
                                <td className="px-6 py-4 text-right font-mono text-slate-700">{log.nbs}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};
