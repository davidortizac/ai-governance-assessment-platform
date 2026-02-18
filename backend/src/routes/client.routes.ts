import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';

export const clientRouter = Router();

// All routes require authentication
clientRouter.use(authenticate as any);

// GET /api/clients
clientRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const where: any = {};
        if (req.user!.tenantId) {
            where.tenantId = req.user!.tenantId;
        }
        if (req.query.search) {
            where.name = { contains: req.query.search as string, mode: 'insensitive' };
        }

        const clients = await prisma.client.findMany({
            where,
            include: { _count: { select: { assessments: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(clients);
    } catch (error) {
        console.error('List clients error:', error);
        res.status(500).json({ error: 'Error al listar clientes' });
    }
});

// GET /api/clients/:id
clientRouter.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const client = await prisma.client.findUnique({
            where: { id: req.params.id },
            include: {
                assessments: {
                    include: { pillarScores: { include: { pillar: true } } },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!client) {
            res.status(404).json({ error: 'Cliente no encontrado' });
            return;
        }
        res.json(client);
    } catch (error) {
        console.error('Get client error:', error);
        res.status(500).json({ error: 'Error al obtener cliente' });
    }
});

// POST /api/clients
clientRouter.post('/', requireRole('ADMIN', 'CONSULTANT') as any, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name, industry, contactEmail, contactName } = req.body;
        const client = await prisma.client.create({
            data: {
                name,
                industry,
                contactEmail,
                contactName,
                tenantId: req.user!.tenantId!,
            },
        });
        res.status(201).json(client);
    } catch (error) {
        console.error('Create client error:', error);
        res.status(500).json({ error: 'Error al crear cliente' });
    }
});

// PUT /api/clients/:id
clientRouter.put('/:id', requireRole('ADMIN', 'CONSULTANT') as any, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name, industry, contactEmail, contactName } = req.body;
        const client = await prisma.client.update({
            where: { id: req.params.id },
            data: { name, industry, contactEmail, contactName },
        });
        res.json(client);
    } catch (error) {
        console.error('Update client error:', error);
        res.status(500).json({ error: 'Error al actualizar cliente' });
    }
});

// DELETE /api/clients/:id
clientRouter.delete('/:id', requireRole('ADMIN') as any, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        await prisma.client.delete({ where: { id: req.params.id } });
        res.json({ message: 'Cliente eliminado' });
    } catch (error) {
        console.error('Delete client error:', error);
        res.status(500).json({ error: 'Error al eliminar cliente' });
    }
});
