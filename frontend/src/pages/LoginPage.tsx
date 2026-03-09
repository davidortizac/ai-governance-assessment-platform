import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, loginWithGoogle, register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (isRegister) {
                await register({ email, password, name });
            } else {
                await login(email, password);
            }
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: any) => {
        setError('');
        setLoading(true);
        try {
            await loginWithGoogle(credentialResponse.credential);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Error al autenticar con Google');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #0F2C5F 0%, #1a3a6e 40%, #1e4d8a 100%)' }}>
            {/* Left panel — branding */}
            <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4 blur-2xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-white/5 rounded-full" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] border border-white/5 rounded-full" />

                {/* Logo top */}
                <div className="relative z-10">
                    <img src="/logo-gamma.png" alt="Gamma Ingenieros" className="h-14 brightness-0 invert" />
                </div>

                {/* Center content */}
                <div className="relative z-10 space-y-6">
                    <h1 className="text-4xl font-bold text-white leading-tight">
                        AI Cybersecurity<br />
                        <span style={{ color: '#C9A84C' }}>Maturity Assessment</span>
                    </h1>
                    <p className="text-lg text-blue-200/80 max-w-md leading-relaxed">
                        Plataforma de evaluación de madurez en ciberseguridad e inteligencia artificial bajo la metodología CSIA.
                    </p>

                    {/* Feature pills */}
                    <div className="flex flex-wrap gap-3 pt-4">
                        {['NIST AI RMF', 'MITRE ATLAS', 'Gartner TRiSM', 'Gobernanza IA'].map(tag => (
                            <span key={tag} className="px-3 py-1.5 text-xs font-medium rounded-full bg-white/10 text-blue-100 border border-white/10 backdrop-blur-sm">
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Bottom stats */}
                <div className="relative z-10 grid grid-cols-3 gap-6">
                    {[
                        { value: '6', label: 'Pilares de evaluación' },
                        { value: '5', label: 'Niveles de madurez' },
                        { value: 'IA', label: 'Análisis automatizado' },
                    ].map(stat => (
                        <div key={stat.label}>
                            <p className="text-2xl font-bold" style={{ color: '#C9A84C' }}>{stat.value}</p>
                            <p className="text-xs text-blue-200/60 mt-1">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right panel — form */}
            <div className="flex-1 flex items-center justify-center p-6 lg:p-12" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 100%)' }}>
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden text-center mb-8">
                        <img src="/logo-gamma.png" alt="Gamma Ingenieros" className="h-12 mx-auto mb-3 brightness-0 invert" />
                        <p className="text-sm font-medium" style={{ color: '#C9A84C' }}>AI Governance & Security Assessment</p>
                    </div>

                    {/* Form card */}
                    <div className="rounded-2xl p-8 backdrop-blur-xl" style={{
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
                    }}>
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-white">
                                {isRegister ? 'Crear Cuenta' : 'Bienvenido'}
                            </h2>
                            <p className="text-sm text-blue-200/60 mt-1">
                                {isRegister ? 'Completa tus datos para registrarte' : 'Ingresa a la plataforma de evaluación'}
                            </p>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/25 text-red-300 text-sm flex items-center gap-2">
                                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                {error}
                            </div>
                        )}

                        {/* Google Login */}
                        <div className="mb-5">
                            <div className="flex justify-center">
                                <GoogleLogin
                                    onSuccess={handleGoogleSuccess}
                                    onError={() => setError('Error al conectar con Google')}
                                    theme="filled_black"
                                    shape="pill"
                                    size="large"
                                    width="350"
                                    text={isRegister ? 'signup_with' : 'signin_with'}
                                />
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="relative mb-5">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10" />
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="px-3 text-blue-200/40" style={{ background: 'rgba(20,50,95,0.8)' }}>o usa tu email</span>
                            </div>
                        </div>

                        {/* Email/Password Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {isRegister && (
                                <div>
                                    <label htmlFor="register-name" className="block text-sm font-medium text-blue-100/70 mb-1.5">Nombre</label>
                                    <input id="register-name" type="text" value={name} onChange={(e) => setName(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl text-white placeholder:text-blue-200/30 focus:outline-none focus:ring-2 focus:ring-amber-400/30 transition-all"
                                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                                        placeholder="Tu nombre completo" required />
                                </div>
                            )}
                            <div>
                                <label htmlFor="login-email" className="block text-sm font-medium text-blue-100/70 mb-1.5">Email</label>
                                <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl text-white placeholder:text-blue-200/30 focus:outline-none focus:ring-2 focus:ring-amber-400/30 transition-all"
                                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                                    placeholder="correo@empresa.com" required />
                            </div>
                            <div>
                                <label htmlFor="login-password" className="block text-sm font-medium text-blue-100/70 mb-1.5">Contraseña</label>
                                <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl text-white placeholder:text-blue-200/30 focus:outline-none focus:ring-2 focus:ring-amber-400/30 transition-all"
                                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                                    placeholder="••••••••" required minLength={6} />
                            </div>
                            <button type="submit" disabled={loading}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                    background: 'linear-gradient(135deg, #C9A84C 0%, #d4b85c 100%)',
                                    color: '#0F2C5F',
                                    boxShadow: '0 4px 14px rgba(201,168,76,0.3)',
                                }}
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-navy-900/30 border-t-navy-900 rounded-full animate-spin" style={{ borderTopColor: '#0F2C5F' }} />
                                ) : (
                                    <span>{isRegister ? 'Crear Cuenta' : 'Ingresar'}</span>
                                )}
                            </button>
                        </form>

                        <div className="mt-5 text-center">
                            <button onClick={() => { setIsRegister(!isRegister); setError(''); }}
                                className="text-sm text-blue-200/50 hover:text-blue-100 transition-colors">
                                {isRegister ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
                            </button>
                        </div>
                    </div>

                    {/* Disclaimer */}
                    <div className="mt-6 px-2 space-y-3">
                        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl" style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                            <svg className="w-4 h-4 mt-0.5 shrink-0 text-amber-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                            </svg>
                            <p className="text-[11px] leading-relaxed text-blue-200/40">
                                Esta plataforma utiliza modelos de inteligencia artificial para generar análisis automatizados
                                de madurez en ciberseguridad. Los resultados son orientativos y complementan el criterio profesional del consultor.
                            </p>
                        </div>

                        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl" style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                            <svg className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                            </svg>
                            <p className="text-[11px] leading-relaxed text-blue-200/40">
                                Tus datos están protegidos bajo las políticas de seguridad de la información de Gamma Ingenieros S.A.S.,
                                en cumplimiento de la Ley 1581 de 2012 y normativa colombiana de protección de datos personales.
                            </p>
                        </div>
                    </div>

                    {/* Copyright */}
                    <p className="text-center text-[10px] text-blue-200/25 mt-6">
                        &copy; {new Date().getFullYear()} Gamma Ingenieros S.A.S. — Todos los derechos reservados.
                    </p>
                </div>
            </div>
        </div>
    );
}
