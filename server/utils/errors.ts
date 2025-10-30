/**
 * Custom Error Classes
 * Provides typed errors with HTTP status codes for consistent error handling
 */

/**
 * Base Application Error
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode?: string;
  public readonly metadata?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode?: string,
    isOperational: boolean = true,
    metadata?: Record<string, any>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.metadata = metadata;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);

    // Set the prototype explicitly
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Bad Request Error (400)
 * Use when client sends invalid data
 */
export class BadRequestError extends AppError {
  constructor(message: string = "Bad request", errorCode?: string, metadata?: Record<string, any>) {
    super(message, 400, errorCode || "bad_request", true, metadata);
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

/**
 * Unauthorized Error (401)
 * Use when authentication is required or failed
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized", errorCode?: string, metadata?: Record<string, any>) {
    super(message, 401, errorCode || "unauthorized", true, metadata);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * Forbidden Error (403)
 * Use when user is authenticated but lacks permissions
 */
export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden", errorCode?: string, metadata?: Record<string, any>) {
    super(message, 403, errorCode || "forbidden", true, metadata);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * Not Found Error (404)
 * Use when a resource is not found
 */
export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found", errorCode?: string, metadata?: Record<string, any>) {
    super(message, 404, errorCode || "not_found", true, metadata);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Conflict Error (409)
 * Use when there's a conflict with current state (e.g., duplicate entry)
 */
export class ConflictError extends AppError {
  constructor(message: string = "Conflict", errorCode?: string, metadata?: Record<string, any>) {
    super(message, 409, errorCode || "conflict", true, metadata);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * Validation Error (422)
 * Use when request data fails validation
 */
export class ValidationError extends AppError {
  constructor(message: string = "Validation failed", errorCode?: string, metadata?: Record<string, any>) {
    super(message, 422, errorCode || "validation_error", true, metadata);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Too Many Requests Error (429)
 * Use when rate limit is exceeded
 */
export class TooManyRequestsError extends AppError {
  constructor(message: string = "Too many requests", errorCode?: string, metadata?: Record<string, any>) {
    super(message, 429, errorCode || "too_many_requests", true, metadata);
    Object.setPrototypeOf(this, TooManyRequestsError.prototype);
  }
}

/**
 * Internal Server Error (500)
 * Use for unexpected server errors
 */
export class InternalServerError extends AppError {
  constructor(
    message: string = "Internal server error",
    errorCode?: string,
    metadata?: Record<string, any>,
    isOperational: boolean = false
  ) {
    super(message, 500, errorCode || "internal_error", isOperational, metadata);
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}

/**
 * Service Unavailable Error (503)
 * Use when a service is temporarily unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = "Service unavailable", errorCode?: string, metadata?: Record<string, any>) {
    super(message, 503, errorCode || "service_unavailable", true, metadata);
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

/**
 * Check if an error is operational (expected) or programming error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}
