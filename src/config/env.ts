import { z } from 'zod';
import * as dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

const envSchema = z.object({
    PORT: z.string().default('3000').transform(Number),
    NODE_ENV: z.string().default('development'),
    FRONTEND_URL: z.string().optional(),
    OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
    SLACK_BOT_TOKEN: z.string().optional(),
    SLACK_CLIENT_ID: z.string().optional(),
    SLACK_CLIENT_SECRET: z.string().optional(),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    // Lemon Squeezy Merchant of Record
    LEMON_SQUEEZY_API_KEY: z.string().optional(),
    LEMON_SQUEEZY_WEBHOOK_SECRET: z.string().optional(),
    LEMON_SQUEEZY_STORE_ID: z.string().optional(),
    LEMON_SQUEEZY_VARIANT_ID: z.string().optional(),
    ENCRYPTION_KEY: z.string().default('default_32_byte_secret_key_revops_aes_gcm'),
    DB_READONLY_USER: z.string().default('databot_readonly'),
    DB_READONLY_PASSWORD: z.string().default('databot_readonly_pass_secure_2026'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
    logger.error({ err: _env.error.format() }, '❌ Invalid environment variables');
    process.exit(1);
}

export const env = _env.data;
