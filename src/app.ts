import express, { Request, Response } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { askRoutes } from './routes/ask.routes';
import { slackRoutes } from './routes/slack.routes';
import { teamsRoutes } from './routes/teams.routes';
import { billingRoutes } from './routes/billing.routes';
import { workspaceRoutes } from './routes/workspace.routes';
import { errorHandler } from './middlewares/errorHandler';
import { aiRateLimiter } from './middlewares/rateLimiter';
import { postgresDb } from './db/postgres.service';

const app = express();

// Configure CORS for production (Vercel) and development
const allowedOrigins: string[] = [];

if (env.FRONTEND_URL) {
    allowedOrigins.push(...env.FRONTEND_URL.split(',').map(url => url.trim().replace(/\/$/, '')));
}

if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080');
}

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. server-to-server, curl, Slack webhooks)
        if (!origin) return callback(null, true);
        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Signature']
}));

// Lemon Squeezy Webhook route mounted BEFORE standard json parser to preserve raw payload
app.use('/api/billing', billingRoutes);

// Global JSON parser with raw body buffer attachment (for webhook verification)
app.use(express.json({
    verify: (req: unknown, _res, buf) => {
        (req as { rawBody?: Buffer }).rawBody = buf;
    }
}));

// Health check endpoint (no rate limit)
app.get('/api/health', async (_req: Request, res: Response) => {
    const start = Date.now();
    try {
        await postgresDb.query('SELECT 1');
        res.json({
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            db: 'connected',
            latency_ms: Date.now() - start,
        });
    } catch (err) {
        res.status(503).json({
            status: 'degraded',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            db: 'error',
            latency_ms: Date.now() - start,
        });
    }
});

// Application Routes (rate-limited AI endpoints)
app.use('/api', aiRateLimiter, askRoutes);
app.use('/api/slack', aiRateLimiter, slackRoutes);
app.use('/api/teams', aiRateLimiter, teamsRoutes);

// Workspace management (no rate limit — admin operations)
app.use('/api/workspaces', workspaceRoutes);

// Global Error Handler
app.use(errorHandler);

export { app };
