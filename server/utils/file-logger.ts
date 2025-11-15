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

/**
 * Formatea una fecha para mostrar en mensajes del sistema
 * @param timestamp - Timestamp en milisegundos (opcional, usa fecha actual si no se provee)
 * @returns Fecha formateada como "dd/mm/yyyy hh:mm"
 */
export function formatEventTimestamp(timestamp?: number): string {
  const date = timestamp ? new Date(timestamp) : new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
