/**
 * Rutas API para el sistema de alertas de mantenimiento
 * Permite a los admins activar alertas que los asesores ven en tiempo real
 */

import { Router, Request, Response } from "express";
import { requireAuth } from "../auth/middleware";
import { requireAdmin } from "../middleware/roles";
import pg from "pg";

const router = Router();
const { Pool } = pg;

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
  database: process.env.POSTGRES_DB || "flowbuilder_crm",
  user: process.env.POSTGRES_USER || "whatsapp_user",
  password: process.env.POSTGRES_PASSWORD,
});

/**
 * GET /api/maintenance/status
 * Obtiene el estado actual de mantenimiento (todos los usuarios)
 */
router.get("/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, status, message, started_at, completed_at
       FROM maintenance_alerts
       WHERE active = true
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      res.json({
        status: "idle",
        message: "Sistema operando normalmente",
        active: false,
      });
      return;
    }

    const alert = result.rows[0];

    res.json({
      id: alert.id,
      status: alert.status,
      message: alert.message,
      startedAt: alert.started_at,
      completedAt: alert.completed_at,
      active: true,
    });
  } catch (error) {
    console.error("Error fetching maintenance status:", error);
    res.status(500).json({ error: "Error al obtener estado de mantenimiento" });
  }
});

/**
 * POST /api/maintenance/start
 * Inicia una alerta de mantenimiento (solo admin)
 */
router.post("/start", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    const userId = req.user?.id;

    if (!message) {
      res.status(400).json({ error: "El mensaje es requerido" });
      return;
    }

    // Actualizar la alerta activa a estado "working"
    const result = await pool.query(
      `UPDATE maintenance_alerts
       SET status = 'working',
           message = $1,
           started_by = $2,
           started_at = NOW(),
           completed_at = NULL
       WHERE active = true
       RETURNING *`,
      [message, userId]
    );

    if (result.rows.length === 0) {
      // Si no existe, crear una nueva
      const createResult = await pool.query(
        `INSERT INTO maintenance_alerts
         (status, message, started_by, started_at, active)
         VALUES ('working', $1, $2, NOW(), true)
         RETURNING *`,
        [message, userId]
      );

      res.json({
        success: true,
        alert: createResult.rows[0],
        message: "Alerta de mantenimiento activada",
      });
      return;
    }

    res.json({
      success: true,
      alert: result.rows[0],
      message: "Alerta de mantenimiento activada",
    });
  } catch (error) {
    console.error("Error starting maintenance:", error);
    res.status(500).json({ error: "Error al iniciar mantenimiento" });
  }
});

/**
 * POST /api/maintenance/complete
 * Marca el mantenimiento como completado (solo admin)
 */
router.post("/complete", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `UPDATE maintenance_alerts
       SET status = 'completed',
           completed_at = NOW()
       WHERE active = true AND status = 'working'
       RETURNING *`
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "No hay mantenimiento activo" });
      return;
    }

    res.json({
      success: true,
      alert: result.rows[0],
      message: "Mantenimiento marcado como completado. Los usuarios verán el ícono de refresh.",
    });
  } catch (error) {
    console.error("Error completing maintenance:", error);
    res.status(500).json({ error: "Error al completar mantenimiento" });
  }
});

/**
 * POST /api/maintenance/dismiss
 * Cierra/elimina la alerta de mantenimiento completado (solo admin)
 * Vuelve al estado idle
 */
router.post("/dismiss", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `UPDATE maintenance_alerts
       SET status = 'idle',
           message = 'Sistema operando normalmente',
           started_by = NULL,
           started_at = NULL,
           completed_at = NULL
       WHERE active = true
       RETURNING *`
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "No hay alerta activa" });
      return;
    }

    res.json({
      success: true,
      alert: result.rows[0],
      message: "Alerta de mantenimiento cerrada",
    });
  } catch (error) {
    console.error("Error dismissing maintenance:", error);
    res.status(500).json({ error: "Error al cerrar alerta de mantenimiento" });
  }
});

/**
 * GET /api/maintenance/history
 * Obtiene el historial de alertas de mantenimiento (solo admin)
 */
router.get("/history", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT
        m.id, m.status, m.message, m.started_at, m.completed_at,
        m.created_at, m.updated_at,
        u.name as started_by_name
       FROM maintenance_alerts m
       LEFT JOIN crm_users u ON m.started_by = u.id
       WHERE m.status != 'idle' OR m.started_at IS NOT NULL
       ORDER BY m.created_at DESC
       LIMIT 50`
    );

    res.json({ history: result.rows });
  } catch (error) {
    console.error("Error fetching maintenance history:", error);
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

export default router;
