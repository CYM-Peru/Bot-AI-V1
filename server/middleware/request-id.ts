import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Extend Express Request type to include requestId
declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

/**
 * Middleware to add unique request ID to each request
 * Adds X-Request-ID header to response for client-side correlation
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Generate unique ID for this request
  req.id = randomUUID();

  // Add to response headers so client can correlate logs
  res.setHeader('X-Request-ID', req.id);

  next();
}
