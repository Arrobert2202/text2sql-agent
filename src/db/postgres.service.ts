import { Pool } from 'pg';
import { DatabaseService } from './database.interface';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export class PostgresService implements DatabaseService {
    private pool: Pool;
    private readOnlyPool: Pool;

    constructor() {
        // Cloud PostgreSQL (Neon, Supabase, Railway, Render) SSL configuration
        const isProduction = process.env.NODE_ENV === 'production';
        const isCloudDb = env.DATABASE_URL.includes('supabase.com') ||
                          env.DATABASE_URL.includes('neon.tech') ||
                          env.DATABASE_URL.includes('sslmode=') ||
                          !env.DATABASE_URL.includes('localhost');
        const ssl = (isProduction || isCloudDb) ? { rejectUnauthorized: false } : undefined;

        this.pool = new Pool({
            connectionString: env.DATABASE_URL,
            ...(ssl && { ssl })
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
            ...(ssl && { ssl }),
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

        // 2b. Add Lemon Squeezy columns (additive migration — keeps stripe_* columns for existing data)
        try {
            await this.execute(`
                ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS ls_subscription_id TEXT;
                ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS ls_subscription_item_id TEXT;
                ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS ls_customer_id TEXT;
            `);
        } catch (e) {
            logger.warn({ err: e }, 'LS column migration warning');
        }

        // Gracefully add column for existing document_chunks table
        try {
            await this.execute(`ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default_tenant';`);
        } catch (e) {}

        // 3. Create governed_metrics table (Context Hub)
        try {
            await this.execute(`
                CREATE TABLE IF NOT EXISTS governed_metrics (
                    id SERIAL PRIMARY KEY,
                    tenant_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    sql_formula TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_governed_metrics_tenant ON governed_metrics(tenant_id);
            `);
        } catch (e) {
            logger.warn({ err: e }, 'governed_metrics table creation warning');
        }

        // 4. Create RevOps demo tables for the demo sandbox
        try {
            await this.execute(`
                CREATE TABLE IF NOT EXISTS pipeline_stages (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    display_order INTEGER NOT NULL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS sales_reps (
                    id SERIAL PRIMARY KEY,
                    tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
                    name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    region TEXT NOT NULL,
                    quota_usd INTEGER NOT NULL DEFAULT 0,
                    hired_at DATE NOT NULL
                );

                CREATE TABLE IF NOT EXISTS accounts (
                    id SERIAL PRIMARY KEY,
                    tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
                    name TEXT NOT NULL,
                    industry TEXT NOT NULL,
                    arr_usd INTEGER NOT NULL DEFAULT 0,
                    health_score INTEGER NOT NULL DEFAULT 80,
                    csm_owner TEXT,
                    created_at DATE NOT NULL
                );

                CREATE TABLE IF NOT EXISTS deals (
                    id SERIAL PRIMARY KEY,
                    tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
                    title TEXT NOT NULL,
                    deal_value INTEGER NOT NULL,
                    status TEXT NOT NULL DEFAULT 'open',
                    stage_id INTEGER REFERENCES pipeline_stages(id),
                    sales_rep_id INTEGER REFERENCES sales_reps(id),
                    account_id INTEGER REFERENCES accounts(id),
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    closed_date TIMESTAMPTZ
                );
            `);
        } catch (e) {
            logger.warn({ err: e }, 'RevOps demo tables creation warning');
        }

        // 5. Task 1: Provision dedicated, strictly READ ONLY PostgreSQL user/role
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
            const isProduction = process.env.NODE_ENV === 'production';
            const isCloudDb = env.DATABASE_URL.includes('supabase.com') ||
                              env.DATABASE_URL.includes('neon.tech') ||
                              env.DATABASE_URL.includes('sslmode=') ||
                              !env.DATABASE_URL.includes('localhost');
            const ssl = (isProduction || isCloudDb) ? { rejectUnauthorized: false } : undefined;
            this.readOnlyPool = new Pool({
                connectionString: env.DATABASE_URL,
                ...(ssl && { ssl }),
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

        // 6. Populate with test data if tables are empty (customers)
        const check = await this.query('SELECT count(*) as count FROM customers');
        const count = parseInt(String(check[0].count), 10);
        
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

        // 7. Seed demo RevOps data if deals table is empty
        await this.seedDemoRevOpsData();
    }

    /**
     * Seeds ~30 realistic B2B SaaS RevOps rows across pipeline_stages, sales_reps, accounts, deals.
     * Also seeds 3 default governed_metrics for 'default_tenant'.
     * Idempotent — checks count before inserting.
     */
    private async seedDemoRevOpsData(): Promise<void> {
        try {
            const dealsCheck = await this.query('SELECT count(*) as count FROM deals');
            if (parseInt(String(dealsCheck[0].count), 10) > 0) return;

            logger.info('Seeding demo RevOps data...');

            // Pipeline stages
            await this.execute(`
                INSERT INTO pipeline_stages (name, display_order) VALUES
                    ('Prospecting', 1),
                    ('Qualification', 2),
                    ('Demo', 3),
                    ('Proposal', 4),
                    ('Negotiation', 5),
                    ('Closed Won', 6),
                    ('Closed Lost', 7)
                ON CONFLICT DO NOTHING;
            `);

            // Sales reps
            await this.execute(`
                INSERT INTO sales_reps (tenant_id, name, email, region, quota_usd, hired_at) VALUES
                    ('default_tenant', 'Alice Chen',    'alice@databot.ai',   'AMER', 800000, '2022-01-15'),
                    ('default_tenant', 'Bob Martinez',  'bob@databot.ai',     'EMEA', 650000, '2022-06-01'),
                    ('default_tenant', 'Carol Kim',     'carol@databot.ai',   'APAC', 500000, '2023-03-10'),
                    ('default_tenant', 'David Osei',    'david@databot.ai',   'AMER', 750000, '2021-11-20'),
                    ('default_tenant', 'Eva Petrov',    'eva@databot.ai',     'EMEA', 600000, '2023-07-05')
                ON CONFLICT DO NOTHING;
            `);

            // Accounts
            await this.execute(`
                INSERT INTO accounts (tenant_id, name, industry, arr_usd, health_score, csm_owner, created_at) VALUES
                    ('default_tenant', 'Acme Corp',          'Manufacturing',    120000, 92, 'alice@databot.ai',  '2022-03-01'),
                    ('default_tenant', 'Globex Ltd',         'Finance',          240000, 78, 'bob@databot.ai',    '2022-07-15'),
                    ('default_tenant', 'Initech Solutions',  'Software',          85000, 65, 'carol@databot.ai',  '2023-01-20'),
                    ('default_tenant', 'Umbrella Inc',       'Healthcare',       310000, 88, 'david@databot.ai',  '2021-12-10'),
                    ('default_tenant', 'Massive Dynamic',    'Technology',       175000, 95, 'eva@databot.ai',    '2022-10-05'),
                    ('default_tenant', 'Cyberdyne Systems',  'Defense',           55000, 42, 'alice@databot.ai',  '2023-04-18'),
                    ('default_tenant', 'Soylent Corp',       'Food & Beverage',   30000, 71, 'bob@databot.ai',    '2023-09-01')
                ON CONFLICT DO NOTHING;
            `);

            // Deals — mix of open/closed_won/closed_lost
            await this.execute(`
                INSERT INTO deals (tenant_id, title, deal_value, status, stage_id, sales_rep_id, account_id, created_at, closed_date) VALUES
                    ('default_tenant', 'Acme - Annual License Renewal',        120000, 'closed_won',  6, 1, 1, NOW() - INTERVAL '180 days', NOW() - INTERVAL '30 days'),
                    ('default_tenant', 'Globex - Enterprise Expansion',        240000, 'closed_won',  6, 2, 2, NOW() - INTERVAL '150 days', NOW() - INTERVAL '20 days'),
                    ('default_tenant', 'Initech - Starter Pack',                25000, 'closed_won',  6, 3, 3, NOW() - INTERVAL '90 days',  NOW() - INTERVAL '10 days'),
                    ('default_tenant', 'Umbrella - Platform Upsell',           180000, 'closed_won',  6, 4, 4, NOW() - INTERVAL '200 days', NOW() - INTERVAL '60 days'),
                    ('default_tenant', 'Massive Dynamic - New Logo',           175000, 'closed_won',  6, 5, 5, NOW() - INTERVAL '120 days', NOW() - INTERVAL '15 days'),
                    ('default_tenant', 'Cyberdyne - POC Conversion',            55000, 'closed_lost', 7, 1, 6, NOW() - INTERVAL '80 days',  NOW() - INTERVAL '5 days'),
                    ('default_tenant', 'Soylent - Pilot Deal',                  30000, 'closed_lost', 7, 2, 7, NOW() - INTERVAL '60 days',  NOW() - INTERVAL '2 days'),
                    ('default_tenant', 'Acme - Professional Services',          45000, 'open',        4, 1, 1, NOW() - INTERVAL '30 days',  NULL),
                    ('default_tenant', 'Globex - Security Add-on',              80000, 'open',        3, 2, 2, NOW() - INTERVAL '25 days',  NULL),
                    ('default_tenant', 'Initech - Team Seats Expansion',        60000, 'open',        5, 3, 3, NOW() - INTERVAL '45 days',  NULL),
                    ('default_tenant', 'Umbrella - EMEA Expansion',            200000, 'open',        2, 4, 4, NOW() - INTERVAL '10 days',  NULL),
                    ('default_tenant', 'Massive Dynamic - API Access',          90000, 'open',        4, 5, 5, NOW() - INTERVAL '20 days',  NULL),
                    ('default_tenant', 'New Prospect - Startup A',              15000, 'open',        1, 1, 1, NOW() - INTERVAL '5 days',   NULL),
                    ('default_tenant', 'New Prospect - Startup B',              22000, 'open',        1, 2, 2, NOW() - INTERVAL '3 days',   NULL),
                    ('default_tenant', 'New Prospect - Enterprise C',          320000, 'open',        2, 4, 4, NOW() - INTERVAL '7 days',   NULL)
                ON CONFLICT DO NOTHING;
            `);

            logger.info('Demo RevOps data seeded successfully.');
        } catch (err) {
            logger.warn({ err }, 'Failed to seed demo RevOps data — may already exist');
        }

        // Seed default governed_metrics for 'default_tenant' if none exist
        try {
            const metricsCheck = await this.query(
                `SELECT count(*) as count FROM governed_metrics WHERE tenant_id = 'default_tenant'`
            );
            if (parseInt(String(metricsCheck[0].count), 10) === 0) {
                logger.info('Seeding default governed_metrics for default_tenant...');
                await this.execute(`
                    INSERT INTO governed_metrics (tenant_id, name, description, sql_formula) VALUES
                    (
                        'default_tenant',
                        'Net Win Rate',
                        'Percentage of closed-won deals over all closed deals for this tenant.',
                        'SELECT COUNT(*) FILTER (WHERE status = ''closed_won'')::float / NULLIF(COUNT(*), 0) AS win_rate FROM deals WHERE tenant_id = ''default_tenant'' AND status IN (''closed_won'', ''closed_lost'')'
                    ),
                    (
                        'default_tenant',
                        'Sales Velocity',
                        'Average deal value and average sales cycle in days for closed-won deals.',
                        'SELECT ROUND(AVG(deal_value)) AS avg_deal_value, AVG(EXTRACT(DAY FROM closed_date - created_at)) AS avg_cycle_days FROM deals WHERE tenant_id = ''default_tenant'' AND status = ''closed_won'''
                    ),
                    (
                        'default_tenant',
                        'Average Deal Size',
                        'Mean deal value across all closed-won opportunities.',
                        'SELECT AVG(deal_value) AS avg_deal_size FROM deals WHERE tenant_id = ''default_tenant'' AND status = ''closed_won'''
                    )
                    ON CONFLICT DO NOTHING;
                `);
                logger.info('Default governed_metrics seeded.');
            }
        } catch (err) {
            logger.warn({ err }, 'Failed to seed governed_metrics — may already exist');
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
    public async query(query: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
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
    public async queryReadOnly(query: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
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
