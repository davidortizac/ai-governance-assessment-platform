import https from 'https';
import http from 'http';
import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';

export const integrationsRouter = Router();

integrationsRouter.use(authenticate as any);

/** Real Slack notification via Incoming Webhook. */
async function sendSlackWebhook(webhookUrl: string, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const url = new URL(webhookUrl);
        const isHttps = url.protocol === 'https:';
        const lib = isHttps ? https : http;
        const body = JSON.stringify({ text });
        const options: https.RequestOptions = {
            hostname: url.hostname,
            port: url.port ? parseInt(url.port, 10) : (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
            timeout: 10000,
            rejectUnauthorized: false,
        };
        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', (c: Buffer) => { data += c.toString(); });
            res.on('end', () => {
                if ((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300) {
                    resolve();
                } else {
                    reject(new Error(`Slack responded ${res.statusCode}: ${data}`));
                }
            });
            res.on('error', reject);
        });
        req.on('timeout', () => req.destroy(new Error('Slack webhook timed out')));
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// GET /api/integrations — List configured integrations (tenant-scoped)
integrationsRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.tenantId;
        if (!tenantId) {
            res.json([]); // user without tenant has no integrations
            return;
        }

        const integrations = await prisma.integration.findMany({
            where: { tenantId },
            select: { id: true, type: true, isActive: true, createdAt: true, updatedAt: true },
        });

        res.json(integrations);
    } catch (error) {
        console.error('List integrations error:', error);
        res.status(500).json({ error: 'Error listing integrations' });
    }
});

// POST /api/integrations/jira — Configure JIRA (ADMIN only)
integrationsRouter.post('/jira', requireRole('ADMIN') as any, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { url, email, apiToken, projectKey } = req.body;
        const tenantId = req.user!.tenantId;

        if (!tenantId) { res.status(400).json({ error: 'Tenant ID requerido' }); return; }
        if (!url || !email || !apiToken || !projectKey) {
            res.status(400).json({ error: 'Faltan campos de configuración JIRA' });
            return;
        }

        const integration = await prisma.integration.upsert({
            where: { tenantId_type: { tenantId, type: 'JIRA' } },
            update:  { config: { url, email, apiToken, projectKey }, isActive: true },
            create:  { tenantId, type: 'JIRA', config: { url, email, apiToken, projectKey }, isActive: true },
        });

        res.json({ message: 'JIRA configurado', integration: { id: integration.id, type: integration.type, isActive: integration.isActive } });
    } catch (error) {
        console.error('Configure JIRA error:', error);
        res.status(500).json({ error: 'Error configurando JIRA' });
    }
});

// POST /api/integrations/slack — Configure Slack (ADMIN only)
integrationsRouter.post('/slack', requireRole('ADMIN') as any, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { webhookUrl, channel } = req.body;
        const tenantId = req.user!.tenantId;

        if (!tenantId) { res.status(400).json({ error: 'Tenant ID requerido' }); return; }
        if (!webhookUrl) { res.status(400).json({ error: 'Webhook URL requerida' }); return; }

        // Test the webhook before saving
        try {
            await sendSlackWebhook(webhookUrl, '✅ Integración con Gamma AI Platform configurada correctamente.');
        } catch (testErr: any) {
            res.status(400).json({ error: `Webhook inválido o inaccesible: ${testErr.message}` });
            return;
        }

        const integration = await prisma.integration.upsert({
            where: { tenantId_type: { tenantId, type: 'SLACK' } },
            update:  { config: { webhookUrl, channel }, isActive: true },
            create:  { tenantId, type: 'SLACK', config: { webhookUrl, channel }, isActive: true },
        });

        res.json({ message: 'Slack configurado', integration: { id: integration.id, type: integration.type, isActive: integration.isActive } });
    } catch (error) {
        console.error('Configure Slack error:', error);
        res.status(500).json({ error: 'Error configurando Slack' });
    }
});

// DELETE /api/integrations/:type — Disable integration
integrationsRouter.delete('/:type', requireRole('ADMIN') as any, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const type = req.params.type.toUpperCase() as 'JIRA' | 'SLACK';
        const tenantId = req.user!.tenantId;

        if (!tenantId) { res.status(400).json({ error: 'Tenant ID requerido' }); return; }
        if (type !== 'JIRA' && type !== 'SLACK') {
            res.status(400).json({ error: 'Tipo de integración inválido' });
            return;
        }

        await prisma.integration.update({
            where: { tenantId_type: { tenantId, type } },
            data: { isActive: false },
        });

        res.json({ message: `Integración ${type} desactivada` });
    } catch (error) {
        console.error('Disable integration error:', error);
        res.status(500).json({ error: 'Error desactivando integración' });
    }
});

// POST /api/integrations/notify — Send real notification to active integrations
integrationsRouter.post('/notify', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { message, severity } = req.body as { message?: string; severity?: string };
        const tenantId = req.user!.tenantId;

        if (!tenantId) { res.json({ message: 'No hay integraciones configuradas', results: [] }); return; }

        const activeIntegrations = await prisma.integration.findMany({
            where: { tenantId, isActive: true },
        });

        const results: { type: string; status: string; detail?: string }[] = [];

        for (const integration of activeIntegrations) {
            const config = integration.config as any;

            if (integration.type === 'SLACK') {
                const icon = severity === 'CRITICAL' ? '🔴' : severity === 'HIGH' ? '🟠' : '🟡';
                const text = `${icon} *[Gamma AI Platform]* ${message ?? 'Alerta de seguridad IA'}`;
                try {
                    await sendSlackWebhook(config.webhookUrl, text);
                    results.push({ type: 'SLACK', status: 'sent', detail: config.channel ?? config.webhookUrl });
                } catch (err: any) {
                    results.push({ type: 'SLACK', status: 'error', detail: err.message });
                }
            } else if (integration.type === 'JIRA') {
                // JIRA ticket creation requires OAuth flow — simulated here
                console.log(`[Integrations] JIRA ticket would be created in ${config.projectKey}: ${message}`);
                results.push({ type: 'JIRA', status: 'simulated', detail: `Proyecto: ${config.projectKey}` });
            }
        }

        res.json({ message: 'Notificaciones procesadas', results });
    } catch (error) {
        console.error('Notify error:', error);
        res.status(500).json({ error: 'Error enviando notificaciones' });
    }
});
