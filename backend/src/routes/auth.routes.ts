import { Router, Response } from 'express';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireRole, JWT_SECRET } from '../middleware/auth';

export const authRouter = Router();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

/** Resolve tenant ID from a hosted domain, falling back to the default tenant. */
async function resolveTenantId(hostedDomain?: string): Promise<string> {
    if (hostedDomain) {
        const tenant = await prisma.tenant.findFirst({ where: { domain: hostedDomain } });
        if (tenant) return tenant.id;
    }
    let defaultTenant = await prisma.tenant.findFirst({ where: { domain: 'default' } });
    defaultTenant ??= await prisma.tenant.create({ data: { name: 'Default Organization', domain: 'default' } });
    return defaultTenant.id;
}

/** Assign role based on email domain: @gammaingenieros.com → CONSULTANT, else → CLIENT. */
function roleForEmail(email: string): 'CONSULTANT' | 'CLIENT' {
    const domain = email.split('@')[1]?.toLowerCase();
    return domain === 'gammaingenieros.com' ? 'CONSULTANT' : 'CLIENT';
}

// POST /api/auth/google — Login with Google OAuth
authRouter.post('/google', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { credential } = req.body;

        if (!credential) {
            res.status(400).json({ error: 'Token de Google requerido' });
            return;
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload?.email) {
            res.status(401).json({ error: 'Token de Google inválido' });
            return;
        }

        const { email, name, hd: hostedDomain } = payload;

        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            const tenantId = await resolveTenantId(hostedDomain);
            const randomPassword = await bcrypt.hash(randomBytes(32).toString('hex'), 12);

            user = await prisma.user.create({
                data: {
                    email,
                    password: randomPassword,
                    name: name || email.split('@')[0],
                    role: roleForEmail(email),
                    tenantId,
                },
            });

            console.log(`New user created via Google OAuth: ${email} (domain: ${hostedDomain || 'personal'})`);
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role, tenantId: user.tenantId },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
            token,
        });
    } catch (error: any) {
        console.error('Google auth error:', error?.message || error);
        res.status(401).json({ error: 'Error al autenticar con Google' });
    }
});

// POST /api/auth/register
authRouter.post('/register', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { email, password, name } = req.body;

        // Input validation
        if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            res.status(400).json({ error: 'Email inválido' });
            return;
        }
        if (!password || typeof password !== 'string' || password.length < 8) {
            res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
            return;
        }
        if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 255) {
            res.status(400).json({ error: 'Nombre inválido' });
            return;
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            res.status(400).json({ error: 'El email ya está registrado' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const tenantId = await resolveTenantId();

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: roleForEmail(email),
                tenantId,
            },
        });

        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role, tenantId: user.tenantId },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
            token,
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
});

// POST /api/auth/login
authRouter.post('/login', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            res.status(401).json({ error: 'Credenciales inválidas' });
            return;
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            res.status(401).json({ error: 'Credenciales inválidas' });
            return;
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role, tenantId: user.tenantId },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
            token,
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

// GET /api/auth/me
authRouter.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.userId },
            select: { id: true, email: true, name: true, role: true, tenantId: true },
        });
        if (!user) {
            res.status(404).json({ error: 'Usuario no encontrado' });
            return;
        }
        res.json(user);
    } catch (error) {
        console.error('Me error:', error);
        res.status(500).json({ error: 'Error al obtener perfil' });
    }
});

// PUT /api/auth/profile — Update own name and/or password
authRouter.put('/profile', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name, currentPassword, newPassword } = req.body as {
            name?: string; currentPassword?: string; newPassword?: string;
        };

        const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
        if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }

        const updates: Record<string, unknown> = {};

        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim().length === 0 || name.length > 255) {
                res.status(400).json({ error: 'Nombre inválido' }); return;
            }
            updates.name = name.trim();
        }

        if (newPassword !== undefined) {
            if (!currentPassword) { res.status(400).json({ error: 'Se requiere la contraseña actual' }); return; }
            const valid = await bcrypt.compare(currentPassword, user.password);
            if (!valid) { res.status(400).json({ error: 'Contraseña actual incorrecta' }); return; }
            if (typeof newPassword !== 'string' || newPassword.length < 8) {
                res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' }); return;
            }
            updates.password = await bcrypt.hash(newPassword, 12);
        }

        if (Object.keys(updates).length === 0) {
            res.status(400).json({ error: 'No hay cambios para guardar' }); return;
        }

        const updated = await prisma.user.update({
            where: { id: req.user!.userId },
            data: updates,
            select: { id: true, email: true, name: true, role: true },
        });

        res.json(updated);
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Error al actualizar perfil' });
    }
});

// DELETE /api/auth/users/:id — Admin only
authRouter.delete('/users/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        if (id === req.user!.userId) {
            res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' }); return;
        }

        const target = await prisma.user.findUnique({ where: { id } });
        if (!target) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }

        if (target.tenantId !== req.user!.tenantId) {
            res.status(403).json({ error: 'Acceso denegado' }); return;
        }

        await prisma.user.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

// GET /api/auth/users (Admin only)
authRouter.get('/users', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const users = await prisma.user.findMany({
            where: req.user!.tenantId ? { tenantId: req.user!.tenantId } : undefined,
            select: { id: true, email: true, name: true, role: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(users);
    } catch (error) {
        console.error('List users error:', error);
        res.status(500).json({ error: 'Error al listar usuarios' });
    }
});
