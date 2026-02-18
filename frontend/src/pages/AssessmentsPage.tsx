import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

const RISK_CONFIG: Record<string, { label: string; color: string }> = {
    CONTROLLED: { label: 'Controlado', color: 'badge-success' },
    LOW: { label: 'Bajo', color: 'badge-success' },
    MEDIUM: { label: 'Medio', color: 'badge-warning' },
    HIGH: { label: 'Alto', color: 'badge-danger' },
    CRITICAL: { label: 'Crítico', color: 'badge-danger' },
    LATENT: { label: 'Latente', color: 'badge-info' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'Borrador', color: 'badge-neutral' },
    IN_PROGRESS: { label: 'En progreso', color: 'badge-warning' },
    COMPLETED: { label: 'Completado', color: 'badge-success' },
};

export default function AssessmentsPage() {
    const [assessments, setAssessments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({ status: '', type: '' });
    const navigate = useNavigate();

    useEffect(() => {
        const params: any = {};
        if (filter.status) params.status = filter.status;
        if (filter.type) params.type = filter.type;
        api.get('/assessments', { params })
            .then(res => setAssessments(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [filter]);

    return (
        <div className="space-y-6 fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-100">Evaluaciones</h1>
                    <p className="text-sm text-surface-500 mt-1">Historial de evaluaciones de madurez</p>
                </div>
                <button onClick={() => navigate('/assessments/new')} className="btn-primary">
                    + Nueva Evaluación
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <select
                    value={filter.status}
                    onChange={e => setFilter({ ...filter, status: e.target.value })}
                    className="input-field w-auto min-w-[160px]"
                >
                    <option value="">Todos los estados</option>
                    <option value="DRAFT">Borrador</option>
                    <option value="IN_PROGRESS">En progreso</option>
                    <option value="COMPLETED">Completado</option>
                </select>
                <select
                    value={filter.type}
                    onChange={e => setFilter({ ...filter, type: e.target.value })}
                    className="input-field w-auto min-w-[160px]"
                >
                    <option value="">Todos los tipos</option>
                    <option value="EXPRESS">Express</option>
                    <option value="ADVANCED">Advanced</option>
                </select>
            </div>

            {/* Assessments Grid */}
            {loading ? (
                <div className="flex items-center justify-center h-32">
                    <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {assessments.map(a => {
                        const statusCfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.DRAFT;
                        const riskCfg = RISK_CONFIG[a.riskLevel || 'MEDIUM'];
                        return (
                            <div
                                key={a.id}
                                onClick={() => {
                                    if (a.status === 'COMPLETED') navigate(`/assessments/${a.id}/results`);
                                    else navigate(`/assessments/new?resume=${a.id}`);
                                }}
                                className="glass-card-hover p-5 cursor-pointer"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <p className="text-sm font-semibold text-surface-200">{a.client?.name}</p>
                                        <p className="text-xs text-surface-500 mt-0.5">{a.createdBy?.name}</p>
                                    </div>
                                    <span className={statusCfg.color}>{statusCfg.label}</span>
                                </div>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="badge-info">{a.type}</span>
                                    {a.riskLevel && (
                                        <span className={riskCfg.color}>{riskCfg.label}</span>
                                    )}
                                </div>
                                {a.status === 'COMPLETED' && (
                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-700/50">
                                        <div>
                                            <p className="text-xs text-surface-500">Score</p>
                                            <p className="text-lg font-bold text-surface-200">{a.overallScore?.toFixed(2)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-surface-500">Madurez</p>
                                            <p className="text-lg font-bold text-primary-400">Nivel {a.maturityLevel}</p>
                                        </div>
                                    </div>
                                )}
                                <p className="text-[10px] text-surface-600 mt-3">
                                    {new Date(a.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                            </div>
                        );
                    })}
                    {assessments.length === 0 && (
                        <div className="col-span-full text-center py-12 text-surface-500">
                            No se encontraron evaluaciones
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
