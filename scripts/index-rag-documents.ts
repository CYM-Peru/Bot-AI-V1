/**
 * Script para indexar documentos RAG manualmente
 */

import path from 'path';
import { readFile, writeFile } from 'fs/promises';
import {
  loadEmbeddingsDatabase,
  processPDFDocument,
  saveEmbeddingsDatabase,
  type EmbeddingsDatabase
} from '../server/ai/rag-embeddings';

async function main() {
  try {
    console.log('[RAG Indexer] 🚀 Iniciando indexación manual de documentos...');

    // 1. Leer configuración del agente
    const configPath = path.join(process.cwd(), 'data', 'ia-agent-config.json');
    const configContent = await readFile(configPath, 'utf-8');
    const agentConfig = JSON.parse(configContent);

    // 2. Leer API key de OpenAI
    const aiConfigPath = path.join(process.cwd(), 'data', 'ai-config.json');
    const aiConfigContent = await readFile(aiConfigPath, 'utf-8');
    const aiConfig = JSON.parse(aiConfigContent);
    const openaiApiKey = aiConfig.openai?.apiKey;

    if (!openaiApiKey) {
      throw new Error('❌ No hay API key de OpenAI configurada');
    }
    console.log('[RAG Indexer] ✅ API key encontrada');

    const documents = agentConfig.integrations?.knowledgeBase?.documents || [];
    if (documents.length === 0) {
      console.log('[RAG Indexer] ⚠️  No hay documentos para indexar');
      return;
    }

    console.log(`[RAG Indexer] 📚 Encontrados ${documents.length} documentos`);

    // 3. Load or create embeddings database
    const dbPath = path.join(process.cwd(), 'data', 'embeddings-db.json');
    let database: EmbeddingsDatabase;
    try {
      database = await loadEmbeddingsDatabase(dbPath);
      console.log(`[RAG Indexer] 📖 Base de datos cargada: ${database.chunks.length} chunks existentes`);
    } catch {
      database = { chunks: [], version: '1.0.0', lastUpdated: new Date().toISOString() };
      console.log('[RAG Indexer] 📝 Creando nueva base de datos');
    }

    // 4. Index each document
    let indexed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const doc of documents) {
      try {
        // Check if already indexed
        const existingChunks = database.chunks.filter(c => c.metadata.source === doc.id);
        if (existingChunks.length > 0) {
          console.log(`[RAG Indexer] ⏭️  ${doc.name} ya está indexado (${existingChunks.length} chunks), saltando...`);
          skipped++;
          continue;
        }

        console.log(`\n[RAG Indexer] 🔄 Indexando: ${doc.name}`);
        console.log(`[RAG Indexer] 📍 Archivo: ${doc.url}`);

        const chunks = await processPDFDocument(doc.url, openaiApiKey, doc.id);
        database.chunks.push(...chunks);
        indexed++;

        console.log(`[RAG Indexer] ✅ ${doc.name} indexado: ${chunks.length} chunks creados`);
      } catch (error) {
        console.error(`[RAG Indexer] ❌ Error indexando ${doc.name}:`, error);
        errors.push(`${doc.name}: ${String(error)}`);
      }
    }

    // 5. Save database
    database.lastUpdated = new Date().toISOString();
    await saveEmbeddingsDatabase(database, dbPath);

    // 6. Report
    console.log('\n' + '='.repeat(60));
    console.log('[RAG Indexer] 📊 RESUMEN DE INDEXACIÓN:');
    console.log('='.repeat(60));
    console.log(`✅ Documentos indexados: ${indexed}`);
    console.log(`⏭️  Documentos saltados (ya indexados): ${skipped}`);
    console.log(`📦 Total de chunks en base de datos: ${database.chunks.length}`);

    if (errors.length > 0) {
      console.log(`\n❌ Errores (${errors.length}):`);
      errors.forEach(err => console.log(`   - ${err}`));
    }

    console.log('='.repeat(60));
    console.log('[RAG Indexer] ✅ Indexación completada!');
  } catch (error) {
    console.error('[RAG Indexer] ❌ Error fatal:', error);
    process.exit(1);
  }
}

main();
