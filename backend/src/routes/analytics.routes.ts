import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

export const analyticsRouter = Router();

analyticsRouter.use(authenticate as any);

// GET /api/analytics/risk-trends
// Returns historical risk level distribution over time (grouped by month)
analyticsRouter.get('/risk-trends', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { tenantId, role, userId } = req.user!;
        const where: any = { status: 'COMPLETED' };

        // Data isolation
        if (role === 'ADMIN') {
            if (tenantId) where.client = { tenantId };
        } else {
            where.createdById = userId;
        }

        const assessments = await prisma.assessment.findMany({
            where,
            select: {
                createdAt: true,
                riskLevel: true,
            },
            orderBy: { createdAt: 'asc' },
        });

        // Agrupar por mes
        const trends = assessments.reduce((acc: any, curr) => {
            const month = curr.createdAt.toISOString().slice(0, 7); // YYYY-MM
            if (!acc[month]) {
                acc[month] = { month, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
            }
            if (curr.riskLevel) {
                acc[month][curr.riskLevel] = (acc[month][curr.riskLevel] || 0) + 1;
            }
            return acc;
        }, {});

        res.json(Object.values(trends));
    } catch (error) {
        console.error('Risk trends error:', error);
        res.status(500).json({ error: 'Error fetching risk trends' });
    }
});

// GET /api/analytics/maturity-gap
// Compare average maturity per pillar vs "Industry Standard" (mocked for now)
analyticsRouter.get('/maturity-gap', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { tenantId, role, userId } = req.user!;
        const where: any = { status: 'COMPLETED' };

        if (role === 'ADMIN') {
            if (tenantId) where.client = { tenantId };
        } else {
            where.createdById = userId;
        }

        const pillarScores = await prisma.pillarScore.findMany({
            where: {
                assessment: where,
            },
            include: { pillar: true },
        });

        // Calculate average score per pillar
        const pillarAgg = pillarScores.reduce((acc: any, curr) => {
            const name = curr.pillar.name;
            if (!acc[name]) {
                acc[name] = { total: 0, count: 0 };
            }
            acc[name].total += curr.score;
            acc[name].count += 1;
            return acc;
        }, {});

        // Mock industry benchmarks
        const benchmarks: Record<string, number> = {
            'Transparencia': 75,
            'Privacidad': 80,
            'Seguridad': 85,
            'Equidad': 70,
            'Responsabilidad': 65,
        };

        const result = Object.keys(pillarAgg).map(key => ({
            pillar: key,
            yourScore: Math.round(pillarAgg[key].total / pillarAgg[key].count),
            industryBenchmark: benchmarks[key] || 70,
        }));

        res.json(result);
    } catch (error) {
        console.error('Maturity gap error:', error);
        res.status(500).json({ error: 'Error fetching maturity gap' });
    }
});
