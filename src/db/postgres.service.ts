import { Pool } from 'pg';
import { DatabaseService } from './database.interface';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export class PostgresService implements DatabaseService {
    private pool: Pool;
    private readOnlyPool: Pool;

    constructor() {
        this.pool = new Pool({
            connectionString: env.DATABASE_URL
        });

        // Initialize strictly read-only pool with transaction read-only enforcement & timeouts
        let readOnlyUrl = env.DATABASE_URL;
        try {
            const url = new URL(env.DATABASE_URL);
            url.username = env.DB_READONLY_USER;
            url.password = env.DB_READONLY_PASSWORD;
            readOnlyUrl = url.toString();
        } catch {
            // Keep default if URL parsing fails
        }

        this.readOnlyPool = new Pool({
            connectionString: readOnlyUrl,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            statement_timeout: 10000, // 10s query execution timeout
            options: '-c default_transaction_read_only=on'
        });

        this.readOnlyPool.on('connect', async (client) => {
            try {
                await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;');
            } catch (err) {
                logger.warn({ err }, 'Failed to set session read-only mode on client');
            }
        });

        // Asynchronously setup database & provision read-only credentials on start
        this.setupDatabase().catch(err => {
            logger.error({ err }, 'Failed to setup PostgreSQL database');
        });
    }

    private async setupDatabase() {
        // 1. Create standard tables
        await this.execute(`
            CREATE EXTENSION IF NOT EXISTS vector;
            
            CREATE TABLE IF NOT EXISTS workspaces (
                tenant_id TEXT PRIMARY KEY,
                team_name TEXT,
                stripe_customer_id TEXT,
                subscription_status TEXT DEFAULT 'free_trial',
                created_at TIMESTAMP DEFAULT NOW(),
                db_host TEXT,
                db_port INTEGER DEFAULT 5432,
                db_name TEXT,
                db_user TEXT,
                db_encrypted_password TEXT,
                db_ssl BOOLEAN DEFAULT true,
                current_period_queries INTEGER DEFAULT 0,
                stripe_subscription_item_id TEXT
            );

            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                company TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL
            );

            CREATE TABLE IF NOT EXISTS auto_parts (
                id SERIAL PRIMARY KEY,
                part_number TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                stock INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                customer_id INTEGER NOT NULL REFERENCES customers(id),
                part_id INTEGER NOT NULL REFERENCES auto_parts(id),
                quantity INTEGER NOT NULL,
                order_date DATE NOT NULL
            );

            CREATE TABLE IF NOT EXISTS document_chunks (
                id SERIAL PRIMARY KEY,
                tenant_id TEXT DEFAULT 'default_tenant',
                file_name TEXT NOT NULL,
                content TEXT NOT NULL,
                embedding vector(1536)
            );

            CREATE TABLE IF NOT EXISTS query_cache (
                id SERIAL PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                question TEXT NOT NULL,
                question_embedding vector(1536),
                generated_sql TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS scheduled_reports (
                id SERIAL PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                natural_language_query TEXT NOT NULL,
                cron_schedule TEXT NOT NULL,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 2. Migration: Ensure external RevOps database & usage columns exist in workspaces
        try {
            await this.execute(`
                ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS db_host TEXT;
                ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS db_port INTEGER DEFAULT 5432;
                ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS db_name TEXT;
                ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS db_user TEXT;
                ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS db_encrypted_password TEXT;
                ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS db_ssl BOOLEAN DEFAULT true;
                ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS current_period_queries INTEGER DEFAULT 0;
                ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS stripe_subscription_item_id TEXT;
            `);
        } catch (e) {
            logger.warn({ err: e }, 'Workspaces schema migration warning');
        }

        // Gracefully add column for existing document_chunks table
        try {
            await this.execute(`ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default_tenant';`);
        } catch (e) {}

        // 3. Task 1: Provision dedicated, strictly READ ONLY PostgreSQL user/role
        try {
            await this.execute(`
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${env.DB_READONLY_USER}') THEN
                        EXECUTE format('CREATE ROLE %I WITH LOGIN PASSWORD %L', '${env.DB_READONLY_USER}', '${env.DB_READONLY_PASSWORD}');
                    END IF;
                END
                $$;
                GRANT CONNECT ON DATABASE current_database() TO ${env.DB_READONLY_USER};
                GRANT USAGE ON SCHEMA public TO ${env.DB_READONLY_USER};
                GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${env.DB_READONLY_USER};
                ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${env.DB_READONLY_USER};
            `);
            logger.info(`Provisioned read-only database role: ${env.DB_READONLY_USER}`);
        } catch (err) {
            logger.warn({ err }, `Could not provision dedicated read-only role (might lack SUPERUSER/CREATEROLE). Enforcing read-only session options.`);
            // Fallback: If dedicated user login fails, point readOnlyPool back to default user with enforced read-only option
            this.readOnlyPool = new Pool({
                connectionString: env.DATABASE_URL,
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 5000,
                statement_timeout: 10000,
                options: '-c default_transaction_read_only=on'
            });
            this.readOnlyPool.on('connect', async (client) => {
                await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;').catch(() => {});
            });
        }

        // 4. Populate with test data if tables are empty
        const check = await this.query('SELECT count(*) as count FROM customers');
        const count = parseInt(check[0].count, 10);
        
        if (count === 0) {
            logger.info("Populating the PostgreSQL database with test data...");
            
            const insertCustomer = 'INSERT INTO customers (name, company, email) VALUES ($1, $2, $3)';
            await this.query(insertCustomer, ['Ion Popescu', 'Auto Serv SRL', 'ion@autoserv.ro']);
            await this.query(insertCustomer, ['Maria Ionescu', 'Logistica Trans', 'maria@logistica.ro']);

            const insertPart = 'INSERT INTO auto_parts (part_number, name, price, stock) VALUES ($1, $2, $3, $4)';
            await this.query(insertPart, ['BOSCH-123', 'Plăcuțe frână', 150.50, 40]);
            await this.query(insertPart, ['VALEO-456', 'Filtru aer', 45.00, 120]);

            const insertOrder = 'INSERT INTO orders (customer_id, part_id, quantity, order_date) VALUES ($1, $2, $3, $4)';
            await this.query(insertOrder, [1, 1, 4, '2023-10-01']);
            await this.query(insertOrder, [2, 2, 10, '2023-10-05']);
        }
    }

    /**
     * Executes a PostgreSQL query without returning results (e.g., CREATE, INSERT).
     * Uses the administrative/write pool.
     * @param query The SQL query string
     */
    public async execute(query: string): Promise<void> {
        await this.pool.query(query);
    }

    /**
     * Executes a parameterized PostgreSQL query and returns the rows.
     * Used for system queries (e.g., workspace lookups, RAG embeddings).
     * @param query The SQL query string
     * @param params Optional array of parameters
     * @returns Array of database rows
     */
    public async query(query: string, params: any[] = []): Promise<any[]> {
        const result = await this.pool.query(query, params);
        return result.rows;
    }

    /**
     * Executes an arbitrary SQL query exclusively using the hardened READ ONLY connection pool.
     * Strictly prevents data mutation, table dropping, and schema tampering.
     * @param query The SQL query generated by AI
     * @param params Optional parameters
     * @returns Array of database rows
     */
    public async queryReadOnly(query: string, params: any[] = []): Promise<any[]> {
        const client = await this.readOnlyPool.connect();
        try {
            const result = await client.query(query, params);
            return result.rows;
        } finally {
            client.release();
        }
    }

    /**
     * Extracts the database schema (tables and columns) dynamically.
     * This schema is fed into the LLM to provide context for Text-to-SQL generation.
     * @returns A string representation of the schema
     */
    public async getSchema(): Promise<string> {
        const result = await this.pool.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public';
        `);

        const schemaMap = result.rows.reduce((acc, row) => {
            if (!acc[row.table_name]) acc[row.table_name] = [];
            acc[row.table_name].push(`${row.column_name} ${row.data_type}`);
            return acc;
        }, {} as Record<string, string[]>);

        return (Object.entries(schemaMap) as [string, string[]][])
            .map(([table, columns]) => `TABLE ${table} (\n  ${columns.join(',\n  ')}\n)`)
            .join('\n\n');
    }

    public async close(): Promise<void> {
        await Promise.all([
            this.pool.end(),
            this.readOnlyPool.end()
        ]);
    }
}

// Export singleton
export const postgresDb = new PostgresService();
