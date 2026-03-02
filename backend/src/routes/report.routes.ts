import { Router, Response } from 'express';
import { authenticate, AuthRequest, AuthPayload } from '../middleware/auth';
import { generatePDFReport } from '../services/pdf.service';
import prisma from '../lib/prisma';

export const reportRouter = Router();

reportRouter.use(authenticate as any);

// Helper: verify the caller has access to the requested assessment's reports.
// Returns true if authorized, false otherwise (response already sent).
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
        const allowed = await assertReportAccess(req.params.assessmentId, req.user!, res);
        if (!allowed) return;

        const pdfBuffer = await generatePDFReport(req.params.assessmentId);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=assessment-report-${req.params.assessmentId}.pdf`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('PDF generation error:', error);
        res.status(500).json({ error: 'Error al generar reporte PDF' });
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

        // Generate CSV content
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
