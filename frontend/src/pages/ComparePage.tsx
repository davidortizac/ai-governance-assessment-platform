import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import RadarChart from '../components/RadarChart';

export default function ComparePage() {
    const [assessments, setAssessments] = useState<any[]>([]);
    const [selectedA, setSelectedA] = useState('');
    const [selectedB, setSelectedB] = useState('');
    const [comparison, setComparison] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get('/assessments', { params: { status: 'COMPLETED' } })
            .then(res => setAssessments(res.data))
            .catch(console.error);
    }, []);

    const handleCompare = async () => {
        if (!selectedA || !selectedB) return;
        setLoading(true);
        try {
            const res = await api.get(`/assessments/compare/${selectedA}/${selectedB}`);
            setComparison(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 fade-in">
            <div>
                <h1 className="text-2xl font-bold text-surface-100">Comparar Evaluaciones</h1>
                <p className="text-sm text-surface-500 mt-1">Compare dos evaluaciones lado a lado</p>
            </div>

            {/* Selection */}
            <div className="glass-card p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-surface-400 mb-2">Evaluación A</label>
                        <select
                            value={selectedA}
                            onChange={e => setSelectedA(e.target.value)}
                            className="input-field"
                        >
                            <option value="">Seleccionar...</option>
                            {assessments.map(a => (
                                <option key={a.id} value={a.id}>
                                    {a.client?.name} - {a.type} ({new Date(a.completedAt).toLocaleDateString('es-ES')})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-surface-400 mb-2">Evaluación B</label>
                        <select
                            value={selectedB}
                            onChange={e => setSelectedB(e.target.value)}
                            className="input-field"
                        >
                            <option value="">Seleccionar...</option>
                            {assessments.filter(a => a.id !== selectedA).map(a => (
                                <option key={a.id} value={a.id}>
                                    {a.client?.name} - {a.type} ({new Date(a.completedAt).toLocaleDateString('es-ES')})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <button
                    onClick={handleCompare}
                    disabled={!selectedA || !selectedB || loading}
                    className="btn-primary mt-4"
                >
                    {loading ? 'Comparando...' : 'Comparar'}
                </button>
            </div>

            {/* Results */}
            {comparison && (
                <>
                    {/* Overall comparison */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="glass-card p-5 text-center">
                            <p className="text-xs text-surface-500 uppercase tracking-wider">Evaluación A</p>
                            <p className="text-2xl font-bold text-surface-200 mt-1">
                                {comparison.assessmentA.overallScore?.toFixed(2)}
                            </p>
                            <p className="text-xs text-surface-500">{comparison.assessmentA.client?.name}</p>
                        </div>
                        <div className="glass-card p-5 text-center flex flex-col items-center justify-center">
                            <p className="text-xs text-surface-500 uppercase tracking-wider">Diferencia</p>
                            <p className={`text-2xl font-bold mt-1 ${comparison.overallDelta > 0 ? 'text-emerald-400' : comparison.overallDelta < 0 ? 'text-red-400' : 'text-surface-400'
                                }`}>
                                {comparison.overallDelta > 0 ? '+' : ''}{comparison.overallDelta.toFixed(2)}
                            </p>
                        </div>
                        <div className="glass-card p-5 text-center">
                            <p className="text-xs text-surface-500 uppercase tracking-wider">Evaluación B</p>
                            <p className="text-2xl font-bold text-surface-200 mt-1">
                                {comparison.assessmentB.overallScore?.toFixed(2)}
                            </p>
                            <p className="text-xs text-surface-500">{comparison.assessmentB.client?.name}</p>
                        </div>
                    </div>

                    {/* Overlaid Radar */}
                    <div className="glass-card p-6">
                        <h3 className="text-lg font-semibold text-surface-100 mb-4">Radar Comparativo</h3>
                        <div className="max-w-lg mx-auto">
                            <RadarChart
                                labels={comparison.comparison.map((c: any) => c.pillar)}
                                datasets={[
                                    {
                                        label: `A: ${comparison.assessmentA.client?.name}`,
                                        data: comparison.comparison.map((c: any) => c.scoreA),
                                    },
                                    {
                                        label: `B: ${comparison.assessmentB.client?.name}`,
                                        data: comparison.comparison.map((c: any) => c.scoreB),
                                    },
                                ]}
                            />
                        </div>
                    </div>

                    {/* Delta Table */}
                    <div className="glass-card overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-surface-700/50">
                                    <th className="text-left px-6 py-4 text-xs font-medium text-surface-500 uppercase">Pilar</th>
                                    <th className="text-center px-6 py-4 text-xs font-medium text-surface-500 uppercase">Score A</th>
                                    <th className="text-center px-6 py-4 text-xs font-medium text-surface-500 uppercase">Score B</th>
                                    <th className="text-center px-6 py-4 text-xs font-medium text-surface-500 uppercase">Delta</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-800/50">
                                {comparison.comparison.map((c: any) => (
                                    <tr key={c.pillarKey} className="hover:bg-surface-800/30">
                                        <td className="px-6 py-4 text-sm font-medium text-surface-200">{c.pillar}</td>
                                        <td className="px-6 py-4 text-center text-sm text-surface-300">{c.scoreA.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-center text-sm text-surface-300">{c.scoreB.toFixed(2)}</td>
                                        <td className={`px-6 py-4 text-center text-sm font-semibold ${c.delta > 0 ? 'text-emerald-400' : c.delta < 0 ? 'text-red-400' : 'text-surface-500'
                                            }`}>
                                            {c.delta > 0 ? '+' : ''}{c.delta.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
