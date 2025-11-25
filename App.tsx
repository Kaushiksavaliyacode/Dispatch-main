import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Layout } from './components/Layout';
import { UserDashboard } from './components/user/UserDashboard';
import { Dashboard } from './components/admin/Dashboard';
import { PartyReport } from './components/admin/PartyReport';
import { getAppData, saveAppData } from './services/storageService';
import { Role, AppData } from './types';

const App: React.FC = () => {
  const [role, setRole] = useState<Role>(Role.ADMIN);
  const [view, setView] = useState<string>('dashboard');
  const [data, setData] = useState<AppData>({ parties: [], dispatches: [], challans: [] });

  useEffect(() => {
    // Load data from local storage service
    const loadedData = getAppData();
    setData(loadedData);
  }, []);

  const handleDataUpdate = (newData: AppData) => {
    setData(newData);
  };

  // Role-View Switching Logic
  useEffect(() => {
    if (role === Role.ADMIN && !['dashboard', 'reports'].includes(view)) {
      setView('dashboard');
    } else if (role === Role.USER) {
      // User role now handled by single dashboard component with internal state
      setView('dashboard'); 
    }
  }, [role]);

  return (
    <Layout currentRole={role} setRole={setRole} currentView={view} setView={setView}>
      {role === Role.ADMIN && view === 'dashboard' && <Dashboard data={data} />}
      {role === Role.ADMIN && view === 'reports' && <PartyReport data={data} />}
      
      {role === Role.USER && <UserDashboard data={data} onUpdate={handleDataUpdate} />}
    </Layout>
  );
};

export default App;