import { z } from 'zod';
import * as dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

const envSchema = z.object({
    PORT: z.string().transform(Number).default('3000'),
    OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
    SLACK_BOT_TOKEN: z.string().optional(), // Make optional so the server doesn't crash if it's missing initially
    SLACK_CLIENT_ID: z.string().optional(),
    SLACK_CLIENT_SECRET: z.string().optional(),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"), // e.g. postgres://user:pass@localhost:5432/dbname
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
    logger.error({ err: _env.error.format() }, '❌ Invalid environment variables');
    process.exit(1);
}

export const env = _env.data;
