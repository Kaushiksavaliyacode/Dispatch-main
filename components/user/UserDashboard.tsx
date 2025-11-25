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
    <div className="space-y-4">
      {/* Compact Top Navigation */}
      <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm flex gap-1">
        <button
          onClick={() => setActiveTab('bill')}
          className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-bold uppercase transition-all ${
            activeTab === 'bill'
              ? 'bg-slate-800 text-white shadow-md'
              : 'text-slate-400 hover:bg-slate-50'
          }`}
        >
          <span>🧾 Bill Entry</span>
        </button>
        <button
          onClick={() => setActiveTab('job')}
          className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-bold uppercase transition-all ${
            activeTab === 'job'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:bg-slate-50'
          }`}
        >
          <span>🚛 Job Entry</span>
        </button>
      </div>

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