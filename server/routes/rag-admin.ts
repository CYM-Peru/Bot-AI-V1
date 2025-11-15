/**
 * RAG Administration Panel API Routes
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { readConfig as readAgentConfig, writeConfig as writeAgentConfig } from './ia-agent-config';
import { readAIConfig, writeAIConfig } from './ai-config';
import {
  loadEmbeddingsDatabase,
  processPDFDocument,
  saveEmbeddingsDatabase,
  type EmbeddingsDatabase
} from '../ai/rag-embeddings';

const router = express.Router();

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'data', 'knowledge-base');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

/**
 * GET /api/rag-admin/status
 * Get RAG system status
 */
router.get('/status', async (req, res) => {
  try {
    const agentConfig = await readAgentConfig();
    const aiConfig = await readAIConfig();

    const knowledgeBase = agentConfig?.integrations?.knowledgeBase;
    const hasApiKey = !!aiConfig?.openai?.apiKey;

    // Load embeddings database
    const dbPath = path.join(process.cwd(), 'data', 'embeddings-db.json');
    let database: EmbeddingsDatabase;
    try {
      database = await loadEmbeddingsDatabase(dbPath);
    } catch {
      database = { chunks: [], version: '1.0.0', lastUpdated: new Date().toISOString() };
    }

    res.json({
      enabled: knowledgeBase?.enabled || false,
      hasApiKey,
      documentsCount: knowledgeBase?.documents?.length || 0,
      documents: knowledgeBase?.documents || [],
      indexedChunks: database.chunks.length,
      lastIndexed: database.lastUpdated,
      dbPath
    });
  } catch (error) {
    console.error('[RAG Admin] Error getting status:', error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/rag-admin/validate-api-key
 * Validate OpenAI API key
 */
router.post('/validate-api-key', async (req, res) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ valid: false, error: 'API key requerida' });
    }

    // Test API key with OpenAI
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (response.ok) {
      res.json({ valid: true });
    } else {
      const error = await response.json();
      res.json({ valid: false, error: error.error?.message || 'API key inválida' });
    }
  } catch (error) {
    res.json({ valid: false, error: String(error) });
  }
});

/**
 * POST /api/rag-admin/save-api-key
 * Save OpenAI API key
 */
router.post('/save-api-key', async (req, res) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API key requerida' });
    }

    const aiConfig = await readAIConfig();
    if (!aiConfig.openai) {
      aiConfig.openai = {};
    }
    aiConfig.openai.apiKey = apiKey;

    await writeAIConfig(aiConfig);

    res.json({ success: true, message: 'API key guardada correctamente' });
  } catch (error) {
    console.error('[RAG Admin] Error saving API key:', error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/rag-admin/upload-pdf
 * Upload a new PDF to knowledge base
 */
router.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió archivo PDF' });
    }

    const { name, description, type } = req.body;

    const document = {
      id: `doc-${Date.now()}`,
      name: name || req.file.originalname,
      description: description || '',
      url: req.file.path,
      type: type || 'catalog',
      uploadedAt: new Date().toISOString()
    };

    // Add to agent config
    const agentConfig = await readAgentConfig();
    if (!agentConfig.integrations) {
      agentConfig.integrations = {};
    }
    if (!agentConfig.integrations.knowledgeBase) {
      agentConfig.integrations.knowledgeBase = { enabled: true, documents: [] };
    }
    if (!agentConfig.integrations.knowledgeBase.documents) {
      agentConfig.integrations.knowledgeBase.documents = [];
    }

    agentConfig.integrations.knowledgeBase.documents.push(document);
    await writeAgentConfig(agentConfig);

    res.json({
      success: true,
      message: 'PDF subido correctamente',
      document
    });
  } catch (error) {
    console.error('[RAG Admin] Error uploading PDF:', error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * DELETE /api/rag-admin/document/:id
 * Remove a document from knowledge base
 */
router.delete('/document/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const agentConfig = await readAgentConfig();
    const documents = agentConfig?.integrations?.knowledgeBase?.documents || [];

    const docIndex = documents.findIndex((d: any) => d.id === id);
    if (docIndex === -1) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const doc = documents[docIndex];

    // Delete file if exists
    try {
      await fs.unlink(doc.url);
    } catch (err) {
      console.log('[RAG Admin] Could not delete file:', doc.url);
    }

    // Remove from config
    documents.splice(docIndex, 1);
    await writeAgentConfig(agentConfig);

    res.json({ success: true, message: 'Documento eliminado' });
  } catch (error) {
    console.error('[RAG Admin] Error deleting document:', error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/rag-admin/index
 * Index all documents (create embeddings)
 */
router.post('/index', async (req, res) => {
  try {
    const agentConfig = await readAgentConfig();
    const aiConfig = await readAIConfig();

    const openaiApiKey = aiConfig?.openai?.apiKey;
    if (!openaiApiKey) {
      return res.status(400).json({ error: 'API key de OpenAI no configurada' });
    }

    const documents = agentConfig?.integrations?.knowledgeBase?.documents || [];
    if (documents.length === 0) {
      return res.status(400).json({ error: 'No hay documentos para indexar' });
    }

    // Load or create embeddings database
    const dbPath = path.join(process.cwd(), 'data', 'embeddings-db.json');
    let database = await loadEmbeddingsDatabase(dbPath);

    let indexed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const doc of documents) {
      try {
        // Check if already indexed
        const existingChunks = database.chunks.filter(c => c.metadata.source === doc.id);
        if (existingChunks.length > 0) {
          console.log(`[RAG Admin] Document ${doc.id} already indexed, skipping`);
          skipped++;
          continue;
        }

        console.log(`[RAG Admin] Indexing document: ${doc.name}`);
        const chunks = await processPDFDocument(doc.url, openaiApiKey, doc.id);
        database.chunks.push(...chunks);
        indexed++;
      } catch (error) {
        console.error(`[RAG Admin] Error indexing ${doc.name}:`, error);
        errors.push(`${doc.name}: ${String(error)}`);
      }
    }

    // Update metadata and save
    database.lastUpdated = new Date().toISOString();
    await saveEmbeddingsDatabase(database, dbPath);

    res.json({
      success: true,
      indexed,
      skipped,
      totalChunks: database.chunks.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[RAG Admin] Error during indexing:', error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/rag-admin/reindex/:id
 * Reindex a specific document
 */
router.post('/reindex/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const agentConfig = await readAgentConfig();
    const aiConfig = await readAIConfig();

    const openaiApiKey = aiConfig?.openai?.apiKey;
    if (!openaiApiKey) {
      return res.status(400).json({ error: 'API key de OpenAI no configurada' });
    }

    const documents = agentConfig?.integrations?.knowledgeBase?.documents || [];
    const doc = documents.find((d: any) => d.id === id);

    if (!doc) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    // Load database
    const dbPath = path.join(process.cwd(), 'data', 'embeddings-db.json');
    let database = await loadEmbeddingsDatabase(dbPath);

    // Remove existing chunks for this document
    database.chunks = database.chunks.filter(c => c.metadata.source !== id);

    // Reindex
    console.log(`[RAG Admin] Reindexing document: ${doc.name}`);
    const chunks = await processPDFDocument(doc.url, openaiApiKey, doc.id);
    database.chunks.push(...chunks);

    // Save
    database.lastUpdated = new Date().toISOString();
    await saveEmbeddingsDatabase(database, dbPath);

    res.json({
      success: true,
      message: `Documento reindexado: ${chunks.length} chunks`,
      chunks: chunks.length
    });
  } catch (error) {
    console.error('[RAG Admin] Error reindexing:', error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * DELETE /api/rag-admin/clear-index
 * Clear all embeddings
 */
router.delete('/clear-index', async (req, res) => {
  try {
    const dbPath = path.join(process.cwd(), 'data', 'embeddings-db.json');
    const emptyDb: EmbeddingsDatabase = {
      chunks: [],
      version: '1.0.0',
      lastUpdated: new Date().toISOString()
    };

    await saveEmbeddingsDatabase(emptyDb, dbPath);

    res.json({ success: true, message: 'Índice limpiado correctamente' });
  } catch (error) {
    console.error('[RAG Admin] Error clearing index:', error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/rag-admin/toggle
 * Enable/disable RAG system
 */
router.post('/toggle', async (req, res) => {
  try {
    const { enabled } = req.body;

    const agentConfig = await readAgentConfig();
    if (!agentConfig.integrations) {
      agentConfig.integrations = {};
    }
    if (!agentConfig.integrations.knowledgeBase) {
      agentConfig.integrations.knowledgeBase = { enabled: false, documents: [] };
    }

    agentConfig.integrations.knowledgeBase.enabled = enabled;
    await writeAgentConfig(agentConfig);

    res.json({
      success: true,
      enabled,
      message: `RAG ${enabled ? 'activado' : 'desactivado'}`
    });
  } catch (error) {
    console.error('[RAG Admin] Error toggling RAG:', error);
    res.status(500).json({ error: String(error) });
  }
});

export default router;
