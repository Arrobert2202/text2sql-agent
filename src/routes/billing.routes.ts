import { Router } from 'express';
import { BillingController } from '../controllers/billing.controller';

const router = Router();

/**
 * POST /api/billing/webhook
 * Lemon Squeezy webhook endpoint.
 * NOTE: Must be mounted BEFORE the global json() middleware so rawBody is preserved.
 */
router.post('/webhook', BillingController.handleWebhook);

export { router as billingRoutes };

