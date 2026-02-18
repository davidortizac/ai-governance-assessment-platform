import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import RadarChart from '../components/RadarChart';

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    CONTROLLED: { label: 'Controlado', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    LOW: { label: 'Bajo', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    MEDIUM: { label: 'Medio', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    HIGH: { label: 'Alto', color: 'text-red-400', bg: 'bg-red-500/10' },
    CRITICAL: { label: 'Crítico', color: 'text-red-500', bg: 'bg-red-500/10' },
    LATENT: { label: 'Latente', color: 'text-violet-400', bg: 'bg-violet-500/10' },
};

const MATURITY_LABELS: Record<number, string> = {
    1: 'Experimental',
    2: 'Emergente',
    3: 'Definido',
    4: 'Gestionado',
    5: 'Optimizado',
};

interface DashboardStats {
    totalClients: number;
    totalAssessments: number;
    completedAssessments: number;
    avgMaturityScore: number;
    riskDistribution: { level: string; count: number }[];
    recentAssessments: any[];
}

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/dashboard/stats')
            .then(res => setStats(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!stats) return null;

    // Get the latest assessment for the radar chart
    const latestAssessment = stats.recentAssessments[0];
    const radarLabels = latestAssessment?.pillarScores?.map((ps: any) => ps.pillar.name) || [];
    const radarData = latestAssessment?.pillarScores?.map((ps: any) => ps.score) || [];

    const maturityLevel = Math.round(stats.avgMaturityScore) || 0;
    const maturityLabel = stats.avgMaturityScore < 1 ? 'Experimental'
        : stats.avgMaturityScore < 2 ? 'Emergente'
            : stats.avgMaturityScore < 3 ? 'Definido'
                : stats.avgMaturityScore <= 3.5 ? 'Gestionado'
                    : 'Optimizado';

    return (
        <div className="space-y-6 fade-in">
            <div>
                <h1 className="text-2xl font-bold text-surface-100">Dashboard</h1>
                <p className="text-sm text-surface-500 mt-1">Resumen general de evaluaciones de madurez en IA</p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="stat-card" style={{ '--accent-from': '#3B82F6', '--accent-to': '#06B6D4' } as React.CSSProperties}>
                    <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Clientes</p>
                    <p className="text-3xl font-bold text-surface-100 mt-2">{stats.totalClients}</p>
                    <p className="text-xs text-surface-500 mt-1">Organizaciones registradas</p>
                </div>
                <div className="stat-card" style={{ '--accent-from': '#8B5CF6', '--accent-to': '#EC4899' } as React.CSSProperties}>
                    <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Evaluaciones</p>
                    <p className="text-3xl font-bold text-surface-100 mt-2">{stats.completedAssessments}</p>
                    <p className="text-xs text-surface-500 mt-1">de {stats.totalAssessments} totales completadas</p>
                </div>
                <div className="stat-card" style={{ '--accent-from': '#10B981', '--accent-to': '#06B6D4' } as React.CSSProperties}>
                    <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Score Promedio</p>
                    <p className="text-3xl font-bold text-surface-100 mt-2">{stats.avgMaturityScore}</p>
                    <p className="text-xs text-surface-500 mt-1">de 4.0 posibles</p>
                </div>
                <div className="stat-card" style={{ '--accent-from': '#F59E0B', '--accent-to': '#EF4444' } as React.CSSProperties}>
                    <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Madurez Promedio</p>
                    <p className="text-3xl font-bold text-surface-100 mt-2">Nivel {maturityLevel || '-'}</p>
                    <p className="text-xs text-surface-500 mt-1">{maturityLabel}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Radar Chart */}
                <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-surface-100 mb-4">
                        Radar de Madurez por Pilar
                    </h3>
                    {radarLabels.length > 0 ? (
                        <div className="max-w-md mx-auto">
                            <RadarChart
                                labels={radarLabels}
                                datasets={[{
                                    label: latestAssessment?.client?.name || 'Última evaluación',
                                    data: radarData,
                                }]}
                            />
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-surface-500 text-sm">
                            No hay evaluaciones completadas aún
                        </div>
                    )}
                </div>

                {/* Risk Distribution + Recent */}
                <div className="space-y-6">
                    {/* Risk Distribution */}
                    <div className="glass-card p-6">
                        <h3 className="text-lg font-semibold text-surface-100 mb-4">Distribución de Riesgo</h3>
                        {stats.riskDistribution.length > 0 ? (
                            <div className="space-y-3">
                                {stats.riskDistribution.map((r) => {
                                    const config = RISK_CONFIG[r.level || 'MEDIUM'];
                                    const total = stats.riskDistribution.reduce((s, x) => s + x.count, 0);
                                    const pct = total > 0 ? (r.count / total) * 100 : 0;
                                    return (
                                        <div key={r.level} className="flex items-center gap-3">
                                            <span className={`text-sm font-medium w-24 ${config?.color}`}>
                                                {config?.label || r.level}
                                            </span>
                                            <div className="flex-1 h-3 bg-surface-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${config?.bg} transition-all duration-500`}
                                                    style={{
                                                        width: `${pct}%`,
                                                        backgroundColor: config?.color?.includes('emerald') ? '#10B981'
                                                            : config?.color?.includes('amber') ? '#F59E0B'
                                                                : config?.color?.includes('violet') ? '#8B5CF6'
                                                                    : '#EF4444',
                                                    }}
                                                />
                                            </div>
                                            <span className="text-sm font-semibold text-surface-300 w-8 text-right">{r.count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-surface-500">Sin datos de riesgo</p>
                        )}
                    </div>

                    {/* Recent Assessments */}
                    <div className="glass-card p-6">
                        <h3 className="text-lg font-semibold text-surface-100 mb-4">Evaluaciones Recientes</h3>
                        {stats.recentAssessments.length > 0 ? (
                            <div className="space-y-3">
                                {stats.recentAssessments.slice(0, 4).map((a: any) => {
                                    const riskCfg = RISK_CONFIG[a.riskLevel || 'MEDIUM'];
                                    return (
                                        <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-800/30 hover:bg-surface-800/50 transition-colors">
                                            <div>
                                                <p className="text-sm font-medium text-surface-200">{a.client?.name}</p>
                                                <p className="text-xs text-surface-500">
                                                    {a.type} · {new Date(a.completedAt).toLocaleDateString('es-ES')}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-surface-200">{a.overallScore?.toFixed(2)}</p>
                                                <span className={`text-xs ${riskCfg?.color}`}>{riskCfg?.label}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-surface-500">Sin evaluaciones recientes</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
