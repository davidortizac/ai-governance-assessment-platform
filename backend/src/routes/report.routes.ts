import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generatePDFReport } from '../services/pdf.service';

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
