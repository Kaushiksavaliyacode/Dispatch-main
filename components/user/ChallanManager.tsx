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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Search
  const [searchParty, setSearchParty] = useState('');

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
      challanNumber: activeChallan.challanNumber || `CH-${Math.floor(1000 + Math.random() * 9000)}`,
      date: activeChallan.date!,
      partyId,
      lines,
      totalWeight,
      totalAmount,
      paymentMode: activeChallan.paymentMode!,
      createdAt: new Date().toISOString()
    };
    await saveChallan(newChallan);
    
    // Reset
    setActiveChallan({
        date: new Date().toISOString().split('T')[0],
        challanNumber: '',
        paymentMode: PaymentMode.UNPAID,
        lines: []
    });
    setPartyInput('');
  };

  const handleDelete = async (id: string) => {
    if(confirm('Delete record?')) await deleteChallan(id);
  }

  const filteredChallans = data.challans.filter(c => {
    const partyName = data.parties.find(p => p.id === c.partyId)?.name.toLowerCase() || '';
    return searchParty ? partyName.includes(searchParty.toLowerCase()) : true;
  });

  return (
    <div className="space-y-4">
      {/* Small Stats */}
      <div className="grid grid-cols-2 gap-3">
         <div className="bg-red-50 rounded-xl p-3 border border-red-100 flex flex-col items-center">
            <span className="text-lg font-bold text-red-900">₹{stats.credit.toLocaleString()}</span>
            <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">Unpaid</span>
         </div>
         <div className="bg-green-50 rounded-xl p-3 border border-green-100 flex flex-col items-center">
            <span className="text-lg font-bold text-green-900">₹{stats.received.toLocaleString()}</span>
            <span className="text-[9px] font-bold text-green-500 uppercase tracking-wider">Received</span>
         </div>
      </div>

      {/* Bill Form */}
      <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
         <div className="bg-red-500 px-4 py-3">
           <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
             🧾 New Transaction
           </h3>
         </div>
         <div className="p-4 space-y-3">
             <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
               {['UNPAID', 'CASH'].map(mode => (
                 <button 
                   key={mode}
                   onClick={() => setActiveChallan({...activeChallan, paymentMode: mode as PaymentMode})}
                   className={`flex-1 py-2 rounded text-[10px] font-bold uppercase transition-all ${
                      activeChallan.paymentMode === mode 
                      ? (mode==='UNPAID'?'bg-red-500 text-white shadow':'bg-green-500 text-white shadow') 
                      : 'text-slate-500 hover:bg-white'
                   }`}
                 >
                   {mode}
                 </button>
               ))}
             </div>

             <div className="flex gap-2">
                 <input 
                   placeholder="Challan #"
                   value={activeChallan.challanNumber}
                   onChange={e => setActiveChallan({...activeChallan, challanNumber: e.target.value})}
                   className="w-1/3 bg-slate-50 border border-slate-200 rounded px-2 py-2 text-sm font-bold outline-none uppercase"
                 />
                 <input 
                   type="date"
                   value={activeChallan.date}
                   onChange={e => setActiveChallan({...activeChallan, date: e.target.value})}
                   className="w-2/3 bg-slate-50 border border-slate-200 rounded px-2 py-2 text-sm font-bold outline-none"
                 />
             </div>
             
             <input 
                list="party_list_challan"
                placeholder="Party Name"
                value={partyInput}
                onChange={e => setPartyInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-base font-bold outline-none uppercase"
             />
             <datalist id="party_list_challan">{data.parties.map(p => <option key={p.id} value={p.name}/>)}</datalist>

             <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                 <div className="flex gap-2 mb-2">
                   <input className="w-1/2 border rounded px-2 py-1 text-xs uppercase" placeholder="Size" value={lineSize} onChange={e => setLineSize(e.target.value)} />
                   <input className="w-1/4 border rounded px-2 py-1 text-xs" placeholder="Wt" type="number" value={lineWt} onChange={e => setLineWt(e.target.value)} />
                   <input className="w-1/4 border rounded px-2 py-1 text-xs" placeholder="Rate" type="number" value={linePrice} onChange={e => setLinePrice(e.target.value)} />
                 </div>
                 <button onClick={addLine} className="w-full bg-slate-800 text-white rounded py-2 text-[10px] font-bold uppercase">+ Add Line</button>
                 {activeChallan.lines?.map((l, idx) => (
                   <div key={idx} className="flex justify-between items-center text-xs border-b border-slate-200 py-2 last:border-0">
                      <span className="font-bold uppercase">{l.size}</span>
                      <span className="text-slate-500">{l.weight.toFixed(3)}kg • ₹{l.rate}</span>
                      <span className="font-bold">₹{l.amount}</span>
                   </div>
                 ))}
             </div>

             <div className="flex justify-between items-center font-bold text-sm px-2">
               <span className="text-slate-400 uppercase text-xs">Total</span>
               <span>₹{(activeChallan.lines||[]).reduce((a,b)=>a+b.amount,0).toLocaleString()}</span>
             </div>

             <button onClick={handleSave} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg shadow-md text-sm uppercase">
               Save Transaction
             </button>
         </div>
      </div>

      {/* History */}
      <div className="space-y-3">
         <input 
           placeholder="Search History..."
           value={searchParty} onChange={e => setSearchParty(e.target.value)}
           className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none uppercase"
         />
         {filteredChallans.slice(0, 50).map(c => {
             const partyName = data.parties.find(p => p.id === c.partyId)?.name || 'Unknown';
             const isUnpaid = c.paymentMode === PaymentMode.UNPAID;
             const isExpanded = expandedId === c.id;
             const statusColor = isUnpaid ? 'bg-red-500' : 'bg-green-500';
             
             return (
               <div key={c.id} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                  <div onClick={() => setExpandedId(isExpanded ? null : c.id)} className="p-3 flex justify-between items-center cursor-pointer">
                     <div className="flex gap-3 items-center">
                        <div className={`w-1.5 h-10 rounded-full ${statusColor}`}></div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800 uppercase">{partyName}</h4>
                          <span className="text-[10px] text-slate-400 font-semibold">#{c.challanNumber} • {c.date}</span>
                        </div>
                     </div>
                     <div className="text-right">
                        <div className="text-sm font-bold text-slate-900">₹{c.totalAmount.toLocaleString()}</div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${isUnpaid?'bg-red-50 text-red-600':'bg-green-50 text-green-600'}`}>
                          {c.paymentMode}
                        </span>
                     </div>
                  </div>
                  {isExpanded && (
                    <div className="bg-slate-50 p-3 border-t border-slate-100">
                      <table className="w-full text-[10px]">
                        <thead><tr className="text-slate-400 text-left"><th className="pb-1">Item</th><th className="pb-1 text-center">Wt</th><th className="pb-1 text-right">Amt</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {c.lines.map((l, i) => (
                             <tr key={i}><td className="py-1 font-bold">{l.size}</td><td className="py-1 text-center">{l.weight.toFixed(3)}</td><td className="py-1 text-right">₹{l.amount}</td></tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-2 flex justify-end">
                        <button onClick={() => handleDelete(c.id)} className="text-red-500 text-[10px] font-bold uppercase">Delete Record</button>
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