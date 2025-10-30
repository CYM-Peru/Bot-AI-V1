import { Request, Response, NextFunction } from "express";
import { AppError, isOperationalError } from "../utils/errors";
import { logError } from "../utils/file-logger";

/**
 * Error response interface
 */
interface ErrorResponse {
  error: string;
  message: string;
  details?: any;
  stack?: string;
}

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
  // Default to 500 if no status code
  let statusCode = 500;
  let errorCode = "internal_error";
  let message = "An unexpected error occurred";
  let metadata: Record<string, any> | undefined;

  // Handle AppError instances
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode || errorCode;
    message = err.message;
    metadata = err.metadata;
  }

  // Log the error with context
  logError(message, err, {
    statusCode,
    errorCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.userId,
    metadata,
  });

  // Build error response
  const errorResponse: ErrorResponse = {
    error: errorCode,
    message: message,
  };

  // Add metadata if present
  if (metadata) {
    errorResponse.details = metadata;
  }

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
 * Wraps async route handlers to catch errors and pass to error handler
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Handle unhandled promise rejections
 */
export function setupUnhandledRejectionHandler(): void {
  process.on("unhandledRejection", (reason: Error | any) => {
    throw reason;
  });
}

/**
 * Handle uncaught exceptions
 */
export function setupUncaughtExceptionHandler(): void {
  process.on("uncaughtException", (error: Error) => {
    logError("Uncaught Exception", error, {
      fatal: true,
    });

    // Check if error is operational
    if (!isOperationalError(error)) {
      // Non-operational errors (programming bugs) should crash the app
      process.exit(1);
    }
  });
}
