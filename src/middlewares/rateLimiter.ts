import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for AI-intensive routes (/api/ask, /api/slack, /api/teams).
 * Max 20 requests per 15-minute window per IP address.
 * Uses in-memory store (sufficient for single-instance deployments).
 */
export const aiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many requests. Please wait before sending more questions.',
        retryAfter: '15 minutes',
    },
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/api/health';
    },
});

