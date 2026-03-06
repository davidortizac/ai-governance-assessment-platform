import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const NAV_ALL = [
    { path: '/',            label: 'Dashboard',    icon: '📊', roles: ['ADMIN','CONSULTANT','CLIENT'] },
    { path: '/clients',     label: 'Clientes',     icon: '🏢', roles: ['ADMIN','CONSULTANT'] },
    { path: '/assessments', label: 'Evaluaciones', icon: '📋', roles: ['ADMIN','CONSULTANT','CLIENT'] },
    { path: '/compare',     label: 'Comparar',     icon: '🔄', roles: ['ADMIN','CONSULTANT'] },
    { path: '/analytics',   label: 'Analítica',    icon: '📈', roles: ['ADMIN','CONSULTANT'] },
    { path: '/admin',       label: 'Panel Admin',  icon: '🗄️', roles: ['ADMIN'] },
];

export default function Layout() {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navItems = NAV_ALL.filter(item => item.roles.includes(user?.role ?? ''));
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isDark = theme === 'dark';

    return (
        <div className="min-h-screen flex" style={{ background: 'var(--bg-page)' }}>
            {/* Mobile overlay */}
            {sidebarOpen && (
                <button
                    type="button"
                    aria-label="Cerrar menú"
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden w-full"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 backdrop-blur-xl flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
                style={{
                    background: 'var(--bg-sidebar)',
                    borderRight: '1px solid var(--sidebar-border)',
                }}
            >
                {/* Logo */}
                <div className="p-5" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
                    <div className="flex items-center gap-3">
                        <img
                            src="/logo-gamma.png"
                            alt="Gamma Ingenieros"
                            className={`h-16 ${isDark ? 'brightness-0 invert' : ''}`}
                        />
                    </div>
                    <p className="text-[10px] text-primary-400 mt-2 uppercase tracking-widest font-medium">Assessment Platform</p>
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
                                    ? 'bg-primary-500/10 text-primary-500 border border-primary-500/20 shadow-sm'
                                    : 'hover:bg-primary-500/5'
                                }
                            `}
                            style={({ isActive }) => isActive ? {} : { color: 'var(--text-nav)' }}
                        >
                            <span className="text-base">{item.icon}</span>
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Theme toggle */}
                <div className="px-4 pb-2">
                    <button
                        onClick={toggleTheme}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-primary-500/5"
                        style={{ color: 'var(--text-muted)' }}
                        title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                    >
                        <span className="text-base">{isDark ? '🌞' : '🌙'}</span>
                        <span>{isDark ? 'Modo claro' : 'Modo oscuro'}</span>
                    </button>
                </div>

                {/* User section */}
                <div className="p-4" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
                    <div className="glass-card p-3">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-600 to-accent-violet flex items-center justify-center text-white font-semibold text-sm">
                                {user?.name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-base)' }}>{user?.name}</p>
                                <p className="text-xs text-primary-400/70 truncate">{user?.role}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="mt-3 w-full text-xs transition-colors py-1.5 rounded border hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5"
                            style={{ color: 'var(--text-muted)', borderColor: 'var(--sidebar-border)' }}
                        >
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-h-screen">
                {/* Top bar */}
                <header
                    className="sticky top-0 z-30 backdrop-blur-xl px-6 py-4"
                    style={{
                        background: 'var(--bg-header)',
                        borderBottom: '1px solid var(--sidebar-border)',
                    }}
                >
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-1 transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <div className="hidden lg:block">
                            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-base)' }}>
                                Gamma Ingenieros — AI Governance
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
