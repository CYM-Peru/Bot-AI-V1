import fs from "fs";
import path from "path";

const DEFAULT_ROOT = path.resolve(process.cwd(), "server");
const secretsRoot = process.env.BACKEND_SECRETS_DIR
  ? path.resolve(process.env.BACKEND_SECRETS_DIR)
  : path.join(DEFAULT_ROOT, ".secrets");
const dataRoot = process.env.BACKEND_DATA_DIR
  ? path.resolve(process.env.BACKEND_DATA_DIR)
  : path.join(DEFAULT_ROOT, ".data");
const logsRoot = process.env.LOGS_DIR
  ? path.resolve(process.env.LOGS_DIR)
  : path.join(process.cwd(), "logs");

function ensureDirSync(dirPath: string, mode: number) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true, mode });
    fs.chmodSync(dirPath, mode);
  } else {
    try {
      fs.chmodSync(dirPath, mode);
    } catch (error) {
      // ignore permission errors in environments that do not support chmod
    }
  }
}

export function ensureStorageSetup() {
  ensureDirSync(secretsRoot, 0o700);
  ensureDirSync(dataRoot, 0o700);
  ensureDirSync(logsRoot, 0o755); // Logs can be slightly more permissive
}

export function getSecretsPath(fileName: string) {
  return path.join(secretsRoot, fileName);
}

export function getDataPath(fileName: string) {
  return path.join(dataRoot, fileName);
}

export function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    return null;
  }
}

export function writeJsonFile(filePath: string, payload: unknown, mode: number = 0o600) {
  const dir = path.dirname(filePath);
  ensureDirSync(dir, 0o700);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), { encoding: "utf8", mode });
  try {
    fs.chmodSync(filePath, mode);
  } catch (error) {
    // ignore permission errors in environments that do not support chmod
  }
}
