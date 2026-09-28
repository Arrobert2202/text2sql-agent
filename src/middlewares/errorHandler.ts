import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
    logger.error({ err, req: { method: req.method, url: req.url } }, 'Unhandled Exception');
    const status = err.status || 500;
    const message = status === 500 ? 'Internal Server Error' : (err.message || 'Eroare internă de server.');
    res.status(status).json({ success: false, error: message });
}
