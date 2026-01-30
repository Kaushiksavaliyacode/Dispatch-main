
import React from 'react';
import { 
  Book, FileText, Download, Shield, Truck, 
  Layers, Beaker, Calculator, Cloud, Info, 
  CheckCircle, AlertCircle, Zap, Scissors,
  Factory, Layout, Database, TrendingUp, Users,
  Settings, Smartphone, MousePointer2, AlertTriangle
} from 'lucide-react';

export const HelpManual: React.FC = () => {
  const handlePrint = () => {
    window.print();
  };

  // Helper for UI Mockup Annotations
  const Annotation = ({ num, text }: { num: number, text: string }) => (
    <div className="flex gap-3 items-start bg-white/80 p-2 rounded-lg border border-slate-200 shadow-sm">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">{num}</span>
      <span className="text-[10px] font-bold text-slate-700 leading-tight">{text}</span>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-32 animate-in fade-in duration-700 print:m-0 print:p-0">
      
      {/* 0. COVER HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-6 bg-white p-8 rounded-3xl border border-slate-200 shadow-2xl print:shadow-none print:border-none print:mb-10">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
            <Book size={48} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">RDMS v1.5</h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.3em]">Master Operational Guide</p>
            <div className="flex gap-2 mt-2">
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-black uppercase">ERP</span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-black uppercase">Production</span>
                <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-black uppercase">Inventory</span>
            </div>
          </div>
        </div>
        <button 
          onClick={handlePrint}
          className="bg-slate-900 hover:bg-black text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 shadow-xl transition-all active:scale-95 hover:-translate-y-1 print:hidden"
        >
          <Download size={20} /> Download PDF Manual
        </button>
      </div>

      {/* TABLE OF CONTENTS */}
      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 print:hidden">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Quick Navigation</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['Access Control', 'Production Flow', 'Billing Logic', 'Plant Merging', 'Chemical Stock', 'Data Structure', 'Sync & Maintenance'].map((item, i) => (
                  <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">{i+1}</div>
                      <span className="text-[11px] font-bold text-slate-600">{item}</span>
                  </div>
              ))}
          </div>
      </div>

      <div className="space-y-16 bg-white p-8 sm:p-16 rounded-[2.5rem] border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0">
        
        {/* SECTION 1: ACCESS CONTROL */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b-4 border-slate-100 pb-4">
            <Shield className="text-indigo-600" size={32} />
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">1. Authentication & Roles</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-indigo-50 border border-indigo-100 space-y-3">
               <h4 className="font-black text-indigo-700 flex items-center gap-2 uppercase tracking-wider text-xs"><Users size={16}/> Admin Mode</h4>
               <p className="text-[11px] font-bold text-indigo-900/60 leading-relaxed">Full system governance, master data editing, chemical purchases, and sync management.</p>
               <div className="bg-white p-3 rounded-xl text-[10px] font-mono border border-indigo-200">
                  ID: admin <br/> PASS: Admin.123
               </div>
            </div>
            <div className="p-6 rounded-3xl bg-red-50 border border-red-100 space-y-3">
               <h4 className="font-black text-red-700 flex items-center gap-2 uppercase tracking-wider text-xs"><Smartphone size={16}/> User Mode</h4>
               <p className="text-[11px] font-bold text-red-900/60 leading-relaxed">Daily operations: Billing, Dispatch Job creation, Slitting entry, and Printing queue.</p>
               <div className="bg-white p-3 rounded-xl text-[10px] font-mono border border-red-200">
                  ID: user <br/> PASS: User.123
               </div>
            </div>
            <div className="p-6 rounded-3xl bg-teal-50 border border-teal-100 space-y-3">
               <h4 className="font-black text-teal-700 flex items-center gap-2 uppercase tracking-wider text-xs"><Beaker size={16}/> Chemical Mode</h4>
               <p className="text-[11px] font-bold text-teal-900/60 leading-relaxed">Simplified kiosk interface for operator-level chemical consumption logging.</p>
               <div className="bg-white p-3 rounded-xl text-[10px] font-mono border border-teal-200">
                  ID: Chemical <br/> PASS: Chemical.123
               </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: PRODUCTION DATA FLOW */}
        <section className="space-y-8">
          <div className="flex items-center gap-3 border-b-4 border-slate-100 pb-4">
            <Truck className="text-indigo-600" size={32} />
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">2. Dispatch Lifecycle</h2>
          </div>
          
          <div className="flex flex-col gap-6">
             <p className="text-slate-600 text-sm font-medium leading-relaxed">
                The core of RDMS is the **Job Card**. A job represents a collection of sizes being produced for a single client on a specific date. 
             </p>

             {/* UI MOCKUP: JOB CARD */}
             <div className="relative border-[3px] border-slate-900 rounded-3xl p-6 bg-slate-50 shadow-inner">
                <div className="absolute -top-4 left-6 bg-slate-900 text-white px-3 py-1 text-[10px] font-black uppercase rounded-full">Interface Breakdown: Job Manager</div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                   <div className="md:col-span-8 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
                      <div className="h-4 bg-slate-100 rounded w-1/3"></div>
                      <div className="h-10 bg-slate-50 border border-dashed border-slate-200 rounded-xl flex items-center px-4"><span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Party Selection & Metadata</span></div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="h-16 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center font-black text-indigo-300 text-[10px]">LINE ITEM 1</div>
                        <div className="h-16 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center font-black text-indigo-300 text-[10px]">LINE ITEM 2</div>
                        <div className="h-16 bg-slate-50 border border-slate-100 border-dashed rounded-xl flex items-center justify-center font-black text-slate-300 text-[10px]">+ ADD</div>
                      </div>
                      <div className="h-12 bg-slate-900 rounded-xl"></div>
                   </div>
                   <div className="md:col-span-4 space-y-3">
                      <Annotation num={1} text="Job Header: Define Job ID (Auto-generated), Date, and Party Name." />
                      <Annotation num={2} text="Line Items: Add multiple sizes. Weights update Total Job Weight instantly." />
                      <Annotation num={3} text="Status Control: Move from Pending → Slitting → Completed." />
                      <Annotation num={4} text="WhatsApp Share: Generate PNG images of selected rows for direct sharing." />
                   </div>
                </div>
             </div>

             <div className="bg-slate-900 rounded-3xl p-8 text-white space-y-6">
                <h3 className="text-lg font-black uppercase tracking-widest flex items-center gap-2 text-indigo-400">
                    <Zap size={20}/> Status Intelligence
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                        <span className="text-[10px] font-black text-amber-400 uppercase">⚡ Slitting Pulse</span>
                        <p className="text-[11px] mt-1 text-slate-400">Jobs set to 'SLITTING' pulse visually on all dashboards to alert staff that production is live on the floor.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                        <span className="text-[10px] font-black text-emerald-400 uppercase">✓ Completion Lock</span>
                        <p className="text-[11px] mt-1 text-slate-400">Once marked 'COMPLETED', the job reflects in Admin Analytics. Operators can still edit for final adjustments until 'DISPATCHED'.</p>
                    </div>
                </div>
             </div>
          </div>
        </section>

        {/* SECTION 3: PLANNING & CALCULATORS */}
        <section className="space-y-8">
          <div className="flex items-center gap-3 border-b-4 border-slate-100 pb-4">
            <Calculator className="text-amber-500" size={32} />
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">3. Planning Intelligence</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-4">
                <p className="text-sm text-slate-600 leading-relaxed font-medium">
                   RDMS eliminates manual math. The **Planning Module** uses deterministic material density constants to predict output.
                </p>
                <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 space-y-4 shadow-sm">
                   <h4 className="text-xs font-black uppercase text-amber-700">Industrial Constant (ρ)</h4>
                   <code className="text-xs font-black block p-3 bg-white rounded-xl border border-amber-200">0.00280 (Standard Density)</code>
                   <p className="text-[10px] text-amber-900/60 font-bold">This constant accounts for PVC/Material density used in Weight-to-Meter conversions.</p>
                </div>
                <div className="bg-indigo-900 p-6 rounded-3xl text-white space-y-2">
                   <div className="flex items-center gap-2 text-indigo-400 font-black text-[10px] uppercase tracking-widest"><Info size={14}/> Auto-Correction</div>
                   <p className="text-[10px] leading-relaxed opacity-80">The system tracks 'Last Edited' field. If you change weight, meter updates. If you change pieces, weight updates to satisfy that order quantity.</p>
                </div>
             </div>

             <div className="bg-white border-2 border-slate-200 rounded-[2rem] p-6 shadow-xl space-y-4 relative">
                <div className="absolute top-4 right-4 bg-indigo-600 text-white rounded-lg p-2 shadow-lg"><Zap size={20}/></div>
                <h4 className="text-sm font-black text-slate-800">Digital Estimator</h4>
                <div className="space-y-3">
                   <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400">Weight</span>
                      <span className="text-xs font-bold text-slate-700 underline decoration-indigo-500 decoration-2">12.500 kg</span>
                   </div>
                   <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400">Calculated Meter</span>
                      <span className="text-xs font-bold text-indigo-600">4,280 MTRS</span>
                   </div>
                   <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400">Final Pcs</span>
                      <span className="text-xs font-bold text-emerald-600">8,500 PCS</span>
                   </div>
                </div>
                <div className="pt-2">
                    <Annotation num={5} text="Allowance: Round (15mm) or Seal (5mm) is auto-added to cutting size before PCS calculation." />
                </div>
             </div>
          </div>
        </section>

        {/* SECTION 4: PLANT QUEUE & MERGING */}
        <section className="space-y-8">
          <div className="flex items-center gap-3 border-b-4 border-slate-100 pb-4">
            <Factory className="text-indigo-600" size={32} />
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">4. Plant Master System</h2>
          </div>

          <div className="space-y-6">
             <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex flex-col md:flex-row gap-6 items-center">
                <div className="flex-1 space-y-3">
                   <h4 className="font-black text-indigo-700 uppercase tracking-widest text-xs">Intelligent Order Merging</h4>
                   <p className="text-xs font-medium text-indigo-900/60 leading-relaxed">
                      Select multiple orders from the **Order Queue** to combine them into one **Master Job Card**. 
                      This allows operators to run one large Tube (Sizer) and slit it into specific customer widths simultaneously.
                   </p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-xl border border-indigo-200 w-full max-w-xs space-y-2">
                   <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-400">Order 1: 250mm</span><CheckCircle size={14} className="text-indigo-500" /></div>
                   <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-400">Order 2: 250mm</span><CheckCircle size={14} className="text-indigo-500" /></div>
                   <button className="w-full bg-indigo-600 text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-widest">Merge & Card →</button>
                </div>
             </div>

             <div className="border-[3px] border-slate-900 rounded-[2.5rem] overflow-hidden bg-white shadow-2xl">
                <div className="bg-slate-900 p-4 text-center"><span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.5em]">Digital Job Card Features</span></div>
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                    <div className="p-6 space-y-4">
                       <h5 className="font-black uppercase text-xs text-indigo-600 underline">Phase 1: Combined Run</h5>
                       <p className="text-[11px] text-slate-500 leading-relaxed">The system calculates the exact meterage where the smallest order is satisfied. Operators are instructed to stop and switch at this specific point.</p>
                       <div className="p-3 bg-slate-50 rounded-xl border-l-4 border-indigo-500 text-xs font-mono">Run Length: 1,250 m</div>
                    </div>
                    <div className="p-6 space-y-4">
                       <h5 className="font-black uppercase text-xs text-emerald-600 underline">Multi-Up Guide</h5>
                       <p className="text-[11px] text-slate-500 leading-relaxed">When orders require complex slitting, the system suggests 'Re-slitting' (Multi-up) where one wide strip is produced and later cut into two smaller ones.</p>
                       <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-[10px] font-bold text-emerald-700 uppercase">Suggest Re-Slit Mode: ON</div>
                    </div>
                </div>
             </div>
          </div>
        </section>

        {/* SECTION 5: CHEMICAL MANAGEMENT */}
        <section className="space-y-8">
          <div className="flex items-center gap-3 border-b-4 border-slate-100 pb-4">
            <Beaker className="text-teal-600" size={32} />
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">5. Chemical Division</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
             <div className="space-y-6">
                <div className="space-y-2">
                   <h4 className="font-black text-slate-800 text-sm">Real-time Stock Depletion</h4>
                   <p className="text-xs text-slate-500 leading-relaxed">Consumption logs entered by operators instantly subtract from the master inventory levels managed by Admin.</p>
                </div>
                <div className="space-y-4">
                   {[
                       { label: 'DOP (Main)', val: 85, color: 'bg-emerald-500' },
                       { label: 'Stabilizer', val: 35, color: 'bg-amber-500' },
                       { label: 'Epoxy', val: 12, color: 'bg-red-500' }
                   ].map((item, i) => (
                       <div key={i} className="space-y-1">
                          <div className="flex justify-between text-[10px] font-black uppercase text-slate-400"><span>{item.label}</span><span>{item.val}%</span></div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`${item.color} h-full`} style={{width: `${item.val}%`}}></div></div>
                       </div>
                   ))}
                </div>
             </div>
             <div className="bg-slate-900 p-8 rounded-[2rem] text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none text-9xl font-black -rotate-12">INVENTORY</div>
                <h4 className="text-xs font-black uppercase tracking-widest text-teal-400 mb-4">Stock Thresholds</h4>
                <ul className="space-y-3 text-[11px] font-bold text-slate-300">
                    <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span> CRITICAL: Below 100 kg</li>
                    <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500"></span> LOW: Below 200 kg</li>
                    <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> OPTIMAL: Above 300 kg</li>
                </ul>
                <div className="mt-6 pt-6 border-t border-white/10">
                   <p className="text-[10px] italic opacity-60">Admin must use the 'Purchase Entry' tab to restore stock levels after buying from vendors.</p>
                </div>
             </div>
          </div>
        </section>

        {/* SECTION 6: DATA DICTIONARY */}
        <section className="space-y-8">
          <div className="flex items-center gap-3 border-b-4 border-slate-100 pb-4">
            <Database className="text-indigo-600" size={32} />
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">6. Data & Definitions</h2>
          </div>

          <div className="overflow-hidden border border-slate-200 rounded-3xl">
             <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-widest font-black">
                   <tr><th className="p-5">Object</th><th className="p-5">Primary ID</th><th className="p-5">Critical Data Points</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   <tr>
                      <td className="p-5 font-black text-indigo-600">Party</td>
                      <td className="p-5 font-mono text-slate-400">REL/XXX</td>
                      <td className="p-5 text-slate-500">Customer Name, Billing Code, Balance Tracking.</td>
                   </tr>
                   <tr>
                      <td className="p-5 font-black text-indigo-600">Dispatch</td>
                      <td className="p-5 font-mono text-slate-400">#1001...</td>
                      <td className="p-5 text-slate-500">Job No, Date, Rows(Size, Wt, Pcs, Box), Status.</td>
                   </tr>
                   <tr>
                      <td className="p-5 font-black text-indigo-600">Challan</td>
                      <td className="p-5 font-mono text-slate-400">#C-101...</td>
                      <td className="p-5 text-slate-500">Bill No, Rate, Amount, Total Weight, Payment Mode.</td>
                   </tr>
                   <tr>
                      <td className="p-5 font-black text-indigo-600">Slitting Log</td>
                      <td className="p-5 font-mono text-slate-400">SR 1, 2...</td>
                      <td className="p-5 text-slate-500">Gross Wt, Core Wt, Net Wt, Computed Meterage.</td>
                   </tr>
                </tbody>
             </table>
          </div>
        </section>

        {/* SECTION 7: SYNC & CLOUD */}
        <section className="space-y-8">
          <div className="flex items-center gap-3 border-b-4 border-slate-100 pb-4">
            <Cloud className="text-slate-600" size={32} />
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">7. Maintenance & Backup</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 space-y-4">
                  <h4 className="font-black text-slate-800 text-sm flex items-center gap-2"><Settings size={18}/> Configuration</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                     The system mirrors all data to a Google Sheet. Ensure the **Apps Script URL** is saved in the Admin Dashboard.
                  </p>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 text-[10px] font-mono text-indigo-600 break-all">
                     https://script.google.com/macros/s/.../exec
                  </div>
              </div>
              <div className="bg-indigo-600 p-8 rounded-3xl text-white space-y-4 shadow-xl">
                  <h4 className="font-black text-indigo-100 text-sm flex items-center gap-2"><Download size={18}/> Recovery Protocol</h4>
                  <div className="space-y-3">
                     <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-black mt-0.5">1</div>
                        <p className="text-[11px] opacity-90 italic">Export daily backups as .JSON files to local storage.</p>
                     </div>
                     <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-black mt-0.5">2</div>
                        <p className="text-[11px] opacity-90 italic">Use 'Restore' to upload a JSON backup if data is accidentally deleted.</p>
                     </div>
                  </div>
                  <div className="pt-2">
                     <div className="bg-amber-400 text-slate-900 p-3 rounded-xl flex items-center gap-3">
                        <AlertTriangle size={24} className="flex-shrink-0" />
                        <p className="text-[9px] font-black uppercase leading-tight">WARNING: Restore action overwrites the live database. Use with caution.</p>
                     </div>
                  </div>
              </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="pt-20 border-t border-slate-100 text-center space-y-4">
          <div className="flex justify-center items-center gap-12 opacity-30 grayscale contrast-125">
             <Factory size={48} /> <Truck size={48} /> <Layers size={48} />
          </div>
          <div className="space-y-1">
             <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em]">RDMS Industrial Support System • 2025</p>
             <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Designed for high-precision manufacturing & logistics</p>
          </div>
        </footer>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4; margin: 1.5cm; }
          body { background: white !important; -webkit-print-color-adjust: exact; color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .animate-in { animation: none !important; }
          .shadow-sm, .shadow-md, .shadow-lg, .shadow-xl, .shadow-2xl { box-shadow: none !important; }
          .rounded-2xl, .rounded-3xl, .rounded-\\[2\\.5rem\\] { border-radius: 0.5rem !important; }
          .border-slate-200 { border-color: #eee !important; }
          section { page-break-inside: avoid; }
          h2 { color: #1e293b !important; }
          .bg-indigo-600 { background-color: #4f46e5 !important; }
          .bg-slate-900 { background-color: #0f172a !important; }
        }
        .animate-spin-slow { animation: spin 3s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};
