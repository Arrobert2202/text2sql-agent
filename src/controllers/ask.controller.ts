import { Request, Response, NextFunction } from 'express';
import { AIService } from '../services/ai.service';
import { postgresDb } from '../db/postgres.service';

const aiService = new AIService(postgresDb);

export class AskController {
    static async ask(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { question, tenantId } = req.body;
            if (!question) { res.status(400).json({ error: "Te rog să trimiți o întrebare în câmpul 'question'." }); return; }
            const response = await aiService.processQuestion(tenantId || 'default_tenant', question);
            res.json({ answer: { text: response.text, chartUrl: response.chartUrl, isError: response.isError }, sql: response.sql });
        } catch (error) { next(error); }
    }
}
