import { Request, Response } from 'express';
import { BillingService, verifyLemonSqueezySignature } from '../services/billing.service';
import { postgresDb } from '../db/postgres.service';
import { logger } from '../utils/logger';

const billingService = new BillingService(postgresDb);

export class BillingController {
    public static async handleWebhook(req: Request, res: Response): Promise<void> {
        const signature = req.headers['x-signature'];
        if (!signature || typeof signature !== 'string') {
            logger.warn('Lemon Squeezy webhook missing X-Signature header');
            res.status(400).json({ error: 'Missing X-Signature header' });
            return;
        }

        const rawBody: Buffer = (req as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body));

        if (!verifyLemonSqueezySignature(rawBody, signature)) {
            logger.warn('Lemon Squeezy webhook signature verification FAILED');
            res.status(401).json({ error: 'Invalid webhook signature' });
            return;
        }

        let payload: Record<string, unknown>;
        try {
            payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch {
            res.status(400).json({ error: 'Invalid JSON payload' });
            return;
        }

        const meta = payload.meta as Record<string, unknown> | undefined;
        const eventName = meta?.event_name as string | undefined;

        logger.info(`Received verified Lemon Squeezy webhook: ${eventName}`);

        try {
            switch (eventName) {
                case 'subscription_created':
                case 'subscription_updated':
                    await billingService.handleSubscriptionCreatedOrUpdated(payload);
                    break;

                case 'subscription_payment_success':
                    await billingService.handlePaymentSuccess(payload);
                    break;

                default:
                    logger.debug(`Unhandled Lemon Squeezy event: ${eventName}`);
                    break;
            }

            res.status(200).json({ received: true });
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.error({ err: error }, `Error processing Lemon Squeezy event ${eventName}: ${msg}`);
            res.status(500).json({ error: 'Internal processing error' });
        }
    }
}

