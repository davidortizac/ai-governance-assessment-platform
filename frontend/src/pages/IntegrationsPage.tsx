import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

interface Integration { id: string; type: 'JIRA' | 'SLACK'; isActive: boolean; }

export default function IntegrationsPage() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';

    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [isLoading, setIsLoading]       = useState(true);
    const [notifying, setNotifying]       = useState(false);

    const [jiraForm, setJiraForm]   = useState({ url: '', email: '', apiToken: '', projectKey: '' });
    const [slackForm, setSlackForm] = useState({ webhookUrl: '', channel: '' });
    const [saving, setSaving]       = useState<'jira' | 'slack' | null>(null);
    const [disabling, setDisabling] = useState<string | null>(null);

    const fetchIntegrations = () => {
        api.get('/integrations')
            .then(r => setIntegrations(r.data))
            .catch(() => toast.error('Error cargando integraciones'))
            .finally(() => setIsLoading(false));
    };

    useEffect(() => { fetchIntegrations(); }, []);

    const handleJiraSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving('jira');
        try {
            await api.post('/integrations/jira', jiraForm);
            toast.success('JIRA conectado correctamente');
            setJiraForm({ url: '', email: '', apiToken: '', projectKey: '' });
            fetchIntegrations();
        } catch (err: any) {
            toast.error(err.response?.data?.error ?? 'Error al conectar JIRA');
        } finally {
            setSaving(null);
        }
    };

    const handleSlackSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving('slack');
        try {
            await api.post('/integrations/slack', slackForm);
            toast.success('Slack conectado y webhook verificado');
            setSlackForm({ webhookUrl: '', channel: '' });
            fetchIntegrations();
        } catch (err: any) {
            toast.error(err.response?.data?.error ?? 'Error al conectar Slack');
        } finally {
            setSaving(null);
        }
    };

    const handleDisable = async (type: string) => {
        if (!confirm(`¿Desactivar integración con ${type}?`)) return;
        setDisabling(type);
        try {
            await api.delete(`/integrations/${type}`);
            toast.success('Integración desactivada');
            fetchIntegrations();
        } catch {
            toast.error('Error al desactivar');
        } finally {
            setDisabling(null);
        }
    };

    const handleTestNotify = async () => {
        setNotifying(true);
        try {
            const r = await api.post('/integrations/notify', {
                message: '🧪 Prueba de integración desde Gamma AI Platform — todo funciona correctamente.',
                severity: 'MEDIUM',
            });
            const results: any[] = r.data.results ?? [];
            if (results.length === 0) {
                toast('No hay integraciones activas para notificar');
            } else {
                results.forEach(res => {
                    if (res.status === 'sent')      toast.success(`${res.type}: mensaje enviado a ${res.detail}`);
                    else if (res.status === 'simulated') toast(`${res.type}: simulado (${res.detail})`);
                    else                             toast.error(`${res.type}: ${res.detail}`);
                });
            }
        } catch {
            toast.error('Error al enviar prueba');
        } finally {
            setNotifying(false);
        }
    };

    const isJiraActive  = integrations.find(i => i.type === 'JIRA'  && i.isActive);
    const isSlackActive = integrations.find(i => i.type === 'SLACK' && i.isActive);

    if (isLoading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
    );

    return (
        <div className="space-y-6 fade-in max-w-3xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-100">Integraciones</h1>
                    <p className="text-sm text-surface-400 mt-1">Conecta herramientas externas para automatizar flujos de trabajo</p>
                </div>
                {(isJiraActive || isSlackActive) && (
                    <button
                        onClick={handleTestNotify}
                        disabled={notifying}
                        className="btn-secondary text-sm flex items-center gap-2"
                    >
                        {notifying
                            ? <><span className="animate-spin inline-block">↺</span> Enviando...</>
                            : <><span>🔔</span> Probar notificaciones</>
                        }
                    </button>
                )}
            </div>

            {!isAdmin && (
                <div className="glass-card p-4 border border-amber-500/20 text-sm text-amber-400">
                    Las integraciones solo pueden ser configuradas por administradores.
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ── JIRA ─────────────────────────────────────────────────── */}
                <div className="glass-card p-6 flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#0052CC]/10 border border-[#0052CC]/20 flex items-center justify-center text-xl">
                                🔷
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-surface-100">JIRA Software</h3>
                                <p className="text-xs text-surface-500">Tickets automáticos por riesgo crítico</p>
                            </div>
                        </div>
                        {isJiraActive
                            ? <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">Activo</span>
                            : <span className="text-xs bg-surface-700/50 text-surface-500 border border-surface-600/20 px-2 py-0.5 rounded-full">Inactivo</span>
                        }
                    </div>

                    {isJiraActive ? (
                        <div className="flex-1 flex flex-col justify-between">
                            <p className="text-sm text-surface-300 mb-4">
                                Integración activa. Los tickets se crean automáticamente cuando se detectan riesgos CRÍTICOS en un assessment.
                            </p>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs text-surface-500">
                                    <span className="w-2 h-2 rounded-full bg-amber-400/60 inline-block" />
                                    Creación de tickets: simulada (requiere configuración OAuth de Jira)
                                </div>
                                {isAdmin && (
                                    <button
                                        onClick={() => handleDisable('JIRA')}
                                        disabled={disabling === 'JIRA'}
                                        className="w-full text-sm text-red-400/70 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5 py-2 rounded-lg transition-colors disabled:opacity-40"
                                    >
                                        {disabling === 'JIRA' ? 'Desconectando...' : 'Desconectar'}
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : isAdmin ? (
                        <form onSubmit={handleJiraSubmit} className="flex-1 flex flex-col space-y-3">
                            <FormField label="URL de JIRA" type="url" placeholder="https://empresa.atlassian.net"
                                value={jiraForm.url} onChange={v => setJiraForm(f => ({ ...f, url: v }))} required />
                            <FormField label="Email" type="email" placeholder="usuario@empresa.com"
                                value={jiraForm.email} onChange={v => setJiraForm(f => ({ ...f, email: v }))} required />
                            <FormField label="API Token" type="password" placeholder="••••••••"
                                value={jiraForm.apiToken} onChange={v => setJiraForm(f => ({ ...f, apiToken: v }))} required />
                            <FormField label="Project Key" type="text" placeholder="PROJ"
                                value={jiraForm.projectKey} onChange={v => setJiraForm(f => ({ ...f, projectKey: v.toUpperCase() }))} required />
                            <button type="submit" disabled={saving === 'jira'} className="btn-primary text-sm w-full mt-auto">
                                {saving === 'jira' ? 'Conectando...' : 'Conectar JIRA'}
                            </button>
                        </form>
                    ) : (
                        <p className="text-sm text-surface-500 flex-1 flex items-center justify-center">No configurado</p>
                    )}
                </div>

                {/* ── Slack ─────────────────────────────────────────────────── */}
                <div className="glass-card p-6 flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#4A154B]/10 border border-[#4A154B]/20 flex items-center justify-center text-xl">
                                💬
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-surface-100">Slack</h3>
                                <p className="text-xs text-surface-500">Alertas en tiempo real al canal configurado</p>
                            </div>
                        </div>
                        {isSlackActive
                            ? <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">Activo</span>
                            : <span className="text-xs bg-surface-700/50 text-surface-500 border border-surface-600/20 px-2 py-0.5 rounded-full">Inactivo</span>
                        }
                    </div>

                    {isSlackActive ? (
                        <div className="flex-1 flex flex-col justify-between">
                            <p className="text-sm text-surface-300 mb-4">
                                Integración activa. Las alertas de riesgo se envían al canal configurado con el webhook de Slack.
                            </p>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs text-surface-500">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                                    Notificaciones reales via Incoming Webhook
                                </div>
                                {isAdmin && (
                                    <button
                                        onClick={() => handleDisable('SLACK')}
                                        disabled={disabling === 'SLACK'}
                                        className="w-full text-sm text-red-400/70 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5 py-2 rounded-lg transition-colors disabled:opacity-40"
                                    >
                                        {disabling === 'SLACK' ? 'Desconectando...' : 'Desconectar'}
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : isAdmin ? (
                        <form onSubmit={handleSlackSubmit} className="flex-1 flex flex-col space-y-3">
                            <FormField label="Webhook URL" type="url" placeholder="https://hooks.slack.com/services/..."
                                value={slackForm.webhookUrl} onChange={v => setSlackForm(f => ({ ...f, webhookUrl: v }))} required />
                            <FormField label="Canal (opcional)" type="text" placeholder="#alertas-ia"
                                value={slackForm.channel} onChange={v => setSlackForm(f => ({ ...f, channel: v }))} />
                            <p className="text-xs text-surface-500">
                                El webhook se verificará enviando un mensaje de prueba al configurarlo.
                            </p>
                            <button type="submit" disabled={saving === 'slack'} className="btn-primary text-sm w-full mt-auto">
                                {saving === 'slack' ? 'Verificando webhook...' : 'Conectar Slack'}
                            </button>
                        </form>
                    ) : (
                        <p className="text-sm text-surface-500 flex-1 flex items-center justify-center">No configurado</p>
                    )}
                </div>
            </div>

            {/* Instructions */}
            <div className="glass-card p-5 space-y-3">
                <h3 className="text-sm font-semibold text-surface-300">Cómo obtener el Webhook de Slack</h3>
                <ol className="text-xs text-surface-400 space-y-1.5 list-none">
                    {[
                        'Ve a api.slack.com/apps y crea una nueva aplicación (o selecciona una existente)',
                        'En el menú lateral selecciona "Incoming Webhooks" y actívalo',
                        'Haz clic en "Add New Webhook to Workspace" y selecciona el canal de destino',
                        'Copia la URL del webhook y pégala en el campo anterior',
                    ].map((step, i) => (
                        <li key={i} className="flex gap-2">
                            <span className="text-primary-400 font-bold shrink-0">{i + 1}.</span>
                            {step}
                        </li>
                    ))}
                </ol>
            </div>
        </div>
    );
}

// ── Small reusable form field ──────────────────────────────────────────────────
function FormField({ label, type, placeholder, value, onChange, required }: {
    label: string; type: string; placeholder?: string;
    value: string; onChange: (v: string) => void; required?: boolean;
}) {
    return (
        <div>
            <label className="block text-xs font-medium text-surface-400 mb-1">{label}</label>
            <input
                type={type}
                required={required}
                placeholder={placeholder}
                className="input-field w-full text-sm"
                value={value}
                onChange={e => onChange(e.target.value)}
            />
        </div>
    );
}
