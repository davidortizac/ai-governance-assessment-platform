import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma';
import fs from 'fs';
import path from 'path';
import { LLMAnalysis } from './llm.service';

/* -------------------------------------------------------------------------- */
/* PAGE GEOMETRY                                                               */
/* -------------------------------------------------------------------------- */

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const HEADER_H = 76;
const CONTENT_Y = HEADER_H + 18;
const FOOTER_Y = PAGE_H - 36;

/* -------------------------------------------------------------------------- */
/* COLOR PALETTE                                                               */
/* -------------------------------------------------------------------------- */

const C = {
    NAVY: '#0F2C5F',
    STEEL: '#2563EB',
    GOLD: '#C9A84C',
    GOLD_BG: '#FEF3C7',
    SILVER: '#94A3B8',
    WHITE: '#FFFFFF',
    PAGE_BG: '#F4F6FA',
    TEXT: '#1E293B',
    TEXT_MUTED: '#475569',
    TEXT_LIGHT: '#94A3B8',
    ROW_ALT: '#EEF2FF',
    CONTROLLED: '#059669',
    LOW: '#16A34A',
    MEDIUM: '#D97706',
    HIGH: '#DC2626',
    CRITICAL: '#991B1B',
    LATENT: '#7C3AED',
};

const FALLBACK = 'El análisis automático no está disponible. Contacte a su consultor.';

/* -------------------------------------------------------------------------- */
/* LOOKUP TABLES                                                               */
/* -------------------------------------------------------------------------- */

const RISK_LABEL: Record<string, string> = {
    CONTROLLED: 'Controlado', LOW: 'Bajo', MEDIUM: 'Medio',
    HIGH: 'Alto', CRITICAL: 'Crítico', LATENT: 'Latente',
};

const RISK_COLOR: Record<string, string> = {
    CONTROLLED: C.CONTROLLED, LOW: C.LOW, MEDIUM: C.MEDIUM,
    HIGH: C.HIGH, CRITICAL: C.CRITICAL, LATENT: C.LATENT,
};

const MATURITY_LABEL: Record<number, string> = {
    1: 'Experimental', 2: 'Emergente', 3: 'Definido', 4: 'Gestionado', 5: 'Optimizado',
};

/* -------------------------------------------------------------------------- */
/* RICH TEXT HELPERS (inline **bold** support)                                */
/* -------------------------------------------------------------------------- */

/** Remove **bold** markers — used for height pre-calculation. */
function stripBold(text: string): string {
    return text.replace(/\*\*([^*]+)\*\*/g, '$1');
}

/**
 * Render text to PDFKit with inline **bold** marker support.
 * Segments wrapped in **...** render with FB (bold font); others with FR (regular).
 * All other options (width, align, lineGap, fillColor) are forwarded as-is.
 */
function renderRichText(
    doc: any, FR: string, FB: string, fillColor: string,
    text: string, x: number, y: number,
    opts: Record<string, unknown>,
): void {
    const rawParts = text.split(/(\*\*[^*]+\*\*)/);
    const parts = rawParts
        .map(p => ({ bold: p.startsWith('**') && p.endsWith('**'), content: p.startsWith('**') ? p.slice(2, -2) : p }))
        .filter(p => p.content.length > 0);

    if (parts.length === 0) return;

    // No bold markers — single call, more efficient
    if (parts.length === 1 && !parts[0].bold) {
        doc.font(FR).fillColor(fillColor).text(text, x, y, opts);
        return;
    }

    parts.forEach((part, idx) => {
        const isLast = idx === parts.length - 1;
        doc.font(part.bold ? FB : FR).fillColor(fillColor);
        if (idx === 0) {
            doc.text(part.content, x, y, { ...opts, continued: !isLast });
        } else {
            doc.text(part.content, { ...opts, continued: !isLast });
        }
    });
}

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
        // Prefer Segoe UI (Windows corporate font)
        const segReg = path.join(root, 'segoeui.ttf');
        const segBold = path.join(root, 'segoeuib.ttf');
        if (fs.existsSync(segReg)) {
            return { reg: segReg, bold: fs.existsSync(segBold) ? segBold : segReg, foundEbrima: true };
        }
        // Fallback: Ebrima
        const reg = path.join(root, 'ebrima.ttf');
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
    doc.font(FB).fontSize(12).fillColor(C.WHITE)
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
/* RADAR CHART RENDERER                                                        */
/* -------------------------------------------------------------------------- */

function renderRadarChart(
    doc: any, FR: string, FB: string,
    pillarScores: Array<{ score: any; pillar: { name: string } }>,
    cx: number, cy: number, radius: number,
): void {
    const N = pillarScores.length;
    if (N < 3) return;

    const angleFor = (i: number) => ((i / N) * 360 - 90) * Math.PI / 180;

    /* Hexagonal grid rings */
    for (let ring = 1; ring <= 4; ring++) {
        const rr = radius * ring / 4;
        for (let i = 0; i < N; i++) {
            const a = angleFor(i);
            const px = cx + rr * Math.cos(a);
            const py = cy + rr * Math.sin(a);
            if (i === 0) doc.moveTo(px, py);
            else doc.lineTo(px, py);
        }
        doc.closePath().lineWidth(0.5).strokeColor('#CBD5E1').stroke();
    }

    /* Axis lines */
    for (let i = 0; i < N; i++) {
        const a = angleFor(i);
        doc.moveTo(cx, cy)
            .lineTo(cx + radius * Math.cos(a), cy + radius * Math.sin(a))
            .lineWidth(0.5).strokeColor('#CBD5E1').stroke();
    }

    /* Scale labels on first axis (1–4) */
    for (let level = 1; level <= 4; level++) {
        const rr = radius * level / 4;
        const a = angleFor(0);
        doc.font(FR).fontSize(7).fillColor(C.TEXT_LIGHT)
            .text(`${level}`, cx + rr * Math.cos(a) + 5, cy + rr * Math.sin(a) - 4, { lineBreak: false });
    }

    /* Score polygon — compute points */
    const pts: Array<[number, number]> = pillarScores.map((ps, i) => {
        const a = angleFor(i);
        const r = radius * Math.min(Number(ps.score) / 4, 1);
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    });

    /* Filled area */
    doc.save();
    doc.fillOpacity(0.25);
    doc.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) doc.lineTo(pts[i][0], pts[i][1]);
    doc.closePath().fill(C.STEEL);
    doc.restore();

    /* Stroke outline */
    doc.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) doc.lineTo(pts[i][0], pts[i][1]);
    doc.closePath().lineWidth(1.5).strokeColor(C.STEEL).stroke();

    /* Data dots + score labels */
    for (let i = 0; i < pts.length; i++) {
        const [px, py] = pts[i];
        doc.circle(px, py, 3.5).fill(C.STEEL);

        const score = Number(pillarScores[i].score);
        const a = angleFor(i);
        const lblR = radius * Math.min(score / 4, 1) + 14;
        const lx = cx + lblR * Math.cos(a);
        const ly = cy + lblR * Math.sin(a);
        doc.font(FB).fontSize(8).fillColor(C.NAVY)
            .text(score.toFixed(2), lx - 14, ly - 5, { width: 28, align: 'center', lineBreak: false });
    }

    /* Pillar axis labels */
    const labelCfg = [
        { dx: -50, dy: -22, w: 100, align: 'center' as const },
        { dx: 10, dy: -16, w: 100, align: 'left' as const },
        { dx: 10, dy: 2, w: 100, align: 'left' as const },
        { dx: -50, dy: 10, w: 100, align: 'center' as const },
        { dx: -110, dy: 2, w: 100, align: 'right' as const },
        { dx: -110, dy: -16, w: 100, align: 'right' as const },
    ];

    for (let i = 0; i < Math.min(N, labelCfg.length); i++) {
        const a = angleFor(i);
        const tipX = cx + radius * Math.cos(a);
        const tipY = cy + radius * Math.sin(a);
        const { dx, dy, w, align } = labelCfg[i];
        doc.font(FB).fontSize(8).fillColor(C.TEXT)
            .text(pillarScores[i].pillar.name, tipX + dx, tipY + dy, { width: w, align, lineBreak: true });
    }
}

/* -------------------------------------------------------------------------- */
/* COVER PAGE RENDERER                                                         */
/* -------------------------------------------------------------------------- */

interface CoverData {
    clientName: string;
    consultantName: string;
    completedAt: Date | null;
    type: string;
    overallScore: number | null;
    matLevel: number | null;
    riskLevel: string | null;
}

function renderCoverPage(
    doc: any, FR: string, FB: string, logoPath: string, data: CoverData,
): void {
    doc.rect(0, 0, PAGE_W, PAGE_H).fill(C.NAVY);
    doc.rect(0, 0, PAGE_W, 5).fill(C.GOLD);
    doc.rect(0, 0, 5, PAGE_H).fill(C.GOLD);

    if (logoPath) {
        try { doc.image(logoPath, PAGE_W / 2 - 50, 55, { width: 100 }); } catch { /* skip */ }
    }

    const companyY = logoPath ? 178 : 100;
    doc.font(FB).fontSize(12).fillColor(C.GOLD)
        .text('GAMMA INGENIEROS', 0, companyY, { width: PAGE_W, align: 'center', lineBreak: false });

    const sepY = companyY + 22;
    doc.rect(PAGE_W / 2 - 100, sepY + 6, 200, 1).fill(C.GOLD);

    const titleY = sepY + 20;
    doc.font(FB).fontSize(26).fillColor(C.WHITE)
        .text('AI CYBERSECURITY', 0, titleY, { width: PAGE_W, align: 'center', lineBreak: false });
    doc.font(FB).fontSize(26).fillColor(C.WHITE)
        .text('MATURITY ASSESSMENT', 0, titleY + 36, { width: PAGE_W, align: 'center', lineBreak: false });
    doc.font(FR).fontSize(12).fillColor(C.SILVER)
        .text('Evaluación de Madurez y Riesgo en Inteligencia Artificial',
            0, titleY + 76, { width: PAGE_W, align: 'center', lineBreak: false });

    /* Client info block */
    const infoY = titleY + 112;
    doc.rect(MARGIN + 30, infoY, CONTENT_W - 60, 0.5).fill('#334E7B');
    const infoRows = [
        { label: 'ORGANIZACIÓN EVALUADA', value: data.clientName },
        { label: 'CONSULTOR', value: data.consultantName },
        {
            label: 'FECHA',
            value: data.completedAt?.toLocaleDateString('es-ES', {
                day: '2-digit', month: 'long', year: 'numeric'
            }) ?? 'N/A'
        },
        { label: 'TIPO DE EVALUACIÓN', value: data.type },
    ];
    let infoLY = infoY + 14;
    for (const row of infoRows) {
        doc.font(FR).fontSize(12).fillColor(C.SILVER)
            .text(row.label, MARGIN + 42, infoLY, { lineBreak: false });
        doc.font(FB).fontSize(12).fillColor(C.WHITE)
            .text(row.value, MARGIN + 42, infoLY + 12, { lineBreak: false });
        infoLY += 36;
    }
    doc.rect(MARGIN + 30, infoLY + 2, CONTENT_W - 60, 0.5).fill('#334E7B');

    /* Score display */
    const scoreY = infoLY + 26;
    const scoreVal = data.overallScore?.toFixed(2) ?? '—';
    doc.font(FB).fontSize(48).fillColor(C.GOLD)
        .text(scoreVal, 0, scoreY, { width: PAGE_W, align: 'center', lineBreak: false });
    doc.font(FB).fontSize(12).fillColor(C.SILVER)
        .text('SCORE GENERAL', 0, scoreY + 56,
            { width: PAGE_W, align: 'center', lineBreak: false });

    /* Madurez y Riesgo */
    const mat = MATURITY_LABEL[data.matLevel ?? 0] ?? '—';
    const risk = RISK_LABEL[data.riskLevel ?? ''] ?? '—';
    doc.font(FR).fontSize(12).fillColor(C.SILVER)
        .text(`Madurez: ${mat}`, 0, scoreY + 80,
            { width: PAGE_W, align: 'center', lineBreak: false });
    doc.font(FR).fontSize(12).fillColor(RISK_COLOR[data.riskLevel ?? ''] ?? C.SILVER)
        .text(`Riesgo: ${risk}`, 0, scoreY + 98,
            { width: PAGE_W, align: 'center', lineBreak: false });

    doc.font(FR).fontSize(7).fillColor(C.SILVER)
        .text('CONFIDENCIAL · Para uso interno exclusivo',
            0, PAGE_H - 28, { width: PAGE_W, align: 'center', lineBreak: false });
}

/* -------------------------------------------------------------------------- */
/* SIGNATURE PAGE RENDERER                                                     */
/* -------------------------------------------------------------------------- */

function renderSignaturePage(
    doc: any, FR: string, FB: string, logoPath: string,
    llmData: LLMAnalysis | null, startY: number,
): void {
    /* Separator line */
    doc.rect(MARGIN + 60, startY, CONTENT_W - 120, 1).fill(C.GOLD);

    /* Logo */
    if (logoPath) {
        try { doc.image(logoPath, PAGE_W / 2 - 40, startY + 20, { width: 80 }); } catch { /* skip */ }
    }

    const stampY = logoPath ? startY + 116 : startY + 30;

    doc.font(FB).fontSize(14).fillColor(C.NAVY)
        .text('GAMMA INGENIEROS', 0, stampY, { width: PAGE_W, align: 'center', lineBreak: false });
    doc.font(FR).fontSize(9).fillColor(C.TEXT_LIGHT)
        .text('AI Governance & Cybersecurity', 0, stampY + 20, { width: PAGE_W, align: 'center', lineBreak: false });

    doc.rect(MARGIN + 100, stampY + 40, CONTENT_W - 200, 0.5).fill(C.GOLD);

    doc.font(FR).fontSize(11).fillColor(C.TEXT_MUTED)
        .text('Este informe fue generado mediante la plataforma de evaluación de Gamma Ingenieros',
            MARGIN, stampY + 56, { width: CONTENT_W, align: 'center', lineGap: 2 });
    doc.font(FR).fontSize(11).fillColor(C.TEXT_MUTED)
        .text('con análisis asistido por inteligencia artificial.',
            MARGIN, stampY + 72, { width: CONTENT_W, align: 'center', lineGap: 2 });

    /* GammIA badge */
    const badgeY = stampY + 104;
    const badgeW = 180;
    const badgeH = 32;
    const badgeX = PAGE_W / 2 - badgeW / 2;
    doc.rect(badgeX, badgeY, badgeW, badgeH).fill(C.NAVY);
    doc.font(FB).fontSize(11).fillColor(C.GOLD)
        .text('Powered by GammIA', badgeX, badgeY + 9, { width: badgeW, align: 'center', lineBreak: false });

    /* Model & date info */
    const modelName = llmData?.model ?? process.env.OLLAMA_MODEL ?? '—';
    const genDate = llmData?.generatedAt
        ? new Date(llmData.generatedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.font(FR).fontSize(8).fillColor(C.TEXT_LIGHT)
        .text(`Modelo de análisis: ${modelName}`, MARGIN, badgeY + 48, { width: CONTENT_W, align: 'center', lineBreak: false });
    doc.font(FR).fontSize(8).fillColor(C.TEXT_LIGHT)
        .text(`Fecha de generación: ${genDate}`, MARGIN, badgeY + 62, { width: CONTENT_W, align: 'center', lineBreak: false });

    /* Disclaimer — metodología */
    doc.rect(MARGIN + 60, badgeY + 88, CONTENT_W - 120, 0.5).fill(C.GOLD);
    doc.font(FR).fontSize(7.5).fillColor(C.TEXT_LIGHT)
        .text(
            'Nota: Los hallazgos, brechas y recomendaciones presentados en este informe han sido generados ' +
            'mediante análisis automatizado de inteligencia artificial y revisados bajo la metodología CSIA de ' +
            'Gamma Ingenieros. Este documento es confidencial y está destinado exclusivamente al uso interno ' +
            'de la organización evaluada.',
            MARGIN + 30, badgeY + 100, { width: CONTENT_W - 60, align: 'center', lineGap: 2 });

    /* Disclaimer — protección de datos */
    const dpY = badgeY + 164;
    doc.rect(MARGIN + 40, dpY, CONTENT_W - 80, 0.5).fill(C.TEXT_LIGHT);
    doc.font(FB).fontSize(7.5).fillColor(C.TEXT)
        .text('AVISO DE PROTECCIÓN DE DATOS', MARGIN, dpY + 10,
            { width: CONTENT_W, align: 'center', lineBreak: false });
    doc.font(FR).fontSize(7).fillColor(C.TEXT_MUTED)
        .text(
            'La información contenida en el presente informe es tratada con estricta confidencialidad ' +
            'y se encuentra protegida conforme a las políticas de seguridad de la información de ' +
            'Gamma Ingenieros S.A.S., en cumplimiento de la Ley 1581 de 2012 (Régimen General de ' +
            'Protección de Datos Personales), el Decreto 1377 de 2013 y demás normas concordantes ' +
            'expedidas por el Gobierno de la República de Colombia. Los datos suministrados por la ' +
            'organización evaluada son recopilados, almacenados y procesados exclusivamente para los ' +
            'fines de la evaluación de madurez en ciberseguridad e inteligencia artificial, y no serán ' +
            'divulgados, transferidos ni comercializados a terceros sin la autorización previa, expresa ' +
            'y escrita del titular. Gamma Ingenieros implementa medidas técnicas, administrativas y ' +
            'organizativas adecuadas para garantizar la integridad, disponibilidad y confidencialidad ' +
            'de la información, en concordancia con los estándares internacionales de seguridad aplicables. ' +
            'El receptor de este documento se compromete a preservar su carácter reservado y a no ' +
            'reproducirlo, total o parcialmente, sin autorización expresa de Gamma Ingenieros.',
            MARGIN + 30, dpY + 24, { width: CONTENT_W - 60, align: 'justify', lineGap: 1.5 });
}

/* -------------------------------------------------------------------------- */
/* ORGANIZATIONAL CONTEXT RENDERER                                             */
/* -------------------------------------------------------------------------- */

const CTX_LABELS: Record<string, string> = {
    totalUsers: 'Usuarios / Empleados',
    infoSystems: 'Sistemas de Información',
    aiModelsUsed: 'Modelos / Herramientas de IA',
    aiBudget: 'Presupuesto IA',
};

function renderOrgContext(
    doc: any, FR: string, FB: string,
    ctxData: Record<string, string> | null,
    secLabel: (text: string, x: number, y: number) => void,
    y: number,
): number {
    if (!ctxData || typeof ctxData !== 'object') return y;
    const entries = Object.entries(ctxData)
        .filter(([, v]) => v && String(v).trim() !== '');
    if (entries.length === 0) return y;

    secLabel('CONTEXTO ORGANIZACIONAL', MARGIN, y);
    y += 16;
    const innerW = CONTENT_W - 24;
    const rowH = 28;
    const boxH = entries.length * rowH + 12;
    doc.rect(MARGIN, y, CONTENT_W, boxH).fill(C.WHITE);
    doc.rect(MARGIN, y, 3, boxH).fill(C.GOLD);
    let row = y + 6;
    for (const [key, val] of entries) {
        const label = CTX_LABELS[key] ?? key;
        const midY = row + (rowH - 11) / 2;
        doc.font(FB).fontSize(12).fillColor(C.TEXT)
            .text(`${label}:`, MARGIN + 14, midY, { lineBreak: false });
        doc.font(FR).fontSize(12).fillColor(C.TEXT_MUTED)
            .text(String(val), MARGIN + 210, midY, { width: innerW - 210, lineBreak: false });
        row += rowH;
    }
    return y + boxH + 12;
}

/* -------------------------------------------------------------------------- */
/* PILLAR ANALYSIS FALLBACK (when LLM didn't generate pillar content)         */
/* -------------------------------------------------------------------------- */

const PILLAR_FALLBACK: Record<string, { findings: string; gaps: string; recommendation: string }> = {
    strategy_governance: {
        findings: 'La evaluación revela un nivel de madurez incipiente en los mecanismos de gobernanza de IA. No se evidencia la existencia de políticas formales, comités de supervisión ni marcos de rendición de cuentas para los sistemas de inteligencia artificial en operación. Las decisiones relacionadas con IA se toman de forma ad hoc sin criterios documentados.',
        gaps: '1. Ausencia de políticas formales de uso y gobernanza de IA alineadas con NIST AI RMF Govern.\n2. Falta de inventario de sistemas de IA activos y clasificación por nivel de riesgo operativo.\n3. Inexistencia de un comité o responsable designado para la supervisión estratégica de IA.',
        recommendation: 'Se recomienda establecer una política corporativa de IA bajo **NIST AI RMF Govern**, crear un inventario de sistemas con clasificación de riesgo y designar un AI Governance Officer. Gamma Ingenieros acompaña este proceso mediante talleres ejecutivos y la metodología **CSIA Pilar 1 y 5**.',
    },
    employee_usage: {
        findings: 'Se identifican prácticas no controladas de uso de herramientas de IA generativa por parte de empleados sin políticas formales de autorización. El fenómeno de **Shadow AI** representa un vector de riesgo activo ante la posible exposición de información corporativa sensible a modelos externos no auditados.',
        gaps: '1. Ausencia de inventario de herramientas de IA utilizadas por empleados (Shadow AI activo y no gestionado).\n2. Sin programas estructurados de capacitación en uso seguro y responsable de IA para el personal.\n3. Falta de controles de prevención de pérdida de datos en interacciones con LLM externos.',
        recommendation: 'Implementar un diagnóstico de **Shadow AI** bajo **CSIA Pilar 1**, establecer una política de uso aceptable de IA y diseñar un programa de capacitación en ciberseguridad de IA (**NIST AI RMF Govern**). Gamma Ingenieros facilita el taller de sensibilización CSIA para directivos y usuarios finales.',
    },
    ai_development: {
        findings: 'Los procesos de desarrollo de modelos de IA carecen de controles de seguridad estructurados. No se evidencian prácticas de validación adversarial, control de calidad de datos de entrenamiento ni procedimientos formales de evaluación de riesgos en el ciclo de vida del modelo, exponiendo los sistemas a amenazas documentadas en **MITRE ATLAS**.',
        gaps: '1. Ausencia de controles contra data poisoning y model inversion en el ciclo de desarrollo (**MITRE ATLAS**).\n2. Sin procesos de validación de integridad y linaje de datos de entrenamiento bajo **NIST Measure**.\n3. Falta de Red Teaming adversarial sobre modelos antes de su despliegue en producción.',
        recommendation: 'Adoptar prácticas de desarrollo seguro de IA bajo **NIST Map+Measure**, implementar controles **MITRE ATLAS** para data poisoning y ejecutar sesiones de Red Teaming (**CSIA Pilar 4**). Gamma Ingenieros acompaña el diseño del programa de pruebas adversariales.',
    },
    agents_integrations: {
        findings: 'Los agentes de IA e integraciones en operación presentan un nivel de supervisión humana insuficiente. Se identifican flujos de automatización con capacidad de toma de decisiones sin intervención humana en procesos críticos, exponiendo a la organización al riesgo de **Excessive Agency (OWASP LLM06)**.',
        gaps: '1. Agentes de IA operando sin Human-in-the-Loop en decisiones de alto impacto (**OWASP LLM06 Excessive Agency**).\n2. Ausencia de inventario y documentación de integraciones de IA activas con sistemas corporativos.\n3. Sin controles de monitoreo de comportamiento anómalo en flujos agénticos en tiempo real.',
        recommendation: 'Implementar supervisión humana obligatoria en decisiones críticas (**CSIA Pilar 6 Human-in-the-Loop**), documentar todas las integraciones y desplegar monitoreo runtime de agentes bajo **NIST Manage**. Gamma Ingenieros diseña el marco de control para entornos agénticos.',
    },
    infrastructure: {
        findings: 'La infraestructura de datos y tecnología no está preparada para soportar sistemas de IA de forma segura y gobernada. Se identifican carencias en la clasificación de datos, la telemetría unificada y los controles de acceso necesarios para un entorno de IA empresarial robusto alineado con **CSIA Pilar 7**.',
        gaps: '1. Datos de entrenamiento e inferencia sin clasificación, segmentación ni controles de acceso adecuados (**NIST Map**).\n2. Ausencia de telemetría unificada para monitoreo de sistemas de IA en el SOC (**CSIA Pilar 7**).\n3. Infraestructura sin preparación para cumplimiento regulatorio de IA (trazabilidad y auditoría).',
        recommendation: 'Implementar clasificación y segmentación de datos bajo **NIST Map+Manage**, construir una capa de telemetría unificada para el SOC agéntico (**CSIA Pilar 7**) y diseñar controles de acceso por roles. Gamma Ingenieros acompaña la hoja de ruta de infraestructura para IA lista para producción.',
    },
    ai_security: {
        findings: 'Los controles de seguridad específicos para sistemas de IA son inexistentes o insuficientes. No se evidencian mecanismos de defensa contra las principales amenazas del ecosistema: **Prompt Injection (OWASP LLM01)**, **Sensitive Information Disclosure (LLM02)** ni controles adversariales documentados bajo **MITRE ATLAS**.',
        gaps: '1. Sin controles de detección y prevención de Prompt Injection en LLM productivos (**OWASP LLM01**).\n2. Ausencia de mecanismos de scrubbing de PII en respuestas de modelos (**OWASP LLM02**).\n3. Sin programa estructurado de pruebas adversariales contra los modelos en uso (**MITRE ATLAS**).',
        recommendation: 'Desplegar monitoreo de prompts y respuestas en tiempo real (**CSIA Pilar 3**), implementar filtros de PII en salidas de modelos y establecer un programa de Red Teaming bajo **MITRE ATLAS** (**CSIA Pilar 4**). Gamma Ingenieros acompaña el baseline de seguridad para IA bajo metodología CSIA.',
    },
};

function buildPillarFallback(pillarKey: string): { findings: string; gaps: string; recommendation: string } {
    return PILLAR_FALLBACK[pillarKey] ?? {
        findings: 'No se dispone de análisis automatizado para este pilar. Se recomienda revisar las respuestas del assessment con el consultor asignado para obtener hallazgos específicos.',
        gaps: '1. Información insuficiente para determinar brechas específicas en este pilar.\n2. Se requiere revisión manual de las respuestas del assessment.\n3. Contacte a Gamma Ingenieros para un diagnóstico detallado.',
        recommendation: 'Consulte con Gamma Ingenieros para obtener un análisis detallado de este pilar bajo la metodología CSIA.',
    };
}

/* -------------------------------------------------------------------------- */
/* FALLBACK IMPROVEMENT PLAN (when LLM didn't generate items)                 */
/* -------------------------------------------------------------------------- */

const PILLAR_QUICK_WIN: Record<string, string> = {
    strategy_governance: 'Definir y aprobar una **Política de Uso de IA** con clasificación de sistemas por nivel de riesgo, alineada con NIST AI RMF Govern. Gamma Ingenieros acompaña la redacción en taller de 1 día.',
    employee_usage: 'Realizar un **diagnóstico de Shadow AI**: inventariar todas las herramientas de IA que los empleados usan sin aprobación formal. Gamma Ingenieros provee la metodología de inventario CSIA en menos de 2 semanas.',
    ai_development: 'Ejecutar una sesión de **Red Teaming básico** sobre los modelos de IA en producción, aplicando las técnicas de data poisoning y model inversion de MITRE ATLAS. Gamma Ingenieros facilita el taller.',
    agents_integrations: 'Mapear todos los **agentes e integraciones de IA activos** e identificar los que operan sin supervisión humana (OWASP LLM06 Excessive Agency). Gamma Ingenieros provee la plantilla de inventario.',
    infrastructure: 'Auditar la **infraestructura de datos que alimenta los sistemas de IA**: identificar fuentes no clasificadas, accesos sin control y telemetría faltante. Gamma Ingenieros realiza el diagnóstico en 5 días.',
    ai_security: 'Implementar **monitoreo básico de prompts y respuestas** en los LLM productivos para detectar intentos de Prompt Injection (OWASP LLM01). Gamma Ingenieros configura el baseline de alertas.',
};

const MATURITY_QUICK_WIN: Record<number, string> = {
    1: 'Realizar el **taller de sensibilización ejecutiva CSIA** con CIO, CISO y directores de tecnología para alinear a la alta dirección sobre los riesgos de la IA no gobernada. Duración: 4 horas.',
    2: 'Formalizar los **procesos de gobernanza de IA existentes** en políticas escritas con responsables, métricas y ciclos de revisión trimestrales bajo NIST AI RMF Govern.',
    3: 'Cerrar la brecha entre **gobernanza definida y controles técnicos activos**: implementar runtime monitoring y pruebas adversariales para validar que las políticas se cumplen en producción.',
    4: 'Optimizar el **programa de Red Teaming adversarial** con ciclos continuos bajo MITRE ATLAS y preparar el reporte de trazabilidad exigido por la regulación de IA emergente.',
    5: 'Escalar las capacidades hacia un **SOC Agéntico**: integrar telemetría de todos los sistemas de IA en una plataforma unificada de detección y respuesta automatizada.',
};

const PILLAR_LONG_TERM: Record<string, string> = {
    strategy_governance: 'Implementar el **marco de gobernanza CSIA completo**: políticas, comité de IA, inventario de modelos y registro de riesgos alineado con NIST AI RMF y la regulación de IA emergente (EU AI Act, ISO 42001).',
    employee_usage: 'Desarrollar un **programa de cultura de IA responsable**: capacitación continua, certificación interna de uso seguro y controles técnicos de acceso a herramientas de IA por rol y nivel de riesgo.',
    ai_development: 'Construir un **ciclo de vida seguro de desarrollo de IA (AI SDLC)**: desde diseño hasta retiro, con controles MITRE ATLAS en cada fase, revisiones de seguridad y pruebas adversariales sistemáticas.',
    agents_integrations: 'Diseñar e implementar una **arquitectura Human-in-the-Loop (HITL)** para todos los agentes de IA que toman decisiones de negocio, garantizando supervisión ejecutiva y trazabilidad (NIST Manage + OWASP LLM06).',
    infrastructure: 'Construir la **infraestructura de datos lista para IA**: data governance, clasificación, linaje de datos y telemetría unificada para habilitar el SOC Agéntico de Gamma Ingenieros.',
    ai_security: 'Implementar una **plataforma de seguridad de IA en tiempo real**: detección de ataques adversariales (MITRE ATLAS), protección contra Prompt Injection y Sensitive Data Disclosure (OWASP LLM01+LLM02), con respuesta automatizada.',
};

/** Build a fallback quick-wins list from the weakest pillar + maturity level. */
function buildFallbackQuickWins(assessment: any): string[] {
    const scores: Array<{ key: string; score: number }> = (assessment.pillarScores ?? [])
        .map((ps: any) => ({ key: ps.pillar?.key ?? '', score: Number(ps.score) }))
        .sort((a: { key: string; score: number }, b: { key: string; score: number }) => a.score - b.score);

    const matLevel: number = (assessment as any).maturityLevel ?? 1;
    const weakest = scores[0]?.key ?? '';
    const second = scores[1]?.key ?? '';

    const w1 = PILLAR_QUICK_WIN[weakest] ?? PILLAR_QUICK_WIN['strategy_governance'];
    const w2 = PILLAR_QUICK_WIN[second] ?? PILLAR_QUICK_WIN['employee_usage'];
    const w3 = MATURITY_QUICK_WIN[matLevel] ?? MATURITY_QUICK_WIN[1];

    return [w1, w2, w3];
}

/** Build a fallback long-term list from the three weakest pillars. */
function buildFallbackLongTerm(assessment: any): string[] {
    const scores: Array<{ key: string; score: number }> = (assessment.pillarScores ?? [])
        .map((ps: any) => ({ key: ps.pillar?.key ?? '', score: Number(ps.score) }))
        .sort((a: { key: string; score: number }, b: { key: string; score: number }) => a.score - b.score);

    const top3 = scores.slice(0, 3).map(s => s.key);
    const defaults = ['strategy_governance', 'ai_security', 'infrastructure'];
    while (top3.length < 3) top3.push(defaults[top3.length]);

    return top3.map(key => PILLAR_LONG_TERM[key] ?? PILLAR_LONG_TERM['strategy_governance']);
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

    const llmData = (assessment as any).llmAnalysis as LLMAnalysis | null;
    const riskLevel = (assessment as any).riskLevel as string | null;
    const matLevel = (assessment as any).maturityLevel as number | null;

    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });

        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        /* ── Fonts ── */
        const fp = resolveFonts();
        let FR = 'Helvetica';
        let FB = 'Helvetica-Bold';
        if (fp.foundEbrima) {
            try {
                doc.registerFont('Ebrima', fp.reg);
                doc.registerFont('Ebrima-Bold', fp.bold);
                FR = 'Ebrima';
                FB = 'Ebrima-Bold';
            } catch { /* keep Helvetica */ }
        }

        const logoPath = resolveLogoPath();

        /* ── Helpers ── */
        const pageBg = () => doc.rect(0, 0, PAGE_W, PAGE_H).fill(C.PAGE_BG);
        const addHeader = (title: string) => renderHeader(doc, FR, FB, logoPath, title);
        const addFooter = (n: number, t: number) => renderFooter(doc, FR, FB, n, t);

        const drawScoreBar = (x: number, y: number, score: number, barW = 100, barH = 7) => {
            const pct = Math.min(Math.max(Number(score) / 4, 0), 1);
            doc.rect(x, y, barW, barH).fill('#DDE3EE');
            if (pct > 0) doc.rect(x, y, barW * pct, barH).fill(scoreColor(Number(score)));
        };

        const secLabel = (text: string, x: number, y: number) =>
            doc.font(FB).fontSize(8).fillColor(C.TEXT_LIGHT).text(text, x, y, { lineBreak: false });

        /* ══════════════════════════════════════════════════════════════════════
           PAGE 1 — COVER
        ══════════════════════════════════════════════════════════════════════ */

        renderCoverPage(doc, FR, FB, logoPath, {
            clientName: assessment.client.name,
            consultantName: assessment.createdBy.name,
            completedAt: assessment.completedAt,
            type: assessment.type,
            overallScore: assessment.overallScore ? Number(assessment.overallScore) : null,
            matLevel,
            riskLevel,
        });

        /* ══════════════════════════════════════════════════════════════════════
           PAGE 2 — RESUMEN EJECUTIVO
        ══════════════════════════════════════════════════════════════════════ */

        doc.addPage();
        pageBg();
        addHeader('Resumen Ejecutivo');

        let y = CONTENT_Y;

        secLabel('RESUMEN EJECUTIVO', MARGIN, y);
        y += 14;
        const execText = llmData?.executiveSummary ?? FALLBACK;
        doc.font(FR).fontSize(12);
        renderRichText(doc, FR, FB, C.TEXT,
            execText, MARGIN, y, { width: CONTENT_W, align: 'justify', lineGap: 2 });
        y += doc.heightOfString(stripBold(execText), { width: CONTENT_W, lineGap: 2 }) + 22;

        /* Awareness callout */
        const awText = llmData?.awarenessMessage ?? FALLBACK;
        const awInnerW = CONTENT_W - 30;
        doc.font(FR).fontSize(12);
        const awH = doc.heightOfString(stripBold(awText), { width: awInnerW, lineGap: 2 }) + 40;
        doc.rect(MARGIN, y, CONTENT_W, awH).fill(C.GOLD_BG);
        doc.rect(MARGIN, y, 4, awH).fill(C.GOLD);
        secLabel('POR QUÉ ES IMPORTANTE ACTUAR AHORA', MARGIN + 16, y + 12);
        renderRichText(doc, FR, FB, C.TEXT_MUTED,
            awText, MARGIN + 16, y + 28, { width: awInnerW, align: 'justify', lineGap: 2 });
        y += awH + 22;

        /* Industry benchmark */
        if (y < FOOTER_Y - 80) {
            const benchText = llmData?.industryBenchmark ?? FALLBACK;
            secLabel('CONTEXTO DE INDUSTRIA', MARGIN, y);
            y += 14;
            renderRichText(doc, FR, FB, C.TEXT_MUTED,
                benchText, MARGIN, y, { width: CONTENT_W, align: 'justify', lineGap: 2 });
            y += doc.heightOfString(stripBold(benchText), { width: CONTENT_W, lineGap: 2 }) + 18;
        }

        /* Organizational context (optional) */
        if (y > FOOTER_Y - 100) {
            doc.addPage(); pageBg(); addHeader('Resumen Ejecutivo (cont.)');
            y = CONTENT_Y;
        }
        renderOrgContext(doc, FR, FB, (assessment as any).contextData, secLabel, y);

        /* ══════════════════════════════════════════════════════════════════════
           PAGE 3 — MODELO ESTRATÉGICO CSIA
        ══════════════════════════════════════════════════════════════════════ */

        doc.addPage();
        pageBg();
        addHeader('Modelo Estratégico CSIA');

        let cy = CONTENT_Y;

        const csiaIntroText =
            'CSIA (Cybersecurity Strategy for Artificial Intelligence) es la estrategia ' +
            'desarrollada por Gamma Ingenieros para apoyar a las organizaciones en la ' +
            'adopción segura de inteligencia artificial mediante controles de gobernanza ' +
            'y ciberseguridad. Integra prácticas de marcos internacionales para construir ' +
            'un modelo operativo de evaluación, control de riesgos y mejora continua en IA.';
        doc.font(FR).fontSize(12).fillColor(C.TEXT)
            .text(csiaIntroText, MARGIN, cy, { width: CONTENT_W, align: 'justify', lineGap: 2 });
        cy += doc.heightOfString(csiaIntroText, { width: CONTENT_W, lineGap: 2 }) + 20;

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
            const fwInnerW = CONTENT_W - 28;
            doc.font(FR).fontSize(12);
            const fwDescH = doc.heightOfString(fw.desc, { width: fwInnerW, lineGap: 2 });
            const fwH = fwDescH + 38;
            doc.rect(MARGIN, cy, CONTENT_W, fwH).fill(C.WHITE);
            doc.rect(MARGIN, cy, 3, fwH).fill(fw.color);
            doc.font(FB).fontSize(12).fillColor(C.TEXT)
                .text(fw.name, MARGIN + 14, cy + 10, { lineBreak: false });
            doc.font(FR).fontSize(12).fillColor(C.TEXT_MUTED)
                .text(fw.desc, MARGIN + 14, cy + 26, { width: fwInnerW, align: 'justify', lineGap: 2 });
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
            .text('PILAR', MARGIN + 14, sy + 8, { lineBreak: false });
        doc.font(FB).fontSize(8.5).fillColor(C.WHITE)
            .text('PUNTUACIÓN', MARGIN + 220, sy + 8, { lineBreak: false });
        doc.font(FB).fontSize(8.5).fillColor(C.WHITE)
            .text('MADUREZ', MARGIN + 390, sy + 8, { lineBreak: false });
        sy += 26;

        assessment.pillarScores.forEach((ps, idx) => {
            const rowH = 38;
            const score = Number(ps.score);
            const rowBg = idx % 2 === 0 ? C.WHITE : C.ROW_ALT;
            doc.rect(MARGIN, sy, CONTENT_W, rowH).fill(rowBg);
            doc.rect(MARGIN, sy, 3, rowH).fill(scoreColor(score));

            const midY = sy + (rowH - 11) / 2;   // vertical center for 11pt font

            /* Pillar name */
            doc.font(FB).fontSize(12).fillColor(C.TEXT)
                .text(ps.pillar.name, MARGIN + 12, midY, { width: 200, lineBreak: false });

            /* Score bar + value */
            drawScoreBar(MARGIN + 220, sy + (rowH - 7) / 2, score, 100, 7);
            doc.font(FB).fontSize(12).fillColor(scoreColor(score))
                .text(score.toFixed(2), MARGIN + 330, midY, { lineBreak: false });

            /* Maturity label */
            doc.font(FR).fontSize(12).fillColor(C.TEXT_MUTED)
                .text(scoreToMaturity(score), MARGIN + 390, midY, { lineBreak: false });

            sy += rowH;
        });

        /* Overall summary row */
        sy += 10;
        doc.rect(MARGIN, sy, CONTENT_W, 48).fill(C.NAVY);
        const overallScore = assessment.overallScore?.toFixed(2) ?? '—';
        const overallMat = MATURITY_LABEL[matLevel ?? 0] ?? '—';
        const overallRisk = RISK_LABEL[riskLevel ?? ''] ?? '—';
        const riskCol = RISK_COLOR[riskLevel ?? ''] ?? C.MEDIUM;

        doc.font(FB).fontSize(8).fillColor(C.SILVER)
            .text('SCORE GENERAL', MARGIN + 14, sy + 8, { lineBreak: false });
        doc.font(FB).fontSize(22).fillColor(C.GOLD)
            .text(overallScore, MARGIN + 14, sy + 18, { lineBreak: false });

        doc.font(FB).fontSize(8).fillColor(C.SILVER)
            .text('NIVEL DE MADUREZ', MARGIN + 200, sy + 8, { lineBreak: false });
        doc.font(FB).fontSize(13).fillColor(C.WHITE)
            .text(overallMat, MARGIN + 200, sy + 22, { lineBreak: false });

        doc.font(FB).fontSize(8).fillColor(C.SILVER)
            .text('RIESGO GLOBAL', MARGIN + 370, sy + 8, { lineBreak: false });
        doc.font(FB).fontSize(13).fillColor(riskCol)
            .text(overallRisk, MARGIN + 370, sy + 22, { lineBreak: false });

        /* ══════════════════════════════════════════════════════════════════════
           PAGE 5 — RADAR CHART
        ══════════════════════════════════════════════════════════════════════ */

        doc.addPage();
        pageBg();
        addHeader('Perfil de Madurez por Pilar');

        /* Radar title */
        let ry = CONTENT_Y;
        doc.font(FB).fontSize(13).fillColor(C.NAVY)
            .text('Radar de Madurez por Pilar', MARGIN, ry, { width: CONTENT_W, align: 'center' });
        ry += 22;

        /* Contextual description based on scores */
        const scores = assessment.pillarScores.map((ps: any) => Number(ps.score));
        const strongest = assessment.pillarScores.reduce((a: any, b: any) => Number(a.score) > Number(b.score) ? a : b, assessment.pillarScores[0]);
        const weakest = assessment.pillarScores.reduce((a: any, b: any) => Number(a.score) < Number(b.score) ? a : b, assessment.pillarScores[0]);
        const avgScore = scores.reduce((s: number, v: number) => s + v, 0) / scores.length;
        const radarDesc = `El siguiente gráfico radar representa el perfil de madurez de ${assessment.client.name} `
            + `en cada uno de los pilares evaluados dentro del marco CSIA. `
            + `Con un puntaje promedio de ${avgScore.toFixed(2)} sobre 4.0, `
            + `la organización muestra su mayor fortaleza en "${strongest.pillar.name}" (${Number(strongest.score).toFixed(2)}) `
            + `y su principal oportunidad de mejora en "${weakest.pillar.name}" (${Number(weakest.score).toFixed(2)}). `
            + `Las áreas con menor cobertura en el radar indican los pilares que requieren atención prioritaria `
            + `para elevar el nivel de madurez general de la organización.`;
        doc.font(FR).fontSize(12).fillColor(C.TEXT_MUTED)
            .text(radarDesc, MARGIN, ry, { width: CONTENT_W, align: 'justify', lineGap: 2 });
        ry += doc.heightOfString(radarDesc, { width: CONTENT_W, lineGap: 2 }) + 16;

        const radarCx = PAGE_W / 2;
        const radarCy = ry + 180;
        const radarR = 150;

        renderRadarChart(doc, FR, FB, assessment.pillarScores as any, radarCx, radarCy, radarR);

        /* ══════════════════════════════════════════════════════════════════════
           PAGE 6+ — ANÁLISIS POR PILAR
        ══════════════════════════════════════════════════════════════════════ */

        doc.addPage();
        pageBg();
        addHeader('Análisis por Pilar');

        let py = CONTENT_Y;

        for (const ps of assessment.pillarScores) {
            const fallback = buildPillarFallback(ps.pillar.key);
            const pillarLLM = llmData?.pillarAnalyses?.[ps.pillar.key];
            const score = Number(ps.score);
            const innerW = CONTENT_W - 30;

            // Use LLM content when available, otherwise use per-pillar fallback
            const findingsText = (pillarLLM?.findings && pillarLLM.findings.trim()) ? pillarLLM.findings : fallback.findings;
            const gapsText = (pillarLLM?.gaps && pillarLLM.gaps.trim()) ? pillarLLM.gaps : fallback.gaps;
            const recommendationText = (pillarLLM?.recommendation && pillarLLM.recommendation.trim()) ? pillarLLM.recommendation : fallback.recommendation;

            /* Set font BEFORE measuring heights so they match rendering.
               Use stripBold() so **markers** don't inflate height estimate. */
            doc.font(FR).fontSize(1);
            const fH = doc.heightOfString(stripBold(findingsText), { width: innerW, lineGap: 2 });
            const gH = doc.heightOfString(stripBold(gapsText), { width: innerW, lineGap: 2 });
            const rH = doc.heightOfString(stripBold(recommendationText), { width: innerW, lineGap: 2 });

            /* cardH = header(54) + 3×(label 16 + text + gap 16) + bottom padding 16 */
            const cardH = 54 + (16 + fH + 16) + (16 + gH + 16) + (16 + rH) + 16;

            if (py + cardH > FOOTER_Y - 20) {
                doc.addPage();
                pageBg();
                addHeader('Análisis por Pilar (cont.)');
                py = CONTENT_Y;
            }

            /* Card background */
            doc.rect(MARGIN, py, CONTENT_W, cardH).fill(C.WHITE);
            doc.rect(MARGIN, py, 4, cardH).fill(scoreColor(score));

            /* Card header — pillar name + score vertically centered in 54pt header */
            const hdrMid = py + 54 / 2;
            doc.font(FB).fontSize(12).fillColor(C.TEXT)
                .text(ps.pillar.name, MARGIN + 14, hdrMid - 18, { lineBreak: false });
            doc.font(FB).fontSize(12).fillColor(scoreColor(score))
                .text(`${score.toFixed(2)} / 4.0`, MARGIN + 14, hdrMid - 18,
                    { width: CONTENT_W - 28, align: 'right', lineBreak: false });
            drawScoreBar(MARGIN + 14, hdrMid + 2, score, 160, 6);
            doc.font(FR).fontSize(9).fillColor(C.TEXT_LIGHT)
                .text(scoreToMaturity(score), MARGIN + 182, hdrMid, { lineBreak: false });

            let cy2 = py + 54;

            /* Findings */
            secLabel('HALLAZGOS', MARGIN + 14, cy2);
            cy2 += 16;
            renderRichText(doc, FR, FB, C.TEXT_MUTED,
                findingsText, MARGIN + 14, cy2, { width: innerW, align: 'justify', lineGap: 2 });
            cy2 += fH + 16;

            /* Gaps */
            secLabel('BRECHAS IDENTIFICADAS', MARGIN + 14, cy2);
            cy2 += 16;
            renderRichText(doc, FR, FB, C.TEXT_MUTED,
                gapsText, MARGIN + 14, cy2, { width: innerW, align: 'justify', lineGap: 2 });
            cy2 += gH + 16;

            /* Recommendation */
            doc.font(FB).fontSize(12).fillColor(C.STEEL)
                .text('RECOMENDACIÓN', MARGIN + 14, cy2, { lineBreak: false });
            cy2 += 16;
            renderRichText(doc, FR, FB, C.TEXT,
                recommendationText, MARGIN + 14, cy2, { width: innerW, align: 'justify', lineGap: 2 });

            py += cardH + 14;
        }

        /* ══════════════════════════════════════════════════════════════════════
           LAST PAGE — PLAN DE MEJORA
        ══════════════════════════════════════════════════════════════════════ */

        doc.addPage();
        pageBg();
        addHeader('Plan de Mejora');

        let iy = CONTENT_Y;

        const quickWins = llmData?.improvementPlan?.quickWins ?? [];
        const longTerm = llmData?.improvementPlan?.longTerm ?? [];

        const drawItems = (items: string[], badgeColor: string, sectionLbl: string) => {
            if (items.length === 0) return;
            secLabel(sectionLbl, MARGIN, iy);
            iy += 16;
            items.forEach((text, i) => {
                if (iy > FOOTER_Y - 60) {
                    doc.addPage();
                    pageBg();
                    addHeader('Plan de Mejora (cont.)');
                    iy = CONTENT_Y;
                }
                doc.font(FR).fontSize(12);
                const itemH = doc.heightOfString(stripBold(text), { width: CONTENT_W - 48, lineGap: 2 });
                const blockH = Math.max(itemH + 20, 40);
                const textY = iy + Math.max(8, (blockH - itemH) / 2);

                doc.rect(MARGIN, iy, CONTENT_W, blockH).fill(C.WHITE);
                /* Number badge — vertically centered */
                const badgeY = iy + (blockH - 22) / 2;
                doc.rect(MARGIN + 8, badgeY, 22, 22).fill(badgeColor);
                doc.font(FB).fontSize(12).fillColor(C.WHITE)
                    .text(`${i + 1}`, MARGIN + 8, badgeY + 6,
                        { width: 22, align: 'center', lineBreak: false });
                /* Text — vertically centered within block */
                renderRichText(doc, FR, FB, C.TEXT,
                    text, MARGIN + 38, textY, { width: CONTENT_W - 48, align: 'justify', lineGap: 2 });

                iy += blockH + 6;
            });
            iy += 12;
        };

        // Build fallback plan from assessment data when LLM didn't provide items
        const effectiveQuickWins = quickWins.length > 0 ? quickWins : buildFallbackQuickWins(assessment);
        const effectiveLongTerm = longTerm.length > 0 ? longTerm : buildFallbackLongTerm(assessment);

        drawItems(effectiveQuickWins, C.CONTROLLED, 'ACCIONES INMEDIATAS (QUICK WINS)');
        drawItems(effectiveLongTerm, C.STEEL, 'INICIATIVAS A LARGO PLAZO');

        /* ══════════════════════════════════════════════════════════════════════
           LAST PAGE — FIRMA GammIA
        ══════════════════════════════════════════════════════════════════════ */

        doc.addPage();
        pageBg();
        addHeader('Certificación del Informe');
        renderSignaturePage(doc, FR, FB, logoPath, llmData, CONTENT_Y + 40);

        /* ══════════════════════════════════════════════════════════════════════
           FOOTERS (all interior pages)
        ══════════════════════════════════════════════════════════════════════ */

        const range = doc.bufferedPageRange();
        const total = range.count;
        // Page numbering starts at 1 on the first interior page (after cover).
        // Total excludes the cover page, so "Página 1 / N-1" through "N-1 / N-1".
        for (let i = range.start; i < range.start + total; i++) {
            doc.switchToPage(i);
            if (i === range.start) continue; // skip cover
            addFooter(i - range.start, total - 1);
        }

        doc.end();
    });
}
