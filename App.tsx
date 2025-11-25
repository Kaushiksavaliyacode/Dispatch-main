import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Layout } from './components/Layout';
import { UserDashboard } from './components/user/UserDashboard';
import { Dashboard } from './components/admin/Dashboard';
import { PartyReport } from './components/admin/PartyReport';
import { subscribeToData } from './services/storageService';
import { Role, AppData } from './types';

const App: React.FC = () => {
  const [role, setRole] = useState<Role>(Role.ADMIN);
  const [view, setView] = useState<string>('dashboard');
  const [data, setData] = useState<AppData>({ parties: [], dispatches: [], challans: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Connect to Firebase Realtime Listeners
    const unsubscribe = subscribeToData((newData) => {
      setData(newData);
      setLoading(false);
    });

    // Cleanup on unmount
    return () => unsubscribe();
  }, []);

  // Update handler not strictly needed for parents anymore as 
  // subscription handles it, but kept for prop compatibility
  const handleDataUpdate = (newData: AppData) => {
    // Optimistic update if needed, but Firestore listener usually fast enough
  };

  // Role-View Switching Logic
  useEffect(() => {
    if (role === Role.ADMIN && !['dashboard', 'reports'].includes(view)) {
      setView('dashboard');
    } else if (role === Role.USER) {
      setView('dashboard'); 
    }
  }, [role]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-indigo-200 rounded-full mb-4"></div>
          <div className="text-slate-400 font-bold text-sm">Loading Data from Cloud...</div>
          <div className="text-[10px] text-red-400 mt-2 max-w-xs text-center">
             If stuck: Check services/firebaseConfig.ts and ensure you added your API Keys.
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout currentRole={role} setRole={setRole} currentView={view} setView={setView}>
      {role === Role.ADMIN && view === 'dashboard' && <Dashboard data={data} />}
      {role === Role.ADMIN && view === 'reports' && <PartyReport data={data} />}
      
      {role === Role.USER && <UserDashboard data={data} onUpdate={handleDataUpdate} />}
    </Layout>
  );
};

export default App;