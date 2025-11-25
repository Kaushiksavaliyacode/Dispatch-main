import React, { useState } from 'react';
import { AppData } from '../../types';
import { DispatchManager } from './DispatchManager';
import { ChallanManager } from './ChallanManager';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const UserDashboard: React.FC<Props> = ({ data, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'bill' | 'job'>('bill');

  return (
    <div className="space-y-6 pb-20">
      {/* Huge Top Navigation Cards */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setActiveTab('bill')}
          className={`relative overflow-hidden rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all duration-200 border-2 ${
            activeTab === 'bill'
              ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-[1.02]'
              : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
          }`}
        >
          <div className={`p-3 rounded-xl ${activeTab === 'bill' ? 'bg-white/20' : 'bg-slate-100'}`}>
             <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-lg font-black tracking-wider uppercase">Bill Entry</span>
          {activeTab === 'bill' && <div className="absolute bottom-0 left-0 w-full h-1.5 bg-red-500"></div>}
        </button>

        <button
          onClick={() => setActiveTab('job')}
          className={`relative overflow-hidden rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all duration-200 border-2 ${
            activeTab === 'job'
              ? 'bg-blue-600 border-blue-600 text-white shadow-xl scale-[1.02]'
              : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
          }`}
        >
          <div className={`p-3 rounded-xl ${activeTab === 'job' ? 'bg-white/20' : 'bg-slate-100'}`}>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-lg font-black tracking-wider uppercase">Job Entry</span>
          {activeTab === 'job' && <div className="absolute bottom-0 left-0 w-full h-1.5 bg-yellow-400"></div>}
        </button>
      </div>

      {/* Content Area */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        {activeTab === 'bill' ? (
          <ChallanManager data={data} onUpdate={onUpdate} />
        ) : (
          <DispatchManager data={data} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );
};