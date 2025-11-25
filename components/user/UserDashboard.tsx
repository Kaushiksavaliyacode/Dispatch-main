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
    <div className="space-y-6">
      {/* Top Toggle Navigation Cards */}
      <div className="flex gap-0 bg-white rounded-xl shadow-sm border border-slate-200 p-1">
        <button
          onClick={() => setActiveTab('bill')}
          className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-bold text-sm transition-all duration-200 ${
            activeTab === 'bill'
              ? 'bg-[#1E293B] text-white shadow-md' // Dark Slate for Bill
              : 'bg-transparent text-slate-500 hover:bg-slate-50'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Bill Entry
        </button>
        <button
          onClick={() => setActiveTab('job')}
          className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-bold text-sm transition-all duration-200 ${
            activeTab === 'job'
              ? 'bg-[#2563EB] text-white shadow-md' // Bright Blue for Job
              : 'bg-transparent text-slate-500 hover:bg-slate-50'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Job Entry
        </button>
      </div>

      {/* Content Area */}
      <div className="animate-in fade-in zoom-in-95 duration-200">
        {activeTab === 'bill' ? (
          <ChallanManager data={data} onUpdate={onUpdate} />
        ) : (
          <DispatchManager data={data} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );
};