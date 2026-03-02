import React, { useEffect, useState } from 'react';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    PointElement, LineElement, Title, Tooltip, Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import api from '../lib/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

// ─── Framework definitions ────────────────────────────────────────────────────
const FRAMEWORKS = {
    NIST_AI_RMF: {
        name: 'NIST AI Risk Management Framework',
        shortName: 'NIST AI RMF',
        badge: 'NIST',
        color: '#3B82F6',
        description: 'Marco publicado por NIST en enero 2023. Define 4 funciones para gestionar riesgos de IA: Govern, Map, Measure y Manage.',
        pillars: {
            strategy_governance: { function: 'GOVERN',  minimum: 3.0, market: 2.3 },
            infrastructure:      { function: 'MEASURE', minimum: 2.5, market: 2.1 },
            ai_security:         { function: 'MEASURE', minimum: 3.0, market: 1.9 },
            employee_usage:      { function: 'MANAGE',  minimum: 2.5, market: 2.0 },
            ai_development:      { function: 'MAP',     minimum: 2.5, market: 1.8 },
            agents_integrations: { function: 'MAP',     minimum: 2.0, market: 1.4 },
        } as Record<string, { function: string; minimum: number; market: number }>,
    },
    MITRE_ATLAS: {
        name: 'MITRE ATLAS (Adversarial Threat Landscape for AI)',
        shortName: 'MITRE ATLAS',
        badge: 'ATLAS',
        color: '#EF4444',
        description: 'Catálogo de tácticas y técnicas de ataque a sistemas de ML. Análogo al MITRE ATT&CK aplicado a IA. Foco en defensa adversarial.',
        pillars: {
            strategy_governance: { function: 'Governance',           minimum: 2.0, market: 2.0 },
            infrastructure:      { function: 'Infrastructure Defense', minimum: 3.0, market: 2.2 },
            ai_security:         { function: 'ML Defense',            minimum: 3.5, market: 2.0 },
            employee_usage:      { function: 'Operational Security',  minimum: 2.0, market: 1.9 },
            ai_development:      { function: 'Supply Chain Security', minimum: 3.0, market: 1.8 },
            agents_integrations: { function: 'Agent Security',        minimum: 2.5, market: 1.6 },
        } as Record<string, { function: string; minimum: number; market: number }>,
    },
} as const;

type FrameworkKey = keyof typeof FRAMEWORKS;

interface PillarAvg { key: string; name: string; avgScore: number; assessmentCount: number; }

// ─── Component ────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
    const [framework, setFramework]   = useState<FrameworkKey>('NIST_AI_RMF');
    const [pillars, setPillars]       = useState<PillarAvg[]>([]);
    const [riskTrends, setRiskTrends] = useState<any[]>([]);
    const [loading, setLoading]       = useState(true);

    useEffect(() => {
        Promise.all([
            api.get('/analytics/pillar-averages'),
            api.get('/analytics/risk-trends'),
        ]).then(([p, r]) => {
            setPillars(p.data);
            setRiskTrends(r.data);
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    const fw = FRAMEWORKS[framework];
    const assessmentCount = pillars[0]?.assessmentCount ?? 0;

    // Build benchmark data
    const benchmarkData = pillars.map(p => {
        const ref = fw.pillars[p.key];
        const gap = ref ? +(p.avgScore - ref.minimum).toFixed(2) : 0;
        const status = !ref ? 'neutral'
            : p.avgScore >= ref.minimum    ? 'ok'
            : p.avgScore >= ref.minimum - 0.5 ? 'warn'
            : 'critical';
        return { ...p, ref, gap, status };
    });

    // Chart data
    const chartLabels = benchmarkData.map(p => p.name);
    const chartData = {
        labels: chartLabels,
        datasets: [
            {
                label: 'Tu organización',
                data: benchmarkData.map(p => p.avgScore),
                backgroundColor: 'rgba(139, 92, 246, 0.8)',
                borderRadius: 4,
            },
            {
                label: `Mínimo ${fw.shortName}`,
                data: benchmarkData.map(p => p.ref?.minimum ?? 0),
                backgroundColor: `${fw.color}55`,
                borderColor: fw.color,
                borderWidth: 1,
                borderRadius: 4,
            },
            {
                label: 'Referencia de mercado',
                data: benchmarkData.map(p => p.ref?.market ?? 0),
                backgroundColor: 'rgba(148, 163, 184, 0.35)',
                borderRadius: 4,
            },
        ],
    };

    const chartOptions = {
        indexAxis: 'y' as const,
        responsive: true,
        plugins: {
            legend: { position: 'top' as const, labels: { color: '#cbd5e1', font: { size: 12 } } },
            tooltip: {
                callbacks: {
                    label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.raw}/4.0`,
                },
            },
        },
        scales: {
            x: {
                min: 0, max: 4,
                ticks: { color: '#94a3b8', stepSize: 0.5 },
                grid: { color: 'rgba(148, 163, 184, 0.1)' },
            },
            y: {
                ticks: { color: '#cbd5e1', font: { size: 11 } },
                grid: { display: false },
            },
        },
    };

    // Risk trend chart
    const trendData = {
        labels: riskTrends.map(d => d.month),
        datasets: [
            { label: 'Crítico', data: riskTrends.map(d => d.CRITICAL || 0), borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.15)', tension: 0.4, fill: false },
            { label: 'Alto',    data: riskTrends.map(d => d.HIGH    || 0), borderColor: '#F97316', backgroundColor: 'rgba(249,115,22,0.15)', tension: 0.4, fill: false },
            { label: 'Medio',   data: riskTrends.map(d => d.MEDIUM  || 0), borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.15)', tension: 0.4, fill: false },
            { label: 'Bajo',    data: riskTrends.map(d => d.LOW     || 0), borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.15)',  tension: 0.4, fill: false },
        ],
    };

    const trendOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'top' as const, labels: { color: '#cbd5e1', font: { size: 12 } } },
        },
        scales: {
            y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
            x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
        },
    };

    // Summary stats
    const okCount       = benchmarkData.filter(p => p.status === 'ok').length;
    const warnCount     = benchmarkData.filter(p => p.status === 'warn').length;
    const criticalCount = benchmarkData.filter(p => p.status === 'critical').length;

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
    );

    return (
        <div className="space-y-6 fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-100">Analítica de Cumplimiento</h1>
                    <p className="text-sm text-surface-400 mt-1">
                        Comparativa de madurez vs estándares internacionales de ciberseguridad para IA
                        {assessmentCount > 0 && <span className="ml-2 text-primary-400">· {assessmentCount} evaluación{assessmentCount !== 1 ? 'es' : ''} incluida{assessmentCount !== 1 ? 's' : ''}</span>}
                    </p>
                </div>

                {/* Framework toggle */}
                <div className="flex gap-1 bg-surface-800/50 p-1 rounded-xl border border-primary-800/20 shrink-0">
                    {(Object.keys(FRAMEWORKS) as FrameworkKey[]).map(key => (
                        <button
                            key={key}
                            onClick={() => setFramework(key)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                                ${framework === key
                                    ? 'text-white shadow-sm'
                                    : 'text-surface-400 hover:text-surface-200'
                                }`}
                            style={framework === key ? { backgroundColor: FRAMEWORKS[key].color + 'CC' } : {}}
                        >
                            {FRAMEWORKS[key].badge}
                        </button>
                    ))}
                </div>
            </div>

            {/* Framework description */}
            <div className="glass-card p-4 flex items-start gap-3 border-l-2" style={{ borderColor: fw.color }}>
                <div>
                    <p className="text-sm font-semibold text-surface-200">{fw.name}</p>
                    <p className="text-xs text-surface-400 mt-0.5">{fw.description}</p>
                </div>
            </div>

            {pillars.length === 0 ? (
                <div className="glass-card p-12 text-center">
                    <p className="text-4xl mb-3">📊</p>
                    <p className="text-surface-400 text-sm">No hay evaluaciones completadas para mostrar la comparativa.</p>
                    <p className="text-surface-500 text-xs mt-2">Completa al menos una evaluación para ver el análisis de cumplimiento.</p>
                </div>
            ) : (
                <>
                    {/* Summary badges */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="glass-card p-4 text-center border border-emerald-500/20">
                            <p className="text-3xl font-bold text-emerald-400">{okCount}</p>
                            <p className="text-xs text-surface-400 mt-1">Pilares que cumplen</p>
                            <p className="text-xs text-emerald-400/70 mt-0.5">≥ mínimo {fw.badge}</p>
                        </div>
                        <div className="glass-card p-4 text-center border border-amber-500/20">
                            <p className="text-3xl font-bold text-amber-400">{warnCount}</p>
                            <p className="text-xs text-surface-400 mt-1">Cerca del mínimo</p>
                            <p className="text-xs text-amber-400/70 mt-0.5">brecha &lt; 0.5 pts</p>
                        </div>
                        <div className="glass-card p-4 text-center border border-red-500/20">
                            <p className="text-3xl font-bold text-red-400">{criticalCount}</p>
                            <p className="text-xs text-surface-400 mt-1">Brechas críticas</p>
                            <p className="text-xs text-red-400/70 mt-0.5">brecha ≥ 0.5 pts</p>
                        </div>
                    </div>

                    {/* Benchmark chart */}
                    <div className="glass-card p-6">
                        <h2 className="text-base font-semibold text-surface-100 mb-4">
                            Madurez por pilar vs {fw.shortName}
                        </h2>
                        <div style={{ height: `${Math.max(280, pillars.length * 56)}px` }}>
                            <Bar data={chartData} options={chartOptions} />
                        </div>
                    </div>

                    {/* Gap table */}
                    <div className="glass-card overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-primary-800/20">
                                    {['Pilar', `Función ${fw.badge}`, 'Tu score', 'Mínimo', 'Brecha', 'Estado'].map(h => (
                                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {benchmarkData.map(p => (
                                    <tr key={p.key} className="border-b border-primary-800/10 hover:bg-surface-800/30 transition-colors">
                                        <td className="px-4 py-3 font-medium text-surface-200">{p.name}</td>
                                        <td className="px-4 py-3 text-surface-400 whitespace-nowrap">
                                            <span className="text-xs px-2 py-0.5 rounded-full border" style={{ color: fw.color, borderColor: fw.color + '44', background: fw.color + '11' }}>
                                                {p.ref?.function ?? '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-surface-200">{p.avgScore.toFixed(2)}</td>
                                        <td className="px-4 py-3 font-mono text-surface-400">{p.ref?.minimum.toFixed(1) ?? '—'}</td>
                                        <td className={`px-4 py-3 font-mono font-medium ${p.gap >= 0 ? 'text-emerald-400' : p.gap >= -0.5 ? 'text-amber-400' : 'text-red-400'}`}>
                                            {p.gap >= 0 ? '+' : ''}{p.gap.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {p.status === 'ok'       && <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full">✓ Cumple</span>}
                                            {p.status === 'warn'     && <span className="text-xs bg-amber-500/15  text-amber-400  border border-amber-500/25  px-2 py-0.5 rounded-full">⚠ Cerca</span>}
                                            {p.status === 'critical' && <span className="text-xs bg-red-500/15    text-red-400    border border-red-500/25    px-2 py-0.5 rounded-full">✗ Brecha</span>}
                                            {p.status === 'neutral'  && <span className="text-xs text-surface-500">—</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="px-4 py-3 text-xs text-surface-500 border-t border-primary-800/10">
                            Referencia de mercado promedio: {benchmarkData.map(p => p.ref?.market.toFixed(1)).join(' / ')} — Valores estimados para organizaciones en etapa de adopción de IA.
                        </div>
                    </div>

                    {/* Key insights */}
                    {criticalCount > 0 && (
                        <div className="glass-card p-5 border border-red-500/20">
                            <h3 className="text-sm font-semibold text-red-400 mb-3">Áreas prioritarias de intervención</h3>
                            <ul className="space-y-2">
                                {benchmarkData.filter(p => p.status === 'critical').map(p => (
                                    <li key={p.key} className="text-xs text-surface-300 flex items-start gap-2">
                                        <span className="text-red-400 mt-0.5 shrink-0">▸</span>
                                        <span>
                                            <span className="font-medium">{p.name}</span> — requiere mejorar {Math.abs(p.gap).toFixed(2)} puntos para alcanzar el mínimo {fw.badge} ({p.ref?.function}).
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            )}

            {/* Risk trends */}
            <div className="glass-card p-6">
                <h2 className="text-base font-semibold text-surface-100 mb-4">
                    Evolución de riesgo <span className="text-sm font-normal text-surface-500">(evaluaciones completadas)</span>
                </h2>
                {riskTrends.length > 0 ? (
                    <Line data={trendData} options={trendOptions} />
                ) : (
                    <p className="text-center text-surface-500 text-sm py-8">No hay suficientes datos históricos para mostrar tendencias</p>
                )}
            </div>
        </div>
    );
}
