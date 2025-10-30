/**
 * Custom Error Classes
 * Simple typed errors with HTTP status codes
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode?: string;

  constructor(message: string, statusCode: number = 500, errorCode?: string) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = "Bad request", errorCode?: string) {
    super(message, 400, errorCode || "bad_request");
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized", errorCode?: string) {
    super(message, 401, errorCode || "unauthorized");
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found", errorCode?: string) {
    super(message, 404, errorCode || "not_found");
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = "Internal server error", errorCode?: string) {
    super(message, 500, errorCode || "internal_error");
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}
