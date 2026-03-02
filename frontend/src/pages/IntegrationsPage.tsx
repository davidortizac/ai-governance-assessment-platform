import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL;

interface Integration {
    id: string;
    type: 'JIRA' | 'SLACK';
    isActive: boolean;
}

export default function IntegrationsPage() {
    const { token } = useAuth();
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Forms
    const [jiraForm, setJiraForm] = useState({ url: '', email: '', apiToken: '', projectKey: '' });
    const [slackForm, setSlackForm] = useState({ webhookUrl: '', channel: '#' });

    useEffect(() => {
        fetchIntegrations();
    }, []);

    const fetchIntegrations = async () => {
        try {
            const res = await fetch(`${API_URL}/integrations`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setIntegrations(data);
            }
        } catch (error) {
            console.error('Error fetching integrations:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleJiraSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/integrations/jira`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(jiraForm),
            });

            if (res.ok) {
                toast.success('JIRA conectado exitosamente');
                fetchIntegrations();
                setJiraForm({ url: '', email: '', apiToken: '', projectKey: '' });
            } else {
                toast.error('Error al conectar JIRA');
            }
        } catch (error) {
            toast.error('Error de conexión');
        }
    };

    const handleSlackSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/integrations/slack`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(slackForm),
            });

            if (res.ok) {
                toast.success('Slack conectado exitosamente');
                fetchIntegrations();
                setSlackForm({ webhookUrl: '', channel: '#' });
            } else {
                toast.error('Error al conectar Slack');
            }
        } catch (error) {
            toast.error('Error de conexión');
        }
    };

    const handleDisable = async (type: string) => {
        if (!confirm(`¿Desactivar integración con ${type}?`)) return;

        try {
            const res = await fetch(`${API_URL}/integrations/${type}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                toast.success('Integración desactivada');
                fetchIntegrations();
            } else {
                toast.error('Error al desactivar');
            }
        } catch (error) {
            toast.error('Error de conexión');
        }
    };

    const handleTestNotify = async () => {
        try {
            const res = await fetch(`${API_URL}/integrations/notify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ message: 'Prueba de integración desde Gamma AI Platform', severity: 'HIGH' }),
            });
            const data = await res.json();
            toast.success(`Notificaciones enviadas: ${data.results.length}`);
        } catch (error) {
            toast.error('Error enviando prueba');
        }
    };

    const isJiraActive = integrations.find(i => i.type === 'JIRA' && i.isActive);
    const isSlackActive = integrations.find(i => i.type === 'SLACK' && i.isActive);

    if (isLoading) return <div className="p-8 text-center text-surface-400">Cargando integraciones...</div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-surface-100">Integraciones</h1>
                {integrations.length > 0 && (
                    <button onClick={handleTestNotify} className="btn-secondary text-sm">
                        🔔 Probar Notificaciones
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* JIRA Card */}
                <div className="glass-card p-6 border border-primary-800/30">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded bg-[#0052CC]/10 flex items-center justify-center text-2xl">
                                🔷
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-surface-100">JIRA Software</h3>
                                <p className="text-sm text-surface-400">Crear tickets automáticos</p>
                            </div>
                        </div>
                        {isJiraActive && (
                            <span className="bg-green-500/10 text-green-400 text-xs px-2 py-1 rounded-full border border-green-500/20">
                                Activo
                            </span>
                        )}
                    </div>

                    {isJiraActive ? (
                        <div className="space-y-4">
                            <p className="text-sm text-surface-300">
                                La integración está activa. Los tickets se crearán automáticamente para riesgos CRÍTICOS.
                            </p>
                            <button
                                onClick={() => handleDisable('JIRA')}
                                className="w-full btn-ghost text-red-400 hover:text-red-300 hover:bg-red-500/5"
                            >
                                Desconectar
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleJiraSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-surface-400 mb-1">URL de JIRA</label>
                                <input
                                    type="url"
                                    required
                                    placeholder="https://tu-empresa.atlassian.net"
                                    className="input-field w-full"
                                    value={jiraForm.url}
                                    onChange={e => setJiraForm({ ...jiraForm, url: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-surface-400 mb-1">Email</label>
                                <input
                                    type="email"
                                    required
                                    className="input-field w-full"
                                    value={jiraForm.email}
                                    onChange={e => setJiraForm({ ...jiraForm, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-surface-400 mb-1">API Token</label>
                                <input
                                    type="password"
                                    required
                                    className="input-field w-full"
                                    value={jiraForm.apiToken}
                                    onChange={e => setJiraForm({ ...jiraForm, apiToken: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-surface-400 mb-1">Project Key</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="PROJ"
                                    className="input-field w-full uppercase"
                                    value={jiraForm.projectKey}
                                    onChange={e => setJiraForm({ ...jiraForm, projectKey: e.target.value })}
                                />
                            </div>
                            <button type="submit" className="w-full btn-primary">
                                Conectar JIRA
                            </button>
                        </form>
                    )}
                </div>

                {/* Slack Card */}
                <div className="glass-card p-6 border border-primary-800/30">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded bg-[#4A154B]/10 flex items-center justify-center text-2xl">
                                💬
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-surface-100">Slack</h3>
                                <p className="text-sm text-surface-400">Notificaciones en canales</p>
                            </div>
                        </div>
                        {isSlackActive && (
                            <span className="bg-green-500/10 text-green-400 text-xs px-2 py-1 rounded-full border border-green-500/20">
                                Activo
                            </span>
                        )}
                    </div>

                    {isSlackActive ? (
                        <div className="space-y-4">
                            <p className="text-sm text-surface-300">
                                La integración está activa. Se enviarán alertas al canal configurado.
                            </p>
                            <button
                                onClick={() => handleDisable('SLACK')}
                                className="w-full btn-ghost text-red-400 hover:text-red-300 hover:bg-red-500/5"
                            >
                                Desconectar
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSlackSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-surface-400 mb-1">Webhook URL</label>
                                <input
                                    type="url"
                                    required
                                    placeholder="https://hooks.slack.com/services/..."
                                    className="input-field w-full"
                                    value={slackForm.webhookUrl}
                                    onChange={e => setSlackForm({ ...slackForm, webhookUrl: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-surface-400 mb-1">Canal (opcional)</label>
                                <input
                                    type="text"
                                    placeholder="#general"
                                    className="input-field w-full"
                                    value={slackForm.channel}
                                    onChange={e => setSlackForm({ ...slackForm, channel: e.target.value })}
                                />
                            </div>
                            <button type="submit" className="w-full btn-primary">
                                Conectar Slack
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
