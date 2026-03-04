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
    if (url && typeof url === 'string' && url.trim()) process.env.OLLAMA_URL = url.trim();
    if (apiKey !== undefined && typeof apiKey === 'string') process.env.LLM_API_KEY = apiKey.trim();
    if (model && typeof model === 'string' && model.trim()) process.env.OLLAMA_MODEL = model.trim();
    console.log(`[Admin] LLM config updated — url: ${process.env.OLLAMA_URL}, model: ${process.env.OLLAMA_MODEL}, apiKey: ${process.env.LLM_API_KEY ? '[set]' : '[empty]'}`);
    res.json({ success: true, url: process.env.OLLAMA_URL, model: process.env.OLLAMA_MODEL });
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
