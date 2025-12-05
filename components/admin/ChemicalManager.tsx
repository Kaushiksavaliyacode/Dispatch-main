
import React, { useState } from 'react';
import { AppData, ChemicalStock, ChemicalLog, ChemicalPurchase } from '../../types';
import { updateChemicalStock, saveChemicalLog, saveChemicalPurchase, deleteChemicalPurchase } from '../../services/storageService';
import { doc, deleteDoc } from 'firebase/firestore'; 
import { db } from '../../services/firebaseConfig';

interface Props {
  data: AppData;
}

export const ChemicalManager: React.FC<Props> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'PURCHASE' | 'STOCK' | 'LOGS'>('PURCHASE');
  const stock = data.chemicalStock || { dop: 0, stabilizer: 0, epoxy: 0, g161: 0, nbs: 0 };

  // Add Stock State
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [addType, setAddType] = useState<keyof ChemicalStock>('dop');
  const [addQty, setAddQty] = useState('');

  // Calculate Total Usage from Logs
  const totalUsed = data.chemicalLogs.reduce((acc, log) => ({
      dop: acc.dop + log.dop,
      stabilizer: acc.stabilizer + log.stabilizer,
      epoxy: acc.epoxy + log.epoxy,
      g161: acc.g161 + (log.g161 || 0),
      nbs: acc.nbs + log.nbs
  }), { dop: 0, stabilizer: 0, epoxy: 0, g161: 0, nbs: 0 });

  const handleAddStock = async () => {
      const qty = parseFloat(addQty) || 0;
      if (qty <= 0) return;

      const newStock = { ...stock };
      newStock[addType] += qty;

      const purchase: ChemicalPurchase = {
          id: `purch-${Date.now()}`,
          date: purchaseDate,
          chemical: addType,
          quantity: qty,
          createdAt: new Date().toISOString()
      };

      await saveChemicalPurchase(purchase);
      await updateChemicalStock(newStock);
      setAddQty('');
      alert(`Added ${qty}kg to ${addType.toUpperCase()}`);
  };

  const handleDeletePurchase = async (item: ChemicalPurchase) => {
      if (!confirm(`Delete purchase of ${item.quantity}kg ${item.chemical}? This will reduce stock.`)) return;
      
      const newStock = { ...stock };
      newStock[item.chemical] -= item.quantity;
      if (newStock[item.chemical] < 0) newStock[item.chemical] = 0; // Prevent negative

      await deleteChemicalPurchase(item.id);
      await updateChemicalStock(newStock);
  };

  const handleDeleteLog = async (log: ChemicalLog) => {
      if (!confirm("Are you sure? This will RESTORE the used chemicals back to stock.")) return;

      // Restore Stock
      const newStock = { ...stock };
      newStock.dop += log.dop;
      newStock.stabilizer += log.stabilizer;
      newStock.epoxy += log.epoxy;
      newStock.nbs += log.nbs;
      if (log.g161) newStock.g161 += log.g161;

      try {
          await updateChemicalStock(newStock);
          await deleteDoc(doc(db, "chemical_logs", log.id));
      } catch (e) {
          console.error("Error deleting log", e);
          alert("Failed to delete log");
      }
  };

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
        
        {/* TABS */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full max-w-xl mx-auto mb-8 shadow-sm">
            <button onClick={() => setActiveTab('PURCHASE')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeTab==='PURCHASE'?'bg-white text-indigo-700 shadow-md':'text-slate-600 hover:text-slate-800'}`}>Purchase</button>
            <button onClick={() => setActiveTab('STOCK')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeTab==='STOCK'?'bg-white text-indigo-700 shadow-md':'text-slate-600 hover:text-slate-800'}`}>Live Stock</button>
            <button onClick={() => setActiveTab('LOGS')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeTab==='LOGS'?'bg-white text-indigo-700 shadow-md':'text-slate-600 hover:text-slate-800'}`}>Production Log</button>
        </div>

        {/* TAB CONTENT: PURCHASE */}
        {activeTab === 'PURCHASE' && (
            <div className="space-y-8">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8">
                    <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <span className="text-2xl p-2 bg-indigo-50 rounded-lg">📥</span> New Purchase Entry
                    </h3>
                    <div className="flex flex-col md:flex-row gap-6 items-end">
                        <div className="flex-1 space-y-2 w-full">
                            <label className="text-sm font-bold text-slate-700 uppercase tracking-wide ml-1">Date</label>
                            <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                        </div>
                        <div className="flex-1 space-y-2 w-full">
                            <label className="text-sm font-bold text-slate-700 uppercase tracking-wide ml-1">Chemical</label>
                            <select value={addType} onChange={e => setAddType(e.target.value as keyof ChemicalStock)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer">
                                <option value="dop">DOP</option>
                                <option value="stabilizer">Stabilizer</option>
                                <option value="epoxy">Epoxy</option>
                                <option value="g161">G161</option>
                                <option value="nbs">NBS</option>
                            </select>
                        </div>
                        <div className="flex-1 space-y-2 w-full">
                            <label className="text-sm font-bold text-slate-700 uppercase tracking-wide ml-1">Quantity (kg)</label>
                            <input type="number" placeholder="0" value={addQty} onChange={e => setAddQty(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                        </div>
                        <button onClick={handleAddStock} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-indigo-200 transition-all transform active:scale-95 flex items-center justify-center gap-2">
                            <span>Add Stock</span>
                            <span className="text-xl">+</span>
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-8 py-5 border-b border-slate-200 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Purchase History</h3>
                        <span className="bg-white px-3 py-1 rounded-lg text-xs font-bold text-slate-500 border border-slate-200">{data.chemicalPurchases.length} Records</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white border-b border-slate-100 text-slate-500 font-bold text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="px-8 py-4 font-bold text-slate-700">Date</th>
                                    <th className="px-8 py-4 font-bold text-slate-700">Chemical Item</th>
                                    <th className="px-8 py-4 text-right font-bold text-slate-700">Quantity Added</th>
                                    <th className="px-8 py-4 text-center font-bold text-slate-700">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {data.chemicalPurchases.length === 0 ? (
                                    <tr><td colSpan={4} className="px-8 py-12 text-center text-slate-400 italic font-medium">No purchase records found.</td></tr>
                                ) : (
                                    data.chemicalPurchases.map(p => (
                                        <tr key={p.id} className="hover:bg-indigo-50/30 transition-colors group">
                                            <td className="px-8 py-4 font-bold text-slate-800">{p.date}</td>
                                            <td className="px-8 py-4 font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                                                {p.chemical}
                                            </td>
                                            <td className="px-8 py-4 text-right font-mono text-emerald-600 font-extrabold text-base">+{p.quantity} kg</td>
                                            <td className="px-8 py-4 text-center">
                                                <button onClick={() => handleDeletePurchase(p)} className="text-slate-300 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Delete & Deduct Stock">
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* TAB CONTENT: STOCK */}
        {activeTab === 'STOCK' && (
            <div className="space-y-8">
                <div className="flex justify-end">
                    <button onClick={shareStockReport} className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-100 transition-all hover:scale-105 active:scale-95">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-8.683-2.031-.967-.272-.297-.471-.421-.92-.891-.298-.471-.794-.666-1.514-.666-.72 0-1.885.27-2.871 1.336-.986 1.066-3.758 3.515-3.758 8.57 0 5.055 3.684 9.941 4.179 10.662.495.721 7.218 11.025 17.514 11.025 10.296 0 11.757-.692 13.843-2.775 2.086-2.083 2.086-3.89 2.086-3.89.27-.124.544-.272.718-.396.174-.124.322-.272.396-.446.074-.174.198-.644.198-1.336 0-.692-.52-1.238-1.114-1.535z"/></svg>
                        Share Stock Report
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Live Stock */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-50 rounded-full blur-3xl opacity-60 -mr-10 -mt-10 pointer-events-none"></div>
                        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                            <span className="bg-cyan-100 text-cyan-600 p-2 rounded-xl text-xl">📊</span> Live Inventory
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 relative z-10">
                            {Object.entries(stock).map(([key, val]) => {
                                const numVal = val as number;
                                return (
                                <div key={key} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-cyan-200 transition-colors group">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{key}</h4>
                                    <div className={`text-2xl font-bold ${numVal < 100 ? 'text-red-500' : 'text-slate-800 group-hover:text-cyan-700'}`}>
                                        {numVal.toFixed(1)} <span className="text-sm font-medium text-slate-400">kg</span>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Total Usage */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full blur-3xl opacity-60 -mr-10 -mt-10 pointer-events-none"></div>
                        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                            <span className="bg-purple-100 text-purple-600 p-2 rounded-xl text-xl">📉</span> Total Consumption
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 relative z-10">
                            {Object.entries(totalUsed).map(([key, val]) => {
                                const numVal = val as number;
                                return (
                                <div key={key} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-purple-200 transition-colors group">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{key}</h4>
                                    <div className="text-2xl font-bold text-slate-700 group-hover:text-purple-700">
                                        {numVal.toFixed(0)} <span className="text-sm font-medium text-slate-400">kg</span>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* TAB CONTENT: LOGS */}
        {activeTab === 'LOGS' && (
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-8 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-white">
                        <span className="text-3xl bg-white/20 p-2 rounded-xl backdrop-blur-sm">🧪</span>
                        <div>
                            <h3 className="text-xl font-bold tracking-tight">Production Logs</h3>
                            <p className="text-cyan-100 text-sm font-medium opacity-90">Chemical Usage History</p>
                        </div>
                    </div>
                    <div className="bg-white/20 px-4 py-2 rounded-xl text-white text-sm font-bold backdrop-blur-sm border border-white/10">
                        Total Entries: {data.chemicalLogs.length}
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs border-b border-slate-200">
                            <tr>
                                <th className="px-8 py-5 font-bold text-slate-600">Date</th>
                                <th className="px-8 py-5 font-bold text-slate-600">Plant</th>
                                <th className="px-8 py-5 text-right font-bold text-slate-600">DOP</th>
                                <th className="px-8 py-5 text-right font-bold text-slate-600">Stabilizer</th>
                                <th className="px-8 py-5 text-right font-bold text-slate-600">Epoxy</th>
                                <th className="px-8 py-5 text-right font-bold text-slate-600">G161</th>
                                <th className="px-8 py-5 text-right font-bold text-slate-600">NBS</th>
                                <th className="px-8 py-5 text-center font-bold text-slate-600">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data.chemicalLogs.map(log => (
                                <tr key={log.id} className="hover:bg-cyan-50/30 transition-colors group">
                                    <td className="px-8 py-5 font-bold text-slate-700">{log.date}</td>
                                    <td className="px-8 py-5">
                                        <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide ${log.plant==='65mm'?'bg-blue-100 text-blue-700': log.plant==='Jumbo'?'bg-purple-100 text-purple-700':'bg-orange-100 text-orange-700'}`}>
                                            {log.plant}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-right font-mono font-bold text-slate-700 group-hover:text-slate-900">{log.dop}</td>
                                    <td className="px-8 py-5 text-right font-mono font-bold text-slate-700 group-hover:text-slate-900">{log.stabilizer}</td>
                                    <td className="px-8 py-5 text-right font-mono font-bold text-slate-700 group-hover:text-slate-900">{log.epoxy}</td>
                                    <td className="px-8 py-5 text-right font-mono font-bold text-slate-700 group-hover:text-slate-900">{log.g161 || '-'}</td>
                                    <td className="px-8 py-5 text-right font-mono font-bold text-slate-700 group-hover:text-slate-900">{log.nbs}</td>
                                    <td className="px-8 py-5 text-center">
                                        <button onClick={() => handleDeleteLog(log)} className="text-slate-300 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Delete & Restore Stock">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
    </div>
  );
};
