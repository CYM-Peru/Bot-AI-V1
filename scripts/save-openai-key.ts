/**
 * Script to save OpenAI API key
 */

import fs from 'fs/promises';
import path from 'path';
import { encryptObject } from '../server/utils/encryption';

async function saveAPIKey(apiKey: string) {
  const AI_CONFIG_PATH = path.join(process.cwd(), 'data', 'ai-config.json');

  // Create config object
  const config = {
    openai: {
      apiKey: apiKey
    }
  };

  // Encrypt sensitive fields
  const encrypted = {
    openai: encryptObject(config.openai, ['apiKey'])
  };

  // Ensure directory exists
  await fs.mkdir(path.dirname(AI_CONFIG_PATH), { recursive: true });

  // Save
  await fs.writeFile(AI_CONFIG_PATH, JSON.stringify(encrypted, null, 2), 'utf-8');

  console.log('✅ API key guardada y encriptada correctamente');

  // Validate
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  if (response.ok) {
    const data = await response.json();
    console.log('✅ API key es VÁLIDA');
    console.log(`📊 ${data.data.length} modelos disponibles`);
  } else {
    const error = await response.json();
    console.log('❌ API key es INVÁLIDA');
    console.log('Error:', error.error?.message);
  }
}

const apiKey = process.argv[2];

if (!apiKey) {
  console.error('❌ Uso: npx tsx scripts/save-openai-key.ts <API_KEY>');
  process.exit(1);
}

saveAPIKey(apiKey);
