import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root, overriding existing env vars
const envPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: envPath, override: true });
