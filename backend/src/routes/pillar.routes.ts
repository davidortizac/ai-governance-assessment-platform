import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';

export const pillarRouter = Router();

pillarRouter.use(authenticate as any);

// GET /api/pillars — List all pillars
pillarRouter.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const pillars = await prisma.pillar.findMany({
            orderBy: { order: 'asc' },
            include: { _count: { select: { questions: true } } },
        });
        res.json(pillars);
    } catch (error) {
        console.error('List pillars error:', error);
        res.status(500).json({ error: 'Error al listar pilares' });
    }
});

// PUT /api/pillars/:id/weight — Update pillar weight
pillarRouter.put('/:id/weight', requireRole('ADMIN') as any, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { weight } = req.body;
        const pillar = await prisma.pillar.update({
            where: { id: req.params.id },
            data: { weight },
        });
        res.json(pillar);
    } catch (error) {
        console.error('Update pillar weight error:', error);
        res.status(500).json({ error: 'Error al actualizar peso' });
    }
});

// GET /api/pillars/:id/questions — List questions for a pillar
pillarRouter.get('/:id/questions', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const questions = await prisma.question.findMany({
            where: { pillarId: req.params.id },
            orderBy: { order: 'asc' },
        });
        res.json(questions);
    } catch (error) {
        console.error('List questions error:', error);
        res.status(500).json({ error: 'Error al listar preguntas' });
    }
});
