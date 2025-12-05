
import React, { useState } from 'react';
import { AppData, ChemicalLog, ChemicalPlant, ChemicalStock } from '../../types';
import { saveChemicalLog, updateChemicalStock } from '../../services/storageService';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const ChemicalDashboard: React.FC<Props> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<ChemicalPlant | 'INVENTORY'>('65mm');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Input States
  const [dop, setDop] = useState('');
  const [stabilizer, setStabilizer] = useState('');
  const [epoxy, setEpoxy] = useState('');
  const [g161, setG161] = useState('');
  const [nbs, setNbs] = useState('');

  // Stock Add State
  const [addStockType, setAddStockType] = useState<keyof ChemicalStock>('dop');
  const [addStockQty, setAddStockQty] = useState('');

  const currentStock = data.chemicalStock || { dop: 0, stabilizer: 0, epoxy: 0, g161: 0, nbs: 0 };

  const handleSaveLog = async () => {
      const log: ChemicalLog = {
          id: `chem-${Date.now()}`,
          date,
          plant: activeTab as ChemicalPlant,
          dop: parseFloat(dop) || 0,
          stabilizer: parseFloat(stabilizer) || 0,
          epoxy: parseFloat(epoxy) || 0,
          nbs: parseFloat(nbs) || 0,
          g161: activeTab === '45mm' ? 0 : (parseFloat(g161) || 0),
          createdAt: new Date().toISOString()
      };

      // Subtract from Stock
      const newStock = { ...currentStock };
      newStock.dop -= log.dop;
      newStock.stabilizer -= log.stabilizer;
      newStock.epoxy -= log.epoxy;
      newStock.nbs -= log.nbs;
      if (log.g161) newStock.g161 -= log.g161;

      await saveChemicalLog(log);
      await updateChemicalStock(newStock);

      // Reset
      setDop(''); setStabilizer(''); setEpoxy(''); setG161(''); setNbs('');
      alert("Entry Saved & Stock Updated!");
  };

  const handleAddStock = async () => {
      const qty = parseFloat(addStockQty) || 0;
      if (qty <= 0) return;

      const newStock = { ...currentStock };
      newStock[addStockType] += qty;

      await updateChemicalStock(newStock);
      setAddStockQty('');
      alert("Stock Added Successfully!");
  };

  const LowStockAlert = ({ name, value }: { name: string, value: number }) => {
      if (value >= 100) return null;
      return (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-2 animate-pulse mb-2">
              <span className="text-lg">⚠️</span>
              <div className="text-xs font-bold text-red-600">
                  Low Stock: {name} ({value.toFixed(1)} kg)
              </div>
          </div>
      );
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in zoom-in duration-500">
        
        {/* Header */}
        <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-cyan-200">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            </div>
            <div>
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Chemical Dept.</h1>
                <p className="text-slate-500 font-medium">Production & Stock Management</p>
            </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="flex flex-wrap gap-2">
            <LowStockAlert name="DOP" value={currentStock.dop} />
            <LowStockAlert name="Stabilizer" value={currentStock.stabilizer} />
            <LowStockAlert name="Epoxy" value={currentStock.epoxy} />
            <LowStockAlert name="G161" value={currentStock.g161} />
            <LowStockAlert name="NBS" value={currentStock.nbs} />
        </div>

        {/* Tabs */}
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
            {(['65mm', 'Jumbo', '45mm', 'INVENTORY'] as const).map(tab => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                        activeTab === tab 
                        ? 'bg-cyan-600 text-white shadow-md' 
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                >
                    {tab === 'INVENTORY' ? '📦 Inventory' : `🏭 ${tab} Plant`}
                </button>
            ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Main Form Area */}
            <div className="md:col-span-2 space-y-6">
                {activeTab !== 'INVENTORY' ? (
                    <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6 relative overflow-hidden animate-in slide-in-from-left-4 duration-500">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                        
                        <div className="flex justify-between items-center mb-6 relative z-10">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <span className="w-2 h-6 bg-cyan-500 rounded-full"></span>
                                {activeTab} Data Entry
                            </h2>
                            <input 
                                type="date" 
                                value={date} 
                                onChange={e => setDate(e.target.value)} 
                                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-cyan-200"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-slate-700 ml-1">DOP (kg)</label>
                                <input type="number" placeholder="0.00" value={dop} onChange={e => setDop(e.target.value)} className="w-full bg-slate-50 border-transparent rounded-xl px-4 py-4 text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-cyan-100 transition-all" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-slate-700 ml-1">Stabilizer (kg)</label>
                                <input type="number" placeholder="0.00" value={stabilizer} onChange={e => setStabilizer(e.target.value)} className="w-full bg-slate-50 border-transparent rounded-xl px-4 py-4 text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-cyan-100 transition-all" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-slate-700 ml-1">Epoxy (kg)</label>
                                <input type="number" placeholder="0.00" value={epoxy} onChange={e => setEpoxy(e.target.value)} className="w-full bg-slate-50 border-transparent rounded-xl px-4 py-4 text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-cyan-100 transition-all" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-slate-700 ml-1">NBS (kg)</label>
                                <input type="number" placeholder="0.00" value={nbs} onChange={e => setNbs(e.target.value)} className="w-full bg-slate-50 border-transparent rounded-xl px-4 py-4 text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-cyan-100 transition-all" />
                            </div>
                            {activeTab !== '45mm' && (
                                <div className="space-y-1 col-span-2">
                                    <label className="text-sm font-bold text-slate-700 ml-1">G161 (kg)</label>
                                    <input type="number" placeholder="0.00" value={g161} onChange={e => setG161(e.target.value)} className="w-full bg-slate-50 border-transparent rounded-xl px-4 py-4 text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-cyan-100 transition-all" />
                                </div>
                            )}
                        </div>

                        <button onClick={handleSaveLog} className="w-full mt-8 bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2">
                            <span>Save Entry</span>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </button>
                    </div>
                ) : (
                    // STOCK MANAGEMENT
                    <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6 animate-in slide-in-from-right-4 duration-500">
                        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <span className="text-2xl">📦</span> Add Stock (Purchase)
                        </h2>
                        
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-slate-700 ml-1">Chemical</label>
                                    <select value={addStockType} onChange={e => setAddStockType(e.target.value as keyof ChemicalStock)} className="w-full bg-slate-50 rounded-xl px-4 py-4 text-base font-bold text-slate-900 outline-none border-r-8 border-transparent">
                                        <option value="dop">DOP</option>
                                        <option value="stabilizer">Stabilizer</option>
                                        <option value="epoxy">Epoxy</option>
                                        <option value="g161">G161</option>
                                        <option value="nbs">NBS</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-slate-700 ml-1">Quantity (kg)</label>
                                    <input type="number" placeholder="0" value={addStockQty} onChange={e => setAddStockQty(e.target.value)} className="w-full bg-slate-50 rounded-xl px-4 py-4 text-base font-bold text-slate-900 outline-none" />
                                </div>
                            </div>
                            <button onClick={handleAddStock} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-md transition-all">
                                + Add Stock
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Live Stock Display - Updated to White Background */}
            <div className="md:col-span-1 space-y-4">
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl relative overflow-hidden animate-in fade-in duration-700">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-100 rounded-full blur-2xl opacity-50 -mr-8 -mt-8 pointer-events-none"></div>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 relative z-10 text-slate-800">
                        <span className="bg-cyan-100 text-cyan-600 p-1.5 rounded-lg">📊</span> Current Stock
                    </h3>
                    
                    <div className="space-y-2 relative z-10">
                        {Object.entries(currentStock).map(([key, val]) => {
                             const numVal = val as number;
                             return (
                            <div key={key} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-cyan-200 transition-colors">
                                <span className="uppercase font-bold text-xs text-slate-600 tracking-wider">{key}</span>
                                <span className={`font-mono font-bold text-sm ${numVal < 100 ? 'text-red-600' : 'text-slate-900'}`}>{numVal.toFixed(1)} <span className="text-[10px] text-slate-500">kg</span></span>
                            </div>
                             );
                        })}
                    </div>
                </div>

                {/* Recent Logs (Detailed View) */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm max-h-[500px] overflow-y-auto custom-scrollbar">
                    <h3 className="text-sm font-bold text-slate-600 uppercase mb-3 ml-1">Recent Activity</h3>
                    <div className="space-y-4">
                        {data.chemicalLogs.slice(0, 5).map(log => (
                            <div key={log.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${log.plant==='65mm'?'bg-blue-100 text-blue-700': log.plant==='Jumbo'?'bg-purple-100 text-purple-700':'bg-orange-100 text-orange-700'}`}>
                                        {log.plant}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-500">{log.date}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {log.dop > 0 && <div className="flex justify-between text-[10px] text-slate-700 border-b border-slate-200/50 pb-0.5"><span>DOP</span><span className="font-bold text-slate-900">{log.dop}</span></div>}
                                    {log.stabilizer > 0 && <div className="flex justify-between text-[10px] text-slate-700 border-b border-slate-200/50 pb-0.5"><span>Stab</span><span className="font-bold text-slate-900">{log.stabilizer}</span></div>}
                                    {log.epoxy > 0 && <div className="flex justify-between text-[10px] text-slate-700 border-b border-slate-200/50 pb-0.5"><span>Epoxy</span><span className="font-bold text-slate-900">{log.epoxy}</span></div>}
                                    {log.nbs > 0 && <div className="flex justify-between text-[10px] text-slate-700 border-b border-slate-200/50 pb-0.5"><span>NBS</span><span className="font-bold text-slate-900">{log.nbs}</span></div>}
                                    {log.g161 && log.g161 > 0 && <div className="flex justify-between text-[10px] text-slate-700 border-b border-slate-200/50 pb-0.5"><span>G161</span><span className="font-bold text-slate-900">{log.g161}</span></div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
