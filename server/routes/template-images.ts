import express from 'express';
import { requireAuth } from '../auth/middleware';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

// Directorio donde se guardan las imágenes
const IMAGES_DIR = path.join(process.cwd(), 'public', 'template-images');

// Asegurar que existe el directorio
fs.mkdir(IMAGES_DIR, { recursive: true }).catch(console.error);

/**
 * GET /api/template-images
 * Lista todas las imágenes guardadas
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const files = await fs.readdir(IMAGES_DIR);
    const imageFiles = files.filter(f =>
      /\.(jpg|jpeg|png|gif|webp)$/i.test(f)
    );

    const images = await Promise.all(
      imageFiles.map(async (filename) => {
        const filePath = path.join(IMAGES_DIR, filename);
        const stats = await fs.stat(filePath);
        return {
          filename,
          url: `/template-images/${filename}`,
          size: stats.size,
          uploadedAt: stats.mtime.getTime(),
        };
      })
    );

    // Ordenar por fecha de subida (más reciente primero)
    images.sort((a, b) => b.uploadedAt - a.uploadedAt);

    res.json({ images });
  } catch (error) {
    console.error('[TemplateImages] Error listing images:', error);
    res.status(500).json({ error: 'Error al listar imágenes' });
  }
});

/**
 * POST /api/template-images/upload
 * Sube una nueva imagen
 */
router.post('/upload', requireAuth, async (req, res) => {
  try {
    const multer = await import('multer');
    const upload = multer.default({
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
      fileFilter: (req, file, cb) => {
        if (/\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname)) {
          cb(null, true);
        } else {
          cb(new Error('Solo se permiten imágenes (JPG, PNG, GIF, WEBP)'));
        }
      }
    }).single('image');

    upload(req as any, res as any, async (err: any) => {
      if (err) {
        console.error('[TemplateImages] Upload error:', err);
        return res.status(400).json({ error: err.message || 'Error al subir imagen' });
      }

      const file = (req as any).file;
      if (!file) {
        return res.status(400).json({ error: 'No se recibió ninguna imagen' });
      }

      // Generar nombre único
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const safeName = file.originalname
        .replace(ext, '')
        .replace(/[^a-z0-9]/gi, '-')
        .toLowerCase()
        .substring(0, 50);
      const filename = `${safeName}-${timestamp}${ext}`;
      const filePath = path.join(IMAGES_DIR, filename);

      // Guardar archivo
      await fs.writeFile(filePath, file.buffer);

      const url = `/template-images/${filename}`;

      console.log('[TemplateImages] Image uploaded:', { filename, size: file.size });

      res.json({
        filename,
        url,
        fullUrl: `${req.protocol}://${req.get('host')}${url}`,
        size: file.size,
      });
    });
  } catch (error) {
    console.error('[TemplateImages] Error uploading:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * DELETE /api/template-images/:filename
 * Elimina una imagen
 */
router.delete('/:filename', requireAuth, async (req, res) => {
  try {
    const { filename } = req.params;

    // Validar que el filename no tenga caracteres peligrosos
    if (!/^[a-z0-9\-_.]+$/i.test(filename)) {
      return res.status(400).json({ error: 'Nombre de archivo inválido' });
    }

    const filePath = path.join(IMAGES_DIR, filename);

    // Verificar que existe
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    // Eliminar
    await fs.unlink(filePath);

    console.log('[TemplateImages] Image deleted:', filename);

    res.json({ success: true, message: 'Imagen eliminada' });
  } catch (error) {
    console.error('[TemplateImages] Error deleting:', error);
    res.status(500).json({ error: 'Error al eliminar imagen' });
  }
});

export default router;
