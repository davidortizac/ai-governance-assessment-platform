import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma';
import { getMaturityLabel } from './scoring.service';

const RISK_LABELS: Record<string, string> = {
    CONTROLLED: 'Controlado',
    LOW: 'Bajo',
    MEDIUM: 'Medio',
    HIGH: 'Alto',
    CRITICAL: 'Crítico',
    LATENT: 'Latente',
};

const RISK_COLORS: Record<string, string> = {
    CONTROLLED: '#10B981',
    LOW: '#34D399',
    MEDIUM: '#F59E0B',
    HIGH: '#EF4444',
    CRITICAL: '#DC2626',
    LATENT: '#8B5CF6',
};

export async function generatePDFReport(assessmentId: string): Promise<Buffer> {
    const assessment = await prisma.assessment.findUnique({
        where: { id: assessmentId },
        include: {
            client: true,
            createdBy: { select: { name: true, email: true } },
            pillarScores: {
                include: { pillar: true },
                orderBy: { pillar: { order: 'asc' } },
            },
            answers: {
                include: { question: { include: { pillar: true } } },
            },
        },
    });

    if (!assessment) throw new Error('Assessment not found');

    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({ size: 'A4', margin: 50 });

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ============ COVER PAGE ============
        doc.rect(0, 0, doc.page.width, doc.page.height).fill('#0F172A');

        doc.fontSize(32).fillColor('#E2E8F0').font('Helvetica-Bold')
            .text('AI Governance &', 50, 180, { align: 'center' });
        doc.fontSize(32).fillColor('#38BDF8')
            .text('Security Assessment', 50, 220, { align: 'center' });

        doc.moveDown(2);
        doc.fontSize(16).fillColor('#94A3B8').font('Helvetica')
            .text(`Reporte de Evaluación`, 50, 300, { align: 'center' });

        doc.moveDown(2);
        doc.fontSize(14).fillColor('#CBD5E1')
            .text(`Cliente: ${assessment.client.name}`, 50, 380, { align: 'center' });
        doc.text(`Tipo: ${assessment.type === 'EXPRESS' ? 'Express (20 min)' : 'Advanced (60-90 min)'}`, { align: 'center' });
        doc.text(`Fecha: ${assessment.completedAt?.toLocaleDateString('es-ES') ?? 'N/A'}`, { align: 'center' });
        doc.text(`Evaluador: ${assessment.createdBy.name}`, { align: 'center' });

        // ============ EXECUTIVE SUMMARY PAGE ============
        doc.addPage();
        doc.rect(0, 0, doc.page.width, 4).fill('#38BDF8');

        doc.fontSize(24).fillColor('#0F172A').font('Helvetica-Bold')
            .text('Resumen Ejecutivo', 50, 40);

        doc.moveDown(1);

        // Overall Score Box
        const scoreY = 100;
        doc.roundedRect(50, scoreY, 150, 100, 8).fill('#F1F5F9');
        doc.fontSize(12).fillColor('#64748B').font('Helvetica')
            .text('Score General', 50, scoreY + 10, { width: 150, align: 'center' });
        doc.fontSize(36).fillColor('#0F172A').font('Helvetica-Bold')
            .text(`${assessment.overallScore?.toFixed(2) ?? '0'}`, 50, scoreY + 35, { width: 150, align: 'center' });
        doc.fontSize(10).fillColor('#94A3B8').font('Helvetica')
            .text('de 4.0', 50, scoreY + 75, { width: 150, align: 'center' });

        // Maturity Level Box
        doc.roundedRect(220, scoreY, 150, 100, 8).fill('#F1F5F9');
        doc.fontSize(12).fillColor('#64748B').font('Helvetica')
            .text('Nivel de Madurez', 220, scoreY + 10, { width: 150, align: 'center' });
        doc.fontSize(36).fillColor('#0F172A').font('Helvetica-Bold')
            .text(`${assessment.maturityLevel ?? 0}`, 220, scoreY + 35, { width: 150, align: 'center' });
        doc.fontSize(10).fillColor('#94A3B8').font('Helvetica')
            .text(getMaturityLabel(assessment.maturityLevel ?? 0), 220, scoreY + 75, { width: 150, align: 'center' });

        // Risk Level Box
        const riskColor = RISK_COLORS[assessment.riskLevel ?? 'MEDIUM'] || '#F59E0B';
        doc.roundedRect(390, scoreY, 150, 100, 8).fill('#F1F5F9');
        doc.fontSize(12).fillColor('#64748B').font('Helvetica')
            .text('Nivel de Riesgo', 390, scoreY + 10, { width: 150, align: 'center' });
        doc.fontSize(20).fillColor(riskColor).font('Helvetica-Bold')
            .text(RISK_LABELS[assessment.riskLevel ?? 'MEDIUM'] || 'Medio', 390, scoreY + 45, { width: 150, align: 'center' });

        // ============ PILLAR SCORES ============
        doc.moveDown(6);
        doc.fontSize(20).fillColor('#0F172A').font('Helvetica-Bold')
            .text('Scores por Pilar', 50, 240);

        let pillarY = 275;
        for (const ps of assessment.pillarScores) {
            // Pillar name
            doc.fontSize(11).fillColor('#334155').font('Helvetica-Bold')
                .text(ps.pillar.name, 50, pillarY, { width: 200 });

            // Score bar background
            doc.roundedRect(260, pillarY, 200, 16, 4).fill('#E2E8F0');

            // Score bar fill
            const fillWidth = (ps.score / 4) * 200;
            const barColor = ps.score < 1.5 ? '#EF4444' : ps.score < 2.5 ? '#F59E0B' : ps.score < 3.5 ? '#3B82F6' : '#10B981';
            if (fillWidth > 0) {
                doc.roundedRect(260, pillarY, fillWidth, 16, 4).fill(barColor);
            }

            // Score value
            doc.fontSize(11).fillColor('#0F172A').font('Helvetica-Bold')
                .text(`${ps.score.toFixed(2)} / 4.0`, 470, pillarY, { width: 80 });

            // Count info
            doc.fontSize(8).fillColor('#94A3B8').font('Helvetica')
                .text(`(${ps.answeredCount}/${ps.totalCount} respondidas)`, 470, pillarY + 14, { width: 80 });

            pillarY += 40;
        }

        // ============ RECOMMENDATIONS PAGE ============
        doc.addPage();
        doc.rect(0, 0, doc.page.width, 4).fill('#38BDF8');

        doc.fontSize(24).fillColor('#0F172A').font('Helvetica-Bold')
            .text('Recomendaciones', 50, 40);

        let recY = 80;
        for (const ps of assessment.pillarScores) {
            const recommendation = getRecommendation(ps.pillar.key, ps.score);

            doc.fontSize(13).fillColor('#1E293B').font('Helvetica-Bold')
                .text(`${ps.pillar.name} (${ps.score.toFixed(2)})`, 50, recY);
            recY += 20;

            doc.fontSize(10).fillColor('#475569').font('Helvetica')
                .text(recommendation, 60, recY, { width: 480 });
            recY += doc.heightOfString(recommendation, { width: 480 }) + 15;

            if (recY > 700) {
                doc.addPage();
                doc.rect(0, 0, doc.page.width, 4).fill('#38BDF8');
                recY = 40;
            }
        }

        // Footer
        doc.fontSize(8).fillColor('#94A3B8')
            .text('Generado por AI Governance & Security Assessment Platform', 50, 760, { align: 'center' });

        doc.end();
    });
}

function getRecommendation(pillarKey: string, score: number): string {
    const recommendations: Record<string, Record<string, string>> = {
        strategy_governance: {
            low: 'Se recomienda establecer un comité de gobernanza de IA con roles y responsabilidades claras. Definir políticas de uso aceptable de IA y crear un marco ético para la adopción de tecnologías de IA.',
            medium: 'Fortalecer el marco de gobernanza existente con KPIs específicos de IA. Implementar revisiones periódicas de políticas y alinear la estrategia de IA con los objetivos de negocio.',
            high: 'Optimizar la gobernanza continua con retroalimentación automatizada. Considerar certificaciones de IA responsable y liderar iniciativas de estándares en la industria.',
        },
        employee_usage: {
            low: 'Desarrollar un programa de capacitación básica en IA para empleados. Identificar casos de uso de IA que aporten valor inmediato y crear guías de uso aceptable.',
            medium: 'Expandir la capacitación a herramientas avanzadas de IA. Establecer comunidades de práctica y medir el impacto de la adopción de IA en la productividad.',
            high: 'Fomentar la innovación liderada por empleados con IA. Implementar programas de mentoría en IA y crear un centro de excelencia de IA.',
        },
        ai_development: {
            low: 'Comenzar con proyectos piloto de IA bien definidos. Establecer estándares de desarrollo de IA y capacitar al equipo técnico en MLOps básico.',
            medium: 'Implementar pipelines de CI/CD para modelos de IA. Establecer prácticas de testing de modelos y documentación técnica de soluciones de IA.',
            high: 'Adoptar arquitecturas de IA escalables y reutilizables. Implementar monitoreo continuo de modelos en producción y contribuir a la comunidad open source.',
        },
        agents_integrations: {
            low: 'Evaluar oportunidades para integrar agentes de IA en procesos existentes. Comenzar con automatizaciones simples basadas en reglas antes de avanzar a agentes autónomos.',
            medium: 'Expandir las integraciones de agentes a procesos más complejos. Implementar orquestación multi-agente y establecer políticas de supervisión.',
            high: 'Optimizar la autonomía de agentes con guardrails robustos. Implementar sistemas de retroalimentación continua y explorar agentes colaborativos avanzados.',
        },
        infrastructure: {
            low: 'Evaluar la infraestructura actual para cargas de trabajo de IA. Considerar opciones cloud para computación de IA y establecer políticas de seguridad de datos.',
            medium: 'Implementar infraestructura dedicada para IA con escalabilidad. Establecer monitoreo de recursos y optimizar costos de computación.',
            high: 'Adoptar infraestructura de IA de siguiente generación. Implementar edge computing para IA cuando sea aplicable y optimizar la eficiencia energética.',
        },
        ai_security: {
            low: 'Realizar una evaluación de riesgos de seguridad de IA. Implementar controles básicos de acceso a modelos y datos. Establecer políticas de privacidad de datos para IA.',
            medium: 'Implementar adversarial testing y red teaming para modelos. Establecer monitoreo de seguridad específico para IA y capacitar al equipo en seguridad de IA.',
            high: 'Adoptar frameworks de seguridad de IA maduros. Implementar detección automatizada de amenazas con IA y liderar prácticas de seguridad de IA responsable.',
        },
    };

    const level = score < 1.5 ? 'low' : score < 3.0 ? 'medium' : 'high';
    return recommendations[pillarKey]?.[level] || 'Continuar con las prácticas actuales y buscar oportunidades de mejora continua.';
}
