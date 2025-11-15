/**
 * Rutas API para el sistema de tickets de soporte
 * Permite a los usuarios reportar problemas y a los admins gestionar los tickets
 */

import { Router, Request, Response } from "express";
import { requireAuth } from "../auth/middleware";
import { requireAdmin } from "../middleware/roles";
import pg from "pg";
import multer from "multer";
import path from "path";
import fs from "fs/promises";

const router = Router();
const { Pool } = pg;

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
  database: process.env.POSTGRES_DB || "flowbuilder_crm",
  user: process.env.POSTGRES_USER || "whatsapp_user",
  password: process.env.POSTGRES_PASSWORD,
});

// Configuración de Multer para subida de imágenes
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "data", "uploads", "tickets");
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `ticket-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
    files: 5, // Máximo 5 archivos
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten imágenes (JPEG, PNG, GIF, WEBP)"));
    }
  },
});

/**
 * Genera un número de ticket único secuencial
 */
async function generateTicketNumber(): Promise<string> {
  const result = await pool.query("SELECT nextval('ticket_number_seq') as num");
  const num = result.rows[0].num;
  return `TKT-${String(num).padStart(5, "0")}`; // TKT-00001, TKT-00002, etc.
}

/**
 * POST /api/tickets/create
 * Crea un nuevo ticket de soporte
 */
router.post("/create", requireAuth, upload.array("images", 5), async (req: Request, res: Response) => {
  try {
    const { title, description } = req.body;
    const userId = req.user?.id;
    const userName = req.user?.name || req.user?.username || "Usuario";

    if (!title || !description) {
      res.status(400).json({ error: "Título y descripción son requeridos" });
      return;
    }

    // Generar número de ticket
    const ticketNumber = await generateTicketNumber();

    // Procesar imágenes subidas
    const images = (req.files as Express.Multer.File[])?.map((file) => ({
      filename: file.filename,
      path: `/api/tickets/image/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype,
    })) || [];

    // Insertar ticket en la base de datos
    const result = await pool.query(
      `INSERT INTO support_tickets
       (ticket_number, reporter_id, reporter_name, title, description, images, status, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [ticketNumber, userId, userName, title, description, JSON.stringify(images), "pending", "medium"]
    );

    const ticket = result.rows[0];

    res.status(201).json({
      success: true,
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticket_number,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        images: ticket.images,
        createdAt: ticket.created_at,
      },
    });
  } catch (error) {
    console.error("Error creating ticket:", error);
    res.status(500).json({ error: "Error al crear el ticket" });
  }
});

/**
 * GET /api/tickets/my
 * Obtiene todos los tickets del usuario actual
 */
router.get("/my", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    const result = await pool.query(
      `SELECT
        id, ticket_number, reporter_name, title, description,
        status, priority, images, admin_comments,
        created_at, updated_at, resolved_at
       FROM support_tickets
       WHERE reporter_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ tickets: result.rows });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({ error: "Error al obtener tickets" });
  }
});

/**
 * GET /api/tickets/all
 * Obtiene todos los tickets (solo admin)
 */
router.get("/all", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, priority } = req.query;

    let query = `
      SELECT
        t.id, t.ticket_number, t.reporter_id, t.reporter_name,
        t.title, t.description, t.status, t.priority,
        t.images, t.admin_comments, t.created_at, t.updated_at,
        t.resolved_at, t.resolved_by,
        u.name as resolved_by_name
      FROM support_tickets t
      LEFT JOIN crm_users u ON t.resolved_by = u.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (status) {
      params.push(status);
      query += ` AND t.status = $${params.length}`;
    }

    if (priority) {
      params.push(priority);
      query += ` AND t.priority = $${params.length}`;
    }

    query += ` ORDER BY t.created_at DESC`;

    const result = await pool.query(query, params);

    res.json({ tickets: result.rows });
  } catch (error) {
    console.error("Error fetching all tickets:", error);
    res.status(500).json({ error: "Error al obtener tickets" });
  }
});

/**
 * GET /api/tickets/:id
 * Obtiene un ticket específico por ID
 */
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === "admin";

    const result = await pool.query(
      `SELECT
        t.*,
        u.name as resolved_by_name
       FROM support_tickets t
       LEFT JOIN crm_users u ON t.resolved_by = u.id
       WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Ticket no encontrado" });
      return;
    }

    const ticket = result.rows[0];

    // Verificar permisos: solo el creador o admin pueden ver
    if (!isAdmin && ticket.reporter_id !== userId) {
      res.status(403).json({ error: "No tienes permiso para ver este ticket" });
      return;
    }

    res.json({ ticket });
  } catch (error) {
    console.error("Error fetching ticket:", error);
    res.status(500).json({ error: "Error al obtener ticket" });
  }
});

/**
 * PATCH /api/tickets/:id/status
 * Actualiza el estado de un ticket (solo admin)
 */
router.patch("/:id/status", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.id;

    if (!["pending", "in_progress", "resolved"].includes(status)) {
      res.status(400).json({ error: "Estado inválido" });
      return;
    }

    const updates: any = { status };
    const params: any[] = [status];
    let paramCount = 1;

    // Si se marca como resuelto, registrar quién y cuándo
    if (status === "resolved") {
      paramCount++;
      params.push(userId);
      paramCount++;
      params.push(new Date());

      const result = await pool.query(
        `UPDATE support_tickets
         SET status = $1, resolved_by = $2, resolved_at = $3
         WHERE id = $4
         RETURNING *`,
        [...params, id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Ticket no encontrado" });
        return;
      }

      res.json({ success: true, ticket: result.rows[0] });
    } else {
      const result = await pool.query(
        `UPDATE support_tickets
         SET status = $1, resolved_by = NULL, resolved_at = NULL
         WHERE id = $2
         RETURNING *`,
        [status, id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Ticket no encontrado" });
        return;
      }

      res.json({ success: true, ticket: result.rows[0] });
    }
  } catch (error) {
    console.error("Error updating ticket status:", error);
    res.status(500).json({ error: "Error al actualizar estado del ticket" });
  }
});

/**
 * POST /api/tickets/:id/comment
 * Agrega un comentario de admin a un ticket (solo admin)
 */
router.post("/:id/comment", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const userName = req.user?.name || req.user?.username || "Admin";

    if (!comment) {
      res.status(400).json({ error: "El comentario es requerido" });
      return;
    }

    // Obtener comentarios actuales
    const current = await pool.query(
      "SELECT admin_comments FROM support_tickets WHERE id = $1",
      [id]
    );

    if (current.rows.length === 0) {
      res.status(404).json({ error: "Ticket no encontrado" });
      return;
    }

    const comments = current.rows[0].admin_comments || [];
    comments.push({
      author: userName,
      comment,
      timestamp: new Date().toISOString(),
    });

    // Actualizar comentarios
    const result = await pool.query(
      "UPDATE support_tickets SET admin_comments = $1 WHERE id = $2 RETURNING *",
      [JSON.stringify(comments), id]
    );

    res.json({ success: true, ticket: result.rows[0] });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ error: "Error al agregar comentario" });
  }
});

/**
 * GET /api/tickets/image/:filename
 * Sirve una imagen de un ticket
 */
router.get("/image/:filename", async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const imagePath = path.join(process.cwd(), "data", "uploads", "tickets", filename);

    // Verificar que el archivo existe
    await fs.access(imagePath);

    res.sendFile(imagePath);
  } catch (error) {
    console.error("Error serving image:", error);
    res.status(404).json({ error: "Imagen no encontrada" });
  }
});

/**
 * GET /api/tickets/stats
 * Obtiene estadísticas de tickets (solo admin)
 */
router.get("/stats/summary", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
        COUNT(*) FILTER (WHERE priority = 'high') as high_priority,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h
      FROM support_tickets
    `);

    res.json({ stats: stats.rows[0] });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

export default router;
