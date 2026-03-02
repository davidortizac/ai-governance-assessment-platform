import React, { useEffect, useState } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { useAuth } from '../context/AuthContext';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend
);

const API_URL = import.meta.env.VITE_API_URL;

export default function AnalyticsPage() {
    const { token } = useAuth();
    const [riskTrends, setRiskTrends] = useState<any[]>([]);
    const [maturityGap, setMaturityGap] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const headers = { Authorization: `Bearer ${token}` };

                const [trendsRes, gapRes] = await Promise.all([
                    fetch(`${API_URL}/analytics/risk-trends`, { headers }),
                    fetch(`${API_URL}/analytics/maturity-gap`, { headers })
                ]);

                if (trendsRes.ok) setRiskTrends(await trendsRes.json());
                if (gapRes.ok) setMaturityGap(await gapRes.json());

            } catch (error) {
                console.error('Error fetching analytics:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [token]);

    const lineChartData = {
        labels: riskTrends.map(d => d.month),
        datasets: [
            {
                label: 'Crítico',
                data: riskTrends.map(d => d.CRITICAL || 0),
                borderColor: 'rgb(239, 68, 68)',
                backgroundColor: 'rgba(239, 68, 68, 0.5)',
            },
            {
                label: 'Alto',
                data: riskTrends.map(d => d.HIGH || 0),
                borderColor: 'rgb(248, 113, 113)',
                backgroundColor: 'rgba(248, 113, 113, 0.5)',
            },
            {
                label: 'Medio',
                data: riskTrends.map(d => d.MEDIUM || 0),
                borderColor: 'rgb(251, 191, 36)',
                backgroundColor: 'rgba(251, 191, 36, 0.5)',
            },
        ],
    };

    const barChartData = {
        labels: maturityGap.map(d => d.pillar),
        datasets: [
            {
                label: 'Tu Organización',
                data: maturityGap.map(d => d.yourScore),
                backgroundColor: 'rgba(139, 92, 246, 0.6)',
            },
            {
                label: 'Promedio Industria',
                data: maturityGap.map(d => d.industryBenchmark),
                backgroundColor: 'rgba(148, 163, 184, 0.6)',
            },
        ],
    };

    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: { color: '#e2e8f0' }
            },
            title: {
                display: false,
            },
        },
        scales: {
            y: {
                ticks: { color: '#94a3b8' },
                grid: { color: 'rgba(148, 163, 184, 0.1)' }
            },
            x: {
                ticks: { color: '#94a3b8' },
                grid: { color: 'rgba(148, 163, 184, 0.1)' }
            }
        }
    };

    if (loading) return <div className="p-8 text-center text-surface-400">Cargando analítica...</div>;

    return (
        <div className="space-y-8 fade-in">
            <div>
                <h1 className="text-2xl font-bold text-surface-100">Analítica Avanzada</h1>
                <p className="text-sm text-surface-500 mt-1">Tendencias de riesgo y comparativas de mercado</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-card p-6 border border-primary-800/30">
                    <h3 className="text-lg font-semibold text-surface-100 mb-4">Tendencias de Riesgo (Últimos 6 meses)</h3>
                    {riskTrends.length > 0 ? (
                        <Line options={options} data={lineChartData} />
                    ) : (
                        <p className="text-center text-surface-500 py-10">No hay suficientes datos históricos</p>
                    )}
                </div>

                <div className="glass-card p-6 border border-primary-800/30">
                    <h3 className="text-lg font-semibold text-surface-100 mb-4">Análisis de Brecha de Madurez</h3>
                    {maturityGap.length > 0 ? (
                        <Bar options={options} data={barChartData} />
                    ) : (
                        <p className="text-center text-surface-500 py-10">No hay datos de evaluaciones completadas</p>
                    )}
                </div>
            </div>
        </div>
    );
}
