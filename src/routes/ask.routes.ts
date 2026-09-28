import { Router } from 'express';
import { AskController } from '../controllers/ask.controller';

const router = Router();
router.post('/ask', AskController.ask);
export { router as askRoutes };
