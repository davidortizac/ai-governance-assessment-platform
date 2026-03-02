import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generatePDFReport } from '../services/pdf.service';
import prisma from '../lib/prisma';

export const reportRouter = Router();

reportRouter.use(authenticate as any);

// GET /api/reports/:assessmentId/pdf
reportRouter.get('/:assessmentId/pdf', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
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
        const assessment = await prisma.assessment.findUnique({
            where: { id: req.params.assessmentId },
            include: {
                client: true,
                pillarScores: { include: { pillar: true } },
                answers: { include: { question: true } },
            },
        });

        if (!assessment) {
            res.status(404).json({ error: 'Evaluación no encontrada' });
            return;
        }

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
        const assessment = await prisma.assessment.findUnique({
            where: { id: req.params.assessmentId },
            include: {
                client: true,
                pillarScores: { include: { pillar: true } },
                answers: { include: { question: true } },
            },
        });

        if (!assessment) {
            res.status(404).json({ error: 'Evaluación no encontrada' });
            return;
        }

        // Generate CSV content
        let csv = 'Categoria,Pregunta,Respuesta,Puntaje\n';

        assessment.answers.forEach(a => {
            // Escape commas and quotes
            const question = `"${a.question.text.replace(/"/g, '""')}"`;
            const score = a.score;
            // Map score to text (simplified)
            let answerText = 'N/A';
            if (a.notApplicable) answerText = 'No Aplica';
            else if (a.score === 1) answerText = 'No iniciado';
            else if (a.score === 3) answerText = 'En progreso';
            else if (a.score === 5) answerText = 'Completado';

            csv += `Detalle,${question},${answerText},${score}\n`;
        });

        // Add summary at bottom
        csv += '\n--- RESUMEN ---\n';
        csv += 'Pilar,Puntaje,Madurez\n';
        assessment.pillarScores.forEach(ps => {
            csv += `${ps.pillar.name},${ps.score.toFixed(2)},\n`;
        });
        csv += `TOTAL,${assessment.overallScore?.toFixed(2)},${assessment.maturityLevel}\n`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=assessment-export-${req.params.assessmentId}.csv`);
        res.send(csv);
    } catch (error) {
        console.error('CSV export error:', error);
        res.status(500).json({ error: 'Error al exportar CSV' });
    }
});
