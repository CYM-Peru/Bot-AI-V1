import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "blue",
};

// Tell winston about our colors
winston.addColors(colors);

// Determine log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || "development";
  const isDevelopment = env === "development";
  return isDevelopment ? "debug" : "info";
};

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}] ${message}`;

  // Add metadata if present
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  return msg;
});

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), "logs");

// Console transport (for development)
const consoleTransport = new winston.transports.Console({
  format: combine(
    colorize({ all: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    consoleFormat
  ),
});

// File transport for all logs
const fileTransport = new winston.transports.File({
  filename: path.join(logsDir, "combined.log"),
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json()
  ),
  maxsize: 5242880, // 5MB
  maxFiles: 5,
});

// File transport for error logs only
const errorFileTransport = new winston.transports.File({
  filename: path.join(logsDir, "error.log"),
  level: "error",
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json()
  ),
  maxsize: 5242880, // 5MB
  maxFiles: 5,
});

// Daily rotate file transport (for production)
const dailyRotateTransport = new DailyRotateFile({
  filename: path.join(logsDir, "application-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d", // Keep logs for 14 days
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json()
  ),
});

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  defaultMeta: { service: "bot-ai-v1" },
  transports: [
    consoleTransport,
    fileTransport,
    errorFileTransport,
  ],
  // Handle exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, "exceptions.log"),
      format: combine(
        timestamp(),
        errors({ stack: true }),
        json()
      ),
    }),
  ],
  // Handle promise rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, "rejections.log"),
      format: combine(
        timestamp(),
        errors({ stack: true }),
        json()
      ),
    }),
  ],
});

// Add daily rotation in production
if (process.env.NODE_ENV === "production") {
  logger.add(dailyRotateTransport);
}

// Create a stream object for Morgan HTTP logging
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Helper functions for common logging patterns
export const logRequest = (req: any, statusCode: number, responseTime: number) => {
  logger.http("HTTP Request", {
    method: req.method,
    url: req.url,
    statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });
};

export const logError = (message: string, error?: any, metadata?: any) => {
  logger.error(message, {
    error: error?.message || error,
    stack: error?.stack,
    ...metadata,
  });
};

export const logInfo = (message: string, metadata?: any) => {
  logger.info(message, metadata);
};

export const logWarn = (message: string, metadata?: any) => {
  logger.warn(message, metadata);
};

export const logDebug = (message: string, metadata?: any) => {
  logger.debug(message, metadata);
};

export default logger;
