
import React from 'react';
import { 
  Book, FileText, Download, Shield, Truck, 
  Layers, Beaker, Calculator, Cloud, Info, 
  CheckCircle, AlertCircle, Zap, Scissors,
  Factory, Layout, Database, TrendingUp, Users,
  Settings, Smartphone, MousePointer2, AlertTriangle,
  // Added RotateCcw to fix the missing import error
  ArrowRight, Search, Share2, Plus, Trash2, Repeat, 
  DatabaseBackup, Eye, LogOut, ChevronRight, RotateCcw
} from 'lucide-react';

export const HelpManual: React.FC = () => {
  const handlePrint = () => {
    window.print();
  };

  const Marker = ({ num }: { num: number }) => (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px] font-black shadow-md ring-2 ring-white">
      {num}
    </span>
  );

  const Callout = ({ num, title, text }: { num: number, title: string, text: string }) => (
    <div className="flex gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex-shrink-0"><Marker num={num} /></div>
      <div>
        <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight mb-1">{title}</h4>
        <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{text}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-32 animate-in fade-in duration-1000 print:m-0 print:p-0">
      
      {/* --- COVER PAGE --- */}
      <div className="flex flex-col items-center justify-center text-center space-y-6 bg-white p-12 sm:p-20 rounded-[3rem] border border-slate-200 shadow-2xl print:shadow-none print:border-none print:p-10">
        <div className="p-6 bg-indigo-600 text-white rounded-[2rem] shadow-2xl shadow-indigo-200 animate-bounce-slow">
          <Book size={64} />
        </div>
        <div className="space-y-2">
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter">RDMS v1.5</h1>
          <p className="text-lg font-bold text-slate-400 uppercase tracking-[0.5em]">Operations Master Manual</p>
        </div>
        <div className="flex gap-4 pt-4 print:hidden">
          <button 
            onClick={handlePrint}
            className="bg-slate-900 hover:bg-black text-white px-10 py-5 rounded-2xl font-black flex items-center gap-3 shadow-2xl transition-all active:scale-95 hover:-translate-y-1"
          >
            <Download size={24} /> Generate Official PDF
          </button>
        </div>
        <div className="grid grid-cols-3 gap-8 pt-12 opacity-50 grayscale contrast-125">
           <div className="flex flex-col items-center gap-2"><Factory size={32}/><span className="text-[10px] font-black">MFG</span></div>
           <div className="flex flex-col items-center gap-2"><Truck size={32}/><span className="text-[10px] font-black">LOGISTICS</span></div>
           <div className="flex flex-col items-center gap-2"><Beaker size={32}/><span className="text-[10px] font-black">CHEM</span></div>
        </div>
      </div>

      <div className="space-y-24 bg-white p-8 sm:p-16 rounded-[3.5rem] border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0">
        
        {/* SECTION 1: ACCESS & ROLES */}
        <section className="space-y-8">
          <div className="flex items-center gap-4 border-b-[6px] border-indigo-50 pb-6">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl"><Shield size={32} /></div>
            <div>
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">1. Access & Security</h2>
                <p className="text-slate-400 font-bold text-sm">Authentication Framework</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-4">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><Users className="text-indigo-600" /> Authorized Roles</h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                   The system implements a **Separation of Duties** (SoD) model. Each department sees only what is necessary for their throughput.
                </p>
                <div className="space-y-3">
                   {[
                     { role: 'Admin', pass: 'Admin.123', desc: 'Full Financial access, Maintenance, & Master Deletion.' },
                     { role: 'User', pass: 'User.123', desc: 'Creation of Jobs, Bills, and Production Plans.' },
                     { role: 'Slitting', pass: 'Direct Access', desc: 'Workshop kiosk mode for weight entry only.' },
                     { role: 'Chemical', pass: 'Chemical.123', desc: 'Simple inventory logging for plant operators.' }
                   ].map((r, i) => (
                     <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                           <div className="text-xs font-black text-slate-800 uppercase">{r.role} Mode</div>
                           <div className="text-[10px] text-slate-400 font-medium">{r.desc}</div>
                        </div>
                        <div className="text-[10px] font-mono bg-white px-3 py-1 rounded-lg border border-slate-200 font-bold text-indigo-600">{r.pass}</div>
                     </div>
                   ))}
                </div>
             </div>

             <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none text-[10rem] font-black -rotate-12">LOCK</div>
                <h4 className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400 mb-6 flex items-center gap-2"><Zap size={16}/> Security Notes</h4>
                <ul className="space-y-4 text-xs font-bold text-slate-300">
                    <li className="flex gap-3"><CheckCircle className="text-emerald-500 flex-shrink-0" size={16}/> Session auto-resets on browser close for security.</li>
                    <li className="flex gap-3"><CheckCircle className="text-emerald-500 flex-shrink-0" size={16}/> Offline Persistence: Data saves locally even if internet drops.</li>
                    <li className="flex gap-3"><CheckCircle className="text-emerald-500 flex-shrink-0" size={16}/> Passwords are case-sensitive. Maintain the exact syntax.</li>
                </ul>
             </div>
          </div>
        </section>

        {/* SECTION 2: PRODUCTION PLANNING */}
        <section className="space-y-8">
          <div className="flex items-center gap-4 border-b-[6px] border-amber-50 pb-6">
            <div className="p-3 bg-amber-500 text-white rounded-2xl"><Calculator size={32} /></div>
            <div>
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">2. Production Planner</h2>
                <p className="text-slate-400 font-bold text-sm">Estimation & Calculation Engine</p>
            </div>
          </div>

          <div className="flex flex-col gap-10">
             {/* UI MOCKUP: PLANNER */}
             <div className="relative border-[4px] border-slate-900 rounded-[2.5rem] p-8 bg-slate-50 shadow-2xl">
                <div className="absolute -top-5 left-10 bg-slate-900 text-white px-6 py-2 text-xs font-black uppercase rounded-full shadow-xl">Interface: Printing Planner</div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                   <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
                      <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                         <div className="flex items-center gap-3"><div className="w-6 h-6 rounded bg-indigo-600"></div><div className="w-32 h-4 bg-slate-200 rounded"></div></div>
                         <div className="flex-shrink-0 ml-4"><Marker num={1} /></div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                         <div className="h-14 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center"><Marker num={2} /></div>
                         <div className="h-14 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center"><Marker num={3} /></div>
                         <div className="h-14 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center"><Marker num={4} /></div>
                      </div>
                      <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6 relative">
                         <div className="absolute -top-3 right-4"><Marker num={5} /></div>
                         <div className="h-20 bg-white/60 border border-indigo-100 rounded-xl flex items-center justify-center"><span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Master Calculator Engine</span></div>
                      </div>
                   </div>
                   <div className="lg:col-span-5 space-y-3">
                      <Callout num={1} title="Party & Date Selection" text="Search existing parties or type a new one to auto-register. Date defaults to Today." />
                      <Callout num={2} title="Label Size (mm)" text="The outer width of the tube/sizer in millimeters. Critical for Weight calculations." />
                      <Callout num={3} title="Micron (μ)" text="Thickness of the material. Higher microns = Lower Meters per KG." />
                      <Callout num={4} title="Cutting Size" text="Length per piece. System auto-adds allowances based on 'Type'." />
                      <Callout num={5} title="The 3-Way Sync" text="Calculates Weight, Meters, or Pcs. Updating one updates the other two instantly." />
                   </div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="bg-indigo-900 p-8 rounded-[2.5rem] text-white space-y-4 shadow-xl">
                   <h4 className="text-xs font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2"><Scissors size={18}/> Process Allowances</h4>
                   <p className="text-xs font-medium leading-relaxed opacity-80">Before calculating PCS, the system adds a 'Safety Margin' to your Cutting Size:</p>
                   <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="bg-white/10 p-4 rounded-2xl border border-white/10">
                         <div className="text-[10px] font-black uppercase text-indigo-300">St. Seal</div>
                         <div className="text-xl font-black">+ 5 mm</div>
                      </div>
                      <div className="bg-white/10 p-4 rounded-2xl border border-white/10">
                         <div className="text-[10px] font-black uppercase text-indigo-300">Round</div>
                         <div className="text-xl font-black">+ 15 mm</div>
                      </div>
                   </div>
                   <div className="pt-4 border-t border-white/10 flex items-start gap-3">
                      <Info size={16} className="text-indigo-400" />
                      <p className="text-[10px] italic opacity-60">Formula: Pcs = (Net Meter * 1000) / (Cutting Size + Allowance). Result is rounded to nearest 100.</p>
                   </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[2.5rem] space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-emerald-700 flex items-center gap-2"><CheckCircle size={18}/> Operational Tips</h4>
                    <ul className="space-y-4 text-xs font-bold text-slate-600">
                        <li className="flex gap-3"><ArrowRight className="text-emerald-500" size={16}/> Use 'Duplicate' on old plans to save time.</li>
                        <li className="flex gap-3"><ArrowRight className="text-emerald-500" size={16}/> Printing jobs auto-add 200m 'Extra Meter' for wastage.</li>
                        <li className="flex gap-3"><ArrowRight className="text-emerald-500" size={16}/> Click 'Taken' to mark an order as 'In-Production'.</li>
                    </ul>
                </div>
             </div>
          </div>
        </section>

        {/* SECTION 3: DISPATCH & LIVE FEED */}
        <section className="space-y-8">
          <div className="flex items-center gap-4 border-b-[6px] border-indigo-50 pb-6">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl"><Truck size={32} /></div>
            <div>
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">3. Dispatch & Jobs</h2>
                <p className="text-slate-400 font-bold text-sm">Real-time Fulfillment Control</p>
            </div>
          </div>

          <div className="space-y-10">
             {/* UI MOCKUP: JOB LIST */}
             <div className="relative border-[4px] border-slate-900 rounded-[2.5rem] p-8 bg-white shadow-2xl">
                <div className="absolute -top-5 left-10 bg-slate-900 text-white px-6 py-2 text-xs font-black uppercase rounded-full shadow-xl">Interface: Job Dashboard</div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                   <div className="lg:col-span-7 space-y-4">
                      <div className="border-2 border-indigo-400 rounded-3xl p-5 bg-indigo-50 relative animate-pulse">
                         <div className="absolute top-2 right-2"><Marker num={6} /></div>
                         <div className="flex justify-between items-center mb-3">
                            <div className="w-24 h-3 bg-indigo-200 rounded"></div>
                            <div className="w-16 h-5 bg-indigo-600 rounded"></div>
                         </div>
                         <div className="w-3/4 h-6 bg-slate-800 rounded"></div>
                      </div>
                      <div className="border border-slate-200 rounded-3xl p-5 bg-white relative">
                         <div className="absolute top-2 right-2 flex gap-2"><Marker num={7} /><Marker num={8} /></div>
                         <div className="flex justify-between items-center mb-3 opacity-30">
                            <div className="w-24 h-3 bg-slate-200 rounded"></div>
                            <div className="w-16 h-5 bg-slate-200 rounded"></div>
                         </div>
                         <div className="w-3/4 h-6 bg-slate-200 rounded"></div>
                      </div>
                   </div>
                   <div className="lg:col-span-5 space-y-3">
                      <Callout num={6} title="Pulsing Indicator" text="Jobs marked as 'SLITTING' or 'CUTTING' pulse on all screens to warn staff of live floor activity." />
                      <Callout num={7} title="Selection Box" text="Select multiple jobs and tap the floating 'Merge' button to combine them." />
                      <Callout num={8} title="WhatsApp Share" text="Tap to generate a high-res PNG image of the job details for instant delivery to customers." />
                   </div>
                </div>
             </div>

             <div className="overflow-hidden border border-slate-200 rounded-3xl shadow-sm">
                <table className="w-full text-left text-xs font-bold">
                    <thead className="bg-slate-900 text-white uppercase tracking-widest">
                        <tr><th className="p-6">Status Code</th><th className="p-6">Operational Meaning</th><th className="p-6">Impact</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600 bg-white">
                        <tr><td className="p-6 text-indigo-600 font-black">PENDING</td><td className="p-6">Order logged in office, not yet on floor.</td><td className="p-6">Visible to Admin only.</td></tr>
                        <tr><td className="p-6 text-amber-600 font-black">SLITTING</td><td className="p-6">Material is currently on the machine.</td><td className="p-6">Inventory Depletes.</td></tr>
                        <tr><td className="p-6 text-emerald-600 font-black">COMPLETED</td><td className="p-6">Production done, awaiting logistics.</td><td className="p-6">Shows in Financials.</td></tr>
                        <tr><td className="p-6 text-purple-600 font-black">DISPATCHED</td><td className="p-6">Material has exited the premises.</td><td className="p-6">Archive State.</td></tr>
                    </tbody>
                </table>
             </div>
          </div>
        </section>

        {/* SECTION 4: SLITTING LOGS */}
        <section className="space-y-8">
          <div className="flex items-center gap-4 border-b-[6px] border-red-50 pb-6">
            <div className="p-3 bg-red-600 text-white rounded-2xl"><Scissors size={32} /></div>
            <div>
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">4. Workshop Kiosk</h2>
                <p className="text-slate-400 font-bold text-sm">Operator-Side Weight Logging</p>
            </div>
          </div>

          <div className="flex flex-col gap-10">
             <p className="text-sm text-slate-600 font-medium leading-relaxed">
                The Slitting Dashboard is designed for high-speed tablet input. It calculates **Net Weight** and 
                **Computed Meters** in real-time as the operator types.
             </p>

             <div className="relative border-[4px] border-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl bg-white">
                <div className="bg-slate-900 p-4 text-center"><span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.5em]">Digital Production Log</span></div>
                <table className="w-full text-center border-collapse">
                    <thead className="bg-slate-100 border-b-2 border-slate-900 text-[9px] font-black uppercase text-slate-500">
                        <tr><th className="p-4">Sr.</th><th className="p-4">Gross (kg)</th><th className="p-4">Core (kg)</th><th className="p-4">Net Wt</th><th className="p-4">Meter</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        <tr className="bg-emerald-50/50">
                            <td className="p-4 font-black">1</td>
                            <td className="p-4 text-slate-800">12.550</td>
                            <td className="p-4 text-slate-400">0.500</td>
                            <td className="p-4 text-emerald-600 font-black">12.050</td>
                            <td className="p-4 font-mono font-bold">4280m</td>
                        </tr>
                        <tr>
                            <td className="p-4 font-black">2</td>
                            <td className="p-4 border border-indigo-200 bg-indigo-50/30 text-indigo-600 font-black">INPUT HERE</td>
                            <td className="p-4 text-slate-400">0.500</td>
                            <td className="p-4">-</td>
                            <td className="p-4">-</td>
                        </tr>
                    </tbody>
                </table>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                   <h5 className="text-[10px] font-black uppercase text-indigo-600 mb-2">Smart Core Filling</h5>
                   <p className="text-[10px] text-slate-500 font-medium">Type the core weight for the first roll. All subsequent rolls will auto-fill with the same value.</p>
                </div>
                <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                   <h5 className="text-[10px] font-black uppercase text-indigo-600 mb-2">Auto-Meter Calculation</h5>
                   <p className="text-[10px] text-slate-500 font-medium">Meterage is derived from Size, Micron, and Net Weight using industrial density constants.</p>
                </div>
                <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                   <h5 className="text-[10px] font-black uppercase text-indigo-600 mb-2">Sync Persistence</h5>
                   <p className="text-[10px] text-slate-500 font-medium">Logs are saved to the cloud on 'Blur' (when you exit the field). No Save button needed.</p>
                </div>
             </div>
          </div>
        </section>

        {/* SECTION 5: CHEMICAL MANAGEMENT */}
        <section className="space-y-8">
          <div className="flex items-center gap-4 border-b-[6px] border-teal-50 pb-6">
            <div className="p-3 bg-teal-600 text-white rounded-2xl"><Beaker size={32} /></div>
            <div>
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">5. Chemical Division</h2>
                <p className="text-slate-400 font-bold text-sm">Inventory & Consumption</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
             <div className="space-y-6">
                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                   The chemical system tracks material depletion in real-time. It supports three primary plant types: **65mm**, **45mm**, and **Jumbo**.
                </p>
                <div className="bg-white border-2 border-slate-100 rounded-[2rem] p-8 shadow-xl space-y-6">
                   <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Inventory Monitoring</h4>
                   {[{ name: 'DOP', val: 80, c: 'bg-emerald-500' }, { name: 'Stabilizer', val: 15, c: 'bg-red-500' }].map((s, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between text-xs font-black uppercase"><span>{s.name}</span><span>{s.val < 20 ? 'CRITICAL' : 'OPTIMAL'}</span></div>
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner"><div className={`h-full ${s.c} transition-all duration-1000`} style={{width: `${s.val}%`}}></div></div>
                      </div>
                   ))}
                </div>
             </div>
             <div className="space-y-4">
                <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white space-y-6 shadow-2xl border-b-[12px] border-teal-500">
                   <h4 className="text-xs font-black uppercase tracking-widest text-teal-400 flex items-center gap-2"><Zap size={18}/> Threshold Logic</h4>
                   <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-4 h-4 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse"></div>
                        <div>
                           <div className="text-xs font-black uppercase tracking-tighter">BELOW 100 KG</div>
                           <p className="text-[10px] text-slate-400">System warns of immediate production halt.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-4 h-4 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                        <div>
                           <div className="text-xs font-black uppercase tracking-tighter">BELOW 200 KG</div>
                           <p className="text-[10px] text-slate-400">Order placement triggered in logs.</p>
                        </div>
                      </div>
                   </div>
                   <div className="pt-4 border-t border-white/10">
                      <p className="text-[11px] font-bold text-slate-300">Admin must use 'Purchase Entry' to restore inventory when barrels are bought.</p>
                   </div>
                </div>
             </div>
          </div>
        </section>

        {/* SECTION 6: BILLING & FINANCIALS */}
        <section className="space-y-8">
          <div className="flex items-center gap-4 border-b-[6px] border-purple-50 pb-6">
            <div className="p-3 bg-purple-600 text-white rounded-2xl"><FileText size={32} /></div>
            <div>
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">6. Billing System</h2>
                <p className="text-slate-400 font-bold text-sm">Challan Management</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
             <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden p-8 space-y-6">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Core Features</h4>
                <ul className="space-y-6">
                   <li className="flex gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0"><Plus size={20}/></div>
                      <div>
                         <div className="text-sm font-black text-slate-800">Auto-Rate Intelligence</div>
                         <p className="text-[11px] text-slate-500">System checks the previous 10 challans for that party and auto-suggests the last rate used for that specific size.</p>
                      </div>
                   </li>
                   <li className="flex gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0"><Repeat size={20}/></div>
                      <div>
                         <div className="text-sm font-black text-slate-800">Clone Bill</div>
                         <p className="text-[11px] text-slate-500">For recurring orders, tap 'Clone' to recreate a bill with fresh weights but same items/rates.</p>
                      </div>
                   </li>
                   <li className="flex gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0"><Layout size={20}/></div>
                      <div>
                         <div className="text-sm font-black text-slate-800">Payment Modes</div>
                         <p className="text-[11px] text-slate-500">Toggle between 'Unpaid' and 'Cash'. Unpaid bills reflect in the Party's outstanding balance.</p>
                      </div>
                   </li>
                </ul>
             </div>
             <div className="bg-slate-50 rounded-[2.5rem] border border-slate-200 p-8 space-y-6 shadow-inner relative">
                <div className="absolute top-8 right-8"><Share2 className="text-emerald-500 animate-pulse" size={32} /></div>
                <h4 className="text-lg font-black text-slate-800">Digital Tax Invoice</h4>
                <p className="text-xs text-slate-500 font-medium">The 'Share to WhatsApp' feature generates a stylized Tax Invoice containing:</p>
                <div className="space-y-2 pt-4">
                   {['Company Header', 'Bill Number & Date', 'Line Item Breakdown', 'Total Billed Weight', 'Grand Total (Rounded)'].map((l, i) => (
                      <div key={i} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 text-[10px] font-black text-slate-700 uppercase"><CheckCircle className="text-emerald-500" size={14}/> {l}</div>
                   ))}
                </div>
             </div>
          </div>
        </section>

        {/* SECTION 7: MAINTENANCE & CLOUD */}
        <section className="space-y-8">
          <div className="flex items-center gap-4 border-b-[6px] border-slate-100 pb-6">
            <div className="p-3 bg-slate-900 text-white rounded-2xl"><Cloud size={32} /></div>
            <div>
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">7. Cloud & Sync</h2>
                <p className="text-slate-400 font-bold text-sm">Data Integrity Management</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
             <div className="bg-slate-900 p-10 rounded-[3rem] text-white space-y-6 shadow-2xl relative overflow-hidden">
                <div className="absolute -right-10 -bottom-10 opacity-10 rotate-12"><Cloud size={200} /></div>
                <h4 className="text-xs font-black uppercase tracking-widest text-indigo-400">Google Sheet Mirroring</h4>
                <p className="text-sm font-medium leading-relaxed text-slate-400">
                   RDMS automatically mirrors your Firebase database to a **Google Spreadsheet** via a custom Apps Script.
                </p>
                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                   <div className="text-[10px] font-black uppercase tracking-tighter text-indigo-300">How to Setup:</div>
                   <ol className="text-[11px] space-y-3 font-medium text-slate-300">
                      <li>1. Deploy the provided Apps Script as a 'Web App'.</li>
                      <li>2. Copy the generated URL.</li>
                      <li>3. Paste it into the 'Maintenance' tab in Admin Dashboard.</li>
                      <li>4. Tap 'Init Sheet Headers' to prepare your spreadsheet.</li>
                   </ol>
                </div>
             </div>
             <div className="space-y-6">
                <div className="bg-amber-50 border border-amber-200 p-8 rounded-[2.5rem] shadow-sm">
                   <h4 className="text-xs font-black uppercase tracking-widest text-amber-700 flex items-center gap-2 mb-4"><AlertTriangle size={18}/> Emergency Recovery</h4>
                   <div className="space-y-6">
                      <div className="flex gap-4">
                         <div className="p-3 bg-white rounded-xl shadow-sm text-slate-700"><Download size={20}/></div>
                         <div>
                            <div className="text-xs font-black text-slate-800 uppercase">Export JSON Backup</div>
                            <p className="text-[10px] text-slate-500">Download a full snapshot of your business data every week. Keep it offline.</p>
                         </div>
                      </div>
                      <div className="flex gap-4">
                         <div className="p-3 bg-white rounded-xl shadow-sm text-red-600"><RotateCcw size={20}/></div>
                         <div>
                            <div className="text-xs font-black text-red-600 uppercase">Full Data Restore</div>
                            <p className="text-[10px] text-slate-500">If data is corrupted, upload your JSON backup. **WARNING:** This overwrites everything.</p>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="pt-24 border-t border-slate-100 text-center space-y-6">
          <div className="flex justify-center items-center gap-12 opacity-30 grayscale contrast-125">
             <Factory size={48} /> <Truck size={48} /> <Layers size={48} />
          </div>
          <div className="space-y-1">
             <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.6em]">Raw Material & Dispatch Management System • 2025</p>
             <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Designed for High-Precision Extrusion & Slitting Facilities</p>
          </div>
        </footer>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4; margin: 1cm; }
          body { background: white !important; -webkit-print-color-adjust: exact; color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .animate-in { animation: none !important; }
          .animate-bounce-slow { animation: none !important; }
          .animate-pulse { animation: none !important; }
          .shadow-sm, .shadow-md, .shadow-lg, .shadow-xl, .shadow-2xl { box-shadow: none !important; }
          .rounded-2xl, .rounded-3xl, .rounded-\\[2\\.5rem\\], .rounded-\\[3\\.5rem\\] { border-radius: 1rem !important; }
          .border-slate-200 { border-color: #f1f5f9 !important; }
          section { page-break-inside: avoid; margin-bottom: 2rem; border-bottom: 2px solid #eee; padding-bottom: 2rem; }
          h2 { color: #1e293b !important; }
          .bg-indigo-600 { background-color: #4f46e5 !important; }
          .bg-slate-900 { background-color: #0f172a !important; }
          .bg-indigo-50 { background-color: #f5f3ff !important; }
          .bg-slate-50 { background-color: #f8fafc !important; }
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow { animation: bounce-slow 4s ease-in-out infinite; }
        .animate-spin-slow { animation: spin 4s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};
