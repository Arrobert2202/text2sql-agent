import { DatabaseService } from '../db/database.interface';
import { logger } from '../utils/logger';

export class WorkspaceService {
    private dbService: DatabaseService;

    constructor(dbService: DatabaseService) {
        this.dbService = dbService;
    }

    /**
     * Registers or updates a workspace in the database.
     * Called during the Slack OAuth installation flow.
     * @param tenantId The Slack Workspace ID (e.g., T123456)
     * @param teamName The name of the Slack Workspace
     */
    public async upsertWorkspace(tenantId: string, teamName: string): Promise<void> {
        try {
            const query = `
                INSERT INTO workspaces (tenant_id, team_name) 
                VALUES ($1, $2)
                ON CONFLICT (tenant_id) 
                DO UPDATE SET team_name = EXCLUDED.team_name;
            `;
            await this.dbService.query(query, [tenantId, teamName]);
        } catch (error) {
            logger.error({ err: error }, `Failed to upsert workspace ${tenantId}`);
        }
    }

    /**
     * Retrieves the SaaS subscription status of a workspace.
     * Used as a security gate before processing any AI requests.
     * @param tenantId The Slack Workspace ID
     * @returns The subscription status (e.g., 'free_trial', 'active', 'inactive')
     */
    public async getWorkspaceStatus(tenantId: string): Promise<string> {
        try {
            const query = `SELECT subscription_status FROM workspaces WHERE tenant_id = $1`;
            const result = await this.dbService.query(query, [tenantId]);
            if (result && result.length > 0) {
                return result[0].subscription_status;
            }
            // If it doesn't exist, we can assume it's a new or unknown tenant, default to free_trial
            return 'free_trial';
        } catch (error) {
            logger.error({ err: error }, `Failed to get status for workspace ${tenantId}`);
            return 'inactive'; // fail securely
        }
    }
}
