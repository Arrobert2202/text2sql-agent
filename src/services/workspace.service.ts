import Stripe from 'stripe';
import { DatabaseService } from '../db/database.interface';
import { logger } from '../utils/logger';
import { encrypt, decrypt } from '../utils/crypto';
import { env } from '../config/env';

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

export interface TenantDbConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password?: string;
    ssl?: boolean;
}

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
            return 'free_trial';
        } catch (error) {
            logger.error({ err: error }, `Failed to get status for workspace ${tenantId}`);
            return 'inactive'; // fail securely
        }
    }

    /**
     * Updates subscription status and optional Stripe Customer ID by Tenant ID.
     */
    public async updateSubscriptionStatus(tenantId: string, status: string, stripeCustomerId?: string): Promise<void> {
        try {
            if (stripeCustomerId) {
                const query = `
                    UPDATE workspaces
                    SET subscription_status = $1, stripe_customer_id = $2
                    WHERE tenant_id = $3;
                `;
                await this.dbService.query(query, [status, stripeCustomerId, tenantId]);
            } else {
                const query = `
                    UPDATE workspaces
                    SET subscription_status = $1
                    WHERE tenant_id = $2;
                `;
                await this.dbService.query(query, [status, tenantId]);
            }
            logger.info(`Updated workspace ${tenantId} subscription status to "${status}"`);
        } catch (error) {
            logger.error({ err: error }, `Failed to update subscription status for tenant ${tenantId}`);
            throw error;
        }
    }

    /**
     * Updates subscription status matching Stripe customer ID from incoming webhooks.
     */
    public async updateSubscriptionByCustomerId(stripeCustomerId: string, status: string): Promise<void> {
        try {
            const query = `
                UPDATE workspaces
                SET subscription_status = $1
                WHERE stripe_customer_id = $2;
            `;
            await this.dbService.query(query, [status, stripeCustomerId]);
            logger.info(`Updated workspace with stripe_customer_id ${stripeCustomerId} to "${status}"`);
        } catch (error) {
            logger.error({ err: error }, `Failed to update subscription by Stripe Customer ID ${stripeCustomerId}`);
            throw error;
        }
    }

    /**
     * Saves the Stripe subscription item ID used for metered overage billing.
     */
    public async setSubscriptionItemByCustomer(stripeCustomerId: string, subscriptionItemId: string): Promise<void> {
        try {
            const query = `
                UPDATE workspaces
                SET stripe_subscription_item_id = $1
                WHERE stripe_customer_id = $2;
            `;
            await this.dbService.query(query, [subscriptionItemId, stripeCustomerId]);
            logger.info(`Attached stripe_subscription_item_id ${subscriptionItemId} for customer ${stripeCustomerId}`);
        } catch (error) {
            logger.error({ err: error }, `Failed to set subscription item for customer ${stripeCustomerId}`);
        }
    }

    /**
     * Increments the query counter for the workspace.
     * Base subscription includes 200 queries. Any query beyond 200 reports
     * metered overage to Stripe in real-time.
     */
    public async recordQueryUsage(tenantId: string): Promise<number> {
        try {
            const query = `
                UPDATE workspaces
                SET current_period_queries = current_period_queries + 1
                WHERE tenant_id = $1
                RETURNING current_period_queries, stripe_customer_id, stripe_subscription_item_id;
            `;
            const rows = await this.dbService.query(query, [tenantId]);
            if (!rows || rows.length === 0) return 0;

            const currentQueries = rows[0].current_period_queries as number;
            const stripeCustomerId = rows[0].stripe_customer_id as string | null;
            const subscriptionItemId = rows[0].stripe_subscription_item_id as string | null;

            logger.info(`Tenant ${tenantId} executed query #${currentQueries} this billing period.`);

            // Hybrid overage threshold: > 200 queries ($10 per 100 extra queries)
            if (currentQueries > 200 && stripe) {
                try {
                    if (stripeCustomerId) {
                        await stripe.billing.meterEvents.create({
                            event_name: 'query_execution',
                            payload: {
                                stripe_customer_id: stripeCustomerId,
                                value: '1'
                            }
                        });
                        logger.info(`Reported 1 metered overage query via Stripe Meter Events for customer ${stripeCustomerId}`);
                    } else if (subscriptionItemId && (stripe.subscriptionItems as any).createUsageRecord) {
                        await (stripe.subscriptionItems as any).createUsageRecord(subscriptionItemId, {
                            quantity: 1,
                            timestamp: Math.floor(Date.now() / 1000),
                            action: 'increment'
                        });
                    }
                } catch (stripeErr) {
                    logger.error({ err: stripeErr }, `Failed to report Stripe metered overage for tenant ${tenantId}`);
                }
            }

            return currentQueries;
        } catch (error) {
            logger.error({ err: error }, `Failed to record query usage for tenant ${tenantId}`);
            return 0;
        }
    }

    /**
     * Resets the period query count to 0 when a new billing cycle invoice is generated.
     */
    public async resetQueryUsageByCustomer(stripeCustomerId: string): Promise<void> {
        try {
            const query = `
                UPDATE workspaces
                SET current_period_queries = 0
                WHERE stripe_customer_id = $1;
            `;
            await this.dbService.query(query, [stripeCustomerId]);
            logger.info(`Reset current_period_queries to 0 for Stripe customer ${stripeCustomerId}`);
        } catch (error) {
            logger.error({ err: error }, `Failed to reset query usage for Stripe customer ${stripeCustomerId}`);
        }
    }

    /**
     * Saves encrypted database connection credentials for a tenant's external RevOps database.
     */
    public async saveTenantDbConfig(tenantId: string, config: TenantDbConfig): Promise<void> {
        try {
            const encryptedPassword = config.password ? encrypt(config.password) : null;
            const query = `
                UPDATE workspaces
                SET db_host = $1, db_port = $2, db_name = $3, db_user = $4, db_encrypted_password = $5, db_ssl = $6
                WHERE tenant_id = $7;
            `;
            await this.dbService.query(query, [
                config.host,
                config.port || 5432,
                config.database,
                config.user,
                encryptedPassword,
                config.ssl ?? true,
                tenantId
            ]);
            logger.info(`Saved external database credentials for tenant: ${tenantId}`);
        } catch (error) {
            logger.error({ err: error }, `Failed to save external DB config for tenant ${tenantId}`);
            throw error;
        }
    }

    /**
     * Retrieves and decrypts the tenant's external RevOps database configuration.
     */
    public async getTenantDbConfig(tenantId: string): Promise<TenantDbConfig | null> {
        try {
            const query = `
                SELECT db_host, db_port, db_name, db_user, db_encrypted_password, db_ssl
                FROM workspaces
                WHERE tenant_id = $1;
            `;
            const rows = await this.dbService.query(query, [tenantId]);
            if (!rows || rows.length === 0) return null;

            const row = rows[0];
            if (!row.db_host || !row.db_name || !row.db_user) {
                return null;
            }

            const decryptedPassword = row.db_encrypted_password
                ? decrypt(row.db_encrypted_password)
                : undefined;

            return {
                host: row.db_host,
                port: row.db_port || 5432,
                database: row.db_name,
                user: row.db_user,
                password: decryptedPassword,
                ssl: row.db_ssl ?? true
            };
        } catch (error) {
            logger.error({ err: error }, `Failed to retrieve external DB config for tenant ${tenantId}`);
            return null;
        }
    }
}
