import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { WorkspaceService } from '../services/workspace.service';
import { postgresDb } from '../db/postgres.service';
import { logger } from '../utils/logger';

const router = Router();
const workspaceService = new WorkspaceService(postgresDb);

/**
 * GET /api/workspaces/db-config
 * Retrieves existing database connection details (with password masked).
 */
router.get('/db-config', async (req: Request, res: Response) => {
    try {
        const tenantId = (req.query.tenantId as string) || 'default_tenant';
        const config = await workspaceService.getTenantDbConfig(tenantId);
        if (!config) {
            return res.status(200).json(null);
        }

        // Return config with masked password
        res.status(200).json({
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.user,
            password: config.password ? '••••••••' : '',
            ssl: config.ssl ?? true
        });
    } catch (err: any) {
        logger.error({ err }, 'Failed to get workspace db config');
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * PUT /api/workspaces/db-config
 * Encrypts password with AES-256-GCM and persists tenant DB credentials.
 */
router.put('/db-config', async (req: Request, res: Response) => {
    try {
        const { tenantId = 'default_tenant', host, port, database, user, password, ssl } = req.body;
        if (!host || !database || !user) {
            return res.status(400).json({ error: 'Host, database, and user are required.' });
        }

        await workspaceService.saveTenantDbConfig(tenantId, {
            host,
            port: Number(port) || 5432,
            database,
            user,
            password: password && password !== '••••••••' ? password : undefined,
            ssl: ssl ?? true
        });

        res.status(200).json({
            success: true,
            message: 'External database credentials successfully saved and encrypted with AES-256-GCM.'
        });
    } catch (err: any) {
        logger.error({ err }, 'Failed to save workspace db config');
        res.status(500).json({ error: 'Failed to save database config. Please try again.' });
    }
});

/**
 * POST /api/workspaces/test-connection
 * Tests external connection using strictly read-only transaction parameters.
 */
router.post('/test-connection', async (req: Request, res: Response) => {
    let testPool: Pool | null = null;
    try {
        const { host, port, database, user, password, ssl } = req.body;
        if (!host || !database || !user) {
            return res.status(400).json({ error: 'Host, database, and user are required to test connection.' });
        }

        testPool = new Pool({
            host,
            port: Number(port) || 5432,
            database,
            user,
            password: password === '••••••••' ? undefined : password,
            ssl: ssl ? { rejectUnauthorized: false } : undefined,
            connectionTimeoutMillis: 5000,
            statement_timeout: 5000,
            options: '-c default_transaction_read_only=on'
        });

        const client = await testPool.connect();
        try {
            await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;');
            const result = await client.query(`
                SELECT count(*) as count 
                FROM information_schema.tables 
                WHERE table_schema = 'public';
            `);
            const tableCount = parseInt(result.rows[0].count, 10);

            res.status(200).json({
                success: true,
                message: `Connection successful! Read-only transaction confirmed. Detected ${tableCount} tables in public schema.`,
                tableCount
            });
        } finally {
            client.release();
        }
    } catch (err: any) {
        logger.warn({ err }, 'External DB test connection failed');
        res.status(400).json({
            success: false,
            error: err.message || 'Could not connect to external database. Please verify host, credentials, and firewall/SSL settings.'
        });
    } finally {
        if (testPool) {
            await testPool.end().catch(() => {});
        }
    }
});

export { router as workspaceRoutes };

