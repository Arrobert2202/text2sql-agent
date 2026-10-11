import { Router, raw } from 'express';
import { StripeController } from '../controllers/stripe.controller';

const router = Router();

// Stripe signature verification requires raw body buffer
router.post('/webhook', raw({ type: 'application/json' }), StripeController.handleWebhook);

export { router as stripeRoutes };
