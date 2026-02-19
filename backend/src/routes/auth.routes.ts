import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// POST /api/auth/google — Login with Google OAuth
authRouter.post('/google', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { credential } = req.body;

        if (!credential) {
            res.status(400).json({ error: 'Token de Google requerido' });
            return;
        }

        // Verify the Google ID token
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            res.status(401).json({ error: 'Token de Google inválido' });
            return;
        }

        const { email, name, sub: googleId, hd: hostedDomain } = payload;

        // Find or create user
        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            // Auto-create user on first Google login
            // Try to find a tenant matching the corporate domain
            let tenantId: string | undefined;

            if (hostedDomain) {
                const tenant = await prisma.tenant.findFirst({
                    where: { domain: hostedDomain },
                });
                if (tenant) {
                    tenantId = tenant.id;
                }
            }

            // If no matching tenant, use or create default
            if (!tenantId) {
                let defaultTenant = await prisma.tenant.findFirst({ where: { domain: 'default' } });
                if (!defaultTenant) {
                    defaultTenant = await prisma.tenant.create({
                        data: { name: 'Default Organization', domain: 'default' },
                    });
                }
                tenantId = defaultTenant.id;
            }

            // Create user with a random password (they'll only use Google login)
            const randomPassword = await bcrypt.hash(Math.random().toString(36) + Date.now(), 12);

            user = await prisma.user.create({
                data: {
                    email,
                    password: randomPassword,
                    name: name || email.split('@')[0],
                    role: 'CLIENT', // Default role for Google login users
                    tenantId,
                },
            });

            console.log(`✅ New user created via Google OAuth: ${email} (domain: ${hostedDomain || 'personal'})`);
        }

        // Generate JWT
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
        const { email, password, name, role, tenantId } = req.body;

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            res.status(400).json({ error: 'El email ya está registrado' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        // If no tenant exists yet, create a default one
        let finalTenantId = tenantId;
        if (!finalTenantId) {
            let defaultTenant = await prisma.tenant.findFirst({ where: { domain: 'default' } });
            if (!defaultTenant) {
                defaultTenant = await prisma.tenant.create({
                    data: { name: 'Default Organization', domain: 'default' },
                });
            }
            finalTenantId = defaultTenant.id;
        }

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: role || 'CLIENT',
                tenantId: finalTenantId,
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
