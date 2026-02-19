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
        <div className="min-h-screen flex items-center justify-center bg-surface-950 relative overflow-hidden">
            {/* Background decoration with Gamma purple tones */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-500/8 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent-lavender/8 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-violet/5 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md mx-4">
                {/* Gamma Ingenieros Logo */}
                <div className="text-center mb-8 fade-in">
                    <img
                        src="/logo-gamma.png"
                        alt="Gamma Ingenieros"
                        className="h-16 mx-auto mb-4 brightness-0 invert"
                    />
                    <p className="text-sm text-primary-400 font-medium tracking-wide">AI Governance & Security Assessment</p>
                </div>

                {/* Form Card */}
                <div className="glass-card p-8 fade-in" style={{ animationDelay: '0.1s' }}>
                    <h2 className="text-xl font-semibold text-surface-100 mb-6">
                        {isRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}
                    </h2>

                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
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
                            <div className="w-full border-t border-primary-700/30" />
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="px-3 bg-surface-800/80 text-surface-500 rounded">o usa tu email</span>
                        </div>
                    </div>

                    {/* Email/Password Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isRegister && (
                            <div>
                                <label className="block text-sm font-medium text-surface-400 mb-1.5">Nombre</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                                    className="input-field" placeholder="Tu nombre completo" required />
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-surface-400 mb-1.5">Email</label>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                className="input-field" placeholder="correo@empresa.com" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-400 mb-1.5">Contraseña</label>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                                className="input-field" placeholder="••••••••" required minLength={6} />
                        </div>
                        <button type="submit" disabled={loading}
                            className="btn-primary w-full flex items-center justify-center gap-2 mt-6">
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <span>{isRegister ? 'Crear Cuenta' : 'Ingresar'}</span>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button onClick={() => { setIsRegister(!isRegister); setError(''); }}
                            className="text-sm text-primary-400 hover:text-primary-300 transition-colors">
                            {isRegister ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
                        </button>
                    </div>
                </div>

                {/* GAMMIA mascot + tagline */}
                <div className="mt-6 flex items-center justify-center gap-3 fade-in" style={{ animationDelay: '0.2s' }}>
                    <img src="/gammia-mascot.jpg" alt="GAMMIA" className="w-12 h-12 rounded-full object-cover ring-2 ring-primary-500/30" />
                    <div>
                        <p className="text-xs text-surface-400">Donde el futuro y la seguridad se encuentran.</p>
                        <p className="text-[10px] text-surface-600">Demo: admin@aigovernance.com / admin123</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
