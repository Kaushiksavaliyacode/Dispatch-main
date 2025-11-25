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
  
  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [partyInput, setPartyInput] = useState('');
  const [lineSize, setLineSize] = useState('');
  const [lineWt, setLineWt] = useState('');
  const [linePrice, setLinePrice] = useState('');
  
  // Filter State
  const [filterMode, setFilterMode] = useState<'ALL' | 'UNPAID' | 'CASH'>('ALL');
  const [searchParty, setSearchParty] = useState('');

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

    setActiveChallan({
      ...activeChallan,
      lines: [...(activeChallan.lines || []), newLine]
    });
    setLineSize('');
    setLineWt('');
    setLinePrice('');
  };

  const handleSave = async () => {
    if (!partyInput) return alert("Party Name Required");
    const partyId = await ensurePartyExists(data.parties, partyInput);
    const lines = activeChallan.lines || [];
    const totalWeight = lines.reduce((s, l) => s + l.weight, 0);
    const totalAmount = lines.reduce((s, l) => s + l.amount, 0);

    const newChallan: Challan = {
      id: isEditingId || activeChallan.id || `c-${Date.now()}`,
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
    resetForm();
  };

  const resetForm = () => {
    setActiveChallan({
        date: new Date().toISOString().split('T')[0],
        challanNumber: '',
        paymentMode: PaymentMode.UNPAID,
        lines: []
    });
    setPartyInput('');
    setIsEditingId(null);
  };

  const handleEdit = (c: Challan) => {
    const partyName = data.parties.find(p => p.id === c.partyId)?.name || '';
    setPartyInput(partyName);
    setActiveChallan(c);
    setIsEditingId(c.id);
    setExpandedId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if(confirm('Delete record?')) {
        await deleteChallan(id);
        if (isEditingId === id) resetForm();
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const filteredChallans = data.challans.filter(c => {
    const statusMatch = filterMode === 'ALL' ? true : c.paymentMode === filterMode;
    const partyName = data.parties.find(p => p.id === c.partyId)?.name.toLowerCase() || '';
    const partyMatch = searchParty ? partyName.includes(searchParty.toLowerCase()) : true;
    return statusMatch && partyMatch;
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
         <div className="bg-red-50 rounded-2xl p-4 border-2 border-red-100 flex flex-col justify-center items-center text-center shadow-sm">
            <h3 className="text-2xl font-black text-red-900">₹{stats.credit.toLocaleString()}</h3>
            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mt-1">Unpaid Credit</p>
         </div>
         <div className="bg-green-50 rounded-2xl p-4 border-2 border-green-100 flex flex-col justify-center items-center text-center shadow-sm">
            <h3 className="text-2xl font-black text-green-900">₹{stats.received.toLocaleString()}</h3>
            <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mt-1">Cash Received</p>
         </div>
      </div>

      {/* NEW BILL FORM */}
      <div className="bg-white rounded-3xl shadow-xl border border-red-50 p-1">
         <div className="bg-slate-50 rounded-[20px] p-5 md:p-8">
            <h3 className="text-xl font-black text-red-800 uppercase tracking-wide mb-6 flex items-center gap-2">
               <span className="text-3xl">🧾</span> {isEditingId ? 'Edit Bill' : 'New Bill'}
            </h3>

            {/* Giant Payment Mode Toggle */}
            <div className="grid grid-cols-2 gap-3 mb-6 bg-white p-2 rounded-2xl border border-slate-200">
               <button 
                 onClick={() => setActiveChallan({...activeChallan, paymentMode: PaymentMode.UNPAID})}
                 className={`py-4 rounded-xl text-sm font-black uppercase tracking-wider transition-all border-2 ${
                    activeChallan.paymentMode === PaymentMode.UNPAID 
                    ? 'bg-red-500 border-red-500 text-white shadow-lg scale-[1.02]' 
                    : 'bg-white border-transparent text-slate-400 hover:bg-slate-50'
                 }`}
               >
                 Unpaid
               </button>
               <button 
                 onClick={() => setActiveChallan({...activeChallan, paymentMode: PaymentMode.CASH})}
                 className={`py-4 rounded-xl text-sm font-black uppercase tracking-wider transition-all border-2 ${
                    activeChallan.paymentMode === PaymentMode.CASH 
                    ? 'bg-green-500 border-green-500 text-white shadow-lg scale-[1.02]' 
                    : 'bg-white border-transparent text-slate-400 hover:bg-slate-50'
                 }`}
               >
                 Cash
               </button>
            </div>

            <div className="space-y-4">
               {/* Inputs */}
               <div className="flex gap-3">
                  <div className="w-1/3">
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">No.</label>
                    <input 
                      type="text"
                      placeholder="AUTO"
                      value={activeChallan.challanNumber}
                      onChange={e => setActiveChallan({...activeChallan, challanNumber: e.target.value})}
                      className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-3 text-base font-black text-slate-800 outline-none focus:border-red-400 text-center uppercase"
                    />
                  </div>
                  <div className="w-2/3">
                     <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Date</label>
                     <input 
                      type="date" 
                      value={activeChallan.date}
                      onChange={e => setActiveChallan({...activeChallan, date: e.target.value})}
                      className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-3 text-base font-bold outline-none focus:border-red-400"
                     />
                  </div>
               </div>

               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Party Name</label>
                 <input 
                    type="text" 
                    list="party_list_challan"
                    placeholder="SEARCH PARTY..."
                    value={partyInput}
                    onChange={e => setPartyInput(e.target.value)}
                    className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-4 text-lg font-bold outline-none focus:border-red-400 placeholder-slate-300 uppercase"
                 />
                 <datalist id="party_list_challan">{data.parties.map(p => <option key={p.id} value={p.name}/>)}</datalist>
               </div>

               {/* Line Items */}
               <div className="bg-white border-2 border-slate-200 rounded-2xl p-4">
                 <div className="flex gap-2 mb-2">
                   <input 
                     className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-3 text-sm font-bold outline-none focus:border-red-400 uppercase"
                     placeholder="SIZE / ITEM"
                     value={lineSize}
                     onChange={e => setLineSize(e.target.value)}
                   />
                 </div>
                 <div className="flex gap-2 mb-3">
                    <input 
                      className="w-1/3 bg-slate-50 border border-slate-200 rounded-lg px-2 py-3 text-sm font-bold outline-none focus:border-red-400 text-center"
                      placeholder="Wt"
                      type="number"
                      value={lineWt}
                      onChange={e => setLineWt(e.target.value)}
                    />
                    <input 
                      className="w-1/3 bg-slate-50 border border-slate-200 rounded-lg px-2 py-3 text-sm font-bold outline-none focus:border-red-400 text-center"
                      placeholder="Price"
                      type="number"
                      value={linePrice}
                      onChange={e => setLinePrice(e.target.value)}
                    />
                    <div className="w-1/3 bg-red-50 border border-red-100 rounded-lg flex items-center justify-center font-black text-red-900">
                      {(parseFloat(lineWt||'0') * parseFloat(linePrice||'0')).toFixed(0)}
                    </div>
                 </div>
                 
                 <button 
                  onClick={addLine}
                  className="w-full py-3 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                 >
                   + Add Line Item
                 </button>

                 {/* List */}
                 {activeChallan.lines && activeChallan.lines.length > 0 && (
                   <div className="mt-4 space-y-2">
                     {activeChallan.lines.map((l, idx) => (
                       <div key={idx} className="flex justify-between items-center text-sm bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <span className="font-black text-slate-700 uppercase">{l.size}</span>
                          <div className="flex gap-3 items-center">
                            <span className="text-[10px] font-bold text-slate-400">{l.weight}kg</span>
                            <span className="font-black text-slate-900">₹{l.amount}</span>
                            <button onClick={() => {
                               const newLines = [...(activeChallan.lines || [])];
                               newLines.splice(idx, 1);
                               setActiveChallan({...activeChallan, lines: newLines});
                            }} className="w-6 h-6 rounded-full bg-red-100 text-red-500 font-bold flex items-center justify-center">×</button>
                          </div>
                       </div>
                     ))}
                   </div>
                 )}
               </div>

               <div className="flex justify-between items-end px-2 py-2">
                 <span className="text-xs font-black text-slate-400 uppercase">Total Amount</span>
                 <div className="text-right">
                   <div className="text-4xl font-black text-slate-900">₹{(activeChallan.lines||[]).reduce((a,b)=>a+b.amount,0).toLocaleString()}</div>
                 </div>
               </div>

               <button 
                onClick={handleSave}
                className="w-full bg-[#D32F2F] hover:bg-red-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-red-500/20 text-lg uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
               >
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                 {isEditingId ? 'Update Bill' : 'Save Bill'}
               </button>
            </div>
         </div>
      </div>

      {/* History List - EXPANDABLE CARDS */}
      <div className="space-y-6">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest px-1">Transaction History</h3>
        
        {/* Search */}
        <div className="flex gap-2">
            <input 
               className="flex-1 bg-white border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-600 outline-none uppercase placeholder-slate-300" 
               placeholder="SEARCH PARTY..."
               value={searchParty}
               onChange={e => setSearchParty(e.target.value)}
            />
        </div>

        {filteredChallans.slice(0, 50).map(c => {
            const partyName = data.parties.find(p => p.id === c.partyId)?.name || 'Unknown';
            const initials = partyName.slice(0, 2).toUpperCase();
            const isUnpaid = c.paymentMode === PaymentMode.UNPAID;
            const isExpanded = expandedId === c.id;

            return (
              <div key={c.id} className={`rounded-3xl border border-slate-200 shadow-md overflow-hidden transition-all duration-300 ${isExpanded ? 'bg-white ring-2 ring-indigo-100' : 'bg-white'}`}>
                 
                 {/* Header / Summary */}
                 <div 
                   onClick={() => toggleExpand(c.id)}
                   className={`p-5 cursor-pointer flex flex-col gap-3 ${isUnpaid ? 'bg-red-50/30' : 'bg-green-50/30'}`}
                 >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black text-white shadow-sm ${isUnpaid ? 'bg-red-500' : 'bg-green-500'}`}>
                              {initials}
                            </div>
                            <div>
                              <h4 className="text-base font-black text-slate-800 uppercase leading-tight">{partyName}</h4>
                              <span className="text-[10px] font-bold text-slate-400 block">{c.date} • #{c.challanNumber}</span>
                            </div>
                        </div>
                        <div className="text-right">
                           <div className="text-lg font-black text-slate-900">₹{c.totalAmount.toLocaleString()}</div>
                           <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${isUnpaid ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                              {c.paymentMode}
                           </span>
                        </div>
                    </div>
                    
                    {!isExpanded && (
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wide border-t border-slate-100/50 pt-2">
                         <span>{c.lines.length} Lines • {c.totalWeight.toFixed(2)} KG</span>
                         <span className="text-blue-600">Tap for Details ↓</span>
                      </div>
                    )}
                 </div>

                 {/* Expanded Details */}
                 {isExpanded && (
                   <div className="p-5 bg-white border-t border-slate-100 animate-in slide-in-from-top-2">
                      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 mb-4">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-slate-400 border-b border-slate-200 text-[9px] uppercase font-black text-left">
                              <th className="pb-2 pl-2">Item</th>
                              <th className="pb-2 text-center">Wt</th>
                              <th className="pb-2 text-center">Rate</th>
                              <th className="pb-2 text-right pr-2">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {c.lines.map((line, idx) => (
                              <tr key={idx}>
                                <td className="py-2 pl-2 font-bold text-slate-700">{line.size}</td>
                                <td className="py-2 text-center text-slate-500">{line.weight}</td>
                                <td className="py-2 text-center text-slate-500">{line.rate}</td>
                                <td className="py-2 text-right pr-2 font-bold text-slate-800">₹{line.amount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Action Bar */}
                      <div className="flex gap-3 pt-2">
                         <button 
                           onClick={(e) => { e.stopPropagation(); handleEdit(c); }}
                           className="flex-1 bg-slate-800 hover:bg-black text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-md active:scale-95 transition-all"
                         >
                           Edit Bill
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                           className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-3 rounded-xl text-xs font-black uppercase tracking-widest border border-red-100 active:scale-95 transition-all"
                         >
                           Delete
                         </button>
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