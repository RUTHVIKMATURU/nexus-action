import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './views/Dashboard';
import { Login } from './views/Login';
import { Signup } from './views/Signup';
import { AuthProvider, useAuth } from './context/AuthContext';
import './App.css';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#111216]">
        <div className="w-8 h-8 border-4 border-[#aa3bff]/20 border-t-[#aa3bff] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const DashboardLayout: React.FC = () => {
  const { signOut } = useAuth();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#111216]">
      <header className="py-4 px-6 bg-white dark:bg-[#16171d] border-b border-gray-200 dark:border-[#2e303a]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black tracking-wider text-gray-900 dark:text-white uppercase">
              Nexus<span className="text-[#aa3bff]">Action</span>
            </span>
            <span className="text-[10px] bg-[#aa3bff]/10 text-[#aa3bff] dark:text-[#c084fc] px-2 py-0.5 rounded-full font-bold uppercase hidden sm:inline-block">
              Orchestration Hub
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline-block">
              Admin Control Panel
            </span>
            <button
              onClick={signOut}
              className="text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        <Dashboard />
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
