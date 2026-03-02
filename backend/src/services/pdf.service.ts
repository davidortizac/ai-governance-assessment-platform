import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma';
import fs from 'fs';
import path from 'path';
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
    CONTROLLED: '#10B981', // Emerald
    LOW: '#34D399',      // Emerald Light
    MEDIUM: '#F59E0B',   // Amber
    HIGH: '#EF4444',     // Red
    CRITICAL: '#DC2626', // Red Dark
    LATENT: '#8B5CF6',   // Violet
};

// Gamma Corporate Colors
const GAMMA_PURPLE = '#4F46E5'; // Indigo/Purple
const GAMMA_DARK = '#0F172A';   // Slate 900
const GAMMA_LIGHT = '#F8FAFC';  // Slate 50

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
        const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ============ HEADER HELPER ============
        const addHeader = (title: string) => {
            doc.rect(0, 0, doc.page.width, 60).fill(GAMMA_DARK);

            // Resolve Logo Path - Try multiple locations
            const possiblePaths = [
                'e:\\IA\\GAMMA\\ASESSMENT IA\\frontend\\public\\logo-gamma.png',
                path.resolve(__dirname, '../../../../frontend/public/logo-gamma.png'), // from src/services
                path.resolve(process.cwd(), '../frontend/public/logo-gamma.png'),
                path.resolve('frontend/public/logo-gamma.png')
            ];

            let logoPath = '';
            for (const p of possiblePaths) {
                if (fs.existsSync(p)) {
                    logoPath = p;
                    break;
                }
            }

            if (logoPath) {
                try {
                    doc.image(logoPath, 50, 10, { height: 40 });
                } catch (e) {
                    console.error('Error loading logo:', e);
                    doc.fontSize(10).fillColor('#94A3B8').font('Helvetica-Bold')
                        .text('GAMMA INGENIEROS', 50, 15, { align: 'left' });
                }
            } else {
                doc.fontSize(10).fillColor('#94A3B8').font('Helvetica-Bold')
                    .text('GAMMA INGENIEROS', 50, 15, { align: 'left' });
            }

            doc.fontSize(10).fillColor('#94A3B8').font('Helvetica')
                .text('CSIA - Cybersecurity AI Strategy', 160, 25, { align: 'left' });

            doc.fontSize(16).fillColor('white').font('Helvetica-Bold')
                .text(title, 0, 20, { align: 'center', width: doc.page.width });
        };

        // ============ COVER PAGE ============
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(GAMMA_DARK);

        // Background accents
        doc.circle(doc.page.width, 0, 300).fillOpacity(0.1).fill(GAMMA_PURPLE);
        doc.circle(0, doc.page.height, 200).fillOpacity(0.1).fill('#38BDF8');
        doc.fillOpacity(1);

        // Cover Logo
        // Resolve Logo Path - Try multiple locations
        const possiblePaths = [
            'e:\\IA\\GAMMA\\ASESSMENT IA\\frontend\\public\\logo-gamma.png',
            path.resolve(__dirname, '../../../../frontend/public/logo-gamma.png'), // from src/services
            path.resolve(process.cwd(), '../frontend/public/logo-gamma.png'),
            path.resolve('frontend/public/logo-gamma.png')
        ];

        let logoPath = '';
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                logoPath = p;
                break;
            }
        }

        if (logoPath) {
            try {
                doc.image(logoPath, 50, 50, { width: 200 });
            } catch (e) { }
        } else {
            doc.fontSize(20).fillColor('white').font('Helvetica-Bold')
                .text('GAMMA INGENIEROS', 50, 50);
        }

        doc.moveDown(8);
        doc.fontSize(36).fillColor('white').font('Helvetica-Bold')
            .text('Estrategia de', { align: 'center' });
        doc.fontSize(36).fillColor('#818CF8') // Indigo 400
            .text('Ciberseguridad en IA', { align: 'center' });

        doc.moveDown(1);
        doc.fontSize(14).fillColor('#94A3B8').font('Helvetica')
            .text('Informe de Evaluación de Madurez & Riesgos', { align: 'center' });

        doc.moveDown(4);
        // Client Info Box
        doc.roundedRect(100, 400, doc.page.width - 200, 140, 10).fill('#1E293B');

        doc.fillColor('white').fontSize(16).font('Helvetica-Bold')
            .text(assessment.client.name, 100, 430, { align: 'center', width: doc.page.width - 200 });

        doc.fontSize(10).fillColor('#94A3B8').font('Helvetica')
            .text(`Fecha: ${assessment.completedAt?.toLocaleDateString('es-ES') ?? 'N/A'}`, { align: 'center' });

        doc.moveDown(2);
        doc.text(`Consultor: ${assessment.createdBy.name}`, { align: 'center' });
        doc.text(`Gamma Ingenieros S.A.S`, { align: 'center' });

        // ============ EXECUTIVE SUMMARY ============
        doc.addPage();
        addHeader('Resumen Ejecutivo');

        doc.moveDown(4);

        // Summary Grid
        const startY = 100;

        // Score
        drawCard(doc, 50, startY, 150, 120, 'Score General',
            `${assessment.overallScore?.toFixed(2)}`, 'de 4.0');

        // Maturity
        drawCard(doc, 220, startY, 150, 120, 'Nivel de Madurez',
            `${assessment.maturityLevel}`, getMaturityLabel(assessment.maturityLevel ?? 0));

        // Risk (Colored)
        const riskColor = RISK_COLORS[assessment.riskLevel ?? 'MEDIUM'];
        drawCard(doc, 390, startY, 150, 120, 'Nivel de Riesgo',
            RISK_LABELS[assessment.riskLevel ?? 'MEDIUM'] || 'Medio', '', riskColor);

        // Context Text
        doc.moveDown(8);
        doc.fontSize(14).fillColor(GAMMA_DARK).font('Helvetica-Bold').text('Análisis Situacional');
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#334155').font('Helvetica').text(
            `La organización ${assessment.client.name} presenta un nivel de madurez ${getMaturityLabel(assessment.maturityLevel ?? 0).toUpperCase()}. ` +
            `Este nivel indica que ${getMaturityDescription(assessment.maturityLevel ?? 0)}. ` +
            `El perfil de riesgo actual es ${RISK_LABELS[assessment.riskLevel ?? 'MEDIUM']}, lo cual requiere atención prioritaria en los pilares con menor desempeño para garantizar una adopción de IA segura y resiliente.`
            , { align: 'justify', width: 500 });

        // ============ MARKET CONTEXT (GARTNER 2026) ============
        doc.addPage();
        addHeader('Contexto de Mercado: Tendencias CSIA 2026');
        doc.moveDown(4);

        doc.fontSize(12).fillColor(GAMMA_PURPLE).font('Helvetica-Bold').text('Cuatro Dinámicas de la Seguridad en IA', { align: 'left' });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#334155').font('Helvetica').text(
            'El panorama de amenazas en 2026 está definido por la intersección entre atacantes y defensores utilizando Inteligencia Artificial. Su estrategia debe abordar estos cuatro frentes:',
            { align: 'justify' }
        );
        doc.moveDown(1);

        // 4 Dynamics Grid
        const dY = 180;
        drawDynamicBox(doc, 50, dY, 'Adversarios usando IA', 'Ataques más rápidos y sofisticados (Phishing, Malware).', '#EF4444');
        drawDynamicBox(doc, 300, dY, 'Defensores usando IA', 'Detección y respuesta a velocidad de máquina (AI for Security).', '#10B981');

        drawDynamicBox(doc, 50, dY + 80, 'Atacando sistemas de IA', 'Prompt Injection, Envenenamiento de modelos (Security for AI).', '#F59E0B');
        drawDynamicBox(doc, 300, dY + 80, 'Asegurando sistemas de IA', 'Protección de pipelines, datos y modelos.', '#3B82F6');

        doc.moveDown(8);
        doc.fontSize(12).fillColor(GAMMA_PURPLE).font('Helvetica-Bold').text('Riesgos Amplificados', { align: 'left' });
        doc.fontSize(10).fillColor('#334155').font('Helvetica').text(
            'La IA no solo introduce nuevos riesgos, sino que multiplica los existentes en dominios críticos:', { align: 'justify' }
        );

        const riskList = [
            '• Seguridad de Datos: Fuga de propiedad intelectual vía prompts.',
            '• Gestión de Identidad: Agentes de IA actuando con permisos excesivos.',
            '• Infraestructura Cloud: Modelos desplegados sin hardening (Shadow AI).',
            '• Aplicaciones SaaS: Integraciones de plugins no verificados.'
        ];

        doc.moveDown(0.5);
        riskList.forEach(item => {
            doc.text(item);
            doc.moveDown(0.3);
        });

        // ============ GAMMA STRATEGY & PORTFOLIO ============
        doc.addPage();
        addHeader('Estrategia de Solución Gamma Ingenieros');
        doc.moveDown(4);

        doc.fontSize(12).fillColor(GAMMA_DARK).font('Helvetica-Bold').text('Enfoque Unificado: Falcon Platform', { align: 'left' });
        doc.fontSize(10).fillColor('#334155').font('Helvetica').text(
            'Para abordar los hallazgos de esta evaluación, Gamma Ingenieros propone una estrategia basada en la plataforma Falcon de CrowdStrike, líder en protección de la era IA.',
            { align: 'justify' }
        );

        doc.moveDown(2);

        // Recommendations Mapping
        const recommendations = getPortfolioRecommendations(assessment);

        recommendations.forEach(rec => {
            const currentY = doc.y;
            // Background box
            doc.rect(50, currentY, 500, 80).fill('#F8FAFC').stroke('#E2E8F0');

            // Icon/Title area
            doc.rect(50, currentY, 6, 80).fill(rec.color);

            doc.fillColor(GAMMA_DARK).fontSize(11).font('Helvetica-Bold')
                .text(rec.module, 65, currentY + 10);

            doc.fillColor('#64748B').fontSize(9).font('Helvetica-Bold')
                .text(rec.focus.toUpperCase(), 350, currentY + 10, { align: 'right', width: 190 });

            doc.fillColor('#334155').fontSize(10).font('Helvetica')
                .text(rec.description, 65, currentY + 30, { width: 470, align: 'justify' });

            doc.y = currentY + 90; // Move down manually
        });

        // ============ DETAILED FINDINGS ============
        doc.addPage();
        addHeader('Detalle de Hallazgos por Pilar');
        doc.moveDown(4);

        let pillarY = 100;
        for (const ps of assessment.pillarScores) {
            if (pillarY > 650) {
                doc.addPage();
                addHeader('Detalle de Hallazgos por Pilar (Cont.)');
                pillarY = 100;
            }

            // Pillar Header
            doc.rect(50, pillarY, 500, 25).fill('#F1F5F9');
            doc.fillColor(GAMMA_DARK).fontSize(11).font('Helvetica-Bold')
                .text(`${ps.pillar.name} - Score: ${ps.score.toFixed(2)}/4.0`, 60, pillarY + 7);

            pillarY += 35;

            // Recommendation text
            const recText = getRecommendation(ps.pillar.key, ps.score);
            doc.fillColor('#334155').fontSize(10).font('Helvetica')
                .text(recText, 50, pillarY, { width: 500, align: 'justify' });

            const textHeight = doc.heightOfString(recText, { width: 500 });
            pillarY += textHeight + 20;
        }

        // ============ FOOTER ============
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).fillColor('#94A3B8')
                .text('Generado por Gamma Ingenieros AI Governance Platform', 50, 760, { align: 'left' })
                .text(`${i + 1} / ${range.count}`, 500, 760, { align: 'right' });
        }

        doc.end();
    });
}

// Helpers
function drawCard(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, title: string, value: string, sub: string, color: string = '#0F172A') {
    doc.roundedRect(x, y, w, h, 8).fill('#F8FAFC').stroke('#E2E8F0');
    doc.fillColor('#64748B').fontSize(10).font('Helvetica').text(title, x, y + 15, { width: w, align: 'center' });
    doc.fillColor(color).fontSize(32).font('Helvetica-Bold').text(value, x, y + 40, { width: w, align: 'center' });
    if (sub) doc.fillColor('#94A3B8').fontSize(9).font('Helvetica').text(sub, x, y + 85, { width: w, align: 'center' });
}

function drawDynamicBox(doc: PDFKit.PDFDocument, x: number, y: number, title: string, text: string, color: string) {
    doc.rect(x, y, 240, 60).fillOpacity(0.05).fill(color).strokeOpacity(0.5).stroke(color);
    doc.fillOpacity(1).strokeOpacity(1);
    doc.fillColor(color).fontSize(10).font('Helvetica-Bold').text(title, x + 10, y + 10);
    doc.fillColor('#334155').fontSize(9).font('Helvetica').text(text, x + 10, y + 25, { width: 220 });
}

function getMaturityDescription(level: number): string {
    if (level < 2) return 'existen iniciativas aisladas sin una estructura formal de gobierno';
    if (level < 3) return 'se han definido procesos básicos pero su ejecución no es consistente';
    if (level < 4) return 'los procesos están estandarizados y se gestionan con métricas claras';
    return 'la organización lidera con innovación y mejora continua en sus prácticas de IA';
}

function getPortfolioRecommendations(assessment: any) {
    const recs = [];

    // Always recommend AIDR for visibility
    recs.push({
        module: 'CrowdStrike AI Detection & Response (AIDR)',
        focus: 'Security for AI',
        description: 'Proporciona visibilidad total sobre el uso de herramientas de IA en la organización (Shadow AI), previene fuga de datos en prompts y detecta comportamiento anómalo en el desarrollo de IA.',
        color: '#8B5CF6'
    });

    // Strategy/Governance low => Charlotte AI
    const strategyScore = assessment.pillarScores.find((p: any) => p.pillar.key === 'strategy_governance')?.score || 0;
    if (strategyScore < 3) {
        recs.push({
            module: 'Charlotte AI + Falcon Complete',
            focus: 'AI for Security',
            description: 'Acelere la madurez de sus operaciones de seguridad utilizando IA generativa para la toma de decisiones y respuesta a incidentes, compensando la falta de procesos formalizados.',
            color: '#10B981'
        });
    }

    // Cloud/Infra low => Cloud Security
    const infraScore = assessment.pillarScores.find((p: any) => p.pillar.key === 'infrastructure')?.score || 0;
    if (infraScore < 3) {
        recs.push({
            module: 'Falcon Cloud Security',
            focus: 'Security for AI',
            description: 'Proteja las cargas de trabajo de IA desde el desarrollo (Build) hasta la ejecución (Runtime), asegurando que los modelos no sean manipulados ni explotados en la nube.',
            color: '#3B82F6'
        });
    }

    // Identity low => Identity Protection
    const identityScore = assessment.pillarScores.find((p: any) => p.pillar.key === 'ai_security')?.score || 0;
    if (identityScore < 3) {
        recs.push({
            module: 'Falcon Identity Protection',
            focus: 'Security for AI',
            description: 'Prevenga el uso no autorizado de agentes de IA y detecte credenciales comprometidas que podrían ser usadas para envenenar datos o modelos.',
            color: '#F59E0B'
        });
    }

    return recs;
}

function getRecommendation(pillarKey: string, score: number): string {
    const recommendations: Record<string, Record<string, string>> = {
        strategy_governance: {
            low: 'Establecer un comité de gobernanza de IA es crítico. Defina políticas de uso aceptable inmediatas para mitigar riesgos de Shadow AI.',
            medium: 'Formalice los KPIs de IA. Alinee la ciberseguridad con los objetivos de negocio de IA para asegurar inversión y soporte ejecutivo.',
            high: 'Avance hacia certificaciones de IA responsable (ISO 42001). Liderar iniciativas de estándares en la industria.',
        },
        employee_usage: {
            low: 'Implementar controles de "Allow-list" para aplicaciones de IA. Capacitar a empleados sobre riesgos de privacidad en prompts.',
            medium: 'Desplegar herramientas DLP (Data Loss Prevention) específicas para IA. Crear guías de ingeniería de prompts segura.',
            high: 'Fomentar la innovación segura. Implementar sandboxes para experimentación de empleados con datos sintéticos.',
        },
        ai_development: {
            low: 'Estandarizar el ciclo de vida de desarrollo (SDLC) de IA. Escanear repositorios por credenciales hardcodeadas en notebooks.',
            medium: 'Implementar escaneo de vulnerabilidades en modelos (Model Scanning). Asegurar la cadena de suministro de librerías de IA.',
            high: 'Monitoreo continuo de Drift y Bias en producción. Implementar MLOps seguro con trazabilidad total.',
        },
        agents_integrations: {
            low: 'Inventariar todas las integraciones de IA actuales. Restringir permisos de plugins de IA al mínimo privilegio.',
            medium: 'Implementar gateways de API seguros para interacciones de agentes. Monitorear tráfico anómalo de bots.',
            high: 'Orquestación de agentes con validación humana en el bucle (HITL) para decisiones críticas.',
        },
        infrastructure: {
            low: 'Asegurar configuraciones básicas de nube. Habilitar logs de auditoría para todos los servicios de IA.',
            medium: 'Implementar Cloud Security Posture Management (CSPM) para recursos de IA. Segregación de redes para entrenamiento e inferencia.',
            high: 'Arquitectura Zero Trust para cargas de trabajo de IA. Uso de enclaves seguros para computación confidencial.',
        },
        ai_security: {
            low: 'Realizar Threat Modeling específico para casos de uso de IA. Habilitar MFA para acceso a consolas de modelos.',
            medium: 'Pruebas de Red Teaming contra modelos de IA (Adversarial ML). Protección contra Prompt Injection en tiempo real.',
            high: 'Defensa automatizada con IA contra ataques a IA. Colaboración con centros de inteligencia de amenazas de IA.',
        },
    };

    const level = score < 1.5 ? 'low' : score < 3.0 ? 'medium' : 'high';
    return recommendations[pillarKey]?.[level] || 'Continuar con las prácticas actuales y buscar oportunidades de mejora continua.';
}
