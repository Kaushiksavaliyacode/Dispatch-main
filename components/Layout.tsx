import React from 'react';
import { Role } from '../types';

interface LayoutProps {
  currentRole: Role;
  setRole: (role: Role) => void;
  currentView: string;
  setView: (view: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentRole, setRole, currentView, setView, onLogout, children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* Unified Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-indigo-200 shadow-md">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </div>
            <div className="flex flex-col">
              <h1 className="text-base font-bold text-slate-800 leading-none tracking-tight">RDMS</h1>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Production</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
             {currentRole === Role.ADMIN && (
               <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-lg mr-2">
                 <button 
                   onClick={() => setView('dashboard')}
                   className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${currentView === 'dashboard' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   Dashboard
                 </button>
               </nav>
             )}
             
             <div className="flex items-center gap-2 pl-3 border-l border-slate-100">
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Logged in as</div>
                  <div className="text-xs font-bold text-slate-800 uppercase">{currentRole}</div>
                </div>
                <button 
                  onClick={onLogout}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  title="Logout"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
             </div>
          </div>
        </div>
      </header>

      {/* Main Content Area - Centered & Compact */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
};