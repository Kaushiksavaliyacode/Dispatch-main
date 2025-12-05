import React from 'react';
import { AppData } from '../../types';

interface Props {
  data: AppData;
}

export const ChemicalManager: React.FC<Props> = ({ data }) => {
  const stock = data.chemicalStock || { dop: 0, stabilizer: 0, epoxy: 0, g161: 0, nbs: 0 };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Stock Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(stock).map(([key, val]) => {
                const numVal = val as number;
                return (
                <div key={key} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">{key}</h4>
                    <div className={`text-2xl font-bold mt-1 ${numVal < 100 ? 'text-red-500' : 'text-slate-800'}`}>
                        {numVal.toFixed(1)} <span className="text-xs text-slate-400">kg</span>
                    </div>
                </div>
                );
            })}
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