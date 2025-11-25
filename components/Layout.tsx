import React from 'react';
import { Role } from '../types';

interface LayoutProps {
  currentRole: Role;
  setRole: (role: Role) => void;
  currentView: string;
  setView: (view: string) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentRole, setRole, currentView, setView, children }) => {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F1F5F9]">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col shadow-sm z-20">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">RDMS</h1>
            <p className="text-[10px] font-bold text-slate-400 tracking-wider">PRODUCTION</p>
          </div>
        </div>

        <div className="p-4 flex-1">
           <div className="mb-6">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3 mb-2 block">Switch Role</span>
              <button 
                onClick={() => setRole(currentRole === Role.ADMIN ? Role.USER : Role.ADMIN)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-bold transition-all ${currentRole === Role.ADMIN ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
              >
                <span>{currentRole}</span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-[10px]">⇄</span>
              </button>
           </div>

           <nav className="space-y-1">
              {currentRole === Role.ADMIN ? (
                <>
                  <NavButton active={currentView === 'dashboard'} onClick={() => setView('dashboard')} icon="📊" label="Dashboard" />
                  <NavButton active={currentView === 'reports'} onClick={() => setView('reports')} icon="📑" label="Reports" />
                </>
              ) : (
                <>
                  {/* User Nav is now handled in dashboard, but sidebar can remain for desktop structure if needed */}
                  <div className="px-3 py-2 text-sm text-slate-400">User Dashboard Active</div>
                </>
              )}
           </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 shadow-sm z-30 sticky top-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-none">RDMS</h1>
              <p className="text-[9px] text-slate-500 font-bold tracking-widest">PRODUCTION</p>
            </div>
          </div>
          <button 
            onClick={() => setRole(currentRole === Role.ADMIN ? Role.USER : Role.ADMIN)}
            className="px-3 py-1.5 bg-slate-100 rounded-full text-xs font-bold text-slate-600"
          >
            {currentRole}
          </button>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
        
        {/* Mobile Bottom Nav (Only for Admin now, as User has top tabs) */}
        {currentRole === Role.ADMIN && (
          <div className="md:hidden bg-white border-t border-slate-200 px-6 py-3 flex justify-around items-center safe-area-bottom z-30">
             <MobileNavBtn active={currentView === 'dashboard'} onClick={() => setView('dashboard')} icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} label="Dash" />
             <MobileNavBtn active={currentView === 'reports'} onClick={() => setView('reports')} icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} label="Report" />
          </div>
        )}
      </main>
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all font-medium ${
      active ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
    }`}
  >
    <span className="text-lg">{icon}</span>
    <span>{label}</span>
  </button>
);

const MobileNavBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center space-y-1 ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
    {icon}
    <span className="text-[10px] font-bold uppercase">{label}</span>
  </button>
)