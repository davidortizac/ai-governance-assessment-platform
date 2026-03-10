import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

const STATUS_STYLE: Record<string, { color: string; label: string }> = {
    COMPLETED:   { color: 'text-emerald-400', label: 'Completado'   },
    IN_PROGRESS: { color: 'text-amber-400',   label: 'En progreso'  },
    DRAFT:       { color: 'text-surface-500', label: 'Borrador'     },
};

const RISK_CONFIG: Record<string, { label: string; color: string }> = {
    CONTROLLED: { label: 'Controlado', color: 'text-emerald-400' },
    LOW:        { label: 'Bajo',        color: 'text-emerald-400' },
    MEDIUM:     { label: 'Medio',       color: 'text-amber-400'   },
    HIGH:       { label: 'Alto',        color: 'text-red-400'     },
    CRITICAL:   { label: 'Crítico',     color: 'text-red-500'     },
    LATENT:     { label: 'Latente',     color: 'text-violet-400'  },
};

const MATURITY_LABELS: Record<number, string> = {
    1: 'Experimental',
    2: 'Emergente',
    3: 'Definido',
    4: 'Gestionado',
    5: 'Optimizado',
};

interface Assessment {
    id: string;
    type: string;
    status: string;
    overallScore: number | null;
    maturityLevel: number | null;
    riskLevel: string | null;
    completedAt: string | null;
    createdAt: string;
}

interface ClientData {
    id: string;
    name: string;
    industry: string | null;
    contactEmail: string | null;
    contactName: string | null;
    assessments: Assessment[];
}

interface DashboardStats {
    totalClients: number;
    totalAssessments: number;
    completedAssessments: number;
    avgMaturityScore: number;
}

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [clients, setClients] = useState<ClientData[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        Promise.all([
            api.get('/dashboard/stats'),
            api.get('/dashboard/clients'),
        ])
            .then(([statsRes, clientsRes]) => {
                setStats(statsRes.data);
                setClients(clientsRes.data);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filtered = clients.filter(c => {
        if (search.trim() === '') return true;
        const q = search.toLowerCase();
        return c.name.toLowerCase().includes(q) || (c.industry ?? '').toLowerCase().includes(q);
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6 fade-in">
            <div>
                <h1 className="text-2xl font-bold text-surface-100">Dashboard</h1>
                <p className="text-sm text-surface-500 mt-1">Clientes y evolución de sus evaluaciones de madurez en IA</p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="stat-card" style={{ '--accent-from': '#3B82F6', '--accent-to': '#06B6D4' } as React.CSSProperties}>
                    <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Clientes</p>
                    <p className="text-3xl font-bold text-surface-100 mt-2">{stats?.totalClients ?? 0}</p>
                    <p className="text-xs text-surface-500 mt-1">Organizaciones registradas</p>
                </div>
                <div className="stat-card" style={{ '--accent-from': '#8B5CF6', '--accent-to': '#EC4899' } as React.CSSProperties}>
                    <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Evaluaciones Completadas</p>
                    <p className="text-3xl font-bold text-surface-100 mt-2">{stats?.completedAssessments ?? 0}</p>
                    <p className="text-xs text-surface-500 mt-1">de {stats?.totalAssessments ?? 0} totales</p>
                </div>
                <div className="stat-card" style={{ '--accent-from': '#10B981', '--accent-to': '#06B6D4' } as React.CSSProperties}>
                    <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Score Promedio</p>
                    <p className="text-3xl font-bold text-surface-100 mt-2">{stats?.avgMaturityScore ?? '—'}</p>
                    <p className="text-xs text-surface-500 mt-1">de 4.0 posibles</p>
                </div>
            </div>

            {/* CSIA Framework Info */}
            <div className="glass-card p-6 space-y-5">
                <div>
                    <h2 className="text-lg font-bold text-surface-100">Metodología CSIA — AI Cybersecurity Maturity Assessment</h2>
                    <p className="text-sm text-surface-400 mt-2 leading-relaxed">
                        La evaluación CSIA mide el nivel de madurez de una organización en la adopción segura y gobernada de inteligencia artificial,
                        analizando seis pilares estratégicos que cubren desde la gobernanza y cumplimiento normativo hasta la protección técnica
                        de modelos y datos. El resultado permite identificar brechas, priorizar acciones y establecer una hoja de ruta de mejora continua.
                    </p>
                </div>

                {/* Frameworks */}
                <div>
                    <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Marcos de Referencia Integrados</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-xl p-4 border-l-[3px]" style={{ borderColor: '#3B82F6', background: 'rgba(59,130,246,0.06)' }}>
                            <p className="text-sm font-semibold text-surface-200">NIST AI RMF</p>
                            <p className="text-xs text-surface-500 mt-1">Marco de gestión de riesgos de IA del NIST — Govern, Map, Measure, Manage.</p>
                        </div>
                        <div className="rounded-xl p-4 border-l-[3px]" style={{ borderColor: '#7C3AED', background: 'rgba(124,58,237,0.06)' }}>
                            <p className="text-sm font-semibold text-surface-200">MITRE ATLAS</p>
                            <p className="text-xs text-surface-500 mt-1">Tácticas y técnicas adversarias contra sistemas de machine learning.</p>
                        </div>
                        <div className="rounded-xl p-4 border-l-[3px]" style={{ borderColor: '#059669', background: 'rgba(5,150,105,0.06)' }}>
                            <p className="text-sm font-semibold text-surface-200">Gartner TRiSM</p>
                            <p className="text-xs text-surface-500 mt-1">Trust, Risk and Security Management para IA — confianza, riesgo y seguridad.</p>
                        </div>
                    </div>
                </div>

                {/* Scoring scale */}
                <div>
                    <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Escala de Calificación (0 – 4)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                        {[
                            { score: 0, label: 'Inexistente', color: '#DC2626', desc: 'No existen prácticas, controles ni conciencia sobre el tema evaluado.' },
                            { score: 1, label: 'Inicial', color: '#F97316', desc: 'Esfuerzos ad-hoc o reactivos, sin procesos formalizados.' },
                            { score: 2, label: 'Emergente', color: '#D97706', desc: 'Procesos parcialmente definidos, aplicados de forma inconsistente.' },
                            { score: 3, label: 'Definido', color: '#2563EB', desc: 'Procesos documentados, implementados y monitoreados regularmente.' },
                            { score: 4, label: 'Optimizado', color: '#059669', desc: 'Mejora continua, automatización e innovación activa.' },
                        ].map(item => (
                            <div key={item.score} className="rounded-xl p-3 border border-surface-700/50" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white" style={{ background: item.color }}>
                                        {item.score}
                                    </span>
                                    <span className="text-sm font-semibold text-surface-200">{item.label}</span>
                                </div>
                                <p className="text-[11px] text-surface-500 leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Assessment procedure */}
                <div className="rounded-xl p-4" style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)' }}>
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#C9A84C' }}>Procedimiento de Evaluación</h3>
                    <ol className="text-xs text-surface-400 space-y-1 list-decimal list-inside leading-relaxed">
                        <li>Registrar la organización a evaluar como cliente de la plataforma.</li>
                        <li>Crear un assessment (Express o Avanzado) asociado al cliente.</li>
                        <li>Responder cada pregunta de los 6 pilares CSIA usando la escala 0-4.</li>
                        <li>Al completar, el sistema calcula scores por pilar, score general, nivel de madurez y nivel de riesgo.</li>
                        <li>Un modelo de IA analiza los resultados y genera un informe con hallazgos, brechas y recomendaciones.</li>
                        <li>Descargar el reporte PDF profesional con el análisis completo.</li>
                    </ol>
                </div>
            </div>

            {/* Search + header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar cliente o industria..."
                    className="input-field max-w-sm"
                />
                <span className="text-xs text-surface-500">{filtered.length} cliente{filtered.length === 1 ? '' : 's'}</span>
            </div>

            {/* Client cards */}
            <div className="space-y-4">
                {filtered.length === 0 && (
                    <div className="glass-card p-12 text-center text-surface-500 text-sm">
                        No se encontraron clientes
                    </div>
                )}

                {filtered.map(client => {
                    // Sort assessments oldest → newest to assign version numbers
                    const sorted = [...client.assessments].sort(
                        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                    );

                    // Score trend between last two completed assessments
                    const completed = sorted.filter(a => a.status === 'COMPLETED');
                    const latest = completed[completed.length - 1];
                    const prev   = completed[completed.length - 2];
                    const scoreDelta =
                        latest?.overallScore != null && prev?.overallScore != null
                            ? Number(latest.overallScore) - Number(prev.overallScore)
                            : null;

                    return (
                        <div key={client.id} className="glass-card overflow-hidden">

                            {/* ── Card header: click → AssessmentsPage filtered by client ── */}
                            <button
                                type="button"
                                className="w-full flex items-center justify-between px-6 py-4 border-b border-surface-700/50 cursor-pointer hover:bg-surface-800/30 transition-colors text-left"
                                onClick={() => navigate(`/assessments?clientId=${client.id}`)}
                                title="Ver todas las evaluaciones de este cliente"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    {/* Avatar letter */}
                                    <div className="w-9 h-9 rounded-lg bg-primary-500/10 flex items-center justify-center flex-shrink-0">
                                        <span className="text-primary-400 font-bold text-sm">
                                            {client.name.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-surface-100 truncate">{client.name}</p>
                                        <p className="text-xs text-surface-500 truncate">
                                            {client.contactEmail || client.contactName || '—'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                                    {client.industry && (
                                        <span className="badge-info text-xs hidden sm:inline">{client.industry}</span>
                                    )}
                                    {/* Score trend indicator */}
                                    {scoreDelta !== null && (
                                        <span className={`text-xs font-semibold ${scoreDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {scoreDelta >= 0 ? '▲' : '▼'} {Math.abs(scoreDelta).toFixed(2)}
                                        </span>
                                    )}
                                    <span className="text-xs text-surface-500">{client.assessments.length} eval.</span>
                                    <span className="text-surface-500 text-sm">→</span>
                                </div>
                            </button>

                            {/* ── Assessment history table ── */}
                            {sorted.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-surface-800/40">
                                                <th className="text-left px-6 py-2 text-xs text-surface-500 font-medium w-12">Ver.</th>
                                                <th className="text-left px-6 py-2 text-xs text-surface-500 font-medium">Tipo</th>
                                                <th className="text-left px-6 py-2 text-xs text-surface-500 font-medium">Fecha</th>
                                                <th className="text-left px-6 py-2 text-xs text-surface-500 font-medium">Score</th>
                                                <th className="text-left px-6 py-2 text-xs text-surface-500 font-medium hidden md:table-cell">Madurez</th>
                                                <th className="text-left px-6 py-2 text-xs text-surface-500 font-medium hidden lg:table-cell">Riesgo</th>
                                                <th className="text-left px-6 py-2 text-xs text-surface-500 font-medium">Estado</th>
                                                <th className="px-6 py-2 w-28" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-surface-800/25">
                                            {sorted.map((a, idx) => {
                                                const risk        = RISK_CONFIG[a.riskLevel ?? ''];
                                                const maturity    = a.maturityLevel ? MATURITY_LABELS[a.maturityLevel] : '—';
                                                const date        = a.completedAt ?? a.createdAt;
                                                const statusStyle = STATUS_STYLE[a.status] ?? STATUS_STYLE['DRAFT'];

                                                return (
                                                    <tr key={a.id} className="hover:bg-surface-800/20 transition-colors">
                                                        <td className="px-6 py-3 text-xs text-surface-600 font-mono">v{idx + 1}</td>
                                                        <td className="px-6 py-3 text-xs text-surface-400">{a.type}</td>
                                                        <td className="px-6 py-3 text-xs text-surface-400 whitespace-nowrap">
                                                            {new Date(date).toLocaleDateString('es-ES')}
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            {a.overallScore == null
                                                                ? <span className="text-xs text-surface-600">—</span>
                                                                : <span className="text-sm font-bold text-surface-200">{Number(a.overallScore).toFixed(2)}</span>
                                                            }
                                                        </td>
                                                        <td className="px-6 py-3 text-xs text-surface-400 hidden md:table-cell">{maturity}</td>
                                                        <td className="px-6 py-3 hidden lg:table-cell">
                                                            {risk
                                                                ? <span className={`text-xs font-medium ${risk.color}`}>{risk.label}</span>
                                                                : <span className="text-xs text-surface-600">—</span>
                                                            }
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <span className={`text-xs font-medium ${statusStyle.color}`}>
                                                                {statusStyle.label}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-3 text-right">
                                                            {a.status === 'COMPLETED' && (
                                                                <button
                                                                    onClick={() => navigate(`/assessments/${a.id}/results`)}
                                                                    className="text-xs text-primary-400 hover:text-primary-300 font-medium"
                                                                >
                                                                    Ver resultados →
                                                                </button>
                                                            )}
                                                            {a.status !== 'COMPLETED' && (
                                                                <button
                                                                    onClick={() => navigate(`/assessments/new?resume=${a.id}`)}
                                                                    className="text-xs text-surface-500 hover:text-surface-400 font-medium"
                                                                >
                                                                    Continuar →
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="px-6 py-5 text-xs text-surface-600">Sin evaluaciones registradas</div>
                            )}

                            {/* ── Card footer ── */}
                            <div className="px-6 py-3 border-t border-surface-800/40 flex justify-end">
                                <button
                                    onClick={() => navigate('/assessments/new')}
                                    className="text-xs text-primary-400 hover:text-primary-300 font-medium"
                                >
                                    + Nueva evaluación
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
