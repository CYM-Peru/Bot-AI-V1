/**
 * Script to index PDFs and create embeddings database
 * Run with: npx tsx server/ai/scripts/index-pdfs.ts
 */

import path from 'path';
import { processPDFDocument, saveEmbeddingsDatabase, loadEmbeddingsDatabase, type EmbeddingsDatabase } from '../rag-embeddings';
import { readAIConfig } from '../../routes/ai-config';
import { readConfig as readAgentConfig } from '../../routes/ia-agent-config';

async function main() {
  console.log('='.repeat(60));
  console.log('📚 Indexando PDFs para RAG con OpenAI Embeddings');
  console.log('='.repeat(60));

  // Load OpenAI API key from command line or AI config
  let openaiApiKey = process.argv[2];

  if (!openaiApiKey) {
    // Try to load from config
    const aiConfig = await readAIConfig();
    openaiApiKey = aiConfig?.openai?.apiKey;

    if (!openaiApiKey) {
      console.error('❌ Error: No se encontró API key de OpenAI');
      console.error('   Use: npx tsx server/ai/scripts/index-pdfs.ts <API_KEY>');
      console.error('   O configure OpenAI en: Configuración → Inteligencia Artificial');
      process.exit(1);
    }
  }

  console.log('✅ API key de OpenAI encontrada');

  // Load agent config to get knowledge base documents
  const agentConfig = await readAgentConfig();
  const documents = agentConfig?.integrations?.knowledgeBase?.documents || [];

  if (documents.length === 0) {
    console.error('❌ Error: No hay documentos en la base de conocimiento');
    console.error('   Agregue documentos en ia-agent-config.json');
    process.exit(1);
  }

  console.log(`📄 Encontrados ${documents.length} documentos para indexar`);

  // Load or create embeddings database
  const dbPath = path.join(process.cwd(), 'data', 'embeddings-db.json');
  let database: EmbeddingsDatabase = await loadEmbeddingsDatabase(dbPath);

  // Process each document
  for (const doc of documents) {
    console.log(`\n📖 Procesando: ${doc.name}`);
    console.log(`   Ruta: ${doc.url}`);

    try {
      // Check if already indexed (by comparing chunk count)
      const existingChunks = database.chunks.filter(c => c.metadata.source === doc.id);
      if (existingChunks.length > 0) {
        console.log(`⏭️  Ya indexado (${existingChunks.length} chunks). Saltando...`);
        continue;
      }

      // Process PDF and create embeddings
      const chunks = await processPDFDocument(doc.url, openaiApiKey, doc.id);

      // Add to database
      database.chunks.push(...chunks);

      console.log(`✅ Indexado exitosamente: ${chunks.length} chunks`);

    } catch (error) {
      console.error(`❌ Error procesando ${doc.name}:`, error);
    }
  }

  // Update metadata
  database.lastUpdated = new Date().toISOString();

  // Save database
  await saveEmbeddingsDatabase(database, dbPath);

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Indexación completa`);
  console.log(`📊 Total chunks: ${database.chunks.length}`);
  console.log(`💾 Base de datos guardada en: ${dbPath}`);
  console.log('='.repeat(60));

  // Calculate approximate cost
  const totalTokens = database.chunks.reduce((sum, chunk) => sum + (chunk.content.length / 4), 0);
  const cost = (totalTokens / 1_000_000) * 0.02; // $0.02 per 1M tokens
  console.log(`\n💰 Costo aproximado: $${cost.toFixed(4)} USD`);
}

main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
