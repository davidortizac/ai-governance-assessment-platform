import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma';
import fs from 'fs';
import path from 'path';
import { getMaturityLabel } from './scoring.service';
import { LLMAnalysis } from './llm.service';

// ─── Page geometry (A4) ───────────────────────────────────────────────────────
const PAGE_W    = 595.28;
const PAGE_H    = 841.89;
const MARGIN    = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;   // 495.28
const HEADER_H  = 88;
const CONTENT_Y = HEADER_H + 12;         // 100 — first usable Y after header
const FOOTER_Y  = PAGE_H - 50;           // ~792

// ─── Professional color palette ───────────────────────────────────────────────
const C = {
    NAVY:       '#0D1B2A',   // near-black navy — header & cover bg
    NAVY_MID:   '#1B3A5C',   // mid-navy — card accents
    STEEL:      '#2E6DA4',   // accent blue
    GOLD:       '#C9A84C',   // gold — accent lines & highlights
    SILVER:     '#9AAAB8',   // muted text on dark bg
    WHITE:      '#FFFFFF',
    PAGE_BG:    '#FAFBFC',   // barely-white page bg
    TEXT:       '#1A2035',   // primary body text
    TEXT_MUTED: '#4A5568',   // secondary body text
    BORDER:     '#D1D9E0',   // subtle borders
    CARD_BG:    '#FFFFFF',
    // Risk
    CONTROLLED: '#0F9060',
    LOW:        '#27AE60',
    MEDIUM:     '#D4860A',
    HIGH:       '#C0392B',
    CRITICAL:   '#922B21',
    LATENT:     '#6C3483',
};

const RISK_LABELS: Record<string, string> = {
    CONTROLLED: 'Controlado', LOW: 'Bajo',   MEDIUM: 'Medio',
    HIGH: 'Alto',             CRITICAL: 'Crítico', LATENT: 'Latente',
};

const FALLBACK = 'El análisis automático no está disponible. Contacte a su consultor.';

// ─── Font resolution — tries Ebrima (Windows), falls back to Helvetica ────────
function resolveFonts(): { reg: string; bold: string; foundEbrima: boolean } {
    const roots = [
        path.resolve(__dirname, '../../assets/fonts'),
        path.resolve(process.cwd(), 'assets/fonts'),
        'C:\\Windows\\Fonts',
        '/mnt/c/Windows/Fonts',
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

// ─── Logo resolution — grey corporate version preferred ───────────────────────
function resolveLogoPath(): string {
    const candidates = [
        // Docker: bundled inside backend image
        path.resolve(process.cwd(), 'assets/GammaGris.png'),
        path.resolve(__dirname, '../../assets/GammaGris.png'),
        // Local dev: Windows absolute path
        'e:\\IA\\GAMMA\\ASESSMENT IA\\frontend\\imagenes\\GammaGris.png',
        // Local dev: relative paths
        path.resolve(__dirname, '../../../../frontend/imagenes/GammaGris.png'),
        path.resolve(process.cwd(), '../frontend/imagenes/GammaGris.png'),
        path.resolve('frontend/imagenes/GammaGris.png'),
        // Fallback: black logo
        path.resolve(__dirname, '../../../../frontend/imagenes/Logo-Gamma-Ingenieros-(Negro).png'),
        path.resolve(process.cwd(), '../frontend/imagenes/Logo-Gamma-Ingenieros-(Negro).png'),
        // Fallback: public logo
        path.resolve(__dirname, '../../../../frontend/public/logo-gamma.png'),
        path.resolve(process.cwd(), '../frontend/public/logo-gamma.png'),
    ];
    return candidates.find(p => fs.existsSync(p)) ?? '';
}

// ─── Main export ──────────────────────────────────────────────────────────────
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

    const llmData = (assessment as any).llmAnalysis as LLMAnalysis | null;

    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ── Fonts ────────────────────────────────────────────────────────────
        const fontPaths = resolveFonts();
        let FONT_REG  = 'Helvetica';
        let FONT_BOLD = 'Helvetica-Bold';
        let FONT_ITAL = 'Helvetica-Oblique';

        if (fontPaths.foundEbrima) {
            try {
                doc.registerFont('Ebrima',     fontPaths.reg);
                doc.registerFont('Ebrima-Bold', fontPaths.bold);
                FONT_REG  = 'Ebrima';
                FONT_BOLD = 'Ebrima-Bold';
                FONT_ITAL = 'Ebrima';
            } catch {
                // keep Helvetica
            }
        }

        const logoPath = resolveLogoPath();

        // ── Header helper ─────────────────────────────────────────────────────
        // Structure: [gold border 3px] [navy bg] [logo + company | separator | page title]
        const addHeader = (title: string) => {
            // Background
            doc.rect(0, 0, PAGE_W, HEADER_H).fill(C.NAVY);
            // Gold top border
            doc.rect(0, 0, PAGE_W, 3).fill(C.GOLD);

            // Logo (left side)
            if (logoPath) {
                try {
                    doc.image(logoPath, MARGIN, 10, { height: 28 });
                } catch {
                    doc.fontSize(9).fillColor(C.WHITE).font(FONT_BOLD)
                        .text('GAMMA', MARGIN, 14, { lineBreak: false });
                }
            } else {
                doc.fontSize(9).fillColor(C.WHITE).font(FONT_BOLD)
                    .text('GAMMA', MARGIN, 14, { lineBreak: false });
            }

            // Company name & subtitle (right of logo area, ~155px offset)
            doc.fontSize(9).fillColor(C.WHITE).font(FONT_BOLD)
                .text('GAMMA INGENIEROS', MARGIN + 155, 12, { lineBreak: false });
            doc.fontSize(7.5).fillColor(C.SILVER).font(FONT_REG)
                .text('CSIA · Cybersecurity AI Strategy', MARGIN + 155, 25, { lineBreak: false });

            // Gold separator line
            doc.rect(MARGIN, 47, CONTENT_W, 0.75).fill(C.GOLD);

            // Page title — centered, BELOW separator
            doc.fontSize(11).fillColor(C.WHITE).font(FONT_BOLD)
                .text(title, MARGIN, 57, { width: CONTENT_W, align: 'center', lineBreak: false });
        };

        // ── Footer helper ─────────────────────────────────────────────────────
        const addFooter = (pageNum: number, total: number) => {
            doc.rect(0, PAGE_H - 35, PAGE_W, 35).fill('#F0F3F6');
            doc.rect(0, PAGE_H - 36, PAGE_W, 1).fill(C.BORDER);
            doc.fontSize(7.5).fillColor(C.TEXT_MUTED).font(FONT_REG)
                .text('Gamma Ingenieros AI Governance Platform · Confidencial', MARGIN, PAGE_H - 23,
                    { align: 'left', width: CONTENT_W - 60, lineBreak: false });
            doc.fontSize(7.5).fillColor(C.TEXT_MUTED).font(FONT_BOLD)
                .text(`${pageNum} / ${total}`, PAGE_W - MARGIN - 40, PAGE_H - 23,
                    { align: 'right', width: 40, lineBreak: false });
        };

        // ════════════════════════════════════════════════════════════════════
        // PAGE 1: COVER
        // ════════════════════════════════════════════════════════════════════
        doc.rect(0, 0, PAGE_W, PAGE_H).fill(C.NAVY);

        // Decorative geometry (subtle, behind content)
        doc.circle(PAGE_W + 60, -60, 290).fillOpacity(0.05).fill(C.STEEL);
        doc.circle(-60, PAGE_H + 60, 250).fillOpacity(0.05).fill(C.GOLD);
        doc.fillOpacity(1);

        // Gold top stripe
        doc.rect(0, 0, PAGE_W, 4).fill(C.GOLD);

        // Right accent bar
        doc.rect(PAGE_W - 8, 0, 8, PAGE_H).fill(C.NAVY_MID);

        // Logo — centered
        const coverLogoW = 160;
        const coverLogoX = (PAGE_W - coverLogoW) / 2;
        if (logoPath) {
            try {
                doc.image(logoPath, coverLogoX, 55, { width: coverLogoW });
            } catch {
                doc.fontSize(20).fillColor(C.WHITE).font(FONT_BOLD)
                    .text('GAMMA INGENIEROS', MARGIN, 65, { align: 'center', width: CONTENT_W, lineBreak: false });
            }
        } else {
            doc.fontSize(20).fillColor(C.WHITE).font(FONT_BOLD)
                .text('GAMMA INGENIEROS', MARGIN, 65, { align: 'center', width: CONTENT_W, lineBreak: false });
        }

        // Thin gold rule below logo
        doc.rect(140, 143, 315, 0.75).fill(C.GOLD);

        // Report type badge
        doc.rect(200, 155, 195, 22).fill(C.NAVY_MID);
        doc.fontSize(7.5).fillColor(C.GOLD).font(FONT_BOLD)
            .text('INFORME EJECUTIVO DE MADUREZ EN IA', 200, 162,
                { width: 195, align: 'center', characterSpacing: 0.8, lineBreak: false });

        // Main title
        doc.fontSize(28).fillColor(C.WHITE).font(FONT_BOLD)
            .text('ESTRATEGIA DE', MARGIN, 192, { align: 'center', width: CONTENT_W, lineBreak: false });
        doc.fontSize(28).fillColor(C.GOLD).font(FONT_BOLD)
            .text('CIBERSEGURIDAD EN IA', MARGIN, 226, { align: 'center', width: CONTENT_W, lineBreak: false });

        doc.fontSize(11).fillColor(C.SILVER).font(FONT_REG)
            .text('Evaluación de Madurez & Riesgos · CSIA Framework', MARGIN, 270,
                { align: 'center', width: CONTENT_W, lineBreak: false });

        // Decorative triple-line rule
        doc.rect(160, 296, 275, 0.75).fill(C.SILVER);
        doc.rect(160, 299, 275, 0.4).fill(C.GOLD);
        doc.rect(160, 302, 275, 0.4).fill(C.SILVER);

        // ── Client info box ──────────────────────────────────────────────────
        const boxX = MARGIN;
        const boxY = 316;
        const boxW = CONTENT_W;
        const boxH = 225;

        // Shadow
        doc.roundedRect(boxX + 3, boxY + 3, boxW, boxH, 10).fill('#070F1A');
        // Box body
        doc.roundedRect(boxX, boxY, boxW, boxH, 10).fill('#0F2034');
        // Gold left accent
        doc.rect(boxX, boxY, 4, boxH).fill(C.GOLD);
        // Top gold rule inside box
        doc.rect(boxX + 20, boxY + 70, boxW - 40, 0.5).fill('#2A4A68');

        // "INFORME PREPARADO PARA" label
        doc.fontSize(8).fillColor(C.GOLD).font(FONT_BOLD)
            .text('INFORME PREPARADO PARA', boxX + 10, boxY + 22,
                { width: boxW - 14, align: 'center', characterSpacing: 1.2, lineBreak: false });

        // Client name
        const clientNameY = boxY + 38;
        doc.fontSize(20).fillColor(C.WHITE).font(FONT_BOLD)
            .text(assessment.client.name, boxX + 10, clientNameY,
                { width: boxW - 14, align: 'center', lineBreak: false });

        // Industry
        if (assessment.client.industry) {
            doc.fontSize(9.5).fillColor(C.SILVER).font(FONT_REG)
                .text(assessment.client.industry, boxX + 10, clientNameY + 28,
                    { width: boxW - 14, align: 'center', lineBreak: false });
        }

        // Meta rows
        const col1X   = boxX + 28;
        const col2X   = boxX + boxW / 2 + 12;
        const metaY1  = boxY + 88;
        const metaY2  = metaY1 + 48;

        // Row 1
        doc.fontSize(7).fillColor(C.SILVER).font(FONT_BOLD)
            .text('FECHA', col1X, metaY1, { characterSpacing: 0.8, lineBreak: false });
        doc.fontSize(10).fillColor(C.WHITE).font(FONT_REG)
            .text(assessment.completedAt?.toLocaleDateString('es-ES',
                { year: 'numeric', month: 'long', day: 'numeric' }) ?? 'N/A',
                col1X, metaY1 + 12, { lineBreak: false });

        doc.fontSize(7).fillColor(C.SILVER).font(FONT_BOLD)
            .text('CONSULTOR', col2X, metaY1, { characterSpacing: 0.8, lineBreak: false });
        doc.fontSize(10).fillColor(C.WHITE).font(FONT_REG)
            .text(assessment.createdBy.name, col2X, metaY1 + 12, { lineBreak: false });

        // Row 2
        doc.fontSize(7).fillColor(C.SILVER).font(FONT_BOLD)
            .text('ELABORADO POR', col1X, metaY2, { characterSpacing: 0.8, lineBreak: false });
        doc.fontSize(10).fillColor(C.GOLD).font(FONT_BOLD)
            .text('Gamma Ingenieros S.A.S', col1X, metaY2 + 12, { lineBreak: false });

        if (assessment.overallScore) {
            doc.fontSize(7).fillColor(C.SILVER).font(FONT_BOLD)
                .text('SCORE GLOBAL', col2X, metaY2, { characterSpacing: 0.8, lineBreak: false });
            doc.fontSize(10).fillColor(C.WHITE).font(FONT_REG)
                .text(`${assessment.overallScore.toFixed(2)} / 4.0`, col2X, metaY2 + 12, { lineBreak: false });
        }

        // Assessment type badge
        doc.rect(boxX + 20, boxY + boxH - 38, boxW - 40, 22).fill('#142540');
        const assessLabel = assessment.type === 'EXPRESS' ? 'Assessment Express' : 'Assessment Avanzado';
        doc.fontSize(8.5).fillColor(C.SILVER).font(FONT_REG)
            .text(assessLabel, boxX + 20, boxY + boxH - 30, { width: boxW - 40, align: 'center', lineBreak: false });

        // Bottom tagline
        doc.fontSize(7.5).fillColor('#2A4060').font(FONT_REG)
            .text('Clasificación: Confidencial · Para uso interno exclusivo', MARGIN, PAGE_H - 42,
                { align: 'center', width: CONTENT_W, lineBreak: false });

        // ════════════════════════════════════════════════════════════════════
        // PAGE 2: EXECUTIVE SUMMARY
        // ════════════════════════════════════════════════════════════════════
        doc.addPage();
        addHeader('Resumen Ejecutivo');

        // Metric cards
        const cardY = CONTENT_Y + 4;
        const cardW = 148;
        const cardH = 112;
        const riskKey = assessment.riskLevel ?? 'MEDIUM';
        const riskColor = (C as any)[riskKey] ?? C.MEDIUM;

        drawCard(doc, MARGIN,       cardY, cardW, cardH, 'Score General',
            `${assessment.overallScore?.toFixed(2) ?? '—'}`, 'de 4.0', C.STEEL, FONT_REG, FONT_BOLD);
        drawCard(doc, MARGIN + 174, cardY, cardW, cardH, 'Nivel de Madurez',
            `${assessment.maturityLevel ?? '—'}`,
            getMaturityLabel(assessment.maturityLevel ?? 0), C.NAVY_MID, FONT_REG, FONT_BOLD);
        drawCard(doc, MARGIN + 348, cardY, cardW, cardH, 'Nivel de Riesgo',
            RISK_LABELS[riskKey] || 'Medio', '', riskColor, FONT_REG, FONT_BOLD);

        let y2 = cardY + cardH + 22;

        // Section: Análisis Situacional
        y2 = drawSectionTitle(doc, 'Análisis Situacional', y2, C.GOLD, FONT_BOLD);
        doc.fontSize(12).fillColor(C.TEXT_MUTED).font(FONT_REG)
            .text(llmData?.executiveSummary ?? FALLBACK, MARGIN, y2,
                { align: 'justify', width: CONTENT_W, lineGap: 2 });
        y2 += doc.heightOfString(llmData?.executiveSummary ?? FALLBACK,
            { width: CONTENT_W }) + 22;

        // Section: Por qué actuar ahora
        y2 = drawSectionTitle(doc, 'Por qué es crítico actuar ahora', y2, C.STEEL, FONT_BOLD);
        doc.fontSize(12).fillColor(C.TEXT_MUTED).font(FONT_REG)
            .text(llmData?.awarenessMessage ?? FALLBACK, MARGIN, y2,
                { align: 'justify', width: CONTENT_W, lineGap: 2 });

        // ════════════════════════════════════════════════════════════════════
        // PAGE 3: PILLAR FINDINGS
        // ════════════════════════════════════════════════════════════════════
        doc.addPage();
        addHeader('Hallazgos y Brechas por Pilar');

        let py = CONTENT_Y + 4;

        for (const ps of assessment.pillarScores) {
            // Auto-paginate
            if (py > PAGE_H - 120) {
                doc.addPage();
                addHeader('Hallazgos por Pilar (cont.)');
                py = CONTENT_Y + 4;
            }

            const pillarLLM = llmData?.pillarAnalyses?.[ps.pillar.key];
            const barColor  = ps.score < 1.5 ? C.HIGH
                            : ps.score < 2.5 ? C.MEDIUM
                            : ps.score < 3.5 ? C.STEEL : C.CONTROLLED;

            // Pillar header bar
            doc.rect(MARGIN, py, CONTENT_W, 26).fill('#EEF2F7');
            // Score fill (proportional)
            const fillW = Math.round((ps.score / 4) * CONTENT_W);
            doc.rect(MARGIN, py, fillW, 26).fillOpacity(0.18).fill(barColor);
            doc.fillOpacity(1);
            // Left accent
            doc.rect(MARGIN, py, 4, 26).fill(barColor);

            doc.fontSize(10).fillColor(C.TEXT).font(FONT_BOLD)
                .text(`${ps.pillar.name}`, MARGIN + 10, py + 7, { lineBreak: false });
            doc.fontSize(9).fillColor(C.TEXT_MUTED).font(FONT_REG)
                .text(`Score: ${ps.score.toFixed(2)} / 4.0`,
                    MARGIN + CONTENT_W - 110, py + 8, { width: 106, align: 'right', lineBreak: false });

            py += 32;

            if (pillarLLM) {
                // Findings
                doc.fontSize(9).fillColor(C.TEXT).font(FONT_BOLD)
                    .text('Hallazgos:', MARGIN + 6, py, { lineBreak: false });
                py += 13;
                doc.fontSize(10).fillColor(C.TEXT_MUTED).font(FONT_REG)
                    .text(pillarLLM.findings, MARGIN + 6, py,
                        { width: CONTENT_W - 6, align: 'justify', lineGap: 2 });
                py += doc.heightOfString(pillarLLM.findings, { width: CONTENT_W - 6 }) + 7;

                // Gaps
                doc.fontSize(9).fillColor(C.TEXT).font(FONT_BOLD)
                    .text('Brechas:', MARGIN + 6, py, { lineBreak: false });
                py += 13;
                doc.fontSize(10).fillColor(C.TEXT_MUTED).font(FONT_REG)
                    .text(pillarLLM.gaps, MARGIN + 6, py,
                        { width: CONTENT_W - 6, align: 'justify', lineGap: 2 });
                py += doc.heightOfString(pillarLLM.gaps, { width: CONTENT_W - 6 }) + 7;

                // Recommendation
                doc.fontSize(9).fillColor(C.STEEL).font(FONT_BOLD)
                    .text('Recomendación:', MARGIN + 6, py, { lineBreak: false });
                py += 13;
                doc.fontSize(10).fillColor(C.TEXT_MUTED).font(FONT_REG)
                    .text(pillarLLM.recommendation, MARGIN + 6, py,
                        { width: CONTENT_W - 6, align: 'justify', lineGap: 2 });
                py += doc.heightOfString(pillarLLM.recommendation, { width: CONTENT_W - 6 }) + 7;
            } else {
                doc.fontSize(10).fillColor(C.SILVER).font(FONT_ITAL)
                    .text(FALLBACK, MARGIN + 6, py, { width: CONTENT_W - 6, lineGap: 2 });
                py += 18;
            }

            py += 14; // inter-pillar spacing
        }

        // ════════════════════════════════════════════════════════════════════
        // PAGE 4: IMPROVEMENT PLAN
        // ════════════════════════════════════════════════════════════════════
        doc.addPage();
        addHeader('Plan de Mejora Priorizado');

        let iy = CONTENT_Y + 4;

        // Quick Wins header
        doc.rect(MARGIN, iy, CONTENT_W, 30).fill(C.STEEL);
        doc.rect(MARGIN, iy, 4, 30).fill(C.GOLD);
        doc.fontSize(11).fillColor(C.WHITE).font(FONT_BOLD)
            .text('Victorias Rápidas  ·  Acciones < 90 días', MARGIN + 12, iy + 9,
                { width: CONTENT_W - 12, lineBreak: false });
        iy += 38;

        const quickWins = llmData?.improvementPlan?.quickWins ?? [];
        if (quickWins.length > 0) {
            quickWins.forEach((item, idx) => {
                // Row bg (alternating)
                doc.rect(MARGIN, iy, CONTENT_W, 4).fill(idx % 2 === 0 ? '#F0F4FA' : C.WHITE);
                iy += 5;
                doc.fontSize(10).fillColor(C.STEEL).font(FONT_BOLD)
                    .text(`${idx + 1}.`, MARGIN + 4, iy, { lineBreak: false });
                doc.fontSize(12).fillColor(C.TEXT).font(FONT_REG)
                    .text(item, MARGIN + 22, iy, { width: CONTENT_W - 22, align: 'justify', lineGap: 2 });
                iy += doc.heightOfString(item, { width: CONTENT_W - 22 }) + 10;
            });
        } else {
            doc.fontSize(12).fillColor(C.SILVER).font(FONT_ITAL)
                .text(FALLBACK, MARGIN, iy, { width: CONTENT_W, lineGap: 2 });
            iy += 22;
        }

        iy += 18;

        // Long-term header
        doc.rect(MARGIN, iy, CONTENT_W, 30).fill(C.NAVY);
        doc.rect(MARGIN, iy, 4, 30).fill(C.GOLD);
        doc.fontSize(11).fillColor(C.WHITE).font(FONT_BOLD)
            .text('Prioridades Estratégicas  ·  Iniciativas > 90 días', MARGIN + 12, iy + 9,
                { width: CONTENT_W - 12, lineBreak: false });
        iy += 38;

        const longTerm = llmData?.improvementPlan?.longTerm ?? [];
        if (longTerm.length > 0) {
            longTerm.forEach((item, idx) => {
                doc.rect(MARGIN, iy, CONTENT_W, 4).fill(idx % 2 === 0 ? '#F5F5F0' : C.WHITE);
                iy += 5;
                doc.fontSize(10).fillColor(C.GOLD).font(FONT_BOLD)
                    .text(`${idx + 1}.`, MARGIN + 4, iy, { lineBreak: false });
                doc.fontSize(12).fillColor(C.TEXT).font(FONT_REG)
                    .text(item, MARGIN + 22, iy, { width: CONTENT_W - 22, align: 'justify', lineGap: 2 });
                iy += doc.heightOfString(item, { width: CONTENT_W - 22 }) + 10;
            });
        } else {
            doc.fontSize(12).fillColor(C.SILVER).font(FONT_ITAL)
                .text(FALLBACK, MARGIN, iy, { width: CONTENT_W, lineGap: 2 });
        }

        // ════════════════════════════════════════════════════════════════════
        // PAGE 5: BENCHMARKING
        // ════════════════════════════════════════════════════════════════════
        doc.addPage();
        addHeader('Benchmarking Sectorial');

        let by = CONTENT_Y + 4;

        // Section title
        by = drawSectionTitle(doc,
            `Posición Relativa: ${assessment.client.name}`, by, C.GOLD, FONT_BOLD);

        // Maturity progression bar — 5 equal segments within content width
        const levels   = ['Experimental', 'Emergente', 'Definido', 'Gestionado', 'Optimizado'];
        const segCount = levels.length;
        const segGap   = 3;
        const segW     = Math.floor((CONTENT_W - segGap * (segCount - 1)) / segCount); // ~97px

        levels.forEach((lbl, i) => {
            const sx       = MARGIN + i * (segW + segGap);
            const isActive = (assessment.maturityLevel ?? 1) === i + 1;

            doc.rect(sx, by, segW, 30).fill(isActive ? C.STEEL : '#E8ECF0');
            if (isActive) {
                doc.rect(sx, by, segW, 3).fill(C.GOLD);
            }
            doc.fontSize(7.5)
                .fillColor(isActive ? C.WHITE : C.TEXT_MUTED)
                .font(isActive ? FONT_BOLD : FONT_REG)
                .text(lbl, sx, by + 11, { width: segW, align: 'center', lineBreak: false });
        });

        // Arrow label below active segment
        const activeIdx = (assessment.maturityLevel ?? 1) - 1;
        const arrowX    = MARGIN + activeIdx * (segW + segGap) + segW / 2 - 20;
        doc.fontSize(7).fillColor(C.STEEL).font(FONT_BOLD)
            .text('▲ Nivel actual', arrowX, by + 33, { width: 40, align: 'center', lineBreak: false });

        by += 55;

        // Benchmark text
        doc.fontSize(12).fillColor(C.TEXT_MUTED).font(FONT_REG)
            .text(llmData?.industryBenchmark ?? FALLBACK, MARGIN, by,
                { align: 'justify', width: CONTENT_W, lineGap: 2 });
        by += doc.heightOfString(llmData?.industryBenchmark ?? FALLBACK, { width: CONTENT_W }) + 24;

        // LLM attribution note
        if (llmData) {
            doc.rect(MARGIN, by, CONTENT_W, 28).fill('#F0F4F8');
            doc.rect(MARGIN, by, 3, 28).fill(C.STEEL);
            doc.fontSize(8).fillColor(C.TEXT_MUTED).font(FONT_REG)
                .text(
                    `Análisis generado por GammIA · ` +
                    `${new Date(llmData.generatedAt).toLocaleString('es-ES')} · ` +
                    `Para uso interno exclusivo.`,
                    MARGIN + 10, by + 9,
                    { width: CONTENT_W - 14, align: 'center', lineBreak: false });
        }

        // ════════════════════════════════════════════════════════════════════
        // FOOTERS — applied to all pages except cover
        // ════════════════════════════════════════════════════════════════════
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

// ─── Helper: section title with left accent bar ────────────────────────────────
function drawSectionTitle(
    doc: PDFKit.PDFDocument,
    title: string,
    y: number,
    accentColor: string,
    fontBold: string
): number {
    doc.rect(MARGIN, y, 3, 18).fill(accentColor);
    doc.fontSize(13).fillColor('#1A2035').font(fontBold)
        .text(title, MARGIN + 10, y + 2,
            { width: CONTENT_W - 10, lineBreak: false });
    return y + 26;
}

// ─── Helper: metric card ───────────────────────────────────────────────────────
function drawCard(
    doc: PDFKit.PDFDocument,
    x: number, y: number, w: number, h: number,
    title: string, value: string, sub: string,
    accentColor: string,
    fontReg: string, fontBold: string
) {
    // Shadow
    doc.roundedRect(x + 2, y + 2, w, h, 8).fill('#E0E6EE');
    // Card body
    doc.roundedRect(x, y, w, h, 8).fill('#FFFFFF').stroke('#D1D9E0');
    // Top accent stripe
    doc.rect(x + 1, y + 1, w - 2, 4).fill(accentColor);

    doc.fontSize(7.5).fillColor('#4A5568').font(fontBold)
        .text(title.toUpperCase(), x, y + 16,
            { width: w, align: 'center', characterSpacing: 0.4, lineBreak: false });

    doc.fontSize(24).fillColor(accentColor).font(fontBold)
        .text(value, x, y + 34, { width: w, align: 'center', lineBreak: false });

    if (sub) {
        doc.fontSize(8.5).fillColor('#9AAAB8').font(fontReg)
            .text(sub, x, y + 72, { width: w, align: 'center', lineBreak: false });
    }
}
