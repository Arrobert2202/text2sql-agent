import { app } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';

app.listen(env.PORT, () => {
    logger.info(`🚀 API Server is running on http://localhost:${env.PORT}`);
    logger.info(`Ready to receive POST requests at http://localhost:${env.PORT}/api/ask`);
});
