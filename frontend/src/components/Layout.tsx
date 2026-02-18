import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/clients', label: 'Clientes', icon: '🏢' },
    { path: '/assessments', label: 'Evaluaciones', icon: '📋' },
    { path: '/compare', label: 'Comparar', icon: '🔄' },
];

export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen flex bg-surface-950">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-surface-900/95 backdrop-blur-xl
        border-r border-surface-800/80 flex flex-col transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
                {/* Logo */}
                <div className="p-6 border-b border-surface-800/80">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-cyan flex items-center justify-center text-white font-bold text-lg">
                            AI
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-surface-100 leading-tight">AI Governance</h1>
                            <p className="text-[10px] text-surface-500 uppercase tracking-wider">Security Assessment</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/'}
                            onClick={() => setSidebarOpen(false)}
                            className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                ${isActive
                                    ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20 shadow-sm'
                                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50'
                                }
              `}
                        >
                            <span className="text-base">{item.icon}</span>
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* User section */}
                <div className="p-4 border-t border-surface-800/80">
                    <div className="glass-card p-3">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-600 to-accent-violet flex items-center justify-center text-white font-semibold text-sm">
                                {user?.name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-surface-200 truncate">{user?.name}</p>
                                <p className="text-xs text-surface-500 truncate">{user?.role}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="mt-3 w-full text-xs text-surface-500 hover:text-red-400 transition-colors py-1.5 rounded border border-surface-700/50 hover:border-red-500/30 hover:bg-red-500/5"
                        >
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-h-screen">
                {/* Top bar */}
                <header className="sticky top-0 z-30 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/50 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden text-surface-400 hover:text-surface-200 p-1"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <div className="hidden lg:block">
                            <h2 className="text-lg font-semibold text-surface-200">
                                AI Governance & Security Assessment
                            </h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <NavLink
                                to="/assessments/new"
                                className="btn-primary text-sm flex items-center gap-2"
                            >
                                <span>+</span>
                                <span className="hidden sm:inline">Nueva Evaluación</span>
                            </NavLink>
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
