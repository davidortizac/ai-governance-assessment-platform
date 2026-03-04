import React, { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AssessmentRow {
    id: string;
    type: 'EXPRESS' | 'ADVANCED';
    status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
    overallScore: number | null;
    maturityLevel: number | null;
    riskLevel: string | null;
    completedAt: string | null;
    createdAt: string;
    hasLlmAnalysis: boolean;
    client: { id: string; name: string; industry: string | null; contactEmail: string | null; contactName: string | null };
    createdBy: { id: string; name: string; email: string };
    pillarScores: { score: number; pillar: { name: string; key: string } }[];
    _count: { answers: number };
}

interface AssessmentDetail extends AssessmentRow {
    llmAnalysis: any;
    answers: {
        id: string;
        score: number;
        notApplicable: boolean;
        question: { text: string; pillar: { name: string; key: string } };
    }[];
}

// ─── Config maps ──────────────────────────────────────────────────────────────
const RISK_CFG: Record<string, { label: string; cls: string }> = {
    CONTROLLED: { label: 'Controlado', cls: 'badge-success' },
    LOW:        { label: 'Bajo',       cls: 'badge-success' },
    MEDIUM:     { label: 'Medio',      cls: 'badge-warning' },
    HIGH:       { label: 'Alto',       cls: 'badge-danger'  },
    CRITICAL:   { label: 'Crítico',    cls: 'badge-danger'  },
    LATENT:     { label: 'Latente',    cls: 'badge-info'    },
};

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
    DRAFT:       { label: 'Borrador',    cls: 'badge-neutral'  },
    IN_PROGRESS: { label: 'En progreso', cls: 'badge-warning'  },
    COMPLETED:   { label: 'Completado',  cls: 'badge-success'  },
};

const MATURITY: Record<number, string> = {
    1: 'Experimental', 2: 'Emergente', 3: 'Definido', 4: 'Gestionado', 5: 'Optimizado',
};

const ANSWER_LABELS: Record<number, string> = {
    0: 'N/A', 1: 'No iniciado', 3: 'En progreso', 5: 'Completado',
};

// ─── LLM status type ──────────────────────────────────────────────────────────
interface LLMStatus {
    connected: boolean;
    url: string;
    currentModel: string;
    models: { name: string; size?: number }[];
    hasApiKey?: boolean;
    error?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminPage() {
    const [mainView, setMainView]   = useState<'assessments' | 'llm-config'>('assessments');
    const [rows, setRows]           = useState<AssessmentRow[]>([]);
    const [loading, setLoading]     = useState(true);
    const [detail, setDetail]       = useState<AssessmentDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [deleting, setDeleting]   = useState<string | null>(null);
    const [regenerating, setRegenerating] = useState(false);
    const [activeTab, setActiveTab] = useState<'info' | 'answers' | 'results' | 'llm'>('info');
    const [filters, setFilters]     = useState({ search: '', status: '', type: '', risk: '' });

    // LLM config state
    const [llmStatus, setLlmStatus]     = useState<LLMStatus | null>(null);
    const [llmTesting, setLlmTesting]   = useState(false);
    const [llmSaving, setLlmSaving]     = useState(false);
    const [selectedModel, setSelectedModel] = useState('');

    // Provider config form state
    const [providerType, setProviderType]   = useState<'google' | 'ollama'>('google');
    const [llmUrl, setLlmUrl]               = useState('');
    const [llmApiKey, setLlmApiKey]         = useState('');
    const [showApiKey, setShowApiKey]       = useState(false);
    const [configSaving, setConfigSaving]   = useState(false);

    // ── Load list ─────────────────────────────────────────────────────────────
    const loadList = useCallback(() => {
        setLoading(true);
        const params: any = {};
        if (filters.status) params.status = filters.status;
        if (filters.type)   params.type   = filters.type;
        if (filters.risk)   params.risk   = filters.risk;
        api.get('/admin/assessments', { params })
            .then(r => setRows(r.data))
            .catch(() => toast.error('Error cargando datos'))
            .finally(() => setLoading(false));
    }, [filters.status, filters.type, filters.risk]);

    useEffect(() => { loadList(); }, [loadList]);

    // ── Open detail panel ─────────────────────────────────────────────────────
    const openDetail = (id: string) => {
        setDetail(null);
        setActiveTab('info');
        setDetailLoading(true);
        api.get(`/admin/assessments/${id}`)
            .then(r => setDetail(r.data))
            .catch(() => toast.error('Error cargando detalle'))
            .finally(() => setDetailLoading(false));
    };

    // ── Delete ────────────────────────────────────────────────────────────────
    const handleDelete = async (id: string, clientName: string) => {
        if (!window.confirm(`¿Eliminar evaluación de "${clientName}"? Esta acción no se puede deshacer.`)) return;
        setDeleting(id);
        try {
            await api.delete(`/admin/assessments/${id}`);
            toast.success('Evaluación eliminada');
            setRows(prev => prev.filter(r => r.id !== id));
            if (detail?.id === id) setDetail(null);
        } catch {
            toast.error('Error al eliminar');
        } finally {
            setDeleting(null);
        }
    };

    // ── Regenerate LLM ────────────────────────────────────────────────────────
    const handleRegenerate = async () => {
        if (!detail) return;
        setRegenerating(true);
        try {
            await api.post(`/reports/${detail.id}/regenerate-analysis`);
            toast.success('Análisis iniciado. Esto puede tardar varios minutos con Ollama local...');
            // Poll every 10s until done (up to 12 min)
            const maxAttempts = 72;
            for (let i = 0; i < maxAttempts; i++) {
                await new Promise(r => setTimeout(r, 10000));
                const { data } = await api.get(`/reports/${detail.id}/regenerate-status`);
                if (data.status === 'done') {
                    toast.success('Análisis regenerado correctamente.');
                    openDetail(detail.id);
                    return;
                }
            }
            toast.error('El análisis tardó demasiado. Intenta recargar la página.');
        } catch {
            toast.error('Error al iniciar regeneración del análisis');
        } finally {
            setRegenerating(false);
        }
    };

    // ── LLM config ────────────────────────────────────────────────────────────
    const GOOGLE_LLM_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    const OLLAMA_LLM_URL = 'http://host.docker.internal:11434/v1/chat/completions';

    const testLLMConnection = async () => {
        setLlmTesting(true);
        try {
            const r = await api.get('/admin/llm/status');
            setLlmStatus(r.data);
            setSelectedModel(r.data.currentModel);
            // Sync provider form from actual backend config
            const detectedUrl: string = r.data.url ?? '';
            setLlmUrl(detectedUrl);
            setProviderType(detectedUrl.includes('googleapis.com') ? 'google' : 'ollama');
        } catch {
            toast.error('Error al verificar conexión con el servidor IA');
        } finally {
            setLlmTesting(false);
        }
    };

    const handleProviderChange = (type: 'google' | 'ollama') => {
        setProviderType(type);
        setLlmUrl(type === 'google' ? GOOGLE_LLM_URL : OLLAMA_LLM_URL);
        if (type === 'ollama') setLlmApiKey('');
    };

    const saveConfig = async () => {
        setConfigSaving(true);
        try {
            await api.post('/admin/llm/config', {
                url: llmUrl,
                ...(llmApiKey && { apiKey: llmApiKey }),
            });
            toast.success('Configuración guardada. Verificando conexión...');
            setLlmApiKey('');
            await testLLMConnection();
        } catch {
            toast.error('Error al guardar configuración');
        } finally {
            setConfigSaving(false);
        }
    };

    const saveModel = async () => {
        if (!selectedModel) return;
        setLlmSaving(true);
        try {
            await api.post('/admin/llm/model', { model: selectedModel });
            toast.success(`Modelo actualizado: ${selectedModel}`);
            setLlmStatus(prev => prev ? { ...prev, currentModel: selectedModel } : null);
        } catch {
            toast.error('Error al guardar el modelo');
        } finally {
            setLlmSaving(false);
        }
    };

    // ── Download report ───────────────────────────────────────────────────────
    const downloadReport = async (id: string, format: 'pdf' | 'csv' | 'json') => {
        const mimeTypes = { pdf: 'application/pdf', csv: 'text/csv', json: 'application/json' };
        const fallbackNames = { pdf: `report-${id}.pdf`, csv: `export-${id}.csv`, json: `data-${id}.json` };
        try {
            const res = await api.get(`/reports/${id}/${format}`, { responseType: 'blob' });
            const disposition: string = res.headers['content-disposition'] ?? '';
            const match = disposition.match(/filename="([^"]+)"/);
            const filename = match ? match[1] : fallbackNames[format];
            const blob = new Blob([res.data], { type: mimeTypes[format] });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            setTimeout(() => { document.body.removeChild(link); window.URL.revokeObjectURL(url); }, 3000);
        } catch {
            toast.error(`Error al descargar ${format.toUpperCase()}`);
        }
    };

    // ── Filtered rows ─────────────────────────────────────────────────────────
    const filtered = rows.filter(r => {
        if (!filters.search) return true;
        const q = filters.search.toLowerCase();
        return r.client.name.toLowerCase().includes(q) ||
               r.createdBy.name.toLowerCase().includes(q) ||
               (r.client.industry ?? '').toLowerCase().includes(q);
    });

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex gap-0 h-full fade-in">

            {/* ── Left: Main panel ─────────────────────────────────────────── */}
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${detail ? 'mr-0' : ''}`}>

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-surface-100">Panel de Administración</h1>
                        <p className="text-sm text-surface-400 mt-1">
                            Gestión completa de evaluaciones, clientes y configuración IA
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {mainView === 'assessments' && (
                            <>
                                <span className="text-xs text-surface-500 bg-surface-800 px-3 py-1.5 rounded-lg border border-primary-800/20">
                                    {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
                                </span>
                                <button onClick={loadList} className="btn-secondary text-sm flex items-center gap-2">
                                    <span>↺</span> Actualizar
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* View toggle */}
                <div className="flex gap-1 mb-5 bg-surface-800/50 p-1 rounded-xl w-fit border border-primary-800/20">
                    {([
                        { key: 'assessments', label: 'Evaluaciones', icon: '📋' },
                        { key: 'llm-config',  label: 'Configuración IA', icon: '🤖' },
                    ] as const).map(v => (
                        <button
                            key={v.key}
                            onClick={() => { setMainView(v.key); if (v.key === 'llm-config' && !llmStatus) testLLMConnection(); }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                                ${mainView === v.key
                                    ? 'bg-primary-500/15 text-primary-300 border border-primary-500/30 shadow-sm'
                                    : 'text-surface-400 hover:text-surface-200'
                                }`}
                        >
                            <span>{v.icon}</span>
                            <span>{v.label}</span>
                        </button>
                    ))}
                </div>

                {/* ── LLM Config view ──────────────────────────────────────── */}
                {mainView === 'llm-config' && (
                    <div className="space-y-5 max-w-2xl">

                        {/* Provider config card */}
                        <div className="glass-card p-5 space-y-4">
                            <h2 className="text-base font-semibold text-surface-100 flex items-center gap-2">
                                <span>⚙️</span> Proveedor de IA
                            </h2>

                            {/* Provider toggle */}
                            <div className="flex gap-2">
                                {(['google', 'ollama'] as const).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => handleProviderChange(type)}
                                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border
                                            ${providerType === type
                                                ? 'bg-primary-500/15 text-primary-300 border-primary-500/30'
                                                : 'bg-surface-800/30 text-surface-400 border-primary-800/20 hover:bg-surface-800/60'
                                            }`}
                                    >
                                        <span>{type === 'google' ? '☁️' : '🖥️'}</span>
                                        <span>{type === 'google' ? 'Google AI Studio' : 'Ollama Local'}</span>
                                    </button>
                                ))}
                            </div>

                            {/* URL field */}
                            <div>
                                <label className="text-xs text-surface-500 uppercase tracking-wider font-medium block mb-1">
                                    URL del servidor
                                </label>
                                <input
                                    type="text"
                                    value={llmUrl}
                                    onChange={e => setLlmUrl(e.target.value)}
                                    placeholder={providerType === 'google'
                                        ? 'https://generativelanguage.googleapis.com/...'
                                        : 'http://host.docker.internal:11434/v1/chat/completions'}
                                    className="input-field w-full text-sm font-mono"
                                />
                            </div>

                            {/* API Key field — only for Google */}
                            {providerType === 'google' && (
                                <div>
                                    <label className="text-xs text-surface-500 uppercase tracking-wider font-medium block mb-1">
                                        API Key
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showApiKey ? 'text' : 'password'}
                                            value={llmApiKey}
                                            onChange={e => setLlmApiKey(e.target.value)}
                                            placeholder={llmStatus?.hasApiKey
                                                ? '••••••••••••• (dejar vacío para mantener la actual)'
                                                : 'Ingresa tu Google AI Studio API key'}
                                            className="input-field w-full text-sm pr-20"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowApiKey(v => !v)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-surface-400 hover:text-surface-200 transition-colors"
                                        >
                                            {showApiKey ? 'Ocultar' : 'Mostrar'}
                                        </button>
                                    </div>
                                    {llmStatus?.hasApiKey && (
                                        <p className="text-xs text-emerald-400 mt-1">✓ API key configurada</p>
                                    )}
                                    <p className="text-xs text-surface-500 mt-1">
                                        Obtén tu key en{' '}
                                        <span className="text-primary-400 font-mono">aistudio.google.com/apikey</span>
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={saveConfig}
                                disabled={configSaving || !llmUrl.trim()}
                                className="btn-primary text-sm flex items-center gap-2 disabled:opacity-40"
                            >
                                {configSaving
                                    ? <><span className="animate-spin inline-block">↺</span> Guardando...</>
                                    : <><span>✓</span> Guardar configuración</>
                                }
                            </button>
                        </div>

                        {/* Connection status card */}
                        <div className="glass-card p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-base font-semibold text-surface-100 flex items-center gap-2">
                                    <span>🔌</span> Conexión con servidor IA
                                </h2>
                                <button
                                    onClick={testLLMConnection}
                                    disabled={llmTesting}
                                    className="btn-secondary text-sm flex items-center gap-2"
                                >
                                    {llmTesting
                                        ? <><span className="animate-spin inline-block">↺</span> Probando...</>
                                        : <><span>↺</span> Verificar</>
                                    }
                                </button>
                            </div>

                            {llmStatus ? (
                                <>
                                    {/* Status row */}
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-800/50 border border-primary-800/20">
                                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${llmStatus.connected ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-red-400'}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium ${llmStatus.connected ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {llmStatus.connected ? 'Conectado' : 'Sin conexión'}
                                            </p>
                                            <p className="text-xs text-surface-500 font-mono truncate mt-0.5">{llmStatus.url}</p>
                                        </div>
                                    </div>

                                    {/* Error */}
                                    {llmStatus.error && (
                                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                                            <span className="font-medium">Error: </span>{llmStatus.error}
                                        </div>
                                    )}

                                    {/* Current model */}
                                    <div>
                                        <p className="text-xs text-surface-500 uppercase tracking-wider font-medium mb-1">Modelo activo</p>
                                        <p className="text-sm font-mono text-primary-300 bg-surface-800/50 px-3 py-2 rounded-lg border border-primary-800/20 inline-block">
                                            {llmStatus.currentModel}
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-6 text-surface-500 text-sm">
                                    {llmTesting
                                        ? 'Verificando conexión...'
                                        : 'Haz clic en "Verificar" para probar la conexión'
                                    }
                                </div>
                            )}
                        </div>

                        {/* Model selector */}
                        {llmStatus && (
                            <div className="glass-card p-5 space-y-4">
                                <h2 className="text-base font-semibold text-surface-100 flex items-center gap-2">
                                    <span>🧠</span> Seleccionar modelo
                                </h2>

                                {llmStatus.models.length === 0 ? (
                                    <div className="text-center py-6 text-surface-500 text-sm">
                                        {llmStatus.connected
                                            ? 'No se encontraron modelos disponibles en el servidor.'
                                            : 'Conecta el servidor para ver los modelos disponibles.'}
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-2">
                                            {llmStatus.models.map(m => (
                                                <label
                                                    key={m.name}
                                                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border
                                                        ${selectedModel === m.name
                                                            ? 'bg-primary-500/10 border-primary-500/30 text-primary-300'
                                                            : 'bg-surface-800/30 border-primary-800/20 text-surface-300 hover:bg-surface-800/60'
                                                        }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="model"
                                                        value={m.name}
                                                        checked={selectedModel === m.name}
                                                        onChange={() => setSelectedModel(m.name)}
                                                        className="accent-primary-400"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-mono font-medium">{m.name}</p>
                                                        {m.size && (
                                                            <p className="text-xs text-surface-500 mt-0.5">
                                                                {(m.size / 1e9).toFixed(1)} GB
                                                            </p>
                                                        )}
                                                    </div>
                                                    {llmStatus.currentModel === m.name && (
                                                        <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                            activo
                                                        </span>
                                                    )}
                                                </label>
                                            ))}
                                        </div>

                                        <button
                                            onClick={saveModel}
                                            disabled={llmSaving || !selectedModel || selectedModel === llmStatus.currentModel}
                                            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-40"
                                        >
                                            {llmSaving
                                                ? <><span className="animate-spin inline-block">↺</span> Guardando...</>
                                                : <><span>✓</span> Usar este modelo</>
                                            }
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Info note */}
                        <div className="text-xs text-surface-500 px-1 space-y-1">
                            <p>• El modelo seleccionado se usa para generar análisis IA al calcular evaluaciones y al regenerar análisis desde el panel de administración.</p>
                            <p>• Los cambios de proveedor/modelo son efectivos inmediatamente y persisten mientras el servidor esté activo. Para hacerlos permanentes, actualiza <span className="font-mono text-surface-400">.env</span> y reinicia el contenedor.</p>
                        </div>
                    </div>
                )}

                {/* ── Assessments view ─────────────────────────────────────── */}
                {mainView === 'assessments' && (<>

                {/* Filters */}
                <div className="glass-card p-4 mb-4 flex flex-wrap gap-3">
                    <input
                        type="text"
                        placeholder="Buscar por cliente, industria o consultor..."
                        className="input-field flex-1 min-w-48 text-sm"
                        value={filters.search}
                        onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                    />
                    <select
                        className="input-field text-sm w-36"
                        value={filters.status}
                        onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                    >
                        <option value="">Todos los estados</option>
                        <option value="DRAFT">Borrador</option>
                        <option value="IN_PROGRESS">En progreso</option>
                        <option value="COMPLETED">Completado</option>
                    </select>
                    <select
                        className="input-field text-sm w-32"
                        value={filters.type}
                        onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
                    >
                        <option value="">Todo tipo</option>
                        <option value="EXPRESS">Express</option>
                        <option value="ADVANCED">Advanced</option>
                    </select>
                    <select
                        className="input-field text-sm w-36"
                        value={filters.risk}
                        onChange={e => setFilters(f => ({ ...f, risk: e.target.value }))}
                    >
                        <option value="">Todo riesgo</option>
                        {Object.entries(RISK_CFG).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                        ))}
                    </select>
                </div>

                {/* Table */}
                <div className="glass-card overflow-x-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-16 text-surface-500">
                            <p className="text-4xl mb-3">📭</p>
                            <p>No hay evaluaciones que coincidan con los filtros</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-primary-800/20">
                                    {['Cliente', 'Industria', 'Tipo', 'Estado', 'Score', 'Madurez', 'Riesgo', 'IA', 'Consultor', 'Fecha', ''].map(h => (
                                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(row => (
                                    <tr
                                        key={row.id}
                                        onClick={() => openDetail(row.id)}
                                        className={`border-b border-primary-800/10 hover:bg-primary-500/5 cursor-pointer transition-colors ${detail?.id === row.id ? 'bg-primary-500/10' : ''}`}
                                    >
                                        <td className="px-4 py-3 font-medium text-surface-200 whitespace-nowrap max-w-36 truncate">
                                            {row.client.name}
                                        </td>
                                        <td className="px-4 py-3 text-surface-400 whitespace-nowrap max-w-28 truncate">
                                            {row.client.industry ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={`badge-info text-xs px-2 py-0.5 rounded-full`}>
                                                {row.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={`${STATUS_CFG[row.status]?.cls} text-xs px-2 py-0.5 rounded-full`}>
                                                {STATUS_CFG[row.status]?.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-surface-300 font-mono whitespace-nowrap">
                                            {row.overallScore != null ? row.overallScore.toFixed(2) : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-surface-400 whitespace-nowrap">
                                            {row.maturityLevel != null ? `${row.maturityLevel} · ${MATURITY[row.maturityLevel] ?? ''}` : '—'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {row.riskLevel
                                                ? <span className={`${RISK_CFG[row.riskLevel]?.cls} text-xs px-2 py-0.5 rounded-full`}>{RISK_CFG[row.riskLevel]?.label}</span>
                                                : <span className="text-surface-500">—</span>
                                            }
                                        </td>
                                        <td className="px-4 py-3 text-center whitespace-nowrap">
                                            <span title={row.hasLlmAnalysis ? 'Análisis IA disponible' : 'Sin análisis IA'}
                                                className={row.hasLlmAnalysis ? 'text-emerald-400' : 'text-surface-600'}>
                                                {row.hasLlmAnalysis ? '✦' : '○'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-surface-400 whitespace-nowrap max-w-28 truncate">
                                            {row.createdBy.name}
                                        </td>
                                        <td className="px-4 py-3 text-surface-500 whitespace-nowrap text-xs">
                                            {new Date(row.createdAt).toLocaleDateString('es-ES')}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => handleDelete(row.id, row.client.name)}
                                                disabled={deleting === row.id}
                                                className="text-xs text-red-400/60 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10 disabled:opacity-40"
                                                title="Eliminar evaluación"
                                            >
                                                {deleting === row.id ? '...' : '🗑'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                </>)}
            </div>

            {/* ── Right: Detail panel ──────────────────────────────────────── */}
            {(detail || detailLoading) && (
                <div className="w-full max-w-xl ml-4 flex flex-col slide-in">
                    <div className="glass-card flex-1 overflow-y-auto flex flex-col">

                        {/* Panel header */}
                        <div className="flex items-start justify-between p-5 border-b border-primary-800/20">
                            <div>
                                <h2 className="text-lg font-semibold text-surface-100">
                                    {detail?.client.name ?? '...'}
                                </h2>
                                <p className="text-xs text-surface-500 mt-0.5">
                                    {detail?.client.industry ?? ''} · {detail?.type}
                                </p>
                            </div>
                            <button
                                onClick={() => setDetail(null)}
                                className="text-surface-500 hover:text-surface-200 transition-colors text-xl leading-none ml-4"
                            >
                                ×
                            </button>
                        </div>

                        {detailLoading ? (
                            <div className="flex items-center justify-center flex-1 py-12">
                                <div className="animate-spin w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full" />
                            </div>
                        ) : detail && (
                            <>
                                {/* Tabs */}
                                <div className="flex border-b border-primary-800/20 px-4">
                                    {([
                                        { key: 'info',    label: 'Cliente'    },
                                        { key: 'results', label: 'Resultados' },
                                        { key: 'answers', label: 'Respuestas' },
                                        { key: 'llm',     label: 'Análisis IA'},
                                    ] as const).map(tab => (
                                        <button
                                            key={tab.key}
                                            onClick={() => setActiveTab(tab.key)}
                                            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap
                                                ${activeTab === tab.key
                                                    ? 'border-primary-400 text-primary-400'
                                                    : 'border-transparent text-surface-500 hover:text-surface-300'
                                                }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="p-5 flex-1 overflow-y-auto space-y-4">

                                    {/* ── Tab: Cliente ───────────────────── */}
                                    {activeTab === 'info' && (
                                        <div className="space-y-4">
                                            <InfoRow label="Empresa"    value={detail.client.name} />
                                            <InfoRow label="Industria"  value={detail.client.industry ?? '—'} />
                                            <InfoRow label="Contacto"   value={detail.client.contactName ?? '—'} />
                                            <InfoRow label="Email"      value={detail.client.contactEmail ?? '—'} />
                                            <InfoRow label="Consultor"  value={`${detail.createdBy.name} (${detail.createdBy.email})`} />
                                            <InfoRow label="Tipo"       value={detail.type} />
                                            <InfoRow label="Estado"     value={STATUS_CFG[detail.status]?.label} />
                                            <InfoRow label="Creado"     value={new Date(detail.createdAt).toLocaleString('es-ES')} />
                                            <InfoRow label="Completado" value={detail.completedAt ? new Date(detail.completedAt).toLocaleString('es-ES') : '—'} />
                                            <InfoRow label="Respuestas" value={`${detail._count.answers} preguntas respondidas`} />
                                        </div>
                                    )}

                                    {/* ── Tab: Resultados ────────────────── */}
                                    {activeTab === 'results' && (
                                        <div className="space-y-4">
                                            {detail.status !== 'COMPLETED' ? (
                                                <p className="text-surface-500 text-sm text-center py-8">
                                                    La evaluación aún no está completada.
                                                </p>
                                            ) : (
                                                <>
                                                    {/* Summary cards */}
                                                    <div className="grid grid-cols-3 gap-3">
                                                        <MiniCard label="Score" value={detail.overallScore?.toFixed(2) ?? '—'} sub="/ 4.0" />
                                                        <MiniCard label="Madurez" value={`N${detail.maturityLevel ?? '—'}`} sub={MATURITY[detail.maturityLevel ?? 0] ?? ''} />
                                                        <MiniCard
                                                            label="Riesgo"
                                                            value={RISK_CFG[detail.riskLevel ?? '']?.label ?? '—'}
                                                            sub=""
                                                            valueClass={detail.riskLevel === 'CRITICAL' || detail.riskLevel === 'HIGH' ? 'text-red-400' : 'text-emerald-400'}
                                                        />
                                                    </div>

                                                    {/* Pillar scores */}
                                                    <div>
                                                        <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">
                                                            Scores por Pilar
                                                        </h3>
                                                        <div className="space-y-2">
                                                            {detail.pillarScores.map(ps => (
                                                                <div key={ps.pillar.key}>
                                                                    <div className="flex justify-between text-xs mb-1">
                                                                        <span className="text-surface-300">{ps.pillar.name}</span>
                                                                        <span className="text-surface-400 font-mono">{ps.score.toFixed(2)}</span>
                                                                    </div>
                                                                    <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                                                                        <div
                                                                            className="h-full rounded-full transition-all"
                                                                            style={{
                                                                                width: `${(ps.score / 4) * 100}%`,
                                                                                background: ps.score < 1.5 ? '#EF4444' : ps.score < 2.5 ? '#F59E0B' : ps.score < 3.5 ? '#3B82F6' : '#10B981',
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* ── Tab: Respuestas ────────────────── */}
                                    {activeTab === 'answers' && (
                                        <div className="space-y-5">
                                            {detail.answers.length === 0 ? (
                                                <p className="text-surface-500 text-sm text-center py-8">
                                                    Sin respuestas registradas.
                                                </p>
                                            ) : (() => {
                                                // Group by pillar
                                                const byPillar: Record<string, typeof detail.answers> = {};
                                                for (const a of detail.answers) {
                                                    const k = a.question.pillar.name;
                                                    if (!byPillar[k]) byPillar[k] = [];
                                                    byPillar[k].push(a);
                                                }
                                                return Object.entries(byPillar).map(([pillarName, answers]) => (
                                                    <div key={pillarName}>
                                                        <h3 className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                            <span className="h-px flex-1 bg-primary-800/40" />
                                                            {pillarName}
                                                            <span className="h-px flex-1 bg-primary-800/40" />
                                                        </h3>
                                                        <div className="space-y-2">
                                                            {answers.map(a => (
                                                                <div key={a.id} className="flex items-start gap-3 bg-surface-800/30 rounded-lg p-3">
                                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-mono whitespace-nowrap mt-0.5 ${
                                                                        a.notApplicable   ? 'bg-surface-700 text-surface-400'
                                                                        : a.score === 5   ? 'bg-emerald-500/20 text-emerald-400'
                                                                        : a.score === 3   ? 'bg-amber-500/20 text-amber-400'
                                                                        : 'bg-red-500/20 text-red-400'
                                                                    }`}>
                                                                        {a.notApplicable ? 'N/A' : ANSWER_LABELS[a.score] ?? `${a.score}`}
                                                                    </span>
                                                                    <p className="text-xs text-surface-300 leading-relaxed">{a.question.text}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    )}

                                    {/* ── Tab: Análisis IA ───────────────── */}
                                    {activeTab === 'llm' && (
                                        <div className="space-y-4">
                                            {detail.llmAnalysis ? (
                                                <>
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-xs text-surface-500">
                                                            Modelo: <span className="text-primary-400">{detail.llmAnalysis.model}</span>
                                                            {' · '}
                                                            {new Date(detail.llmAnalysis.generatedAt).toLocaleString('es-ES')}
                                                        </div>
                                                        <button
                                                            onClick={handleRegenerate}
                                                            disabled={regenerating}
                                                            className="btn-secondary text-xs flex items-center gap-1.5"
                                                        >
                                                            {regenerating ? <span className="animate-spin">↺</span> : '↺'} Regenerar
                                                        </button>
                                                    </div>
                                                    <LLMSection title="Resumen Ejecutivo"    text={detail.llmAnalysis.executiveSummary} />
                                                    <LLMSection title="Mensaje de Conciencia" text={detail.llmAnalysis.awarenessMessage} />
                                                    <LLMSection title="Benchmark Sectorial"  text={detail.llmAnalysis.industryBenchmark} />

                                                    {detail.llmAnalysis.improvementPlan && (
                                                        <div>
                                                            <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Plan de Mejora</h4>
                                                            <div className="space-y-3">
                                                                <div>
                                                                    <p className="text-xs text-primary-400 font-medium mb-1">Victorias rápidas (&lt;90 días)</p>
                                                                    <ul className="space-y-1">
                                                                        {detail.llmAnalysis.improvementPlan.quickWins?.map((w: string, i: number) => (
                                                                            <li key={i} className="text-xs text-surface-300 flex gap-2">
                                                                                <span className="text-primary-400 font-bold">{i + 1}.</span>{w}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs text-amber-400 font-medium mb-1">Prioridades estratégicas (&gt;90 días)</p>
                                                                    <ul className="space-y-1">
                                                                        {detail.llmAnalysis.improvementPlan.longTerm?.map((w: string, i: number) => (
                                                                            <li key={i} className="text-xs text-surface-300 flex gap-2">
                                                                                <span className="text-amber-400 font-bold">{i + 1}.</span>{w}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {detail.llmAnalysis.pillarAnalyses && Object.entries(detail.llmAnalysis.pillarAnalyses).length > 0 && (
                                                        <div>
                                                            <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Análisis por Pilar</h4>
                                                            <div className="space-y-3">
                                                                {Object.entries(detail.llmAnalysis.pillarAnalyses).map(([key, val]: [string, any]) => (
                                                                    <div key={key} className="bg-surface-800/40 rounded-lg p-3 space-y-1.5">
                                                                        <p className="text-xs font-semibold text-primary-300 uppercase">{key.replace(/_/g, ' ')}</p>
                                                                        {val.findings     && <p className="text-xs text-surface-400"><span className="text-surface-300 font-medium">Hallazgos:</span> {val.findings}</p>}
                                                                        {val.gaps         && <p className="text-xs text-surface-400"><span className="text-surface-300 font-medium">Brechas:</span> {val.gaps}</p>}
                                                                        {val.recommendation && <p className="text-xs text-surface-400"><span className="text-surface-300 font-medium">Rec.:</span> {val.recommendation}</p>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="text-center py-8 space-y-4">
                                                    <p className="text-4xl">🤖</p>
                                                    <p className="text-surface-400 text-sm">No hay análisis IA disponible para esta evaluación.</p>
                                                    {detail.status === 'COMPLETED' && (
                                                        <button
                                                            onClick={handleRegenerate}
                                                            disabled={regenerating}
                                                            className="btn-primary text-sm flex items-center gap-2 mx-auto"
                                                        >
                                                            {regenerating
                                                                ? <><span className="animate-spin">↺</span> Generando...</>
                                                                : <><span>✦</span> Generar Análisis IA</>
                                                            }
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Panel footer — actions */}
                                {detail.status === 'COMPLETED' && (
                                    <div className="p-4 border-t border-primary-800/20 flex flex-wrap gap-2">
                                        <button
                                            onClick={() => downloadReport(detail.id, 'pdf')}
                                            className="btn-primary text-xs flex items-center gap-1.5"
                                        >
                                            📄 PDF
                                        </button>
                                        <button
                                            onClick={() => downloadReport(detail.id, 'csv')}
                                            className="btn-secondary text-xs flex items-center gap-1.5"
                                        >
                                            📊 CSV
                                        </button>
                                        <button
                                            onClick={() => downloadReport(detail.id, 'json')}
                                            className="btn-secondary text-xs flex items-center gap-1.5"
                                        >
                                            { } JSON
                                        </button>
                                        <div className="flex-1" />
                                        <button
                                            onClick={() => handleDelete(detail.id, detail.client.name)}
                                            disabled={deleting === detail.id}
                                            className="text-xs text-red-400/70 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                                        >
                                            {deleting === detail.id ? 'Eliminando...' : '🗑 Eliminar'}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start gap-3 py-2 border-b border-primary-800/10 last:border-0">
            <span className="text-xs text-surface-500 w-24 shrink-0 pt-0.5">{label}</span>
            <span className="text-sm text-surface-200 break-all">{value}</span>
        </div>
    );
}

function MiniCard({ label, value, sub, valueClass = 'text-primary-400' }: {
    label: string; value: string; sub: string; valueClass?: string;
}) {
    return (
        <div className="bg-surface-800/50 rounded-xl p-3 text-center border border-primary-800/20">
            <p className="text-xs text-surface-500 mb-1">{label}</p>
            <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
            {sub && <p className="text-xs text-surface-500 mt-0.5">{sub}</p>}
        </div>
    );
}

function LLMSection({ title, text }: { title: string; text: string }) {
    return (
        <div>
            <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">{title}</h4>
            <p className="text-xs text-surface-300 leading-relaxed bg-surface-800/30 rounded-lg p-3">{text}</p>
        </div>
    );
}
