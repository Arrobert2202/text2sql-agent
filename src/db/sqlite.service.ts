import Database from 'better-sqlite3';
import { DatabaseService } from './database.interface';
import { logger } from '../utils/logger';

export class SqliteService implements DatabaseService {
    private db: Database.Database;

    constructor(dbPath: string = 'database.sqlite') {
        this.db = new Database(dbPath);
        this.setupDatabase();
    }

    private setupDatabase() {
        this.execute(`
            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                company TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL
            );
            CREATE TABLE IF NOT EXISTS auto_parts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                part_number TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                stock INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER NOT NULL,
                part_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                order_date DATE NOT NULL,
                FOREIGN KEY (customer_id) REFERENCES customers(id),
                FOREIGN KEY (part_id) REFERENCES auto_parts(id)
            );
        `);

        const check = this.db.prepare('SELECT count(*) as count FROM customers').get() as { count: number };
        if (check.count === 0) {
            logger.info("Populating the database with test data...");
            const insertCustomer = this.db.prepare('INSERT INTO customers (name, company, email) VALUES (?, ?, ?)');
            insertCustomer.run('Ion Popescu', 'Auto Serv SRL', 'ion@autoserv.ro');
            insertCustomer.run('Maria Ionescu', 'Logistica Trans', 'maria@logistica.ro');

            const insertPart = this.db.prepare('INSERT INTO auto_parts (part_number, name, price, stock) VALUES (?, ?, ?, ?)');
            insertPart.run('BOSCH-123', 'Plăcuțe frână', 150.50, 40);
            insertPart.run('VALEO-456', 'Filtru aer', 45.00, 120);

            const insertOrder = this.db.prepare('INSERT INTO orders (customer_id, part_id, quantity, order_date) VALUES (?, ?, ?, ?)');
            insertOrder.run(1, 1, 4, '2023-10-01');
            insertOrder.run(2, 2, 10, '2023-10-05');
        }
    }

    public execute(query: string): void { this.db.exec(query); }
    public query(query: string, params: any[] = []): any[] { return this.db.prepare(query).all(...params); }
    public getSchema(): string {
        const tables = this.db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all() as { sql: string }[];
        return tables.map(t => t.sql).join('\n\n');
    }
    public close(): void { this.db.close(); }
}
export const sqliteDb = new SqliteService();
