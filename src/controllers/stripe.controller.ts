import { Request, Response } from 'express';
import Stripe from 'stripe';
import { env } from '../config/env';
import { WorkspaceService } from '../services/workspace.service';
import { postgresDb } from '../db/postgres.service';
import { logger } from '../utils/logger';

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
const workspaceService = new WorkspaceService(postgresDb);

export class StripeController {
    public static async handleWebhook(req: Request, res: Response): Promise<void> {
        if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
            logger.error('Stripe credentials or webhook secret not configured');
            res.status(500).json({ error: 'Stripe webhook is not configured on this server.' });
            return;
        }

        const sig = req.headers['stripe-signature'];
        if (!sig || typeof sig !== 'string') {
            logger.warn('Stripe webhook missing stripe-signature header');
            res.status(400).send('Webhook Error: Missing signature');
            return;
        }

        let event: Stripe.Event;

        try {
            // Must verify signature using raw body Buffer
            const rawBody = (req as any).rawBody || req.body;
            event = stripe.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
        } catch (err: any) {
            logger.error({ err }, `Stripe Webhook Signature Verification Failed: ${err.message}`);
            res.status(400).send('Webhook Error: Invalid signature');
            return;
        }

        logger.info(`Received verified Stripe webhook event: ${event.type}`);

        try {
            switch (event.type) {
                case 'checkout.session.completed': {
                    const session = event.data.object as Stripe.Checkout.Session;
                    const tenantId = session.client_reference_id || session.metadata?.tenant_id;
                    const stripeCustomerId = typeof session.customer === 'string' 
                        ? session.customer 
                        : session.customer?.id;

                    if (tenantId) {
                        logger.info(`Checkout completed for tenant: ${tenantId}, customer: ${stripeCustomerId}`);
                        await workspaceService.updateSubscriptionStatus(tenantId, 'active', stripeCustomerId);
                    } else if (stripeCustomerId) {
                        logger.warn(`No tenant_id metadata found on checkout session. Updating by customer ID ${stripeCustomerId}`);
                        await workspaceService.updateSubscriptionByCustomerId(stripeCustomerId, 'active');
                    }

                    // Extract and associate subscription item ID if available
                    if (stripeCustomerId && session.subscription && typeof session.subscription === 'string') {
                        try {
                            const sub = await stripe.subscriptions.retrieve(session.subscription);
                            if (sub.items?.data?.length > 0 && sub.items.data[0]?.id) {
                                await workspaceService.setSubscriptionItemByCustomer(stripeCustomerId, sub.items.data[0].id);
                            }
                        } catch (subErr) {
                            logger.warn({ err: subErr }, 'Failed to fetch subscription items during checkout completion');
                        }
                    }
                    break;
                }

                case 'customer.subscription.updated': {
                    const subscription = event.data.object as Stripe.Subscription;
                    const customerId = typeof subscription.customer === 'string'
                        ? subscription.customer
                        : subscription.customer.id;
                    
                    // Map Stripe subscription status to internal workspace status
                    let status = 'active';
                    if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
                        status = 'canceled';
                    } else if (subscription.status === 'past_due') {
                        status = 'past_due';
                    } else if (subscription.status === 'trialing') {
                        status = 'free_trial';
                    } else if (subscription.status === 'incomplete' || subscription.status === 'incomplete_expired') {
                        status = 'inactive';
                    }

                    logger.info(`Subscription updated for Stripe customer ${customerId} -> ${status} (raw: ${subscription.status})`);
                    await workspaceService.updateSubscriptionByCustomerId(customerId, status);

                    // Sync subscription item ID for metered billing
                    if (subscription.items?.data?.length > 0 && subscription.items.data[0]?.id) {
                        await workspaceService.setSubscriptionItemByCustomer(customerId, subscription.items.data[0].id);
                    }
                    break;
                }

                case 'customer.subscription.deleted': {
                    const subscription = event.data.object as Stripe.Subscription;
                    const customerId = typeof subscription.customer === 'string'
                        ? subscription.customer
                        : subscription.customer.id;

                    logger.info(`Subscription deleted for customer ${customerId} -> marking as canceled`);
                    await workspaceService.updateSubscriptionByCustomerId(customerId, 'canceled');
                    break;
                }

                case 'invoice.created':
                case 'invoice.payment_succeeded': {
                    // Reset query usage counter on new billing cycle
                    const invoice = event.data.object as Stripe.Invoice;
                    const customerId = typeof invoice.customer === 'string'
                        ? invoice.customer
                        : invoice.customer?.id;

                    if (customerId) {
                        logger.info(`New billing cycle invoice event (${event.type}) for customer ${customerId}. Resetting current_period_queries to 0.`);
                        await workspaceService.resetQueryUsageByCustomer(customerId);
                    }
                    break;
                }

                default:
                    logger.debug(`Unhandled Stripe event type: ${event.type}`);
                    break;
            }

            res.status(200).json({ received: true });
        } catch (error: any) {
            logger.error({ err: error }, `Error processing Stripe event ${event.type}`);
            res.status(500).json({ error: 'Internal processing error for Stripe event' });
        }
    }
}
