/**
 * File logger - Now powered by Winston
 * This file maintains backward compatibility while using structured logging
 */
import logger, { logDebug as winstonLogDebug, logError as winstonLogError } from "./logger";

/**
 * Log debug messages
 * @param message - The message to log
 * @param args - Additional arguments to log as metadata
 */
export function logDebug(message: string, ...args: unknown[]): void {
  if (args.length > 0) {
    winstonLogDebug(message, { data: args });
  } else {
    winstonLogDebug(message);
  }
}

/**
 * Log error messages
 * @param message - The error message
 * @param error - The error object or additional data
 */
export function logError(message: string, error?: unknown): void {
  winstonLogError(message, error);
}

/**
 * Log info messages
 * @param message - The message to log
 * @param metadata - Additional metadata
 */
export function logInfo(message: string, metadata?: any): void {
  logger.info(message, metadata);
}

/**
 * Log warning messages
 * @param message - The message to log
 * @param metadata - Additional metadata
 */
export function logWarn(message: string, metadata?: any): void {
  logger.warn(message, metadata);
}
