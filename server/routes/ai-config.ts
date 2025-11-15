/**
 * AI Configuration API
 * Manage AI provider API keys
 */

import express from "express";
import fs from "fs/promises";
import path from "path";
import { encryptObject, decryptObject } from "../utils/encryption";

const router = express.Router();

const AI_CONFIG_PATH = path.join(process.cwd(), "data", "ai-config.json");

interface AIConfig {
  openai?: {
    apiKey: string;
    baseUrl?: string;
  };
  anthropic?: {
    apiKey: string;
    baseUrl?: string;
  };
  gemini?: {
    apiKey: string;
    baseUrl?: string;
  };
  ollama?: {
    baseUrl: string;
  };
}

async function readAIConfig(): Promise<AIConfig | null> {
  try {
    const data = await fs.readFile(AI_CONFIG_PATH, "utf-8");
    const encrypted = JSON.parse(data);

    // Decrypt sensitive fields
    const decrypted: AIConfig = {};

    if (encrypted.openai) {
      decrypted.openai = decryptObject(encrypted.openai, ["apiKey"]);
    }
    if (encrypted.anthropic) {
      decrypted.anthropic = decryptObject(encrypted.anthropic, ["apiKey"]);
    }
    if (encrypted.gemini) {
      decrypted.gemini = decryptObject(encrypted.gemini, ["apiKey"]);
    }
    if (encrypted.ollama) {
      decrypted.ollama = encrypted.ollama; // No encryption needed for base URL
    }

    return decrypted;
  } catch (error) {
    // File doesn't exist or is invalid, return empty config
    return null;
  }
}

async function writeAIConfig(config: AIConfig): Promise<void> {
  // Encrypt sensitive fields
  const encrypted: any = {};

  if (config.openai) {
    encrypted.openai = encryptObject(config.openai, ["apiKey"]);
  }
  if (config.anthropic) {
    encrypted.anthropic = encryptObject(config.anthropic, ["apiKey"]);
  }
  if (config.gemini) {
    encrypted.gemini = encryptObject(config.gemini, ["apiKey"]);
  }
  if (config.ollama) {
    encrypted.ollama = config.ollama; // No encryption needed
  }

  // Ensure data directory exists
  const dataDir = path.dirname(AI_CONFIG_PATH);
  await fs.mkdir(dataDir, { recursive: true });

  await fs.writeFile(AI_CONFIG_PATH, JSON.stringify(encrypted, null, 2), "utf-8");
}

// GET /api/ai-config - Get current AI configuration
router.get("/", async (req, res) => {
  try {
    const config = await readAIConfig();

    // Return masked version (only show if key exists, not the actual key)
    const masked: any = {
      openai: config?.openai ? {
        hasApiKey: !!config.openai.apiKey,
        baseUrl: config.openai.baseUrl || "https://api.openai.com/v1",
      } : { hasApiKey: false },
      anthropic: config?.anthropic ? {
        hasApiKey: !!config.anthropic.apiKey,
        baseUrl: config.anthropic.baseUrl || "https://api.anthropic.com/v1",
      } : { hasApiKey: false },
      gemini: config?.gemini ? {
        hasApiKey: !!config.gemini.apiKey,
        baseUrl: config.gemini.baseUrl || "https://generativelanguage.googleapis.com/v1beta",
      } : { hasApiKey: false },
      ollama: config?.ollama || {
        baseUrl: "http://localhost:11434",
      },
    };

    res.json(masked);
  } catch (error) {
    console.error("[AI Config] Error reading config:", error);
    res.status(500).json({ error: "Failed to read AI configuration" });
  }
});

// POST /api/ai-config - Update AI configuration
router.post("/", async (req, res) => {
  try {
    const { provider, apiKey, baseUrl } = req.body;

    if (!provider) {
      return res.status(400).json({ error: "Provider is required" });
    }

    // Read current config
    const currentConfig = await readAIConfig() || {};

    // Update the specific provider
    if (provider === "openai") {
      currentConfig.openai = {
        apiKey: apiKey || currentConfig.openai?.apiKey || "",
        baseUrl: baseUrl || currentConfig.openai?.baseUrl,
      };
    } else if (provider === "anthropic") {
      currentConfig.anthropic = {
        apiKey: apiKey || currentConfig.anthropic?.apiKey || "",
        baseUrl: baseUrl || currentConfig.anthropic?.baseUrl,
      };
    } else if (provider === "gemini") {
      currentConfig.gemini = {
        apiKey: apiKey || currentConfig.gemini?.apiKey || "",
        baseUrl: baseUrl || currentConfig.gemini?.baseUrl,
      };
    } else if (provider === "ollama") {
      currentConfig.ollama = {
        baseUrl: baseUrl || "http://localhost:11434",
      };
    } else {
      return res.status(400).json({ error: "Invalid provider" });
    }

    // Save updated config
    await writeAIConfig(currentConfig);

    res.json({ success: true, message: "AI configuration updated successfully" });
  } catch (error) {
    console.error("[AI Config] Error updating config:", error);
    res.status(500).json({ error: "Failed to update AI configuration" });
  }
});

// DELETE /api/ai-config/:provider - Delete API key for a provider
router.delete("/:provider", async (req, res) => {
  try {
    const { provider } = req.params;

    const currentConfig = await readAIConfig() || {};

    if (provider === "openai") {
      delete currentConfig.openai;
    } else if (provider === "anthropic") {
      delete currentConfig.anthropic;
    } else if (provider === "gemini") {
      delete currentConfig.gemini;
    } else if (provider === "ollama") {
      delete currentConfig.ollama;
    } else {
      return res.status(400).json({ error: "Invalid provider" });
    }

    await writeAIConfig(currentConfig);

    res.json({ success: true, message: "API key deleted successfully" });
  } catch (error) {
    console.error("[AI Config] Error deleting config:", error);
    res.status(500).json({ error: "Failed to delete API key" });
  }
});

export default router;
export { readAIConfig, writeAIConfig };
