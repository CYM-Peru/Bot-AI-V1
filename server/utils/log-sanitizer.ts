/**
 * Utilities to sanitize sensitive data from logs
 * Prevents accidental logging of passwords, tokens, secrets, PII
 */

const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'apiKey',
  'api_key',
  'privateKey',
  'private_key',
  'authorization',
  'cookie',
  'session',
  'jwt',
  'bearer',
  'credentials',
];

const REDACTED = '[REDACTED]';

/**
 * Sanitizes an object by redacting sensitive fields
 * Works recursively on nested objects and arrays
 */
export function sanitizeForLogging(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  // Handle primitives
  if (typeof value !== 'object') {
    return value;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(item => sanitizeForLogging(item));
  }

  // Handle objects
  const sanitized: Record<string, any> = {};

  for (const [key, val] of Object.entries(value)) {
    const lowerKey = key.toLowerCase();

    // Check if key is sensitive
    const isSensitive = SENSITIVE_KEYS.some(sensitiveKey =>
      lowerKey.includes(sensitiveKey)
    );

    if (isSensitive) {
      sanitized[key] = REDACTED;
    } else if (typeof val === 'object' && val !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeForLogging(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

/**
 * Sanitizes error objects for logging
 * Preserves stack trace but redacts sensitive message content
 */
export function sanitizeError(error: any): any {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: sanitizeString(error.message),
      stack: error.stack, // Keep stack trace for debugging
      ...(error.cause ? { cause: sanitizeError(error.cause) } : {}),
    };
  }

  return sanitizeForLogging(error);
}

/**
 * Sanitizes a string by redacting tokens/keys that look like secrets
 * Looks for patterns like Bearer tokens, JWT tokens, API keys
 */
export function sanitizeString(str: string): string {
  if (typeof str !== 'string') {
    return str;
  }

  // Redact Bearer tokens
  str = str.replace(/Bearer\s+[A-Za-z0-9\-._~+\/]+=*/gi, 'Bearer [REDACTED]');

  // Redact JWT tokens (3 base64 segments separated by dots)
  str = str.replace(/[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, '[JWT-REDACTED]');

  // Redact API keys (long alphanumeric strings)
  str = str.replace(/\b[A-Za-z0-9]{32,}\b/g, '[KEY-REDACTED]');

  return str;
}

/**
 * Creates a sanitized logger wrapper
 * Use this instead of console.log for sensitive data
 */
export function createSafeLogger(requestId?: string) {
  const prefix = requestId ? `[${requestId}]` : '';

  return {
    info: (message: string, data?: any) => {
      console.log(`${prefix} ${message}`, data ? sanitizeForLogging(data) : '');
    },
    warn: (message: string, data?: any) => {
      console.warn(`${prefix} ${message}`, data ? sanitizeForLogging(data) : '');
    },
    error: (message: string, error?: any) => {
      console.error(`${prefix} ${message}`, error ? sanitizeError(error) : '');
    },
    debug: (message: string, data?: any) => {
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`${prefix} ${message}`, data ? sanitizeForLogging(data) : '');
      }
    },
  };
}
