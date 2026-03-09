import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth.routes';
import { clientRouter } from './routes/client.routes';
import { assessmentRouter } from './routes/assessment.routes';
import { pillarRouter } from './routes/pillar.routes';
import { reportRouter } from './routes/report.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import { integrationsRouter } from './routes/integrations.routes';
import { analyticsRouter } from './routes/analytics.routes';
import { adminRouter } from './routes/admin.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:5173',
    'http://localhost:3000',
];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin not allowed — ${origin}`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(helmet());
app.use(express.json({ limit: '10mb' }));

// Rate limiting: general API
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));
// Stricter rate limit on auth endpoints
app.use('/api/auth/', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' } }));

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/clients', clientRouter);
app.use('/api/assessments', assessmentRouter);
app.use('/api/pillars', pillarRouter);
app.use('/api/reports', reportRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/admin', adminRouter);

app.listen(PORT, () => {
    console.log(`🚀 Backend running on http://localhost:${PORT}`);
});

export default app;
