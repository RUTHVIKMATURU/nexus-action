import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet } from 'react-router-dom';
import { Dashboard } from './views/Dashboard';
import { Sandbox } from './views/Sandbox';
import { Login } from './views/Login';
import { Signup } from './views/Signup';
import { AuthProvider, useAuth } from './context/AuthContext';
import './App.css';

// ---------------------------------------------------------------------------
// Protected Route Guard
// ---------------------------------------------------------------------------

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0b0f]">
        <div className="w-8 h-8 border-4 border-[#aa3bff]/20 border-t-[#aa3bff] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// ---------------------------------------------------------------------------
// Top-Level Navigation Header
// ---------------------------------------------------------------------------

const NavHeader: React.FC = () => {
  const { signOut } = useAuth();

  const linkBase =
    'relative px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 focus:outline-none';
  const linkActive =
    'bg-[#aa3bff]/15 text-[#c084fc] shadow-inner';
  const linkInactive =
    'text-gray-500 hover:text-gray-300 hover:bg-[#1e2030]/50';

  return (
    <header className="py-3.5 px-6 bg-[#0d0e14] border-b border-[#1e2030]">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between">
        {/* Left: Brand + Navigation */}
        <div className="flex items-center gap-5">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2.5 group">
            <span className="text-xl font-black tracking-wider text-white uppercase">
              Nexus<span className="text-[#aa3bff]">Action</span>
            </span>
            <span className="text-[9px] bg-[#aa3bff]/10 text-[#c084fc] px-2 py-0.5 rounded-full font-bold uppercase hidden sm:inline-block">
              Sales Command Center
            </span>
          </NavLink>

          {/* Divider */}
          <div className="hidden sm:block w-px h-5 bg-[#1e2030]" />

          {/* Nav Links */}
          <nav className="flex items-center gap-1.5">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkInactive}`
              }
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Dashboard
              </span>
            </NavLink>
            <NavLink
              to="/sandbox"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkInactive}`
              }
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Sandbox
              </span>
            </NavLink>
          </nav>
        </div>

        {/* Right: Status + Sign Out */}
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-gray-600 hidden sm:inline-block uppercase tracking-wider font-medium">
            Enterprise Control Panel
          </span>
          <div className="w-px h-4 bg-[#1e2030] hidden sm:block" />
          <button
            onClick={signOut}
            className="text-xs font-semibold text-gray-500 hover:text-red-400 transition-colors focus:outline-none"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
};

// ---------------------------------------------------------------------------
// Authenticated App Shell (shared header + routed content via Outlet)
// ---------------------------------------------------------------------------

const AppShell: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-[#0a0b0f]">
      <NavHeader />
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Root App
// ---------------------------------------------------------------------------

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected routes with shared nav shell */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/sandbox" element={<Sandbox />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
