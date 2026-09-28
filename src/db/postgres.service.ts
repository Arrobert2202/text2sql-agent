import { Pool } from 'pg';
import { DatabaseService } from './database.interface';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export class PostgresService implements DatabaseService {
    private pool: Pool;

    constructor() {
        this.pool = new Pool({
            connectionString: env.DATABASE_URL
        });
        
        // Asynchronously setup database on start
        this.setupDatabase().catch(err => {
            logger.error({ err }, 'Failed to setup PostgreSQL database');
        });
    }

    private async setupDatabase() {
        // Create tables using PostgreSQL syntax
        await this.execute(`
            CREATE EXTENSION IF NOT EXISTS vector;
            
            CREATE TABLE IF NOT EXISTS workspaces (
                tenant_id TEXT PRIMARY KEY,
                team_name TEXT,
                stripe_customer_id TEXT,
                subscription_status TEXT DEFAULT 'free_trial',
                created_at TIMESTAMP DEFAULT NOW()
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
        `);

        // Gracefully add column for existing table
        try {
            await this.execute(`ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default_tenant';`);
        } catch (e) {}

        // Populate with test data if tables are empty
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
     * @param query The SQL query string
     */
    public async execute(query: string): Promise<void> {
        await this.pool.query(query);
    }

    /**
     * Executes a parameterized PostgreSQL query and returns the rows.
     * Useful for RAG vector search and generic SQL queries.
     * @param query The SQL query string
     * @param params Optional array of parameters to prevent SQL injection
     * @returns Array of database rows
     */
    public async query(query: string, params: any[] = []): Promise<any[]> {
        const result = await this.pool.query(query, params);
        return result.rows;
    }

    /**
     * Extracts the database schema (tables and columns) dynamically.
     * This schema is fed into the LLM to provide context for Text-to-SQL generation.
     * @returns A string representation of the schema
     */
    public async getSchema(): Promise<string> {
        // Fetch table schemas in PostgreSQL
        const result = await this.pool.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public';
        `);

        // Group by table
        const schemaMap = result.rows.reduce((acc, row) => {
            if (!acc[row.table_name]) acc[row.table_name] = [];
            acc[row.table_name].push(`${row.column_name} ${row.data_type}`);
            return acc;
        }, {} as Record<string, string[]>);

        return Object.entries(schemaMap)
            .map(([table, columns]) => `TABLE ${table} (\n  ${columns.join(',\n  ')}\n)`)
            .join('\n\n');
    }

    public async close(): Promise<void> {
        await this.pool.end();
    }
}

// Export singleton
export const postgresDb = new PostgresService();
