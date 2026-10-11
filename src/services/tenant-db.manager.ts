import { Pool } from 'pg';
import { WorkspaceService } from './workspace.service';
import { logger } from '../utils/logger';

export class TenantDbManager {
    private poolCache: Map<string, Pool> = new Map();
    private workspaceService: WorkspaceService;

    constructor(workspaceService: WorkspaceService) {
        this.workspaceService = workspaceService;
    }

    /**
     * Retrieves or instantiates a cached, strictly read-only PostgreSQL pool for a tenant.
     * Returns null if the tenant has not configured an external database.
     */
    public async getPoolForTenant(tenantId: string): Promise<Pool | null> {
        if (this.poolCache.has(tenantId)) {
            return this.poolCache.get(tenantId)!;
        }

        const config = await this.workspaceService.getTenantDbConfig(tenantId);
        if (!config) {
            return null;
        }

        logger.info(`Instantiating new read-only pool for tenant ${tenantId} at ${config.host}:${config.port}/${config.database}`);

        const pool = new Pool({
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.user,
            password: config.password,
            ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
            max: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 7000,
            statement_timeout: 10000, // 10s query execution timeout
            options: '-c default_transaction_read_only=on'
        });

        // Strict read-only enforcement on every connection
        pool.on('connect', async (client) => {
            try {
                await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;');
            } catch (err) {
                logger.warn({ err }, `Failed to enforce read-only session on external DB for tenant ${tenantId}`);
            }
        });

        pool.on('error', (err) => {
            logger.error({ err }, `External DB Pool error for tenant ${tenantId}`);
        });

        this.poolCache.set(tenantId, pool);
        return pool;
    }

    /**
     * Dynamically fetches table schemas from the tenant's external RevOps database.
     */
    public async getSchemaForTenant(tenantId: string): Promise<string | null> {
        const pool = await this.getPoolForTenant(tenantId);
        if (!pool) return null;

        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT table_name, column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'public';
            `);

            if (!result.rows || result.rows.length === 0) return null;

            const schemaMap = result.rows.reduce((acc, row) => {
                if (!acc[row.table_name]) acc[row.table_name] = [];
                acc[row.table_name].push(`${row.column_name} ${row.data_type}`);
                return acc;
            }, {} as Record<string, string[]>);

            return (Object.entries(schemaMap) as [string, string[]][])
                .map(([table, columns]) => `TABLE ${table} (\n  ${columns.join(',\n  ')}\n)`)
                .join('\n\n');
        } catch (error) {
            logger.error({ err: error }, `Failed to fetch external schema for tenant ${tenantId}`);
            return null;
        } finally {
            client.release();
        }
    }

    /**
     * Executes SQL query on tenant's external database using their read-only connection pool.
     */
    public async queryReadOnly(tenantId: string, query: string, params: any[] = []): Promise<any[]> {
        const pool = await this.getPoolForTenant(tenantId);
        if (!pool) {
            throw new Error(`No database pool available for tenant ${tenantId}`);
        }

        const client = await pool.connect();
        try {
            const result = await client.query(query, params);
            return result.rows;
        } finally {
            client.release();
        }
    }

    /**
     * Evicts and closes a cached pool (e.g. when credentials are updated).
     */
    public async invalidatePool(tenantId: string): Promise<void> {
        const pool = this.poolCache.get(tenantId);
        if (pool) {
            this.poolCache.delete(tenantId);
            await pool.end().catch(() => {});
        }
    }

    public async closeAll(): Promise<void> {
        for (const [tenantId, pool] of this.poolCache.entries()) {
            await pool.end().catch(() => {});
        }
        this.poolCache.clear();
    }
}
