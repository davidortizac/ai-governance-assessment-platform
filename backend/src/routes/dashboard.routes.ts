import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate as any);

// GET /api/dashboard/stats
dashboardRouter.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { role, tenantId, userId } = req.user!;

        // Build assessment filter based on role
        const assessmentFilter: any = {};
        const clientFilter: any = {};

        if (role === 'CLIENT') {
            // CLIENT only sees assessments they created
            assessmentFilter.createdById = userId;
            // CLIENT doesn't see the clients list (maybe only their own org)
        } else if (role === 'CONSULTANT') {
            // CONSULTANT sees assessments they created within their tenant
            assessmentFilter.createdById = userId;
            if (tenantId) clientFilter.tenantId = tenantId;
        } else {
            // ADMIN sees everything in their tenant
            if (tenantId) {
                assessmentFilter.client = { tenantId };
                clientFilter.tenantId = tenantId;
            }
        }

        const completedFilter = { ...assessmentFilter, status: 'COMPLETED' };

        const [totalClients, totalAssessments, completedAssessments] = await Promise.all([
            prisma.client.count({ where: clientFilter }),
            prisma.assessment.count({ where: assessmentFilter }),
            prisma.assessment.count({ where: completedFilter }),
        ]);

        // Average maturity across completed assessments
        const avgResult = await prisma.assessment.aggregate({
            where: completedFilter,
            _avg: { overallScore: true },
        });

        // Risk distribution
        const riskDistribution = await prisma.assessment.groupBy({
            by: ['riskLevel'],
            where: { ...completedFilter, riskLevel: { not: null } },
            _count: true,
        });

        // Recent assessments
        const recentAssessments = await prisma.assessment.findMany({
            where: completedFilter,
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
