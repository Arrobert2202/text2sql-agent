import { Router, Request, Response } from 'express';
import { AIService } from '../services/ai.service';
import { postgresDb } from '../db/postgres.service';
import { logger } from '../utils/logger';

const router = Router();
const aiService = new AIService(postgresDb);

router.post('/messages', async (req: Request, res: Response) => {
    try {
        const { type, text, conversation, from } = req.body;

        // 1. Handle incoming message
        if (type === 'message' && text) {
            // Remove bot mentions from the text (usually formatted as <at>BotName</at>)
            const userText = text.replace(/<at>.*?<\/at>/gi, '').trim();
            
            logger.info(`[Teams] Received message with text: "${userText}"`);

            // Process the AI query
            const answer = await aiService.processQuestion(userText);

            // 2. Prepare the Microsoft Bot Framework response payload structure
            const replyPayload = {
                type: 'message',
                text: answer,
                replyToId: req.body.id,
                conversation: { id: conversation?.id },
                recipient: { id: from?.id, name: from?.name }
            };

            logger.info({ teamsPayload: replyPayload }, '[Teams] Response payload prepared');

            // Send the response payload directly back (Teams supports synchronous bot replies)
            return res.status(200).json(replyPayload);
        }

        res.status(200).send();
    } catch (error) {
        logger.error({ err: error }, 'Teams Message Error');
        res.status(500).send('Internal Server Error');
    }
});

export { router as teamsRoutes };
