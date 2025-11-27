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
    <div className="min-h-screen flex flex-col bg-[#F1F5F9]">
      {/* Professional Enterprise Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo Section */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-200 ring-2 ring-indigo-50">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </div>
            <div className="flex flex-col justify-center">
              <h1 className="text-lg font-bold text-slate-800 leading-none tracking-tight">RDMS</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Production</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-4">
             {currentRole === Role.ADMIN && (
               <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                 <button 
                   onClick={() => setView('dashboard')}
                   className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${currentView === 'dashboard' ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   Dashboard
                 </button>
               </nav>
             )}
             
             <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Logged in as</div>
                  <div className="text-xs font-bold text-slate-800 uppercase bg-slate-100 px-2 py-0.5 rounded mt-0.5 inline-block">{currentRole}</div>
                </div>
                <button 
                  onClick={onLogout}
                  className="group p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all duration-200 border border-transparent hover:border-red-100"
                  title="Logout"
                >
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
             </div>
          </div>
        </div>
      </header>

      {/* Main Content Area - Full Width for Desktop */}
      <main className="flex-1 overflow-x-hidden">
        <div className="max-w-[1920px] mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};