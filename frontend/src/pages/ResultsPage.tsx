import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import RadarChart from '../components/RadarChart';

const RISK_CONFIG: Record<string, { label: string; color: string; description: string }> = {
    CONTROLLED: { label: 'Controlado', color: 'text-emerald-400', description: 'Alta adopción con gobernanza y seguridad sólidas' },
    LOW: { label: 'Bajo', color: 'text-emerald-400', description: 'Buen balance entre adopción y controles' },
    MEDIUM: { label: 'Medio', color: 'text-amber-400', description: 'Se requieren mejoras en gobernanza o seguridad' },
    HIGH: { label: 'Alto', color: 'text-red-400', description: 'Alta adopción con seguridad insuficiente' },
    CRITICAL: { label: 'Crítico', color: 'text-red-500', description: 'Alta adopción sin gobernanza adecuada' },
    LATENT: { label: 'Latente', color: 'text-violet-400', description: 'Baja adopción con baja gobernanza' },
};

const MATURITY = [
    { level: 1, label: 'Experimental', range: '0 – 0.9', description: 'Iniciativas aisladas sin estructura formal' },
    { level: 2, label: 'Emergente', range: '1.0 – 1.9', description: 'Primeros esfuerzos organizados de adopción' },
    { level: 3, label: 'Definido', range: '2.0 – 2.9', description: 'Procesos documentados y replicables' },
    { level: 4, label: 'Gestionado', range: '3.0 – 3.5', description: 'Métricas de control y mejora continua' },
    { level: 5, label: 'Optimizado', range: '3.6 – 4.0', description: 'Innovación continua y liderazgo en IA' },
];

export default function ResultsPage() {
    const { id } = useParams<{ id: string }>();
    const [assessment, setAssessment] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        api.get(`/assessments/${id}`)
            .then(res => setAssessment(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [id]);

    const handleDownloadPDF = async () => {
        try {
            const res = await api.get(`/reports/${id}/pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `assessment-report-${id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!assessment) return <p className="text-surface-500">Evaluación no encontrada</p>;

    const riskCfg = RISK_CONFIG[assessment.riskLevel || 'MEDIUM'];
    const radarLabels = assessment.pillarScores?.map((ps: any) => ps.pillar.name) || [];
    const radarData = assessment.pillarScores?.map((ps: any) => ps.score) || [];

    return (
        <div className="max-w-4xl mx-auto space-y-6 fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-100">Resultados de Evaluación</h1>
                    <p className="text-sm text-surface-500 mt-1">
                        {assessment.client?.name} · {assessment.type} · {assessment.completedAt ? new Date(assessment.completedAt).toLocaleDateString('es-ES') : 'N/A'}
                    </p>
                </div>
                <button onClick={handleDownloadPDF} className="btn-primary flex items-center gap-2">
                    <span>📄</span>
                    <span>Descargar PDF</span>
                </button>
            </div>

            {/* Score Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass-card p-6 text-center">
                    <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Score General</p>
                    <p className="text-4xl font-bold text-surface-100 mt-2">{assessment.overallScore?.toFixed(2)}</p>
                    <p className="text-xs text-surface-500 mt-1">de 4.00</p>
                    <div className="mt-3 h-2 bg-surface-800 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-primary-600 to-accent-cyan transition-all duration-1000"
                            style={{ width: `${(assessment.overallScore / 4) * 100}%` }}
                        />
                    </div>
                </div>

                <div className="glass-card p-6 text-center">
                    <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Nivel de Madurez</p>
                    <p className="text-4xl font-bold text-primary-400 mt-2">{assessment.maturityLevel}</p>
                    <p className="text-sm text-surface-400 mt-1 font-medium">
                        {MATURITY.find(m => m.level === assessment.maturityLevel)?.label}
                    </p>
                </div>

                <div className="glass-card p-6 text-center">
                    <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Nivel de Riesgo</p>
                    <p className={`text-2xl font-bold mt-2 ${riskCfg.color}`}>{riskCfg.label}</p>
                    <p className="text-xs text-surface-500 mt-2">{riskCfg.description}</p>
                </div>
            </div>

            {/* Radar Chart */}
            <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-surface-100 mb-4">Radar de Madurez por Pilar</h3>
                <div className="max-w-lg mx-auto">
                    <RadarChart
                        labels={radarLabels}
                        datasets={[{ label: assessment.client?.name || 'Evaluación', data: radarData }]}
                    />
                </div>
            </div>

            {/* Pillar Breakdown */}
            <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-surface-100 mb-4">Detalle por Pilar</h3>
                <div className="space-y-4">
                    {assessment.pillarScores?.map((ps: any) => {
                        const score = ps.score;
                        const barColor = score < 1.5 ? 'from-red-500 to-red-400'
                            : score < 2.5 ? 'from-amber-500 to-amber-400'
                                : score < 3.5 ? 'from-primary-500 to-primary-400'
                                    : 'from-emerald-500 to-emerald-400';

                        return (
                            <div key={ps.id} className="p-4 bg-surface-800/30 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-semibold text-surface-200">{ps.pillar.name}</h4>
                                    <span className="text-sm font-bold text-surface-200">{score.toFixed(2)} / 4.0</span>
                                </div>
                                <div className="h-3 bg-surface-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
                                        style={{ width: `${(score / 4) * 100}%` }}
                                    />
                                </div>
                                <p className="text-xs text-surface-500 mt-1">
                                    {ps.answeredCount} de {ps.totalCount} preguntas respondidas
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Maturity Scale */}
            <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-surface-100 mb-4">Escala de Madurez</h3>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                    {MATURITY.map(m => (
                        <div
                            key={m.level}
                            className={`p-3 rounded-lg text-center border transition-all ${assessment.maturityLevel === m.level
                                    ? 'border-primary-500/50 bg-primary-500/10 ring-1 ring-primary-500/20'
                                    : 'border-surface-700/30 bg-surface-800/30'
                                }`}
                        >
                            <p className={`text-lg font-bold ${assessment.maturityLevel === m.level ? 'text-primary-400' : 'text-surface-400'}`}>
                                {m.level}
                            </p>
                            <p className="text-xs font-medium text-surface-300 mt-1">{m.label}</p>
                            <p className="text-[10px] text-surface-500 mt-0.5">{m.range}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
