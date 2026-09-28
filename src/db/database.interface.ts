export interface DatabaseService {
    /**
     * Executes a raw query that doesn't return data (e.g. schema creation).
     */
    execute(query: string): void | Promise<void>;

    /**
     * Executes a safe query and returns the rows.
     */
    query(query: string, params?: any[]): any[] | Promise<any[]>;

    /**
     * Retrieves the database schema formatted as a string for the LLM.
     */
    getSchema(): string | Promise<string>;

    /**
     * Closes the database connection.
     */
    close(): void | Promise<void>;
}
