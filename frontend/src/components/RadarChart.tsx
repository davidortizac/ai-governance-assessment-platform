import React from 'react';
import {
    Chart as ChartJS,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface RadarChartProps {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        borderColor?: string;
        backgroundColor?: string;
    }[];
    maxValue?: number;
}

export default function RadarChart({ labels, datasets, maxValue = 4 }: RadarChartProps) {
    const colors = [
        { border: 'rgba(59, 130, 246, 0.9)', bg: 'rgba(59, 130, 246, 0.15)' },
        { border: 'rgba(6, 182, 212, 0.9)', bg: 'rgba(6, 182, 212, 0.15)' },
        { border: 'rgba(139, 92, 246, 0.9)', bg: 'rgba(139, 92, 246, 0.15)' },
    ];

    const data = {
        labels,
        datasets: datasets.map((ds, i) => ({
            label: ds.label,
            data: ds.data,
            borderColor: ds.borderColor || colors[i % colors.length].border,
            backgroundColor: ds.backgroundColor || colors[i % colors.length].bg,
            borderWidth: 2,
            pointBackgroundColor: ds.borderColor || colors[i % colors.length].border,
            pointBorderColor: '#0F172A',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
        })),
    };

    const options = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: {
                    color: '#94A3B8',
                    padding: 20,
                    font: { family: 'Inter', size: 12 },
                    usePointStyle: true,
                    pointStyleWidth: 8,
                },
            },
            tooltip: {
                backgroundColor: '#1E293B',
                titleColor: '#E2E8F0',
                bodyColor: '#CBD5E1',
                borderColor: '#334155',
                borderWidth: 1,
                padding: 12,
                titleFont: { family: 'Inter', size: 13, weight: '600' as const },
                bodyFont: { family: 'Inter', size: 12 },
                callbacks: {
                    label: (context: any) => `${context.dataset.label}: ${context.parsed.r.toFixed(2)} / ${maxValue}`,
                },
            },
        },
        scales: {
            r: {
                min: 0,
                max: maxValue,
                ticks: {
                    stepSize: 1,
                    color: '#64748B',
                    backdropColor: 'transparent',
                    font: { size: 10 },
                },
                grid: {
                    color: 'rgba(71, 85, 105, 0.3)',
                    circular: true,
                },
                pointLabels: {
                    color: '#CBD5E1',
                    font: { family: 'Inter', size: 11, weight: '500' as const },
                    padding: 15,
                },
                angleLines: {
                    color: 'rgba(71, 85, 105, 0.2)',
                },
            },
        },
    };

    return <Radar data={data} options={options as any} />;
}
