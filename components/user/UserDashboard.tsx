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
    <div className="space-y-4 pb-20">
      {/* Compact Top Navigation */}
      <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200">
        <button
          onClick={() => setActiveTab('bill')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all ${
            activeTab === 'bill'
              ? 'bg-slate-800 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Bill Entry
        </button>
        <button
          onClick={() => setActiveTab('job')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all ${
            activeTab === 'job'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Job Entry
        </button>
      </div>

      {/* Content Area */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'bill' ? (
          <ChallanManager data={data} onUpdate={onUpdate} />
        ) : (
          <DispatchManager data={data} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );
};