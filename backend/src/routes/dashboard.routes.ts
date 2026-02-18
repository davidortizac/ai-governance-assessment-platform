import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate as any);

// GET /api/dashboard/stats
dashboardRouter.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantFilter: any = {};
        if (req.user!.tenantId) {
            tenantFilter.tenantId = req.user!.tenantId;
        }

        const [totalClients, totalAssessments, completedAssessments] = await Promise.all([
            prisma.client.count({ where: tenantFilter }),
            prisma.assessment.count({
                where: req.user!.tenantId
                    ? { client: { tenantId: req.user!.tenantId } }
                    : undefined,
            }),
            prisma.assessment.count({
                where: {
                    status: 'COMPLETED',
                    ...(req.user!.tenantId
                        ? { client: { tenantId: req.user!.tenantId } }
                        : {}),
                },
            }),
        ]);

        // Average maturity across completed assessments
        const avgResult = await prisma.assessment.aggregate({
            where: {
                status: 'COMPLETED',
                ...(req.user!.tenantId
                    ? { client: { tenantId: req.user!.tenantId } }
                    : {}),
            },
            _avg: { overallScore: true },
        });

        // Risk distribution
        const riskDistribution = await prisma.assessment.groupBy({
            by: ['riskLevel'],
            where: {
                status: 'COMPLETED',
                riskLevel: { not: null },
                ...(req.user!.tenantId
                    ? { client: { tenantId: req.user!.tenantId } }
                    : {}),
            },
            _count: true,
        });

        // Recent assessments
        const recentAssessments = await prisma.assessment.findMany({
            where: {
                status: 'COMPLETED',
                ...(req.user!.tenantId
                    ? { client: { tenantId: req.user!.tenantId } }
                    : {}),
            },
            include: {
                client: { select: { name: true } },
                pillarScores: { include: { pillar: true }, orderBy: { pillar: { order: 'asc' } } },
            },
            orderBy: { completedAt: 'desc' },
            take: 5,
        });

        res.json({
            totalClients,
            totalAssessments,
            completedAssessments,
            avgMaturityScore: Math.round((avgResult._avg.overallScore ?? 0) * 100) / 100,
            riskDistribution: riskDistribution.map(r => ({
                level: r.riskLevel,
                count: r._count,
            })),
            recentAssessments,
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});
