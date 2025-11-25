import React, { useState, useMemo } from 'react';
import { AppData, Challan, PaymentMode } from '../../types';
import { saveAppData } from '../../services/storageService';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const ChallanManager: React.FC<Props> = ({ data, onUpdate }) => {
  const [activeChallan, setActiveChallan] = useState<Partial<Challan>>({
    date: new Date().toISOString().split('T')[0],
    challanNumber: '', // Allow manual entry
    paymentMode: PaymentMode.UNPAID,
    lines: []
  });
  
  const [partyInput, setPartyInput] = useState('');
  const [lineSize, setLineSize] = useState('');
  const [lineWt, setLineWt] = useState('');
  const [linePrice, setLinePrice] = useState('');
  
  // Filter State
  const [filterMode, setFilterMode] = useState<'ALL' | 'UNPAID' | 'CASH'>('ALL');
  const [searchDate, setSearchDate] = useState('');
  const [searchParty, setSearchParty] = useState('');
  const [searchChallanNo, setSearchChallanNo] = useState('');

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

  const handleSave = () => {
    if (!partyInput) return alert("Party Name Required");
    
    // Find/Create Party
    let partyId = data.parties.find(p => p.name.toLowerCase() === partyInput.toLowerCase())?.id;
    let newParties = [...data.parties];
    if (!partyId) {
      partyId = `p-${Date.now()}`;
      newParties.push({ id: partyId, name: partyInput, contact: '', address: '' });
    }

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

    let newChallans = [...data.challans];
    if (activeChallan.id) {
        newChallans = newChallans.map(c => c.id === activeChallan.id ? newChallan : c);
    } else {
        newChallans = [newChallan, ...newChallans];
    }

    const newData = { ...data, parties: newParties, challans: newChallans };
    saveAppData(newData);
    onUpdate(newData);
    
    // Reset
    setActiveChallan({
        date: new Date().toISOString().split('T')[0],
        challanNumber: '',
        paymentMode: PaymentMode.UNPAID,
        lines: []
    });
    setPartyInput('');
  };

  const handleDelete = (id: string) => {
    if(confirm('Delete record?')) {
        const newChallans = data.challans.filter(c => c.id !== id);
        const newData = {...data, challans: newChallans};
        saveAppData(newData);
        onUpdate(newData);
    }
  }

  // Filter Logic
  const filteredChallans = data.challans.filter(c => {
    const statusMatch = filterMode === 'ALL' ? true : c.paymentMode === filterMode;
    const dateMatch = searchDate ? c.date === searchDate : true;
    const partyName = data.parties.find(p => p.id === c.partyId)?.name.toLowerCase() || '';
    const partyMatch = searchParty ? partyName.includes(searchParty.toLowerCase()) : true;
    const challanMatch = searchChallanNo ? c.challanNumber.toLowerCase().includes(searchChallanNo.toLowerCase()) : true;
    
    return statusMatch && dateMatch && partyMatch && challanMatch;
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards (Red/Green Style) */}
      <div className="grid grid-cols-2 gap-4">
         {/* Unpaid Credit - Red */}
         <div className="bg-[#FFF5F5] rounded-2xl p-5 border border-red-100 flex flex-col justify-between relative overflow-hidden h-28">
            <div className="absolute right-[-12px] top-[-12px] w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Unpaid Credit</p>
            <h3 className="text-2xl font-black text-red-900">₹{stats.credit.toLocaleString()}</h3>
         </div>
         {/* Cash Received - Green */}
         <div className="bg-[#F0FDF4] rounded-2xl p-5 border border-green-100 flex flex-col justify-between relative overflow-hidden h-28">
            <div className="absolute right-[-12px] top-[-12px] w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Cash Received</p>
            <h3 className="text-2xl font-black text-green-900">₹{stats.received.toLocaleString()}</h3>
         </div>
      </div>

      {/* New Bill Form Card */}
      <div className="bg-[#FFF5F5] rounded-xl shadow-sm border border-red-50 p-5">
         <div className="flex items-center gap-2 mb-4 border-b border-red-100 pb-3">
           <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
           <h3 className="text-sm font-bold text-red-800 uppercase tracking-wider">New Bill</h3>
           <div className="flex-1"></div>
           <div className="flex bg-white rounded-lg p-1 border border-red-100">
              <button 
                onClick={() => setActiveChallan({...activeChallan, paymentMode: PaymentMode.UNPAID})}
                className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${activeChallan.paymentMode === PaymentMode.UNPAID ? 'bg-red-500 text-white' : 'text-slate-400'}`}
              >UNPAID</button>
              <button 
                onClick={() => setActiveChallan({...activeChallan, paymentMode: PaymentMode.CASH})}
                className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${activeChallan.paymentMode === PaymentMode.CASH ? 'bg-green-500 text-white' : 'text-slate-400'}`}
              >CASH</button>
           </div>
         </div>

         <div className="space-y-4">
             <div className="flex gap-4">
                <div className="w-1/3">
                  <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Challan #</label>
                  <input 
                    type="text"
                    placeholder="Auto"
                    value={activeChallan.challanNumber}
                    onChange={e => setActiveChallan({...activeChallan, challanNumber: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-600 outline-none focus:border-red-400"
                  />
                </div>
                <div className="w-2/3">
                   <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Date</label>
                   <input 
                    type="date" 
                    value={activeChallan.date}
                    onChange={e => setActiveChallan({...activeChallan, date: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:border-red-400"
                   />
                </div>
             </div>

             <div>
               <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Party Name</label>
               <input 
                  type="text" 
                  list="party_list_challan"
                  placeholder="Search or Add Party..."
                  value={partyInput}
                  onChange={e => setPartyInput(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-3 text-sm font-semibold outline-none focus:border-red-400 placeholder-slate-300"
               />
               <datalist id="party_list_challan">{data.parties.map(p => <option key={p.id} value={p.name}/>)}</datalist>
             </div>

             {/* Line Item Input Section */}
             <div className="border border-slate-200 border-dashed rounded-xl p-3 bg-white">
               <input 
                 className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs mb-2 outline-none focus:border-red-400 font-medium"
                 placeholder="Item Description / Size"
                 value={lineSize}
                 onChange={e => setLineSize(e.target.value)}
               />
               <div className="flex gap-2 mb-2">
                 <div className="relative w-1/3">
                    <input 
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:border-red-400 text-center"
                      placeholder="Wt"
                      type="number"
                      value={lineWt}
                      onChange={e => setLineWt(e.target.value)}
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-slate-400">kg</span>
                 </div>
                 <input 
                   className="w-1/3 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:border-red-400 text-center"
                   placeholder="Price"
                   type="number"
                   value={linePrice}
                   onChange={e => setLinePrice(e.target.value)}
                 />
                 <div className="w-1/3 bg-slate-100 rounded-lg p-2 text-xs text-center font-bold text-slate-700 flex items-center justify-center">
                    {(parseFloat(lineWt||'0') * parseFloat(linePrice||'0')).toFixed(0)}
                 </div>
               </div>
               
               <button 
                onClick={addLine}
                className="w-full py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-500 hover:text-red-600 hover:border-red-200 transition-colors flex items-center justify-center gap-1"
               >
                 <span>+</span> Add Row
               </button>

               {/* Line Items List */}
               {activeChallan.lines && activeChallan.lines.length > 0 && (
                 <div className="mt-3 space-y-1">
                   {activeChallan.lines.map((l, idx) => (
                     <div key={idx} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded border border-slate-100">
                        <span className="font-medium text-slate-700 w-1/3 truncate">{l.size}</span>
                        <div className="flex gap-2 items-center w-2/3 justify-end">
                          <span className="text-slate-400">{l.weight}kg</span>
                          <span className="font-bold text-slate-800 w-12 text-right">₹{l.amount}</span>
                          <button onClick={() => {
                             const newLines = [...(activeChallan.lines || [])];
                             newLines.splice(idx, 1);
                             setActiveChallan({...activeChallan, lines: newLines});
                          }} className="text-red-400 font-bold hover:text-red-600 px-1">&times;</button>
                        </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>

             <div className="flex justify-between items-end pt-2">
               <span className="text-xs font-bold text-slate-400">GRAND TOTAL</span>
               <div className="text-right">
                 <div className="text-[10px] text-slate-400">{(activeChallan.lines||[]).reduce((a,b)=>a+b.weight,0).toFixed(3)} kg</div>
                 <div className="text-3xl font-black text-slate-800">₹{(activeChallan.lines||[]).reduce((a,b)=>a+b.amount,0)}</div>
               </div>
             </div>

             <button 
              onClick={handleSave}
              className="w-full bg-[#D32F2F] hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-500/20 text-sm uppercase tracking-wide flex items-center justify-center gap-2"
             >
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
               Save Bill
             </button>
         </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-3">
        {/* Filter Bar */}
        <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3">
            {/* Status Tabs */}
            <div className="flex bg-slate-50 rounded-lg p-1 border border-slate-200">
              <button 
                onClick={() => setFilterMode('ALL')}
                className={`flex-1 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${filterMode === 'ALL' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
              >ALL</button>
              <button 
                onClick={() => setFilterMode('UNPAID')}
                className={`flex-1 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${filterMode === 'UNPAID' ? 'bg-white shadow-sm text-red-600' : 'text-slate-500'}`}
              >UNPAID</button>
              <button 
                onClick={() => setFilterMode('CASH')}
                className={`flex-1 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${filterMode === 'CASH' ? 'bg-white shadow-sm text-green-600' : 'text-slate-500'}`}
              >CASH</button>
           </div>
           
           {/* Search Inputs */}
           <div className="flex flex-1 gap-2">
              <input 
                type="date" 
                value={searchDate}
                onChange={e => setSearchDate(e.target.value)}
                className="w-1/3 bg-slate-50 border border-slate-200 rounded-lg px-2 text-[10px] font-semibold outline-none"
              />
              <input 
                type="text" 
                placeholder="Party..." 
                value={searchParty}
                onChange={e => setSearchParty(e.target.value)}
                className="w-1/3 bg-slate-50 border border-slate-200 rounded-lg px-2 text-[10px] outline-none" 
              />
              <input 
                type="text" 
                placeholder="Challan #..." 
                value={searchChallanNo}
                onChange={e => setSearchChallanNo(e.target.value)}
                className="w-1/3 bg-slate-50 border border-slate-200 rounded-lg px-2 text-[10px] outline-none" 
              />
           </div>
        </div>

        {/* Items List */}
        <div className="space-y-2">
          {filteredChallans.slice(0, 50).map(c => {
            const partyName = data.parties.find(p => p.id === c.partyId)?.name || 'Unknown';
            const initials = partyName.slice(0, 2).toUpperCase();
            return (
              <div key={c.id} className="bg-white rounded-xl p-3 flex items-center justify-between border border-slate-100 shadow-sm">
                 <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm ${c.paymentMode === PaymentMode.UNPAID ? 'bg-red-500' : 'bg-emerald-500'}`}>
                      {initials}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{partyName}</h4>
                      <p className="text-[9px] text-slate-400 font-mono flex items-center gap-1">
                        <span>#{c.challanNumber.replace('CH-', '')}</span>
                        <span>•</span>
                        <span>{c.date}</span>
                      </p>
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-sm font-black text-slate-800">₹{c.totalAmount.toLocaleString()}</div>
                        <div className="text-[9px] text-slate-400 font-medium">{c.totalWeight.toFixed(3)} kg</div>
                    </div>
                    <div className="flex gap-2">
                         <button className="text-slate-300 hover:text-blue-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                         <button onClick={() => handleDelete(c.id)} className="text-slate-300 hover:text-red-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </div>
                 </div>
              </div>
            );
          })}
          {filteredChallans.length === 0 && (
             <div className="text-center py-6 text-xs text-slate-400">No bills found.</div>
          )}
        </div>
      </div>
    </div>
  );
};