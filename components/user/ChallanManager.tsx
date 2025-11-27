import React, { useState, useMemo } from 'react';
import { AppData, Challan, PaymentMode } from '../../types';
import { saveChallan, deleteChallan, ensurePartyExists } from '../../services/storageService';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const ChallanManager: React.FC<Props> = ({ data, onUpdate }) => {
  const [activeChallan, setActiveChallan] = useState<Partial<Challan>>({
    date: new Date().toISOString().split('T')[0],
    challanNumber: '', 
    paymentMode: PaymentMode.UNPAID,
    lines: []
  });
  
  const [partyInput, setPartyInput] = useState('');
  const [lineSize, setLineSize] = useState('');
  const [lineWt, setLineWt] = useState('');
  const [linePrice, setLinePrice] = useState('');
  const [searchParty, setSearchParty] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Stats
  const stats = useMemo(() => {
    const received = data.challans.filter(c => c.paymentMode === PaymentMode.CASH).reduce((a,b) => a + b.totalAmount, 0);
    const credit = data.challans.filter(c => c.paymentMode === PaymentMode.UNPAID).reduce((a,b) => a + b.totalAmount, 0);
    return { received, credit };
  }, [data.challans]);

  const addLine = () => {
    const wt = parseFloat(lineWt) || 0;
    const price = parseFloat(linePrice) || 0;
    const newLine = {
      id: `l-${Date.now()}`,
      size: lineSize || 'Item',
      weight: wt,
      rate: price,
      amount: wt > 0 ? wt * price : price 
    };
    setActiveChallan({ ...activeChallan, lines: [...(activeChallan.lines || []), newLine] });
    setLineSize(''); setLineWt(''); setLinePrice('');
  };

  const handleSave = async () => {
    if (!partyInput) return alert("Party Name Required");
    const partyId = await ensurePartyExists(data.parties, partyInput);
    const lines = activeChallan.lines || [];
    const totalWeight = lines.reduce((s, l) => s + l.weight, 0);
    const totalAmount = lines.reduce((s, l) => s + l.amount, 0);

    const newChallan: Challan = {
      id: activeChallan.id || `c-${Date.now()}`,
      challanNumber: activeChallan.challanNumber || `AUTO`,
      date: activeChallan.date!,
      partyId,
      lines,
      totalWeight,
      totalAmount,
      paymentMode: activeChallan.paymentMode!,
      createdAt: new Date().toISOString()
    };
    await saveChallan(newChallan);
    setPartyInput('');
    setActiveChallan({ date: new Date().toISOString().split('T')[0], challanNumber: '', paymentMode: PaymentMode.UNPAID, lines: [] });
  };

  const filteredChallans = data.challans.filter(c => {
    const partyName = data.parties.find(p => p.id === c.partyId)?.name.toLowerCase() || '';
    return partyName.includes(searchParty.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-2 gap-4">
         <div className="bg-red-50 rounded-xl p-4 border border-red-100 text-center shadow-sm">
            <h3 className="text-xl md:text-2xl font-bold text-red-900">₹{stats.credit.toLocaleString()}</h3>
            <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Unpaid Credit</p>
         </div>
         <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 text-center shadow-sm">
            <h3 className="text-xl md:text-2xl font-bold text-emerald-900">₹{stats.received.toLocaleString()}</h3>
            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Cash Received</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Bill Entry Form */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-800 px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🧾</span>
                        <h3 className="text-base font-bold text-white uppercase tracking-wide">New Bill</h3>
                    </div>
                    <div className="flex bg-slate-700 rounded-lg p-0.5">
                    <button onClick={() => setActiveChallan({...activeChallan, paymentMode: PaymentMode.UNPAID})} className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${activeChallan.paymentMode === PaymentMode.UNPAID ? 'bg-red-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Unpaid</button>
                    <button onClick={() => setActiveChallan({...activeChallan, paymentMode: PaymentMode.CASH})} className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${activeChallan.paymentMode === PaymentMode.CASH ? 'bg-emerald-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Cash</button>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex gap-4">
                        <div className="w-24">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Challan #</label>
                            <input placeholder="Auto" value={activeChallan.challanNumber} onChange={e => setActiveChallan({...activeChallan, challanNumber: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-center outline-none focus:border-indigo-500" />
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Date</label>
                            <input type="date" value={activeChallan.date} onChange={e => setActiveChallan({...activeChallan, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500" />
                        </div>
                    </div>
                    
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Party Name</label>
                        <input list="party_list" placeholder="Select Party..." value={partyInput} onChange={e => setPartyInput(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold uppercase outline-none focus:border-indigo-500" />
                        <datalist id="party_list">{data.parties.map(p => <option key={p.id} value={p.name}/>)}</datalist>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="flex gap-2 mb-2">
                            <input placeholder="Item Size / Desc" value={lineSize} onChange={e => setLineSize(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold uppercase outline-none focus:border-indigo-500" />
                            <input type="number" placeholder="Wt" value={lineWt} onChange={e => setLineWt(e.target.value)} className="w-20 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-center outline-none focus:border-indigo-500" />
                            <input type="number" placeholder="Price/Rate" value={linePrice} onChange={e => setLinePrice(e.target.value)} className="w-20 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-center outline-none focus:border-indigo-500" />
                        </div>
                        <button onClick={addLine} className="w-full bg-white border border-red-200 text-red-600 rounded-lg py-2 text-xs font-bold uppercase hover:bg-red-50 transition-colors shadow-sm">+ Add Line Item</button>
                    </div>

                    {/* Line Items Preview */}
                    <div className="space-y-1 max-h-40 overflow-auto custom-scrollbar">
                    {(activeChallan.lines || []).map((l, i) => (
                        <div key={i} className="flex justify-between items-center text-xs bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                            <span className="font-bold uppercase text-slate-700">{l.size}</span>
                            <div className="flex items-center gap-3">
                                <span className="text-slate-400 font-medium">{l.weight.toFixed(3)}kg</span>
                                <span className="font-bold text-slate-800">₹{l.amount}</span>
                            </div>
                        </div>
                    ))}
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Grand Total</span>
                        <span className="text-2xl font-bold text-slate-900">₹{(activeChallan.lines||[]).reduce((a,b)=>a+b.amount,0).toLocaleString()}</span>
                    </div>

                    <button onClick={handleSave} className="w-full bg-slate-900 hover:bg-black text-white font-bold py-4 rounded-xl text-sm uppercase tracking-wider shadow-lg transition-transform active:scale-[0.99]">Save Bill</button>
                </div>
            </div>
          </div>

          {/* RIGHT: History List */}
          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-700 uppercase">Recent Transactions</h3>
                <input placeholder="Search History..." value={searchParty} onChange={e => setSearchParty(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none uppercase w-48 focus:ring-2 focus:ring-indigo-100" />
             </div>
             
             <div className="space-y-3">
                {filteredChallans.slice(0,30).map(c => {
                    const party = data.parties.find(p => p.id === c.partyId)?.name || 'Unknown';
                    const isUnpaid = c.paymentMode === PaymentMode.UNPAID;
                    const isExpanded = expandedId === c.id;

                    return (
                    <div key={c.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                        <div className={`p-4 border-l-4 ${isUnpaid ? 'border-red-500 bg-red-50/10' : 'border-emerald-500 bg-emerald-50/10'}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{c.date} • #{c.challanNumber}</div>
                                    <h4 className="text-sm font-bold text-slate-800 uppercase">{party}</h4>
                                </div>
                                <div className="text-right">
                                    <div className="text-base font-bold text-slate-900">₹{c.totalAmount.toLocaleString()}</div>
                                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${isUnpaid ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>{c.paymentMode}</span>
                                </div>
                            </div>
                        </div>
                        
                        {isExpanded && (
                            <div className="bg-slate-50 p-4 border-t border-slate-100 text-xs">
                                <table className="w-full text-[10px] mb-3">
                                    <thead>
                                        <tr className="text-slate-400 border-b border-slate-200"><th className="text-left pb-1 uppercase">Item</th><th className="text-right pb-1 uppercase">Weight</th><th className="text-right pb-1 uppercase">Amount</th></tr>
                                    </thead>
                                    <tbody>
                                        {c.lines.map((l, idx) => (
                                            <tr key={idx} className="border-b border-slate-100 last:border-0">
                                                <td className="py-2 font-bold text-slate-700 uppercase">{l.size}</td>
                                                <td className="py-2 text-right text-slate-500">{l.weight.toFixed(3)}</td>
                                                <td className="py-2 text-right font-bold text-slate-800">{l.amount}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="text-right">
                                    <button onClick={(e) => { e.stopPropagation(); deleteChallan(c.id); }} className="text-red-500 hover:text-white hover:bg-red-500 text-[10px] font-bold uppercase border border-red-200 px-3 py-1.5 rounded transition-colors">Delete Entry</button>
                                </div>
                            </div>
                        )}
                    </div>
                    );
                })}
             </div>
          </div>
      </div>
    </div>
  );
};