import { Router, Response } from 'express';
import { authenticate, AuthRequest, AuthPayload } from '../middleware/auth';
import { generatePDFReport } from '../services/pdf.service';
import { generateLLMAnalysis } from '../services/llm.service';
import prisma from '../lib/prisma';

export const reportRouter = Router();

reportRouter.use(authenticate as any);

// Helper: verify the caller has access to the requested assessment's reports.
async function assertReportAccess(
    assessmentId: string,
    user: AuthPayload,
    res: Response
): Promise<boolean> {
    const assessment = await prisma.assessment.findUnique({
        where: { id: assessmentId },
        include: { client: true },
    });
    if (!assessment) {
        res.status(404).json({ error: 'Evaluación no encontrada' });
        return false;
    }
    const isAdmin = user.role === 'ADMIN' && assessment.client.tenantId === user.tenantId;
    const isOwner = assessment.createdById === user.userId;
    if (!isAdmin && !isOwner) {
        res.status(403).json({ error: 'Acceso denegado' });
        return false;
    }
    return true;
}

// GET /api/reports/:assessmentId/pdf
reportRouter.get('/:assessmentId/pdf', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { assessmentId } = req.params;
        const allowed = await assertReportAccess(assessmentId, req.user!, res);
        if (!allowed) return;

        // If LLM analysis is missing, generate it synchronously so the PDF includes it.
        // The PDF download will block until the model responds (or fails, in which case
        // the PDF uses the fallback text).
        const current = await prisma.assessment.findUnique({
            where: { id: assessmentId },
            select: { status: true, llmAnalysis: true },
        });

        if (current?.status === 'COMPLETED' && !current?.llmAnalysis) {
            try {
                console.log(`[LLM] On-demand analysis for PDF — assessment ${assessmentId}`);
                const full = await prisma.assessment.findUnique({
                    where: { id: assessmentId },
                    include: {
                        client: true,
                        pillarScores: { include: { pillar: true }, orderBy: { pillar: { order: 'asc' } } },
                        answers: { include: { question: { include: { pillar: true } } } },
                    },
                });
                if (full) {
                    const llmAnalysis = await generateLLMAnalysis(full);
                    await prisma.assessment.update({
                        where: { id: assessmentId },
                        data: { llmAnalysis: llmAnalysis as any },
                    });
                    console.log(`[LLM] On-demand analysis saved for assessment ${assessmentId}`);
                }
            } catch (err) {
                console.error('[LLM] On-demand analysis failed (PDF will use fallback):', err);
            }
        }

        const meta = await prisma.assessment.findUnique({
            where: { id: assessmentId },
            select: { type: true, completedAt: true, createdAt: true, client: { select: { name: true } } },
        });

        const pdfBuffer = await generatePDFReport(assessmentId);

        const clientName = (meta?.client.name ?? 'Cliente')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
            .replace(/[^a-zA-Z0-9]/g, '_')                   // non-alphanumeric → _
            .replace(/_+/g, '_')                              // collapse multiple _
            .replace(/^_|_$/g, '');                           // trim leading/trailing _

        const date = meta?.completedAt ?? meta?.createdAt ?? new Date();
        const dd   = String(date.getDate()).padStart(2, '0');
        const mm   = String(date.getMonth() + 1).padStart(2, '0');
        const aaaa = date.getFullYear();

        const filename = `Assement_CSIA_${clientName}_${meta?.type ?? 'EXPRESS'}_${dd}-${mm}-${aaaa}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('PDF generation error:', error);
        res.status(500).json({ error: 'Error al generar reporte PDF' });
    }
});

// POST /api/reports/:assessmentId/regenerate-analysis
// Force re-generation of the LLM analysis for an existing COMPLETED assessment.
reportRouter.post('/:assessmentId/regenerate-analysis', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { assessmentId } = req.params;
        const allowed = await assertReportAccess(assessmentId, req.user!, res);
        if (!allowed) return;

        const assessment = await prisma.assessment.findUnique({
            where: { id: assessmentId },
            include: {
                client: true,
                pillarScores: { include: { pillar: true }, orderBy: { pillar: { order: 'asc' } } },
                answers: { include: { question: { include: { pillar: true } } } },
            },
        });

        if (!assessment) {
            res.status(404).json({ error: 'Evaluación no encontrada' });
            return;
        }

        if (assessment.status !== 'COMPLETED') {
            res.status(400).json({ error: 'El assessment debe estar completado para regenerar el análisis' });
            return;
        }

        const llmAnalysis = await generateLLMAnalysis(assessment);
        await prisma.assessment.update({
            where: { id: assessmentId },
            data: { llmAnalysis: llmAnalysis as any },
        });

        res.json({ success: true, model: llmAnalysis.model, generatedAt: llmAnalysis.generatedAt });
    } catch (error) {
        console.error('LLM regeneration error:', error);
        res.status(500).json({ error: 'Error al regenerar análisis LLM', details: (error as Error).message });
    }
});

// GET /api/reports/:assessmentId/json
reportRouter.get('/:assessmentId/json', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const allowed = await assertReportAccess(req.params.assessmentId, req.user!, res);
        if (!allowed) return;

        const assessment = await prisma.assessment.findUnique({
            where: { id: req.params.assessmentId },
            include: {
                client: true,
                pillarScores: { include: { pillar: true } },
                answers: { include: { question: true } },
            },
        });

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=assessment-data-${req.params.assessmentId}.json`);
        res.send(JSON.stringify(assessment, null, 2));
    } catch (error) {
        console.error('JSON export error:', error);
        res.status(500).json({ error: 'Error al exportar JSON' });
    }
});

// GET /api/reports/:assessmentId/csv
reportRouter.get('/:assessmentId/csv', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const allowed = await assertReportAccess(req.params.assessmentId, req.user!, res);
        if (!allowed) return;

        const assessment = await prisma.assessment.findUnique({
            where: { id: req.params.assessmentId },
            include: {
                client: true,
                pillarScores: { include: { pillar: true } },
                answers: { include: { question: true } },
            },
        });

        let csv = 'Categoria,Pregunta,Respuesta,Puntaje\n';

        assessment!.answers.forEach(a => {
            const question = `"${a.question.text.replace(/"/g, '""')}"`;
            const score = a.score;
            let answerText = 'N/A';
            if (a.notApplicable) answerText = 'No Aplica';
            else if (a.score === 1) answerText = 'No iniciado';
            else if (a.score === 3) answerText = 'En progreso';
            else if (a.score === 5) answerText = 'Completado';

            csv += `Detalle,${question},${answerText},${score}\n`;
        });

        csv += '\n--- RESUMEN ---\n';
        csv += 'Pilar,Puntaje,Madurez\n';
        assessment!.pillarScores.forEach(ps => {
            csv += `${ps.pillar.name},${ps.score.toFixed(2)},\n`;
        });
        csv += `TOTAL,${assessment!.overallScore?.toFixed(2)},${assessment!.maturityLevel}\n`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=assessment-export-${req.params.assessmentId}.csv`);
        res.send(csv);
    } catch (error) {
        console.error('CSV export error:', error);
        res.status(500).json({ error: 'Error al exportar CSV' });
    }
});
