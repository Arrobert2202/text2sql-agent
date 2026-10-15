import { createHmac, timingSafeEqual } from 'crypto';
import { DatabaseService } from '../db/database.interface';
import { logger } from '../utils/logger';
import { env } from '../config/env';

/**
 * Verifies a Lemon Squeezy webhook signature using HMAC-SHA256.
 * LS signs the raw body with the webhook secret and sends it as `X-Signature`.
 */
export function verifyLemonSqueezySignature(rawBody: Buffer | string, signature: string): boolean {
    if (!env.LEMON_SQUEEZY_WEBHOOK_SECRET) {
        logger.warn('LEMON_SQUEEZY_WEBHOOK_SECRET is not set — skipping signature verification (dev mode)');
        return true;
    }
    const hmac = createHmac('sha256', env.LEMON_SQUEEZY_WEBHOOK_SECRET);
    hmac.update(rawBody);
    const expected = hmac.digest('hex');
    try {
        return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
    } catch {
        return false;
    }
}

/**
 * Reports a single metered overage query to Lemon Squeezy's usage-records API.
 * Called when current_period_queries > 200.
 */
export async function reportMeteredUsageToLemonSqueezy(subscriptionItemId: string): Promise<void> {
    if (!env.LEMON_SQUEEZY_API_KEY) {
        logger.warn('LEMON_SQUEEZY_API_KEY not set — skipping metered overage report');
        return;
    }
    const body = JSON.stringify({
        data: {
            type: 'usage-records',
            attributes: {
                quantity: 1,
                action: 'increment',
            },
            relationships: {
                subscription_item: {
                    data: {
                        type: 'subscription-items',
                        id: subscriptionItemId,
                    },
                },
            },
        },
    });

    const response = await fetch('https://api.lemonsqueezy.com/v1/usage-records', {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json',
            'Authorization': `Bearer ${env.LEMON_SQUEEZY_API_KEY}`,
        },
        body,
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`LS usage-records API error ${response.status}: ${text}`);
    }
    logger.info(`Reported 1 metered overage query to Lemon Squeezy for subscription item ${subscriptionItemId}`);
}

export class BillingService {
    constructor(private dbService: DatabaseService) {}

    /**
     * Handles `subscription_created` and `subscription_updated` events.
     * Stores LS subscription IDs and updates workspace subscription status.
     */
    async handleSubscriptionCreatedOrUpdated(payload: Record<string, unknown>): Promise<void> {
        const data = payload.data as Record<string, unknown> | undefined;
        if (!data) return;

        const attrs = data.attributes as Record<string, unknown> | undefined;
        const id = data.id as string | undefined;
        if (!attrs || !id) return;

        const tenantId = (attrs.first_subscription_item as Record<string, unknown> | undefined)?.price_id
            ? undefined
            : ((attrs.custom_data as Record<string, unknown> | undefined)?.tenant_id as string | undefined);

        const lsSubscriptionId = id;
        const subscriptionItemId = ((attrs.first_subscription_item as Record<string, unknown> | undefined)?.id as string | undefined);
        const rawStatus = attrs.status as string | undefined;

        let status = 'active';
        if (rawStatus === 'cancelled' || rawStatus === 'expired') {
            status = 'canceled';
        } else if (rawStatus === 'past_due' || rawStatus === 'unpaid') {
            status = 'past_due';
        } else if (rawStatus === 'on_trial') {
            status = 'free_trial';
        } else if (rawStatus === 'paused') {
            status = 'inactive';
        }

        logger.info(`LS subscription event: id=${lsSubscriptionId}, tenantId=${tenantId}, status=${status}`);

        if (tenantId) {
            await this.dbService.query(
                `UPDATE workspaces
                 SET subscription_status = $1,
                     ls_subscription_id = $2,
                     ls_subscription_item_id = $3
                 WHERE tenant_id = $4`,
                [status, lsSubscriptionId, subscriptionItemId ?? null, tenantId]
            );
        } else if (lsSubscriptionId) {
            // Fallback: match by LS subscription ID already stored
            await this.dbService.query(
                `UPDATE workspaces
                 SET subscription_status = $1,
                     ls_subscription_item_id = $2
                 WHERE ls_subscription_id = $3`,
                [status, subscriptionItemId ?? null, lsSubscriptionId]
            );
        }
    }

    /**
     * Handles `subscription_payment_success` — resets current_period_queries to 0.
     */
    async handlePaymentSuccess(payload: Record<string, unknown>): Promise<void> {
        const data = payload.data as Record<string, unknown> | undefined;
        if (!data) return;

        const attrs = data.attributes as Record<string, unknown> | undefined;
        const subscriptionId = (attrs?.subscription_id as string | undefined) ??
            ((data.relationships as Record<string, unknown> | undefined)
                ?.subscription as Record<string, unknown> | undefined)
                ?.data as string | undefined;

        if (!subscriptionId) {
            logger.warn('subscription_payment_success: could not extract subscription_id from payload');
            return;
        }

        await this.dbService.query(
            `UPDATE workspaces SET current_period_queries = 0 WHERE ls_subscription_id = $1`,
            [subscriptionId]
        );
        logger.info(`Reset current_period_queries to 0 for LS subscription ${subscriptionId}`);
    }
}

