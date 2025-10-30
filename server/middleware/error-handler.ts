import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";

/**
 * Global error handler middleware
 * Catches all errors and formats them consistently
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // If headers already sent, delegate to default Express error handler
  if (res.headersSent) {
    return _next(err);
  }

  // Default to 500 if no status code
  let statusCode = 500;
  let errorCode = "internal_error";
  let message = "An unexpected error occurred";

  // Handle AppError instances
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode || errorCode;
    message = err.message;
  }

  // Log error to console (simple logging for now)
  console.error(`[ERROR] ${statusCode} - ${errorCode}: ${message}`, {
    path: req.path,
    method: req.method,
    error: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });

  // Build error response
  const errorResponse: any = {
    error: errorCode,
    message: message,
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === "development" && err.stack) {
    errorResponse.stack = err.stack;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
}

/**
 * Not Found handler - handles 404 errors
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  res.status(404).json({
    error: "not_found",
    message: `Cannot ${req.method} ${req.path}`,
  });
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors automatically
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
