import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import { WorkspaceService } from '../services/workspace.service';
import { postgresDb } from '../db/postgres.service';
import { logger } from '../utils/logger';

const router = Router();
const workspaceService = new WorkspaceService(postgresDb);

// ---------------------------------------------------------------------------
// Zod validation schemas
// ---------------------------------------------------------------------------

const metricCreateSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    sql_formula: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Governed Metrics — Context Hub CRUD
// ---------------------------------------------------------------------------

/**
 * GET /api/workspaces/:tenantId/metrics
 * Returns all governed metrics for a tenant.
 */
router.get('/:tenantId/metrics', async (req: Request, res: Response) => {
    try {
        const { tenantId } = req.params;
        const rows = await postgresDb.query(
            `SELECT id, tenant_id, name, description, sql_formula, created_at
             FROM governed_metrics
             WHERE tenant_id = $1
             ORDER BY created_at DESC`,
            [tenantId]
        );
        res.status(200).json(rows);
    } catch (err: unknown) {
        logger.error({ err }, 'Failed to list governed metrics');
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/workspaces/:tenantId/metrics
 * Creates a new governed metric for a tenant.
 */
router.post('/:tenantId/metrics', async (req: Request, res: Response) => {
    try {
        const { tenantId } = req.params;
        const parsed = metricCreateSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() });
        }

        const { name, description, sql_formula } = parsed.data;
        const rows = await postgresDb.query(
            `INSERT INTO governed_metrics (tenant_id, name, description, sql_formula)
             VALUES ($1, $2, $3, $4)
             RETURNING id, tenant_id, name, description, sql_formula, created_at`,
            [tenantId, name, description ?? null, sql_formula]
        );
        res.status(201).json(rows[0]);
    } catch (err: unknown) {
        logger.error({ err }, 'Failed to create governed metric');
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * DELETE /api/workspaces/:tenantId/metrics/:id
 * Deletes a governed metric by ID (tenant-scoped for security).
 */
router.delete('/:tenantId/metrics/:id', async (req: Request, res: Response) => {
    try {
        const { tenantId, id } = req.params;
        const result = await postgresDb.query(
            `DELETE FROM governed_metrics WHERE id = $1 AND tenant_id = $2 RETURNING id`,
            [id, tenantId]
        );
        if (!result || result.length === 0) {
            return res.status(404).json({ error: 'Metric not found or not owned by this tenant' });
        }
        res.status(200).json({ success: true, deleted: id });
    } catch (err: unknown) {
        logger.error({ err }, 'Failed to delete governed metric');
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ---------------------------------------------------------------------------
// Workspace Overview
// ---------------------------------------------------------------------------

/**
 * GET /api/workspaces/:tenantId/overview
 * Returns workspace subscription status, query usage, DB connection status, and active reports.
 */
router.get('/:tenantId/overview', async (req: Request, res: Response) => {
    try {
        const { tenantId } = req.params;

        const [wsRows, reportRows] = await Promise.all([
            postgresDb.query(
                `SELECT subscription_status, current_period_queries, db_host, db_name
                 FROM workspaces WHERE tenant_id = $1`,
                [tenantId]
            ),
            postgresDb.query(
                `SELECT count(*) as count FROM scheduled_reports WHERE tenant_id = $1 AND is_active = true`,
                [tenantId]
            ),
        ]);

        const ws = wsRows[0];
        const dbConnected = !!(ws?.db_host && ws?.db_name);

        res.status(200).json({
            tenant_id: tenantId,
            subscription_status: ws?.subscription_status ?? 'free_trial',
            current_period_queries: ws?.current_period_queries ?? 0,
            quota_limit: 200,
            db_connected: dbConnected,
            active_reports: parseInt(String(reportRows[0]?.count ?? '0'), 10),
        });
    } catch (err: unknown) {
        logger.error({ err }, 'Failed to get workspace overview');
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ---------------------------------------------------------------------------
// Database Configuration
// ---------------------------------------------------------------------------

/**
 * GET /api/workspaces/:tenantId/db-config
 * Retrieves existing database connection details (with password masked).
 */
router.get('/:tenantId/db-config', async (req: Request, res: Response) => {
    try {
        const tenantId = String(req.params.tenantId);
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
    } catch (err: unknown) {
        logger.error({ err }, 'Failed to get workspace db config');
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /api/workspaces/db-config (legacy — tenantId from query param)
 * Kept for backward compatibility with the legacy frontend api-client.
 */
router.get('/db-config', async (req: Request, res: Response) => {
    try {
        const tenantId = (req.query.tenantId as string) || 'default_tenant';
        const config = await workspaceService.getTenantDbConfig(tenantId);
        if (!config) {
            return res.status(200).json(null);
        }
        res.status(200).json({
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.user,
            password: config.password ? '••••••••' : '',
            ssl: config.ssl ?? true
        });
    } catch (err: unknown) {
        logger.error({ err }, 'Failed to get workspace db config (legacy)');
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * PUT /api/workspaces/:tenantId/db-config
 * Encrypts password with AES-256-GCM and persists tenant DB credentials.
 */
router.put('/:tenantId/db-config', async (req: Request, res: Response) => {
    try {
        const tenantId = String(req.params.tenantId);
        const { host, port, database, user, password, ssl } = req.body;
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
    } catch (err: unknown) {
        logger.error({ err }, 'Failed to save workspace db config');
        res.status(500).json({ error: 'Failed to save database config. Please try again.' });
    }
});

/**
 * PUT /api/workspaces/db-config (legacy — tenantId from body)
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
    } catch (err: unknown) {
        logger.error({ err }, 'Failed to save workspace db config (legacy)');
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
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.warn({ err }, 'External DB test connection failed');
        res.status(400).json({
            success: false,
            error: msg || 'Could not connect to external database. Please verify host, credentials, and firewall/SSL settings.'
        });
    } finally {
        if (testPool) {
            await testPool.end().catch(() => {});
        }
    }
});

export { router as workspaceRoutes };
