import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

export const analyticsRouter = Router();

analyticsRouter.use(authenticate as any);

// GET /api/analytics/risk-trends
// Returns historical risk level distribution over time (grouped by month)
// Optional query param: ?clientId=xxx to filter by a specific client
analyticsRouter.get('/risk-trends', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { tenantId, role, userId } = req.user!;
        const { clientId } = req.query as { clientId?: string };
        const where: any = { status: 'COMPLETED' };

        // Data isolation
        if (role === 'ADMIN') {
            if (clientId) {
                where.clientId = clientId;
                where.client = { tenantId };
            } else if (tenantId) {
                where.client = { tenantId };
            }
        } else {
            where.createdById = userId;
            if (clientId) where.clientId = clientId;
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

// GET /api/analytics/pillar-averages
// Returns average score per pillar for all completed assessments in scope.
// Optional query param: ?clientId=xxx to filter by a specific client
analyticsRouter.get('/pillar-averages', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { tenantId, role, userId } = req.user!;
        const { clientId } = req.query as { clientId?: string };
        const where: any = { status: 'COMPLETED' };

        if (role === 'ADMIN') {
            if (clientId) {
                where.clientId = clientId;
                where.client = { tenantId };
            } else if (tenantId) {
                where.client = { tenantId };
            }
        } else {
            where.createdById = userId;
            if (clientId) where.clientId = clientId;
        }

        const pillarScores = await prisma.pillarScore.findMany({
            where: { assessment: where },
            include: { pillar: true },
        });

        const agg: Record<string, { name: string; key: string; total: number; count: number; order: number }> = {};
        for (const ps of pillarScores) {
            const k = ps.pillar.key;
            if (!agg[k]) agg[k] = { name: ps.pillar.name, key: k, total: 0, count: 0, order: ps.pillar.order };
            agg[k].total += ps.score;
            agg[k].count += 1;
        }

        const result = Object.values(agg)
            .sort((a, b) => a.order - b.order)
            .map(p => ({
                key: p.key,
                name: p.name,
                avgScore: p.count > 0 ? Math.round((p.total / p.count) * 100) / 100 : 0,
                assessmentCount: p.count,
            }));

        res.json(result);
    } catch (error) {
        console.error('Pillar averages error:', error);
        res.status(500).json({ error: 'Error fetching pillar averages' });
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
