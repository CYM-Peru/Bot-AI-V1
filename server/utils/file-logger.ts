import * as fs from "fs";
import * as path from "path";

const LOG_DIR = path.join(process.cwd(), "logs");
const DEBUG_LOG = path.join(LOG_DIR, "debug.log");

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

export function logDebug(message: string, ...args: unknown[]): void {
  const timestamp = formatTimestamp();
  const formattedMessage = `[${timestamp}] ${message} ${args.length > 0 ? JSON.stringify(args) : ""}\n`;

  // Write to file synchronously to ensure it's written immediately
  fs.appendFileSync(DEBUG_LOG, formattedMessage, "utf-8");

  // Also log to console (even if buffered, at least we have file)
  console.log(message, ...args);
}

export function logError(message: string, error?: unknown): void {
  const timestamp = formatTimestamp();
  const errorStr = error instanceof Error ? error.stack : JSON.stringify(error);
  const formattedMessage = `[${timestamp}] ERROR: ${message} ${errorStr || ""}\n`;

  fs.appendFileSync(DEBUG_LOG, formattedMessage, "utf-8");
  console.error(message, error);
}
