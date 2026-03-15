import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/api';

// --- Outline SVG Icons ---
function IconDashboard() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-[1.1em] h-[1.1em]">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
    );
}
function IconClients() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-[1.1em] h-[1.1em]">
            <path d="M3 21h18M9 21V7l6-4v18M9 12h6" />
        </svg>
    );
}
function IconAssessments() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-[1.1em] h-[1.1em]">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <path d="M9 12h6M9 16h4" />
        </svg>
    );
}
function IconCompare() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-[1.1em] h-[1.1em]">
            <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
        </svg>
    );
}
function IconAnalytics() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-[1.1em] h-[1.1em]">
            <path d="M4 20h16M4 20V14M8 20V10M12 20V6M16 20V12M20 20V16" />
        </svg>
    );
}
function IconAdmin() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-[1.1em] h-[1.1em]">
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
    );
}
function IconSun() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-[1.1em] h-[1.1em]">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
    );
}
function IconMoon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-[1.1em] h-[1.1em]">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
    );
}
function IconChevronLeft() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M15 18l-6-6 6-6" />
        </svg>
    );
}
function IconChevronRight() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M9 18l6-6-6-6" />
        </svg>
    );
}
function IconUser() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-[1em] h-[1em]">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    );
}
function IconLogout() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-[1em] h-[1em]">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
    );
}
function IconEdit() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-[1em] h-[1em]">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
    );
}
function IconClose() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M18 6L6 18M6 6l12 12" />
        </svg>
    );
}
function IconTrash() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-[1em] h-[1em]">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
        </svg>
    );
}

// --- Nav items ---
const NAV_ALL = [
    { path: '/',            label: 'Dashboard',    icon: <IconDashboard />,   roles: ['ADMIN', 'CONSULTANT', 'CLIENT'] },
    { path: '/clients',     label: 'Clientes',     icon: <IconClients />,     roles: ['ADMIN', 'CONSULTANT', 'CLIENT'] },
    { path: '/assessments', label: 'Evaluaciones', icon: <IconAssessments />, roles: ['ADMIN', 'CONSULTANT', 'CLIENT'] },
    { path: '/compare',     label: 'Comparar',     icon: <IconCompare />,     roles: ['ADMIN', 'CONSULTANT'] },
    { path: '/analytics',   label: 'Analítica',    icon: <IconAnalytics />,   roles: ['ADMIN', 'CONSULTANT'] },
    { path: '/admin',       label: 'Panel Admin',  icon: <IconAdmin />,       roles: ['ADMIN'] },
];

interface AppUser {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
}

export default function Layout() {
    const { user, logout, updateProfile } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navItems = NAV_ALL.filter(item => item.roles.includes(user?.role ?? ''));
    const navigate = useNavigate();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
    const [showProfile, setShowProfile] = useState(false);

    // Profile edit state
    const [editName, setEditName] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState('');

    // Admin user list
    const [users, setUsers] = useState<AppUser[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    const isDark = theme === 'dark';

    const toggleCollapse = () => {
        setCollapsed(prev => {
            const next = !prev;
            localStorage.setItem('sidebarCollapsed', String(next));
            return next;
        });
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const openProfile = () => {
        setEditName(user?.name ?? '');
        setCurrentPassword('');
        setNewPassword('');
        setSaveError('');
        setSaveSuccess('');
        if (user?.role === 'ADMIN') {
            setLoadingUsers(true);
            api.get('/auth/users')
                .then(res => setUsers(res.data))
                .catch(() => setUsers([]))
                .finally(() => setLoadingUsers(false));
        }
        setShowProfile(true);
    };

    const handleSaveProfile = async () => {
        setSaving(true);
        setSaveError('');
        setSaveSuccess('');
        try {
            const data: { name?: string; currentPassword?: string; newPassword?: string } = {};
            if (editName.trim() && editName.trim() !== user?.name) data.name = editName.trim();
            if (newPassword) {
                data.currentPassword = currentPassword;
                data.newPassword = newPassword;
            }
            if (Object.keys(data).length === 0) {
                setSaveError('No hay cambios para guardar.');
                setSaving(false);
                return;
            }
            await updateProfile(data);
            setSaveSuccess('Perfil actualizado correctamente.');
            setCurrentPassword('');
            setNewPassword('');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            setSaveError(msg ?? 'Error al guardar cambios.');
        }
        setSaving(false);
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return;
        try {
            await api.delete(`/auth/users/${userId}`);
            setUsers(prev => prev.filter(u => u.id !== userId));
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            alert(msg ?? 'Error al eliminar usuario.');
        }
    };

    const inputStyle: React.CSSProperties = {
        background: 'var(--bg-page)',
        borderColor: 'var(--sidebar-border)',
        color: 'var(--text-base)',
    };

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
                className={`fixed lg:sticky top-0 left-0 z-50 h-screen flex flex-col transition-all duration-300 ${
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                } ${collapsed ? 'w-16' : 'w-64'}`}
                style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--sidebar-border)' }}
            >
                {/* Logo */}
                <div
                    className={`flex items-center ${collapsed ? 'justify-center p-3' : 'p-4'}`}
                    style={{ borderBottom: '1px solid var(--sidebar-border)', minHeight: '88px' }}
                >
                    {collapsed ? (
                        <div className="w-10 h-10 rounded-xl bg-primary-600/20 flex items-center justify-center">
                            <span className="text-primary-400 font-bold text-lg">G</span>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            <img
                                src="/logo-gamma.png"
                                alt="Gamma Ingenieros"
                                className={`h-14 w-auto object-contain ${isDark ? 'brightness-0 invert' : ''}`}
                            />
                            <p className="text-[10px] text-primary-400 uppercase tracking-widest font-medium">
                                Assessment Platform
                            </p>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/'}
                            onClick={() => setSidebarOpen(false)}
                            title={collapsed ? item.label : undefined}
                            className={({ isActive }) =>
                                `flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                    isActive
                                        ? 'bg-primary-500/10 text-primary-500 border border-primary-500/20'
                                        : 'hover:bg-primary-500/5'
                                }`
                            }
                            style={({ isActive }) => isActive ? {} : { color: 'var(--text-nav)' }}
                        >
                            <span className="flex-shrink-0 text-base leading-none">{item.icon}</span>
                            {!collapsed && <span>{item.label}</span>}
                        </NavLink>
                    ))}
                </nav>

                {/* Theme toggle */}
                <div className="px-2 pb-1">
                    <button
                        onClick={toggleTheme}
                        title={isDark ? 'Modo claro' : 'Modo oscuro'}
                        className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-primary-500/5`}
                        style={{ color: 'var(--text-muted)' }}
                    >
                        <span className="flex-shrink-0 text-base leading-none">{isDark ? <IconSun /> : <IconMoon />}</span>
                        {!collapsed && <span>{isDark ? 'Modo claro' : 'Modo oscuro'}</span>}
                    </button>
                </div>

                {/* Collapse toggle (desktop only) */}
                <div className="hidden lg:flex px-2 pb-1 justify-end">
                    <button
                        onClick={toggleCollapse}
                        title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
                        className="p-1.5 rounded-md transition-colors hover:bg-primary-500/10"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
                    </button>
                </div>

                {/* User section */}
                <div className="p-2" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
                    {collapsed ? (
                        <button
                            onClick={openProfile}
                            title={user?.name}
                            className="w-full flex justify-center py-2 rounded-lg hover:bg-primary-500/5 transition-colors"
                        >
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-600 to-accent-violet flex items-center justify-center text-white font-semibold text-sm">
                                {user?.name?.charAt(0).toUpperCase()}
                            </div>
                        </button>
                    ) : (
                        <div className="glass-card p-3">
                            <div className="flex items-center gap-2.5 mb-2.5">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-accent-violet flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                                    {user?.name?.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-base)' }}>{user?.name}</p>
                                    <p className="text-xs text-primary-400/70 truncate">{user?.role}</p>
                                </div>
                            </div>
                            <div className="flex gap-1.5">
                                <button
                                    onClick={openProfile}
                                    className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded border transition-colors hover:text-primary-400 hover:border-primary-500/30 hover:bg-primary-500/5"
                                    style={{ color: 'var(--text-muted)', borderColor: 'var(--sidebar-border)' }}
                                >
                                    <IconUser />
                                    <span>Perfil</span>
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded border transition-colors hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5"
                                    style={{ color: 'var(--text-muted)', borderColor: 'var(--sidebar-border)' }}
                                >
                                    <IconLogout />
                                    <span>Salir</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {/* Profile Modal */}
            {showProfile && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowProfile(false)}
                    />
                    <div
                        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"
                        style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--sidebar-border)' }}
                    >
                        {/* Modal header */}
                        <div
                            className="flex items-center justify-between p-5 sticky top-0"
                            style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--sidebar-border)' }}
                        >
                            <h2 className="text-base font-semibold" style={{ color: 'var(--text-base)' }}>
                                Cuenta y Aplicación
                            </h2>
                            <button
                                onClick={() => setShowProfile(false)}
                                className="p-1 rounded-lg hover:bg-primary-500/10 transition-colors"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                <IconClose />
                            </button>
                        </div>

                        <div className="p-5 space-y-6">
                            {/* App Info */}
                            <section>
                                <h3 className="text-xs uppercase tracking-wider font-semibold text-primary-400 mb-3">
                                    Plataforma
                                </h3>
                                <div className="glass-card p-4 space-y-2.5">
                                    {[
                                        { label: 'Plataforma', value: 'CSIA Assessment' },
                                        { label: 'Versión', value: '1.0.0' },
                                        { label: 'Empresa', value: 'Gamma Ingenieros' },
                                        { label: 'Frameworks', value: 'NIST AI RMF · MITRE ATLAS · OWASP LLM' },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="flex justify-between items-start gap-4 text-sm">
                                            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                                            <span style={{ color: 'var(--text-base)' }} className="font-medium text-right">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Profile section */}
                            <section>
                                <h3 className="text-xs uppercase tracking-wider font-semibold text-primary-400 mb-3">
                                    Mi Perfil
                                </h3>
                                <div className="glass-card p-4 space-y-4">
                                    {/* Avatar + info */}
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-600 to-accent-violet flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                                            {user?.name?.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-semibold" style={{ color: 'var(--text-base)' }}>{user?.name}</p>
                                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-400 border border-primary-500/20">
                                                {user?.role}
                                            </span>
                                        </div>
                                    </div>

                                    <hr style={{ borderColor: 'var(--sidebar-border)' }} />

                                    {/* Edit form */}
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                                                Nombre
                                            </label>
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:border-primary-500 transition-colors"
                                                style={inputStyle}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                                                Contraseña actual
                                            </label>
                                            <input
                                                type="password"
                                                value={currentPassword}
                                                onChange={e => setCurrentPassword(e.target.value)}
                                                placeholder="Solo si deseas cambiar contraseña"
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:border-primary-500 transition-colors"
                                                style={inputStyle}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                                                Nueva contraseña
                                            </label>
                                            <input
                                                type="password"
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                placeholder="Mínimo 8 caracteres"
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:border-primary-500 transition-colors"
                                                style={inputStyle}
                                            />
                                        </div>
                                        {saveError && <p className="text-xs text-red-400">{saveError}</p>}
                                        {saveSuccess && <p className="text-xs text-green-400">{saveSuccess}</p>}
                                        <button
                                            onClick={handleSaveProfile}
                                            disabled={saving}
                                            className="w-full btn-primary text-sm py-2 flex items-center justify-center gap-2"
                                        >
                                            <IconEdit />
                                            {saving ? 'Guardando...' : 'Guardar cambios'}
                                        </button>
                                    </div>
                                </div>
                            </section>

                            {/* Admin: Users */}
                            {user?.role === 'ADMIN' && (
                                <section>
                                    <h3 className="text-xs uppercase tracking-wider font-semibold text-primary-400 mb-3">
                                        Usuarios del Sistema
                                    </h3>
                                    <div className="glass-card p-4">
                                        {loadingUsers ? (
                                            <div className="flex justify-center py-4">
                                                <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" />
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                {users.map((u, idx) => (
                                                    <div
                                                        key={u.id}
                                                        className={`flex items-center justify-between py-2.5 ${idx < users.length - 1 ? 'border-b' : ''}`}
                                                        style={{ borderColor: 'var(--sidebar-border)' }}
                                                    >
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-base)' }}>{u.name}</p>
                                                            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                                                {u.email} · {u.role}
                                                            </p>
                                                        </div>
                                                        {u.id !== user.id && (
                                                            <button
                                                                onClick={() => handleDeleteUser(u.id)}
                                                                className="ml-3 p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                                                                title="Eliminar usuario"
                                                            >
                                                                <IconTrash />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                {users.length === 0 && (
                                                    <p className="text-sm text-center py-2" style={{ color: 'var(--text-muted)' }}>
                                                        No hay usuarios
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}

                            {/* Logout */}
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center justify-center gap-2 text-sm py-2.5 rounded-lg border transition-colors hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5"
                                style={{ color: 'var(--text-muted)', borderColor: 'var(--sidebar-border)' }}
                            >
                                <IconLogout />
                                Cerrar Sesión
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main content */}
            <div className="flex-1 flex flex-col min-h-screen min-w-0">
                {/* Top bar */}
                <header
                    className="sticky top-0 z-30 backdrop-blur-xl px-6 py-4"
                    style={{ background: 'var(--bg-header)', borderBottom: '1px solid var(--sidebar-border)' }}
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
