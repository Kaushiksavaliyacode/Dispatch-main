import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { UserDashboard } from './components/user/UserDashboard';
import { Dashboard } from './components/admin/Dashboard';
import { subscribeToData } from './services/storageService';
import { Role, AppData } from './types';

const App: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authId, setAuthId] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // App State
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (authId === 'admin' && authPass === 'Admin.123') {
      setRole(Role.ADMIN);
      setIsAuthenticated(true);
      setLoginError('');
    } else if (authId === 'user' && authPass === 'User.123') {
      setRole(Role.USER);
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Invalid ID or Password');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthId('');
    setAuthPass('');
    setRole(Role.ADMIN); // Default reset
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-['Plus_Jakarta_Sans']">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 border border-slate-200">
           <div className="flex flex-col items-center mb-8">
             <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-indigo-200">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
             </div>
             <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">RDMS Login</h1>
             <p className="text-slate-500 font-medium text-sm">Production Management System</p>
           </div>
           
           <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">User ID</label>
                <input 
                  type="text" 
                  value={authId}
                  onChange={e => setAuthId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-semibold text-slate-800 outline-none focus:border-indigo-500 transition-colors"
                  placeholder="Enter ID"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Password</label>
                <input 
                  type="password" 
                  value={authPass}
                  onChange={e => setAuthPass(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-semibold text-slate-800 outline-none focus:border-indigo-500 transition-colors"
                  placeholder="Enter Password"
                />
              </div>
              
              {loginError && <p className="text-red-500 text-xs font-bold text-center">{loginError}</p>}

              <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/30 transition-all active:scale-[0.98]">
                Secure Login
              </button>
           </form>
           <div className="mt-6 text-center text-[10px] text-slate-400">
             Authorized Personnel Only
           </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-indigo-200 rounded-full mb-4"></div>
          <div className="text-slate-400 font-bold text-sm">Loading Live Data...</div>
        </div>
      </div>
    );
  }

  return (
    <Layout currentRole={role} setRole={setRole} currentView={view} setView={setView} onLogout={handleLogout}>
      {role === Role.ADMIN && <Dashboard data={data} />}
      {role === Role.USER && <UserDashboard data={data} onUpdate={() => {}} />}
    </Layout>
  );
};

export default App;