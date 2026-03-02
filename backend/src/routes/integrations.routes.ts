import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';

export const integrationsRouter = Router();

integrationsRouter.use(authenticate as any);

// GET /api/integrations - List configured integrations
integrationsRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.tenantId;
        if (!tenantId) {
            res.status(400).json({ error: 'Tenant ID required' });
            return;
        }

        const integrations = await prisma.integration.findMany({
            where: { tenantId },
            select: {
                id: true,
                type: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                // Do not return full config for security reasons
            },
        });

        res.json(integrations);
    } catch (error) {
        console.error('List integrations error:', error);
        res.status(500).json({ error: 'Error listing integrations' });
    }
});

// POST /api/integrations/jira - Configure JIRA
integrationsRouter.post('/jira', requireRole('ADMIN') as any, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { url, email, apiToken, projectKey } = req.body;
        const tenantId = req.user!.tenantId!;

        if (!url || !email || !apiToken || !projectKey) {
            res.status(400).json({ error: 'Missing JIRA configuration' });
            return;
        }

        // Upsert JIRA integration
        const integration = await prisma.integration.upsert({
            where: {
                tenantId_type: {
                    tenantId,
                    type: 'JIRA',
                },
            },
            update: {
                config: { url, email, apiToken, projectKey },
                isActive: true,
            },
            create: {
                tenantId,
                type: 'JIRA',
                config: { url, email, apiToken, projectKey },
                isActive: true, // Auto-enable on creation
            },
        });

        res.json({ message: 'JIRA integration configured', integration: { id: integration.id, type: integration.type, isActive: integration.isActive } });
    } catch (error) {
        console.error('Configure JIRA error:', error);
        res.status(500).json({ error: 'Error configuring JIRA' });
    }
});

// POST /api/integrations/slack - Configure Slack
integrationsRouter.post('/slack', requireRole('ADMIN') as any, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { webhookUrl, channel } = req.body;
        const tenantId = req.user!.tenantId!;

        if (!webhookUrl) {
            res.status(400).json({ error: 'Missing Slack Webhook URL' });
            return;
        }

        // Upsert Slack integration
        const integration = await prisma.integration.upsert({
            where: {
                tenantId_type: {
                    tenantId,
                    type: 'SLACK',
                },
            },
            update: {
                config: { webhookUrl, channel },
                isActive: true,
            },
            create: {
                tenantId,
                type: 'SLACK',
                config: { webhookUrl, channel },
                isActive: true,
            },
        });

        res.json({ message: 'Slack integration configured', integration: { id: integration.id, type: integration.type, isActive: integration.isActive } });
    } catch (error) {
        console.error('Configure Slack error:', error);
        res.status(500).json({ error: 'Error configuring Slack' });
    }
});

// DELETE /api/integrations/:type - Disable integration
integrationsRouter.delete('/:type', requireRole('ADMIN') as any, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { type } = req.params;
        const tenantId = req.user!.tenantId!;

        if (type !== 'JIRA' && type !== 'SLACK') {
            res.status(400).json({ error: 'Invalid integration type' });
            return;
        }

        await prisma.integration.update({
            where: {
                tenantId_type: {
                    tenantId,
                    type: type as any,
                },
            },
            data: { isActive: false },
        });

        res.json({ message: `${type} integration disabled` });
    } catch (error) {
        console.error('Disable integration error:', error);
        res.status(500).json({ error: 'Error disabling integration' });
    }
});

// POST /api/integrations/notify - Test notification
integrationsRouter.post('/notify', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { message, severity } = req.body;
        const tenantId = req.user!.tenantId!;

        // Fetch active integrations
        const activeIntegrations = await prisma.integration.findMany({
            where: { tenantId, isActive: true },
        });

        const results: any[] = [];

        for (const integration of activeIntegrations) {
            if (integration.type === 'SLACK') {
                // Mock Slack notification
                const config = integration.config as any;
                console.log(`[MOCK] Sending Slack to ${config.webhookUrl}: ${message}`);
                results.push({ type: 'SLACK', status: 'sent', recipient: config.channel });
            } else if (integration.type === 'JIRA') {
                // Mock JIRA ticket creation
                const config = integration.config as any;
                console.log(`[MOCK] Creating JIRA ticket in ${config.projectKey}: ${message}`);
                results.push({ type: 'JIRA', status: 'ticket_created', project: config.projectKey });
            }
        }

        res.json({ message: 'Notifications processed', results });
    } catch (error) {
        console.error('Notify error:', error);
        res.status(500).json({ error: 'Error sending notifications' });
    }
});
