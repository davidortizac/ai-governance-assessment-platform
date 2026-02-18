import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { calculateAssessmentScores } from '../services/scoring.service';

export const assessmentRouter = Router();

assessmentRouter.use(authenticate as any);

// POST /api/assessments — Create a new assessment
assessmentRouter.post('/', requireRole('ADMIN', 'CONSULTANT') as any, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { clientId, type } = req.body;

        // Validate client exists
        const client = await prisma.client.findUnique({ where: { id: clientId } });
        if (!client) {
            res.status(404).json({ error: 'Cliente no encontrado' });
            return;
        }

        // Get questions for this assessment type
        const questions = await prisma.question.findMany({
            where: { assessmentType: type },
            include: { pillar: true },
            orderBy: [{ pillar: { order: 'asc' } }, { order: 'asc' }],
        });

        // Create assessment
        const assessment = await prisma.assessment.create({
            data: {
                type,
                status: 'DRAFT',
                clientId,
                createdById: req.user!.userId,
            },
        });

        res.status(201).json({ assessment, questions });
    } catch (error) {
        console.error('Create assessment error:', error);
        res.status(500).json({ error: 'Error al crear assessment' });
    }
});

// GET /api/assessments — List all assessments
assessmentRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const where: any = {};

        // Tenant filtering
        if (req.user!.tenantId) {
            where.client = { tenantId: req.user!.tenantId };
        }

        if (req.query.clientId) {
            where.clientId = req.query.clientId;
        }
        if (req.query.status) {
            where.status = req.query.status;
        }
        if (req.query.type) {
            where.type = req.query.type;
        }

        const assessments = await prisma.assessment.findMany({
            where,
            include: {
                client: { select: { id: true, name: true } },
                createdBy: { select: { id: true, name: true } },
                pillarScores: { include: { pillar: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json(assessments);
    } catch (error) {
        console.error('List assessments error:', error);
        res.status(500).json({ error: 'Error al listar assessments' });
    }
});

// GET /api/assessments/:id — Get assessment details
assessmentRouter.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const assessment = await prisma.assessment.findUnique({
            where: { id: req.params.id },
            include: {
                client: true,
                createdBy: { select: { id: true, name: true, email: true } },
                answers: {
                    include: { question: { include: { pillar: true } } },
                    orderBy: { question: { order: 'asc' } },
                },
                pillarScores: {
                    include: { pillar: true },
                    orderBy: { pillar: { order: 'asc' } },
                },
            },
        });

        if (!assessment) {
            res.status(404).json({ error: 'Assessment no encontrado' });
            return;
        }

        // Also get questions if assessment is not completed
        let questions: any[] = [];
        if (assessment.status !== 'COMPLETED') {
            questions = await prisma.question.findMany({
                where: { assessmentType: assessment.type },
                include: { pillar: true },
                orderBy: [{ pillar: { order: 'asc' } }, { order: 'asc' }],
            });
        }

        res.json({ ...assessment, questions });
    } catch (error) {
        console.error('Get assessment error:', error);
        res.status(500).json({ error: 'Error al obtener assessment' });
    }
});

// POST /api/assessments/:id/answers — Submit answers
assessmentRouter.post('/:id/answers', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { answers } = req.body; // Array of { questionId, score, notApplicable }

        const assessment = await prisma.assessment.findUnique({
            where: { id: req.params.id },
        });

        if (!assessment) {
            res.status(404).json({ error: 'Assessment no encontrado' });
            return;
        }

        // Upsert answers
        for (const answer of answers) {
            await prisma.answer.upsert({
                where: {
                    assessmentId_questionId: {
                        assessmentId: req.params.id,
                        questionId: answer.questionId,
                    },
                },
                update: {
                    score: answer.notApplicable ? 0 : answer.score,
                    notApplicable: answer.notApplicable || false,
                },
                create: {
                    assessmentId: req.params.id,
                    questionId: answer.questionId,
                    score: answer.notApplicable ? 0 : answer.score,
                    notApplicable: answer.notApplicable || false,
                },
            });
        }

        // Update assessment status
        await prisma.assessment.update({
            where: { id: req.params.id },
            data: { status: 'IN_PROGRESS' },
        });

        res.json({ message: 'Respuestas guardadas' });
    } catch (error) {
        console.error('Submit answers error:', error);
        res.status(500).json({ error: 'Error al guardar respuestas' });
    }
});

// POST /api/assessments/:id/calculate — Calculate scores
assessmentRouter.post('/:id/calculate', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const result = await calculateAssessmentScores(req.params.id);
        res.json(result);
    } catch (error) {
        console.error('Calculate scores error:', error);
        res.status(500).json({ error: 'Error al calcular scores' });
    }
});

// GET /api/assessments/compare/:id1/:id2 — Compare two assessments
assessmentRouter.get('/compare/:id1/:id2', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const [a1, a2] = await Promise.all([
            prisma.assessment.findUnique({
                where: { id: req.params.id1 },
                include: {
                    client: true,
                    pillarScores: { include: { pillar: true }, orderBy: { pillar: { order: 'asc' } } },
                },
            }),
            prisma.assessment.findUnique({
                where: { id: req.params.id2 },
                include: {
                    client: true,
                    pillarScores: { include: { pillar: true }, orderBy: { pillar: { order: 'asc' } } },
                },
            }),
        ]);

        if (!a1 || !a2) {
            res.status(404).json({ error: 'Assessment no encontrado' });
            return;
        }

        // Calculate deltas
        const comparison = a1.pillarScores.map(ps1 => {
            const ps2 = a2.pillarScores.find(ps => ps.pillarId === ps1.pillarId);
            return {
                pillar: ps1.pillar.name,
                pillarKey: ps1.pillar.key,
                scoreA: ps1.score,
                scoreB: ps2?.score ?? 0,
                delta: Math.round(((ps2?.score ?? 0) - ps1.score) * 100) / 100,
            };
        });

        res.json({
            assessmentA: a1,
            assessmentB: a2,
            comparison,
            overallDelta: Math.round(((a2.overallScore ?? 0) - (a1.overallScore ?? 0)) * 100) / 100,
        });
    } catch (error) {
        console.error('Compare error:', error);
        res.status(500).json({ error: 'Error al comparar assessments' });
    }
});
