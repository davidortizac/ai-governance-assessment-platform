import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma';
import fs from 'fs';
import path from 'path';
import { LLMAnalysis } from './llm.service';

/* -------------------------------------------------------------------------- */
/* PAGE GEOMETRY                                                               */
/* -------------------------------------------------------------------------- */

const PAGE_W    = 595.28;
const PAGE_H    = 841.89;
const MARGIN    = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const HEADER_H  = 76;
const CONTENT_Y = HEADER_H + 18;
const FOOTER_Y  = PAGE_H - 36;

/* -------------------------------------------------------------------------- */
/* COLOR PALETTE                                                               */
/* -------------------------------------------------------------------------- */

const C = {
    NAVY:       '#0F2C5F',
    STEEL:      '#2563EB',
    GOLD:       '#C9A84C',
    GOLD_BG:    '#FEF3C7',
    SILVER:     '#94A3B8',
    WHITE:      '#FFFFFF',
    PAGE_BG:    '#F4F6FA',
    TEXT:       '#1E293B',
    TEXT_MUTED: '#475569',
    TEXT_LIGHT: '#94A3B8',
    ROW_ALT:    '#EEF2FF',
    CONTROLLED: '#059669',
    LOW:        '#16A34A',
    MEDIUM:     '#D97706',
    HIGH:       '#DC2626',
    CRITICAL:   '#991B1B',
    LATENT:     '#7C3AED',
};

const FALLBACK = 'El análisis automático no está disponible. Contacte a su consultor.';

/* -------------------------------------------------------------------------- */
/* LOOKUP TABLES                                                               */
/* -------------------------------------------------------------------------- */

const RISK_LABEL: Record<string, string> = {
    CONTROLLED: 'Controlado', LOW: 'Bajo',      MEDIUM: 'Medio',
    HIGH: 'Alto',             CRITICAL: 'Crítico', LATENT: 'Latente',
};

const RISK_COLOR: Record<string, string> = {
    CONTROLLED: C.CONTROLLED, LOW: C.LOW,      MEDIUM: C.MEDIUM,
    HIGH: C.HIGH,             CRITICAL: C.CRITICAL, LATENT: C.LATENT,
};

const MATURITY_LABEL: Record<number, string> = {
    1: 'Experimental', 2: 'Emergente', 3: 'Definido', 4: 'Gestionado', 5: 'Optimizado',
};

/* -------------------------------------------------------------------------- */
/* SCORE HELPERS                                                               */
/* -------------------------------------------------------------------------- */

function scoreColor(s: number): string {
    if (s < 1.5) return C.HIGH;
    if (s < 2.5) return C.MEDIUM;
    if (s < 3.5) return C.STEEL;
    return C.CONTROLLED;
}

function scoreToMaturity(score: number): string {
    if (score < 1) return 'Experimental';
    if (score < 2) return 'Emergente';
    if (score < 3) return 'Definido';
    if (score < 4) return 'Gestionado';
    return 'Optimizado';
}

/* -------------------------------------------------------------------------- */
/* FONT RESOLUTION                                                             */
/* -------------------------------------------------------------------------- */

function resolveFonts(): { reg: string; bold: string; foundEbrima: boolean } {
    const roots = [
        path.resolve(__dirname, '../../assets/fonts'),
        path.resolve(process.cwd(), 'assets/fonts'),
        'C:\\Windows\\Fonts',
    ];
    for (const root of roots) {
        const reg  = path.join(root, 'ebrima.ttf');
        const bold = path.join(root, 'ebrimabd.ttf');
        if (fs.existsSync(reg)) {
            return { reg, bold: fs.existsSync(bold) ? bold : reg, foundEbrima: true };
        }
    }
    return { reg: 'Helvetica', bold: 'Helvetica-Bold', foundEbrima: false };
}

/* -------------------------------------------------------------------------- */
/* LOGO RESOLUTION                                                             */
/* -------------------------------------------------------------------------- */

function resolveLogoPath(): string {
    const candidates = [
        path.resolve(process.cwd(), 'assets/GammaGris.png'),
        path.resolve(__dirname, '../../assets/GammaGris.png'),
        path.resolve('frontend/imagenes/GammaGris.png'),
        path.resolve('frontend/public/logo-gamma.png'),
    ];
    return candidates.find(p => fs.existsSync(p)) ?? '';
}

/* -------------------------------------------------------------------------- */
/* REUSABLE PAGE RENDERERS                                                     */
/* -------------------------------------------------------------------------- */

function renderHeader(doc: any, FR: string, FB: string, logoPath: string, title: string): void {
    doc.rect(0, 0, PAGE_W, HEADER_H).fill(C.NAVY);
    doc.rect(0, 0, PAGE_W, 4).fill(C.GOLD);
    if (logoPath) {
        try { doc.image(logoPath, MARGIN, 16, { height: 26 }); } catch { /* skip */ }
    }
    const tx = MARGIN + (logoPath ? 118 : 0);
    doc.font(FB).fontSize(10).fillColor(C.WHITE)
        .text('GAMMA INGENIEROS', tx, 18, { lineBreak: false });
    doc.font(FR).fontSize(7.5).fillColor(C.SILVER)
        .text('CSIA · Cybersecurity Strategy for Artificial Intelligence', tx, 32, { lineBreak: false });
    doc.font(FB).fontSize(10).fillColor(C.GOLD)
        .text(title.toUpperCase(), MARGIN, 54, { width: CONTENT_W, align: 'right', lineBreak: false });
}

function renderFooter(doc: any, FR: string, FB: string, pageNum: number, total: number): void {
    doc.rect(MARGIN, FOOTER_Y - 8, CONTENT_W, 0.5).fill(C.GOLD);
    doc.font(FR).fontSize(7).fillColor(C.TEXT_LIGHT)
        .text('Gamma Ingenieros  ·  AI Governance Platform  ·  Documento Confidencial',
            MARGIN, FOOTER_Y, { lineBreak: false });
    doc.font(FB).fontSize(7).fillColor(C.TEXT_LIGHT)
        .text(`${pageNum} / ${total}`, MARGIN, FOOTER_Y,
            { width: CONTENT_W, align: 'right', lineBreak: false });
}

/* -------------------------------------------------------------------------- */
/* MAIN REPORT                                                                 */
/* -------------------------------------------------------------------------- */

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

    const llmData    = (assessment as any).llmAnalysis as LLMAnalysis | null;
    const riskLevel  = (assessment as any).riskLevel   as string | null;
    const matLevel   = (assessment as any).maturityLevel as number | null;

    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });

        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end',  () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        /* ── Fonts ── */
        const fp = resolveFonts();
        let FR = 'Helvetica';
        let FB = 'Helvetica-Bold';
        if (fp.foundEbrima) {
            try {
                doc.registerFont('Ebrima',      fp.reg);
                doc.registerFont('Ebrima-Bold', fp.bold);
                FR = 'Ebrima';
                FB = 'Ebrima-Bold';
            } catch { /* keep Helvetica */ }
        }

        const logoPath = resolveLogoPath();

        /* ── Helpers ── */
        const pageBg    = () => doc.rect(0, 0, PAGE_W, PAGE_H).fill(C.PAGE_BG);
        const addHeader = (title: string) => renderHeader(doc, FR, FB, logoPath, title);
        const addFooter = (n: number, t: number) => renderFooter(doc, FR, FB, n, t);

        /* ── Helper: score bar ── */
        const drawScoreBar = (x: number, y: number, score: number, barW = 100, barH = 7) => {
            const pct = Math.min(Math.max(Number(score) / 4, 0), 1);
            doc.rect(x, y, barW, barH).fill('#DDE3EE');
            if (pct > 0) doc.rect(x, y, barW * pct, barH).fill(scoreColor(Number(score)));
        };

        /* ── Helper: section label ── */
        const secLabel = (text: string, x: number, y: number) =>
            doc.font(FB).fontSize(7.5).fillColor(C.TEXT_LIGHT).text(text, x, y, { lineBreak: false });

        /* ══════════════════════════════════════════════════════════════════════
           PAGE 1 — COVER
        ══════════════════════════════════════════════════════════════════════ */

        doc.rect(0, 0, PAGE_W, PAGE_H).fill(C.NAVY);
        doc.rect(0, 0, PAGE_W, 5).fill(C.GOLD);
        doc.rect(0, 0, 5, PAGE_H).fill(C.GOLD);

        if (logoPath) {
            try { doc.image(logoPath, PAGE_W / 2 - 50, 55, { width: 100 }); } catch { /* skip */ }
        }

        const companyY = logoPath ? 178 : 100;
        doc.font(FB).fontSize(11).fillColor(C.GOLD)
            .text('GAMMA INGENIEROS', 0, companyY, { width: PAGE_W, align: 'center', lineBreak: false });

        const sepY = companyY + 22;
        doc.rect(PAGE_W / 2 - 100, sepY + 6, 200, 1).fill(C.GOLD);

        const titleY = sepY + 20;
        doc.font(FB).fontSize(26).fillColor(C.WHITE)
            .text('AI CYBERSECURITY', 0, titleY, { width: PAGE_W, align: 'center', lineBreak: false });
        doc.font(FB).fontSize(26).fillColor(C.WHITE)
            .text('MATURITY ASSESSMENT', 0, titleY + 36, { width: PAGE_W, align: 'center', lineBreak: false });
        doc.font(FR).fontSize(11).fillColor(C.SILVER)
            .text('Evaluación de Madurez y Riesgo en Inteligencia Artificial',
                0, titleY + 76, { width: PAGE_W, align: 'center', lineBreak: false });

        /* Client info block */
        const infoY = titleY + 112;
        doc.rect(MARGIN + 30, infoY, CONTENT_W - 60, 0.5).fill('#334E7B');
        const infoRows = [
            { label: 'ORGANIZACIÓN EVALUADA', value: assessment.client.name },
            { label: 'CONSULTOR',             value: assessment.createdBy.name },
            { label: 'FECHA',
              value: assessment.completedAt?.toLocaleDateString('es-ES', {
                  day: '2-digit', month: 'long', year: 'numeric' }) ?? 'N/A' },
            { label: 'TIPO DE EVALUACIÓN',    value: assessment.type },
        ];
        let infoLY = infoY + 14;
        for (const row of infoRows) {
            doc.font(FR).fontSize(8).fillColor(C.SILVER)
                .text(row.label, MARGIN + 42, infoLY, { lineBreak: false });
            doc.font(FB).fontSize(10).fillColor(C.WHITE)
                .text(row.value, MARGIN + 42, infoLY + 12, { lineBreak: false });
            infoLY += 36;
        }
        doc.rect(MARGIN + 30, infoLY + 2, CONTENT_W - 60, 0.5).fill('#334E7B');

        /* Score display */
        const scoreY = infoLY + 26;
        const scoreVal = assessment.overallScore?.toFixed(2) ?? '—';
        doc.font(FB).fontSize(48).fillColor(C.GOLD)
            .text(scoreVal, 0, scoreY, { width: PAGE_W, align: 'center', lineBreak: false });
        doc.font(FR).fontSize(12).fillColor(C.SILVER)
            .text('/ 4.0  ·  SCORE GENERAL', 0, scoreY + 58,
                { width: PAGE_W, align: 'center', lineBreak: false });

        const mat  = MATURITY_LABEL[matLevel ?? 0] ?? '—';
        const risk = RISK_LABEL[riskLevel ?? ''] ?? '—';
        doc.font(FR).fontSize(10).fillColor(C.SILVER)
            .text(`Madurez: `, 0, scoreY + 82, { width: PAGE_W / 2, align: 'right', lineBreak: false });
        doc.font(FB).fontSize(10).fillColor(C.WHITE)
            .text(mat, PAGE_W / 2 + 2, scoreY + 82, { lineBreak: false });
        doc.font(FR).fontSize(10).fillColor(C.SILVER)
            .text('  ·  Riesgo: ', PAGE_W / 2 + 2 + doc.widthOfString(mat), scoreY + 82, { lineBreak: false });
        doc.font(FB).fontSize(10).fillColor(RISK_COLOR[riskLevel ?? ''] ?? C.SILVER)
            .text(risk, PAGE_W / 2 + 2 + doc.widthOfString(mat) + doc.widthOfString('  ·  Riesgo: '), scoreY + 82, { lineBreak: false });

        doc.font(FR).fontSize(7).fillColor(C.SILVER)
            .text('CONFIDENCIAL · Para uso interno exclusivo',
                0, PAGE_H - 28, { width: PAGE_W, align: 'center', lineBreak: false });

        /* ══════════════════════════════════════════════════════════════════════
           PAGE 2 — RESUMEN EJECUTIVO
        ══════════════════════════════════════════════════════════════════════ */

        doc.addPage();
        pageBg();
        addHeader('Resumen Ejecutivo');

        let y = CONTENT_Y;

        /* Executive summary */
        secLabel('RESUMEN EJECUTIVO', MARGIN, y);
        y += 14;
        const execText = llmData?.executiveSummary ?? FALLBACK;
        doc.font(FR).fontSize(10.5).fillColor(C.TEXT)
            .text(execText, MARGIN, y, { width: CONTENT_W, align: 'justify', lineGap: 3 });
        y += doc.heightOfString(execText, { width: CONTENT_W, lineGap: 3 }) + 22;

        /* Awareness callout */
        const awText   = llmData?.awarenessMessage ?? FALLBACK;
        const awInnerW = CONTENT_W - 28;
        const awH      = doc.heightOfString(awText, { width: awInnerW, lineGap: 3 }) + 38;
        doc.rect(MARGIN, y, CONTENT_W, awH).fill(C.GOLD_BG);
        doc.rect(MARGIN, y, 4, awH).fill(C.GOLD);
        secLabel('POR QUÉ ES IMPORTANTE ACTUAR AHORA', MARGIN + 16, y + 10);
        doc.font(FR).fontSize(10.5).fillColor(C.TEXT_MUTED)
            .text(awText, MARGIN + 16, y + 26, { width: awInnerW, align: 'justify', lineGap: 3 });
        y += awH + 22;

        /* Industry benchmark */
        if (y < FOOTER_Y - 80) {
            const benchText = llmData?.industryBenchmark ?? FALLBACK;
            secLabel('CONTEXTO DE INDUSTRIA', MARGIN, y);
            y += 14;
            doc.font(FR).fontSize(10).fillColor(C.TEXT_MUTED)
                .text(benchText, MARGIN, y, { width: CONTENT_W, align: 'justify', lineGap: 3 });
        }

        /* ══════════════════════════════════════════════════════════════════════
           PAGE 3 — MODELO ESTRATÉGICO CSIA
        ══════════════════════════════════════════════════════════════════════ */

        doc.addPage();
        pageBg();
        addHeader('Modelo Estratégico CSIA');

        let cy = CONTENT_Y;

        doc.font(FR).fontSize(10.5).fillColor(C.TEXT)
            .text(
                'CSIA (Cybersecurity Strategy for Artificial Intelligence) es la estrategia ' +
                'desarrollada por Gamma Ingenieros para apoyar a las organizaciones en la ' +
                'adopción segura de inteligencia artificial mediante controles de gobernanza ' +
                'y ciberseguridad. Integra prácticas de marcos internacionales para construir ' +
                'un modelo operativo de evaluación, control de riesgos y mejora continua en IA.',
                MARGIN, cy, { width: CONTENT_W, align: 'justify', lineGap: 3 });
        cy += 80;

        secLabel('MARCOS DE REFERENCIA INTEGRADOS', MARGIN, cy);
        cy += 16;

        const frameworks = [
            {
                name: 'NIST AI Risk Management Framework',
                desc: 'Framework desarrollado por el NIST para gestionar riesgos de sistemas de inteligencia artificial mediante las funciones Govern, Map, Measure y Manage. Provee un vocabulario común para abordar los riesgos de la IA a lo largo de su ciclo de vida.',
                color: C.STEEL,
            },
            {
                name: 'MITRE ATLAS',
                desc: 'Base de conocimiento que documenta tácticas, técnicas y procedimientos de ataque adversarial contra sistemas de Machine Learning. Permite a las organizaciones diseñar controles preventivos frente a amenazas específicas de la IA.',
                color: C.LATENT,
            },
            {
                name: 'Gartner TRiSM',
                desc: 'Modelo de gobernanza enfocado en Trust, Risk and Security Management aplicado a sistemas de IA empresariales. Orienta hacia la gestión estructurada de la confiabilidad, la seguridad y el riesgo en entornos de adopción de IA.',
                color: C.CONTROLLED,
            },
        ];

        for (const fw of frameworks) {
            const fwInnerW = CONTENT_W - 22;
            const fwH = doc.heightOfString(fw.desc, { width: fwInnerW, lineGap: 2 }) + 36;
            doc.rect(MARGIN, cy, CONTENT_W, fwH).fill(C.WHITE);
            doc.rect(MARGIN, cy, 3, fwH).fill(fw.color);
            doc.font(FB).fontSize(10).fillColor(C.TEXT)
                .text(fw.name, MARGIN + 14, cy + 10, { lineBreak: false });
            doc.font(FR).fontSize(9.5).fillColor(C.TEXT_MUTED)
                .text(fw.desc, MARGIN + 14, cy + 26, { width: fwInnerW, lineGap: 2 });
            cy += fwH + 10;
        }

        /* ══════════════════════════════════════════════════════════════════════
           PAGE 4 — RESUMEN DE PUNTAJES
        ══════════════════════════════════════════════════════════════════════ */

        doc.addPage();
        pageBg();
        addHeader('Resumen de Puntajes');

        let sy = CONTENT_Y;

        /* Table header row */
        doc.rect(MARGIN, sy, CONTENT_W, 26).fill(C.NAVY);
        doc.font(FB).fontSize(8.5).fillColor(C.WHITE)
            .text('PILAR',    MARGIN + 14,  sy + 8, { lineBreak: false });
        doc.font(FB).fontSize(8.5).fillColor(C.WHITE)
            .text('PUNTUACIÓN', MARGIN + 270, sy + 8, { lineBreak: false });
        doc.font(FB).fontSize(8.5).fillColor(C.WHITE)
            .text('MADUREZ',  MARGIN + 370, sy + 8, { lineBreak: false });
        sy += 26;

        assessment.pillarScores.forEach((ps, idx) => {
            const rowH   = 38;
            const score  = Number(ps.score);
            const rowBg  = idx % 2 === 0 ? C.WHITE : C.ROW_ALT;
            doc.rect(MARGIN, sy, CONTENT_W, rowH).fill(rowBg);
            doc.rect(MARGIN, sy, 3, rowH).fill(scoreColor(score));

            /* Pillar name */
            doc.font(FB).fontSize(9).fillColor(C.TEXT)
                .text(ps.pillar.name, MARGIN + 12, sy + 7, { lineBreak: false });
            doc.font(FR).fontSize(7.5).fillColor(C.TEXT_LIGHT)
                .text(ps.pillar.key, MARGIN + 12, sy + 22, { lineBreak: false });

            /* Score bar + value */
            drawScoreBar(MARGIN + 270, sy + 15, score, 80, 7);
            doc.font(FB).fontSize(10).fillColor(scoreColor(score))
                .text(score.toFixed(2), MARGIN + 357, sy + 10, { lineBreak: false });

            /* Maturity label */
            doc.font(FR).fontSize(9).fillColor(C.TEXT_MUTED)
                .text(scoreToMaturity(score), MARGIN + 370, sy + 14, { lineBreak: false });

            sy += rowH;
        });

        /* Overall summary row */
        sy += 10;
        doc.rect(MARGIN, sy, CONTENT_W, 48).fill(C.NAVY);
        const overallScore = assessment.overallScore?.toFixed(2) ?? '—';
        const overallMat   = MATURITY_LABEL[matLevel ?? 0] ?? '—';
        const overallRisk  = RISK_LABEL[riskLevel ?? ''] ?? '—';
        const riskCol      = RISK_COLOR[riskLevel ?? ''] ?? C.MEDIUM;

        doc.font(FB).fontSize(8).fillColor(C.SILVER)
            .text('SCORE GENERAL', MARGIN + 14, sy + 8, { lineBreak: false });
        doc.font(FB).fontSize(22).fillColor(C.GOLD)
            .text(overallScore, MARGIN + 14, sy + 18, { lineBreak: false });
        doc.font(FR).fontSize(8).fillColor(C.SILVER)
            .text('/ 4.0', MARGIN + 80, sy + 28, { lineBreak: false });

        doc.font(FB).fontSize(8).fillColor(C.SILVER)
            .text('NIVEL DE MADUREZ', MARGIN + 200, sy + 8, { lineBreak: false });
        doc.font(FB).fontSize(13).fillColor(C.WHITE)
            .text(overallMat, MARGIN + 200, sy + 22, { lineBreak: false });

        doc.font(FB).fontSize(8).fillColor(C.SILVER)
            .text('RIESGO GLOBAL', MARGIN + 360, sy + 8, { lineBreak: false });
        doc.font(FB).fontSize(13).fillColor(riskCol)
            .text(overallRisk, MARGIN + 360, sy + 22, { lineBreak: false });

        /* ══════════════════════════════════════════════════════════════════════
           PAGE 5+ — ANÁLISIS POR PILAR
        ══════════════════════════════════════════════════════════════════════ */

        doc.addPage();
        pageBg();
        addHeader('Análisis por Pilar');

        let py = CONTENT_Y;

        for (const ps of assessment.pillarScores) {
            const pillarLLM = llmData?.pillarAnalyses?.[ps.pillar.key];
            const score     = Number(ps.score);
            const innerW    = CONTENT_W - 24;

            const fH = doc.heightOfString(pillarLLM?.findings       ?? FALLBACK, { width: innerW, lineGap: 2 });
            const gH = doc.heightOfString(pillarLLM?.gaps            ?? FALLBACK, { width: innerW, lineGap: 2 });
            const rH = doc.heightOfString(pillarLLM?.recommendation  ?? FALLBACK, { width: innerW, lineGap: 2 });
            const cardH = 52 + fH + gH + rH + 72; /* header + 3×(label+gap) + sections */

            if (py + cardH > FOOTER_Y - 20) {
                doc.addPage();
                pageBg();
                addHeader('Análisis por Pilar (cont.)');
                py = CONTENT_Y;
            }

            /* Card */
            doc.rect(MARGIN, py, CONTENT_W, cardH).fill(C.WHITE);
            doc.rect(MARGIN, py, 4, cardH).fill(scoreColor(score));

            /* Card header */
            doc.font(FB).fontSize(11).fillColor(C.TEXT)
                .text(ps.pillar.name, MARGIN + 14, py + 10, { lineBreak: false });
            doc.font(FB).fontSize(10).fillColor(scoreColor(score))
                .text(`${score.toFixed(2)} / 4.0`, MARGIN + 14, py + 10,
                    { width: CONTENT_W - 28, align: 'right', lineBreak: false });

            drawScoreBar(MARGIN + 14, py + 30, score, 160, 6);
            doc.font(FR).fontSize(8.5).fillColor(C.TEXT_LIGHT)
                .text(scoreToMaturity(score), MARGIN + 182, py + 29, { lineBreak: false });

            let cy2 = py + 50;

            /* Findings */
            secLabel('HALLAZGOS', MARGIN + 14, cy2);
            cy2 += 12;
            doc.font(FR).fontSize(9.5).fillColor(C.TEXT_MUTED)
                .text(pillarLLM?.findings ?? FALLBACK, MARGIN + 14, cy2, { width: innerW, lineGap: 2 });
            cy2 += fH + 12;

            /* Gaps */
            secLabel('BRECHAS IDENTIFICADAS', MARGIN + 14, cy2);
            cy2 += 12;
            doc.font(FR).fontSize(9.5).fillColor(C.TEXT_MUTED)
                .text(pillarLLM?.gaps ?? FALLBACK, MARGIN + 14, cy2, { width: innerW, lineGap: 2 });
            cy2 += gH + 12;

            /* Recommendation */
            doc.font(FB).fontSize(7.5).fillColor(C.STEEL)
                .text('RECOMENDACIÓN', MARGIN + 14, cy2, { lineBreak: false });
            cy2 += 12;
            doc.font(FR).fontSize(9.5).fillColor(C.TEXT)
                .text(pillarLLM?.recommendation ?? FALLBACK, MARGIN + 14, cy2, { width: innerW, lineGap: 2 });

            py += cardH + 12;
        }

        /* ══════════════════════════════════════════════════════════════════════
           LAST PAGE — PLAN DE MEJORA
        ══════════════════════════════════════════════════════════════════════ */

        doc.addPage();
        pageBg();
        addHeader('Plan de Mejora');

        let iy = CONTENT_Y;

        const quickWins = llmData?.improvementPlan?.quickWins ?? [];
        const longTerm  = llmData?.improvementPlan?.longTerm  ?? [];

        const drawItems = (items: string[], badgeColor: string, sectionLabel: string) => {
            if (items.length === 0) return;
            secLabel(sectionLabel, MARGIN, iy);
            iy += 16;
            items.forEach((text, i) => {
                if (iy > FOOTER_Y - 60) {
                    doc.addPage();
                    pageBg();
                    addHeader('Plan de Mejora (cont.)');
                    iy = CONTENT_Y;
                }
                const itemH  = doc.heightOfString(text, { width: CONTENT_W - 46, lineGap: 2 });
                const blockH = Math.max(itemH + 16, 32);

                doc.rect(MARGIN, iy, CONTENT_W, blockH).fill(C.WHITE);
                /* Number badge */
                doc.rect(MARGIN + 8, iy + (blockH - 22) / 2, 22, 22).fill(badgeColor);
                doc.font(FB).fontSize(8.5).fillColor(C.WHITE)
                    .text(`${i + 1}`, MARGIN + 8, iy + (blockH - 22) / 2 + 6,
                        { width: 22, align: 'center', lineBreak: false });
                /* Text */
                doc.font(FR).fontSize(9.5).fillColor(C.TEXT)
                    .text(text, MARGIN + 38, iy + 8, { width: CONTENT_W - 46, lineGap: 2 });

                iy += blockH + 6;
            });
            iy += 12;
        };

        if (quickWins.length > 0 || longTerm.length > 0) {
            drawItems(quickWins, C.CONTROLLED, 'ACCIONES INMEDIATAS (QUICK WINS)');
            drawItems(longTerm,  C.STEEL,      'INICIATIVAS A LARGO PLAZO');
        } else {
            doc.font(FR).fontSize(10.5).fillColor(C.TEXT_LIGHT)
                .text(FALLBACK, MARGIN, iy, { width: CONTENT_W });
        }

        /* ══════════════════════════════════════════════════════════════════════
           FOOTERS (all interior pages)
        ══════════════════════════════════════════════════════════════════════ */

        const range = doc.bufferedPageRange();
        const total = range.count;
        for (let i = range.start; i < range.start + total; i++) {
            doc.switchToPage(i);
            if (i === range.start) continue; // skip cover
            addFooter(i - range.start + 1, total - 1);
        }

        doc.end();
    });
}
