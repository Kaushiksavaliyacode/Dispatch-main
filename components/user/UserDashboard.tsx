
import React, { useState } from 'react';
import { AppData } from '../../types';
import { DispatchManager } from './DispatchManager';
import { ChallanManager } from './ChallanManager';
import { SlittingManager } from '../admin/SlittingManager'; 
import { ProductionPlanner } from '../admin/ProductionPlanner';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const UserDashboard: React.FC<Props> = ({ data, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'bill' | 'job' | 'slitting' | 'planning'>('bill');

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Modern Segmented Control */}
      <div className="flex justify-center mb-8">
        <div className="glass p-1.5 rounded-2xl flex gap-1 shadow-sm w-full max-w-2xl">
          <button
            onClick={() => setActiveTab('bill')}
            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all duration-300 ${
              activeTab === 'bill'
                ? 'bg-slate-800 text-white shadow-lg shadow-slate-200'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <span className="text-lg">🧾</span>
            <span className="hidden sm:inline">Bill Entry</span>
            <span className="sm:hidden">Bills</span>
          </button>
          <button
            onClick={() => setActiveTab('job')}
            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all duration-300 ${
              activeTab === 'job'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <span className="text-lg">🚛</span>
            <span className="hidden sm:inline">Job Entry</span>
            <span className="sm:hidden">Jobs</span>
          </button>
          <button
            onClick={() => setActiveTab('slitting')}
            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all duration-300 ${
              activeTab === 'slitting'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-200'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <span className="text-lg">🏭</span>
            <span className="hidden sm:inline">Slitting</span>
            <span className="sm:hidden">Slitting</span>
          </button>
          <button
            onClick={() => setActiveTab('planning')}
            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all duration-300 ${
              activeTab === 'planning'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-200'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <span className="text-lg">📋</span>
            <span className="hidden sm:inline">Plan</span>
            <span className="sm:hidden">Plan</span>
          </button>
        </div>
      </div>

      {/* Content Area with Fade In */}
      <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
        {activeTab === 'bill' ? (
          <ChallanManager data={data} onUpdate={onUpdate} />
        ) : activeTab === 'job' ? (
          <DispatchManager data={data} onUpdate={onUpdate} />
        ) : activeTab === 'slitting' ? (
          <SlittingManager data={data} />
        ) : (
          <ProductionPlanner data={data} isUserView={true} />
        )}
      </div>
    </div>
  );
};
