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
      {/* Stats (Compact) */}
      <div className="grid grid-cols-2 gap-3">
         <div className="bg-red-50 rounded-xl p-3 border border-red-100 text-center">
            <h3 className="text-lg font-bold text-red-900">₹{stats.credit.toLocaleString()}</h3>
            <p className="text-[9px] font-bold text-red-400 uppercase">Unpaid</p>
         </div>
         <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 text-center">
            <h3 className="text-lg font-bold text-emerald-900">₹{stats.received.toLocaleString()}</h3>
            <p className="text-[9px] font-bold text-emerald-500 uppercase">Cash</p>
         </div>
      </div>

      {/* Bill Form (Compact) */}
      <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
         <div className="bg-slate-800 px-4 py-3 flex justify-between items-center">
             <div className="flex items-center gap-2">
                 <span className="text-xl">🧾</span>
                 <h3 className="text-sm font-bold text-white uppercase">New Bill</h3>
             </div>
             <div className="flex bg-slate-700 rounded-lg p-0.5">
               <button onClick={() => setActiveChallan({...activeChallan, paymentMode: PaymentMode.UNPAID})} className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${activeChallan.paymentMode === PaymentMode.UNPAID ? 'bg-red-500 text-white' : 'text-slate-400'}`}>Unpaid</button>
               <button onClick={() => setActiveChallan({...activeChallan, paymentMode: PaymentMode.CASH})} className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${activeChallan.paymentMode === PaymentMode.CASH ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}>Cash</button>
             </div>
         </div>

         <div className="p-4 space-y-3">
            <div className="flex gap-2">
               <input placeholder="No." value={activeChallan.challanNumber} onChange={e => setActiveChallan({...activeChallan, challanNumber: e.target.value})} className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold text-center outline-none" />
               <input type="date" value={activeChallan.date} onChange={e => setActiveChallan({...activeChallan, date: e.target.value})} className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold outline-none" />
            </div>
            <input list="party_list" placeholder="Select Party..." value={partyInput} onChange={e => setPartyInput(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold uppercase outline-none" />
            <datalist id="party_list">{data.parties.map(p => <option key={p.id} value={p.name}/>)}</datalist>

            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
               <div className="flex gap-2 mb-2">
                  <input placeholder="Item" value={lineSize} onChange={e => setLineSize(e.target.value)} className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs font-semibold uppercase outline-none" />
                  <input type="number" placeholder="Wt" value={lineWt} onChange={e => setLineWt(e.target.value)} className="w-14 border border-slate-200 rounded px-2 py-1 text-xs font-semibold text-center outline-none" />
                  <input type="number" placeholder="₹" value={linePrice} onChange={e => setLinePrice(e.target.value)} className="w-14 border border-slate-200 rounded px-2 py-1 text-xs font-semibold text-center outline-none" />
               </div>
               <button onClick={addLine} className="w-full bg-red-100 text-red-600 rounded-md py-1.5 text-[10px] font-bold uppercase hover:bg-red-200">+ Add Line</button>
            </div>

            {/* Line Items Preview */}
            <div className="space-y-1">
               {(activeChallan.lines || []).map((l, i) => (
                  <div key={i} className="flex justify-between items-center text-xs bg-slate-50 px-2 py-1.5 rounded border border-slate-100">
                     <span className="font-bold uppercase text-slate-700">{l.size}</span>
                     <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-medium">{l.weight.toFixed(3)}kg</span>
                        <span className="font-bold text-slate-800">₹{l.amount}</span>
                     </div>
                  </div>
               ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
               <span className="text-xs font-bold text-slate-400 uppercase">Total</span>
               <span className="text-xl font-bold text-slate-900">₹{(activeChallan.lines||[]).reduce((a,b)=>a+b.amount,0).toLocaleString()}</span>
            </div>

            <button onClick={handleSave} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl text-sm uppercase tracking-wider">Save Bill</button>
         </div>
      </div>

      {/* History (Compact) */}
      <div className="space-y-3">
         <input placeholder="Search History..." value={searchParty} onChange={e => setSearchParty(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none uppercase" />
         
         {filteredChallans.slice(0,30).map(c => {
             const party = data.parties.find(p => p.id === c.partyId)?.name || 'Unknown';
             const isUnpaid = c.paymentMode === PaymentMode.UNPAID;
             const isExpanded = expandedId === c.id;

             return (
               <div key={c.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                  <div className={`p-3 border-l-4 ${isUnpaid ? 'border-red-500 bg-red-50/20' : 'border-emerald-500 bg-emerald-50/20'}`}>
                     <div className="flex justify-between items-start">
                        <div>
                           <div className="text-[9px] font-bold text-slate-400 uppercase">{c.date} • #{c.challanNumber}</div>
                           <h4 className="text-sm font-bold text-slate-800 uppercase">{party}</h4>
                        </div>
                        <div className="text-right">
                           <div className="text-sm font-bold text-slate-900">₹{c.totalAmount.toLocaleString()}</div>
                           <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${isUnpaid ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>{c.paymentMode}</span>
                        </div>
                     </div>
                  </div>
                  
                  {isExpanded && (
                     <div className="bg-slate-50 p-3 border-t border-slate-100 text-xs">
                        <table className="w-full text-[10px]">
                           <thead>
                              <tr className="text-slate-400 border-b border-slate-200"><th className="text-left pb-1">Item</th><th className="text-right pb-1">Wt</th><th className="text-right pb-1">Amt</th></tr>
                           </thead>
                           <tbody>
                              {c.lines.map((l, idx) => (
                                 <tr key={idx}>
                                    <td className="py-1 font-bold text-slate-700 uppercase">{l.size}</td>
                                    <td className="py-1 text-right text-slate-500">{l.weight.toFixed(3)}</td>
                                    <td className="py-1 text-right font-bold text-slate-800">{l.amount}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                        <div className="mt-3 text-center">
                           <button onClick={(e) => { e.stopPropagation(); deleteChallan(c.id); }} className="text-red-500 text-[10px] font-bold uppercase border border-red-200 px-3 py-1 rounded bg-white">Delete</button>
                        </div>
                     </div>
                  )}
               </div>
             );
         })}
      </div>
    </div>
  );
};