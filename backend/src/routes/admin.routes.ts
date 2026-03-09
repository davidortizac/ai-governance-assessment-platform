import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { listOllamaModels } from '../services/llm.service';

export const adminRouter = Router();

adminRouter.use(authenticate as any);

// Guard — ADMIN only
function requireAdmin(req: AuthRequest, res: Response): boolean {
    if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Acceso restringido a administradores' });
        return false;
    }
    return true;
}

// GET /api/admin/assessments
// Full list with client, scores, consultant, LLM status — tenant-scoped
adminRouter.get('/assessments', async (req: AuthRequest, res: Response): Promise<void> => {
    if (!requireAdmin(req, res)) return;
    try {
        const where: any = {};
        if (req.user!.tenantId) where.client = { tenantId: req.user!.tenantId };
        if (req.query.status)   where.status   = req.query.status;
        if (req.query.type)     where.type      = req.query.type;
        if (req.query.risk)     where.riskLevel = req.query.risk;
        if (req.query.clientId) where.clientId  = req.query.clientId;

        const assessments = await prisma.assessment.findMany({
            where,
            include: {
                client:   { select: { id: true, name: true, industry: true, contactEmail: true, contactName: true } },
                createdBy:{ select: { id: true, name: true, email: true } },
                pillarScores: { include: { pillar: true }, orderBy: { pillar: { order: 'asc' } } },
                _count:   { select: { answers: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Add llmAnalysis presence flag without sending the full JSON payload
        const result = assessments.map(a => ({
            ...a,
            hasLlmAnalysis: !!(a as any).llmAnalysis,
            llmAnalysis: undefined,   // strip from list — fetch on detail
        }));

        res.json(result);
    } catch (error) {
        console.error('Admin list error:', error);
        res.status(500).json({ error: 'Error al listar assessments' });
    }
});

// GET /api/admin/assessments/:id — Full detail: answers + pillar scores + LLM analysis
adminRouter.get('/assessments/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    if (!requireAdmin(req, res)) return;
    try {
        const assessment = await prisma.assessment.findUnique({
            where: { id: req.params.id },
            include: {
                client:   true,
                createdBy:{ select: { id: true, name: true, email: true } },
                pillarScores: {
                    include: { pillar: true },
                    orderBy: { pillar: { order: 'asc' } },
                },
                answers: {
                    include: { question: { include: { pillar: true } } },
                    orderBy: [{ question: { pillar: { order: 'asc' } } }, { question: { order: 'asc' } }],
                },
            },
        });

        if (!assessment) {
            res.status(404).json({ error: 'Assessment no encontrado' });
            return;
        }

        // Tenant guard
        if (req.user!.tenantId && (assessment.client as any).tenantId !== req.user!.tenantId) {
            res.status(403).json({ error: 'Acceso denegado' });
            return;
        }

        res.json(assessment);
    } catch (error) {
        console.error('Admin detail error:', error);
        res.status(500).json({ error: 'Error al obtener assessment' });
    }
});

// DELETE /api/admin/assessments/:id — Hard delete (cascades to answers + pillarScores)
adminRouter.delete('/assessments/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    if (!requireAdmin(req, res)) return;
    try {
        const assessment = await prisma.assessment.findUnique({
            where: { id: req.params.id },
            include: { client: true },
        });

        if (!assessment) {
            res.status(404).json({ error: 'Assessment no encontrado' });
            return;
        }

        if (req.user!.tenantId && (assessment.client as any).tenantId !== req.user!.tenantId) {
            res.status(403).json({ error: 'Acceso denegado' });
            return;
        }

        await prisma.assessment.delete({ where: { id: req.params.id } });
        res.json({ message: 'Assessment eliminado' });
    } catch (error) {
        console.error('Admin delete error:', error);
        res.status(500).json({ error: 'Error al eliminar assessment' });
    }
});

// GET /api/admin/llm/status — Test Ollama connection and list available models
adminRouter.get('/llm/status', async (req: AuthRequest, res: Response): Promise<void> => {
    if (!requireAdmin(req, res)) return;
    const url = process.env.OLLAMA_URL ?? 'http://host.docker.internal:11434/v1/chat/completions';
    const currentModel = process.env.OLLAMA_MODEL ?? 'deepseek-r1:8b';
    const hasApiKey = !!(process.env.LLM_API_KEY);
    try {
        const models = await listOllamaModels();
        res.json({ connected: true, url, currentModel, models, hasApiKey });
    } catch (err: any) {
        res.json({ connected: false, url, currentModel, models: [], hasApiKey, error: err.message ?? 'Error de conexión' });
    }
});

// POST /api/admin/llm/model — Set the active LLM model at runtime
adminRouter.post('/llm/model', (req: AuthRequest, res: Response): void => {
    if (!requireAdmin(req, res)) return;
    const { model } = req.body as { model?: string };
    if (!model || typeof model !== 'string' || !model.trim()) {
        res.status(400).json({ error: 'El campo model es requerido' });
        return;
    }
    process.env.OLLAMA_MODEL = model.trim();
    console.log(`[Admin] OLLAMA_MODEL changed to: ${process.env.OLLAMA_MODEL}`);
    res.json({ success: true, model: process.env.OLLAMA_MODEL });
});

// POST /api/admin/llm/config — Set provider URL, API key and model at runtime (no restart needed)
adminRouter.post('/llm/config', (req: AuthRequest, res: Response): void => {
    if (!requireAdmin(req, res)) return;
    const { url, apiKey, model } = req.body as { url?: string; apiKey?: string; model?: string };
    if (url && typeof url === 'string' && url.trim()) {
        // Validate URL format — only allow http/https
        try {
            const parsed = new URL(url.trim());
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                res.status(400).json({ error: 'URL debe usar protocolo http o https' });
                return;
            }
        } catch {
            res.status(400).json({ error: 'URL inválida' });
            return;
        }
        process.env.OLLAMA_URL = url.trim();
    }
    if (apiKey !== undefined && typeof apiKey === 'string') process.env.LLM_API_KEY = apiKey.trim();
    if (model && typeof model === 'string' && model.trim()) process.env.OLLAMA_MODEL = model.trim();
    console.log(`[Admin] LLM config updated — url: ${process.env.OLLAMA_URL}, model: ${process.env.OLLAMA_MODEL}, apiKey: ${process.env.LLM_API_KEY ? '[set]' : '[empty]'}`);
    res.json({ success: true, url: process.env.OLLAMA_URL, model: process.env.OLLAMA_MODEL });
});

// GET /api/admin/users — List all users for the tenant
adminRouter.get('/users', async (req: AuthRequest, res: Response): Promise<void> => {
    if (!requireAdmin(req, res)) return;
    try {
        const where: any = {};
        if (req.user!.tenantId) where.tenantId = req.user!.tenantId;

        const users = await prisma.user.findMany({
            where,
            select: {
                id: true, email: true, name: true, role: true,
                createdAt: true, updatedAt: true,
                _count: { select: { assessments: true, clients: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json(users);
    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({ error: 'Error al listar usuarios' });
    }
});

// DELETE /api/admin/users/:id — Delete a user (cannot delete yourself)
adminRouter.delete('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    if (!requireAdmin(req, res)) return;
    try {
        if (req.params.id === req.user!.userId) {
            res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
            return;
        }

        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user) {
            res.status(404).json({ error: 'Usuario no encontrado' });
            return;
        }
        if (req.user!.tenantId && user.tenantId !== req.user!.tenantId) {
            res.status(403).json({ error: 'Acceso denegado' });
            return;
        }

        await prisma.user.delete({ where: { id: req.params.id } });
        res.json({ message: 'Usuario eliminado' });
    } catch (error) {
        console.error('Admin delete user error:', error);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

// GET /api/admin/backup/user/:id — Export all assessments for a specific user
adminRouter.get('/backup/user/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    if (!requireAdmin(req, res)) return;
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: { id: true, name: true, email: true, tenantId: true },
        });
        if (!user) {
            res.status(404).json({ error: 'Usuario no encontrado' });
            return;
        }
        if (req.user!.tenantId && user.tenantId !== req.user!.tenantId) {
            res.status(403).json({ error: 'Acceso denegado' });
            return;
        }

        const assessments = await prisma.assessment.findMany({
            where: { createdById: req.params.id },
            include: {
                client: true,
                pillarScores: { include: { pillar: true } },
                answers: { include: { question: { include: { pillar: true } } } },
            },
        });

        const backup = {
            exportedAt: new Date().toISOString(),
            version: '1.0',
            user: { id: user.id, name: user.name, email: user.email },
            assessments,
        };

        const safeName = user.name.split(/\s+/).join('_');
        const filename = `backup_${safeName}_${new Date().toISOString().slice(0, 10)}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.json(backup);
    } catch (error) {
        console.error('Admin backup user error:', error);
        res.status(500).json({ error: 'Error al exportar datos del usuario' });
    }
});

// GET /api/admin/db/export — Full database export (all data for the tenant)
adminRouter.get('/db/export', async (req: AuthRequest, res: Response): Promise<void> => {
    if (!requireAdmin(req, res)) return;
    try {
        const tenantWhere: any = {};
        if (req.user!.tenantId) tenantWhere.tenantId = req.user!.tenantId;

        const [users, clients, assessments, pillars, questions] = await Promise.all([
            prisma.user.findMany({
                where: tenantWhere,
                select: { id: true, email: true, name: true, role: true, createdAt: true },
            }),
            prisma.client.findMany({
                where: tenantWhere,
                include: { createdBy: { select: { email: true } } },
            }),
            prisma.assessment.findMany({
                where: { client: tenantWhere },
                include: {
                    client: { select: { id: true, name: true } },
                    createdBy: { select: { id: true, email: true } },
                    pillarScores: { include: { pillar: true } },
                    answers: { include: { question: { include: { pillar: true } } } },
                },
            }),
            prisma.pillar.findMany({ orderBy: { order: 'asc' } }),
            prisma.question.findMany({ include: { pillar: true }, orderBy: [{ pillar: { order: 'asc' } }, { order: 'asc' }] }),
        ]);

        const backup = {
            exportedAt: new Date().toISOString(),
            version: '1.0',
            tenantId: req.user!.tenantId ?? null,
            data: { users, clients, pillars, questions, assessments },
        };

        const filename = `gamma_backup_${new Date().toISOString().slice(0, 10)}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.json(backup);
    } catch (error) {
        console.error('Admin DB export error:', error);
        res.status(500).json({ error: 'Error al exportar base de datos' });
    }
});

// ── Restore helpers (extracted to reduce cognitive complexity) ────────────────
async function restoreClients(clients: any[], tenantId: string | null, userId: string): Promise<number> {
    let count = 0;
    for (const c of clients) {
        const existing = await prisma.client.findUnique({ where: { id: c.id } });
        if (existing) continue;
        await prisma.client.create({
            data: {
                id: c.id, name: c.name,
                industry: c.industry ?? null, contactName: c.contactName ?? null,
                contactEmail: c.contactEmail ?? null,
                tenantId: tenantId ?? c.tenantId ?? null,
                createdById: userId,
            },
        });
        count++;
    }
    return count;
}

async function restorePillarScores(pillarScores: any[], assessmentId: string): Promise<number> {
    let count = 0;
    for (const ps of pillarScores) {
        const pillar = await prisma.pillar.findFirst({ where: { key: ps.pillar?.key ?? ps.pillarKey } });
        if (!pillar) continue;
        await prisma.pillarScore.create({
            data: { assessmentId, pillarId: pillar.id, score: ps.score, answeredCount: ps.answeredCount ?? 0, totalCount: ps.totalCount ?? 0 },
        });
        count++;
    }
    return count;
}

async function restoreAnswers(answers: any[], assessmentId: string): Promise<number> {
    let count = 0;
    for (const ans of answers) {
        const question = await prisma.question.findUnique({ where: { id: ans.questionId ?? ans.question?.id } });
        if (!question) continue;
        await prisma.answer.create({
            data: { assessmentId, questionId: question.id, score: ans.score, notApplicable: ans.notApplicable ?? false },
        });
        count++;
    }
    return count;
}

async function restoreAssessments(assessments: any[], userId: string): Promise<{ assessments: number; pillarScores: number; answers: number }> {
    const stats = { assessments: 0, pillarScores: 0, answers: 0 };
    for (const a of assessments) {
        const existing = await prisma.assessment.findUnique({ where: { id: a.id } });
        if (existing) continue;
        const client = await prisma.client.findUnique({ where: { id: a.clientId ?? a.client?.id } });
        if (!client) continue;

        await prisma.assessment.create({
            data: {
                id: a.id, type: a.type, status: a.status,
                overallScore: a.overallScore ?? null, maturityLevel: a.maturityLevel ?? null,
                riskLevel: a.riskLevel ?? null, llmAnalysis: a.llmAnalysis ?? undefined,
                completedAt: a.completedAt ? new Date(a.completedAt) : null,
                clientId: client.id, createdById: userId,
            },
        });
        stats.assessments++;
        if (a.pillarScores?.length) stats.pillarScores += await restorePillarScores(a.pillarScores, a.id);
        if (a.answers?.length) stats.answers += await restoreAnswers(a.answers, a.id);
    }
    return stats;
}

// POST /api/admin/db/restore — Restore data from a backup JSON file
adminRouter.post('/db/restore', async (req: AuthRequest, res: Response): Promise<void> => {
    if (!requireAdmin(req, res)) return;
    try {
        const backup = req.body;
        if (!backup?.data || !backup?.version) {
            res.status(400).json({ error: 'Formato de backup inválido. Se requiere { version, data }' });
            return;
        }

        const clientCount = backup.data.clients?.length
            ? await restoreClients(backup.data.clients, req.user!.tenantId ?? null, req.user!.userId)
            : 0;

        const aStats = backup.data.assessments?.length
            ? await restoreAssessments(backup.data.assessments, req.user!.userId)
            : { assessments: 0, pillarScores: 0, answers: 0 };

        res.json({
            message: 'Restauración completada',
            stats: { clients: clientCount, ...aStats },
        });
    } catch (error) {
        console.error('Admin DB restore error:', error);
        res.status(500).json({ error: 'Error al restaurar base de datos' });
    }
});

// GET /api/admin/db/stats — Database statistics for maintenance view
adminRouter.get('/db/stats', async (req: AuthRequest, res: Response): Promise<void> => {
    if (!requireAdmin(req, res)) return;
    try {
        const tenantWhere: any = {};
        if (req.user!.tenantId) tenantWhere.tenantId = req.user!.tenantId;

        const [users, clients, assessments, answers, pillars, questions] = await Promise.all([
            prisma.user.count({ where: tenantWhere }),
            prisma.client.count({ where: tenantWhere }),
            prisma.assessment.count({ where: { client: tenantWhere } }),
            prisma.answer.count({ where: { assessment: { client: tenantWhere } } }),
            prisma.pillar.count(),
            prisma.question.count(),
        ]);

        res.json({ users, clients, assessments, answers, pillars, questions });
    } catch (error) {
        console.error('Admin DB stats error:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

// GET /api/admin/clients — All clients for tenant
adminRouter.get('/clients', async (req: AuthRequest, res: Response): Promise<void> => {
    if (!requireAdmin(req, res)) return;
    try {
        const where: any = {};
        if (req.user!.tenantId) where.tenantId = req.user!.tenantId;

        const clients = await prisma.client.findMany({
            where,
            include: {
                _count: { select: { assessments: true } },
                createdBy: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json(clients);
    } catch (error) {
        console.error('Admin clients error:', error);
        res.status(500).json({ error: 'Error al listar clientes' });
    }
});
