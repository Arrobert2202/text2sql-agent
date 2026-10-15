import http from 'http';
import { app } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { postgresDb } from './db/postgres.service';

const server = http.createServer(app);

server.listen(env.PORT, () => {
    logger.info(`🚀 API Server is running on http://localhost:${env.PORT}`);
    logger.info(`Ready to receive POST requests at http://localhost:${env.PORT}/api/ask`);
});

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`[Server] Received ${signal} — starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async (err) => {
        if (err) {
            logger.error({ err }, '[Server] Error closing HTTP server');
        } else {
            logger.info('[Server] HTTP server closed — no new connections accepted');
        }

        // Close all database pools
        try {
            await postgresDb.close();
            logger.info('[Server] Main Postgres pool closed');
        } catch (dbErr) {
            logger.error({ err: dbErr }, '[Server] Error closing main Postgres pool');
        }

        logger.info('[Server] Graceful shutdown complete. Exiting.');
        process.exit(0);
    });

    // Force exit after 10 seconds if graceful shutdown hangs
    setTimeout(() => {
        logger.error('[Server] Graceful shutdown timed out — forcing exit');
        process.exit(1);
    }, 10_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
    logger.fatal({ err }, '[Server] Uncaught Exception — exiting');
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, '[Server] Unhandled Promise Rejection');
});
