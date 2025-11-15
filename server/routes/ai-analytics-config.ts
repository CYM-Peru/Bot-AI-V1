import { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { requireAdmin } from '../middleware/roles';

const router = Router();
const CONFIG_FILE = path.join(process.cwd(), 'data', 'ai-analytics-config.json');

interface AnalyticsConfig {
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  outputFormat: string;
}

const DEFAULT_CONFIG: AnalyticsConfig = {
  systemPrompt: `Eres un asistente que analiza conversaciones de servicio al cliente.
Analiza la siguiente conversación y proporciona:
1. Un resumen breve (máximo 2 frases)
2. El sentimiento general (positive, negative, o neutral)
3. Hasta 3 temas principales mencionados
4. Hasta 5 palabras clave relevantes

Responde SOLO en formato JSON con esta estructura exacta:
{
  "summary": "resumen aquí",
  "sentiment": "positive|negative|neutral",
  "topics": ["tema1", "tema2", "tema3"],
  "keywords": ["palabra1", "palabra2", "palabra3", "palabra4", "palabra5"]
}`,
  temperature: 0.3,
  maxTokens: 500,
  outputFormat: `{
  "summary": "string",
  "sentiment": "positive|negative|neutral",
  "topics": ["string"],
  "keywords": ["string"]
}`
};

// Ensure config file exists
async function ensureConfigFile() {
  try {
    await fs.access(CONFIG_FILE);
  } catch {
    // File doesn't exist, create with defaults
    await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
    await fs.writeFile(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
  }
}

// GET /api/ai-analytics-config
router.get('/', requireAdmin, async (req, res) => {
  try {
    await ensureConfigFile();
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(data);
    res.json(config);
  } catch (error) {
    console.error('[AI Analytics Config] Error reading config:', error);
    res.json(DEFAULT_CONFIG);
  }
});

// PUT /api/ai-analytics-config
router.put('/', requireAdmin, async (req, res) => {
  try {
    const { systemPrompt, temperature, maxTokens, outputFormat } = req.body;

    // Validate
    if (!systemPrompt || typeof systemPrompt !== 'string') {
      res.status(400).json({ error: 'invalid_prompt', message: 'System prompt is required' });
      return;
    }

    if (typeof temperature !== 'number' || temperature < 0 || temperature > 2) {
      res.status(400).json({ error: 'invalid_temperature', message: 'Temperature must be between 0 and 2' });
      return;
    }

    if (typeof maxTokens !== 'number' || maxTokens < 50 || maxTokens > 4000) {
      res.status(400).json({ error: 'invalid_max_tokens', message: 'Max tokens must be between 50 and 4000' });
      return;
    }

    const config: AnalyticsConfig = {
      systemPrompt,
      temperature,
      maxTokens,
      outputFormat: outputFormat || DEFAULT_CONFIG.outputFormat
    };

    await ensureConfigFile();
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));

    res.json({ success: true, config });
  } catch (error) {
    console.error('[AI Analytics Config] Error saving config:', error);
    res.status(500).json({
      error: 'server_error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/ai-analytics-config/reset
router.post('/reset', requireAdmin, async (req, res) => {
  try {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    res.json({ success: true, config: DEFAULT_CONFIG });
  } catch (error) {
    console.error('[AI Analytics Config] Error resetting config:', error);
    res.status(500).json({
      error: 'server_error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
