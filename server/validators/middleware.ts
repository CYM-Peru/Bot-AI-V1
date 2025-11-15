/**
 * Validation middleware using Zod schemas
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Validates request body against a Zod schema
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        console.error('[Validation] Body validation failed:', errors);

        res.status(400).json({
          error: 'Validation failed',
          details: errors,
        });
        return;
      }

      console.error('[Validation] Unexpected error:', error);
      res.status(500).json({ error: 'Internal validation error' });
    }
  };
}

/**
 * Validates request params against a Zod schema
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.params);
      req.params = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        console.error('[Validation] Params validation failed:', errors);

        res.status(400).json({
          error: 'Invalid URL parameters',
          details: errors,
        });
        return;
      }

      console.error('[Validation] Unexpected error:', error);
      res.status(500).json({ error: 'Internal validation error' });
    }
  };
}

/**
 * Validates query parameters against a Zod schema
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        console.error('[Validation] Query validation failed:', errors);

        res.status(400).json({
          error: 'Invalid query parameters',
          details: errors,
        });
        return;
      }

      console.error('[Validation] Unexpected error:', error);
      res.status(500).json({ error: 'Internal validation error' });
    }
  };
}

/**
 * Sanitizes string inputs to prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove inline event handlers
    .trim();
}

/**
 * Validates and sanitizes text fields
 */
export function sanitizeBody(fields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const field of fields) {
      if (req.body[field] && typeof req.body[field] === 'string') {
        req.body[field] = sanitizeString(req.body[field]);
      }
    }
    next();
  };
}
