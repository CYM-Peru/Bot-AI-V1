import { Router } from "express";
import { generateToken } from "../auth/jwt";
import { verifyPassword } from "../auth/password";
import { requireAuth } from "../auth/middleware";
import { adminDb } from "../admin-db";
import { authLimiter } from "../middleware/rate-limit";
import { validateBody } from "../middleware/validate";
import { loginSchema, updateProfileSchema, changePasswordSchema } from "../schemas/validation";
import logger from "../utils/logger";
import { advisorPresence } from "../crm/advisor-presence";

export function createAuthRouter() {
  const router = Router();

  /**
   * POST /api/auth/login
   * Login con usuario y contraseña
   */
  router.post("/login", authLimiter, validateBody(loginSchema), async (req, res) => {
    try {
      const { username, password } = req.body;

      // Buscar usuario por username
      const user = await adminDb.getUserByUsername(username);

      if (!user) {
        res.status(401).json({ error: "invalid_credentials", message: "Invalid username or password" });
        return;
      }

      // Verificar contraseña
      const isValidPassword = await verifyPassword(password, user.password);

      if (!isValidPassword) {
        res.status(401).json({ error: "invalid_credentials", message: "Invalid username or password" });
        return;
      }

      // Generar token JWT
      const token = generateToken({
        userId: user.id,
        username: user.username,
        role: user.role,
      });

      // Configurar cookie httpOnly
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
      });

      // Log login activity
      try {
        await adminDb.logAdvisorActivity(user.id, user.name || user.username, 'login');
      } catch (error) {
        logger.error("[Auth] Failed to log login activity:", error);
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          email: user.email,
        },
        token, // También enviar en el body para clientes que prefieran localStorage
      });
    } catch (error) {
      logger.error("[Auth] Login error:", error);
      res.status(500).json({ error: "internal_error", message: "Login failed" });
    }
  });

  /**
   * POST /api/auth/logout
   * Cerrar sesión
   */
  router.post("/logout", requireAuth, async (req, res) => {
    try {
      // Log logout activity and mark advisor as offline
      if (req.user) {
        const user = await adminDb.getUser(req.user.userId);
        if (user) {
          await adminDb.logAdvisorActivity(user.id, user.name || user.username, 'logout');

          // CRITICAL FIX: Mark advisor as offline immediately when they logout
          await advisorPresence.markOffline(user.id, true);
          logger.info(`[Auth] User ${user.id} logged out and marked as offline`);

          // IMPROVEMENT: Add logout notification to advisor's active conversations
          await addLogoutNotifications(user.id, user.name || user.username);
        }
      }
    } catch (error) {
      logger.error("[Auth] Failed to log logout activity:", error);
    }

    res.clearCookie("token");
    res.json({ success: true });
  });

  /**
   * Add logout notifications to ALL conversations where the advisor has participated
   * This includes conversations assigned to them AND conversations they've attended before
   */
  async function addLogoutNotifications(userId: string, userName: string): Promise<void> {
    try {
      const { crmDb } = await import("../crm/db");
      const { getCrmGateway } = await import("../crm/ws");

      // CHANGED: Get ALL conversations where this advisor has participated
      // This includes: currently assigned + attended_by history (for full traceability)
      const allConversations = await crmDb.listConversations();
      const advisorConversations = allConversations.filter(conv => {
        // Currently assigned to this advisor
        const isCurrentlyAssigned = conv.assignedTo === userId;

        // Has attended this conversation before (check attended_by array)
        const hasAttended = conv.attendedBy?.includes(userId) || false;

        // Only include active/attending conversations (not archived)
        const isActive = conv.status === "active" || conv.status === "attending";

        return (isCurrentlyAssigned || hasAttended) && isActive;
      });

      if (advisorConversations.length === 0) {
        logger.info(`[Auth] No active conversations for ${userName} - skipping logout notifications`);
        return;
      }

      logger.info(`[Auth] Adding logout notifications to ${advisorConversations.length} conversations of ${userName} (assigned + attended)`);

      const now = new Date();
      const timestamp = now.toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      const gateway = getCrmGateway();

      // Add system message to each conversation AND close them
      for (const conversation of advisorConversations) {
        const systemMessage = await crmDb.createSystemEvent(
          conversation.id,
          'advisor_logout',
          `👋 ${userName} cerró sesión (${timestamp})`
        );

        // CRITICAL FIX: Close the conversation when advisor logs out
        // Set status to 'closed' and clear assignment
        await crmDb.updateConversation(conversation.id, {
          status: 'closed',
          assignedTo: null,
          queueId: null
        });

        // Emit WebSocket events
        if (gateway) {
          gateway.emitNewMessage({ message: systemMessage });
          gateway.emitConversationUpdate({
            conversationId: conversation.id,
            updates: {
              status: 'closed',
              assignedTo: null,
              queueId: null
            }
          });
        }
      }

      logger.info(`[Auth] ✅ Added logout notifications and closed ${advisorConversations.length} conversations`);
    } catch (error) {
      logger.error(`[Auth] Error adding logout notifications:`, error);
    }
  }

  /**
   * GET /api/auth/me
   * Obtener información del usuario autenticado
   */
  router.get("/me", requireAuth, async (req, res) => {
    if (!req.user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    // Buscar usuario completo en la DB
    const user = await adminDb.getUser(req.user.userId);

    if (!user) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        email: user.email,
        createdAt: user.createdAt,
      }
    });
  });

  /**
   * PATCH /api/auth/profile
   * Actualizar perfil del usuario autenticado (nombre y email)
   */
  router.patch("/profile", requireAuth, validateBody(updateProfileSchema), async (req, res) => {
    try {
      const { name, email } = req.body;

      if (!req.user) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      const user = await adminDb.getUser(req.user.userId);

      if (!user) {
        res.status(404).json({ error: "user_not_found" });
        return;
      }

      // Preparar datos de actualización
      const updates: { name?: string; email?: string } = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;

      // Actualizar usuario
      const updated = await adminDb.updateUser(user.id, updates);

      if (!updated) {
        res.status(500).json({ error: "update_failed", message: "Failed to update profile" });
        return;
      }

      res.json({
        success: true,
        message: "Profile updated successfully",
        user: {
          id: updated.id,
          username: updated.username,
          name: updated.name,
          email: updated.email,
          role: updated.role,
        },
      });
    } catch (error) {
      logger.error("[Auth] Update profile error:", error);
      res.status(500).json({ error: "internal_error", message: "Failed to update profile" });
    }
  });

  /**
   * POST /api/auth/change-password
   * Cambiar contraseña del usuario autenticado
   */
  router.post("/change-password", authLimiter, requireAuth, validateBody(changePasswordSchema), async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!req.user) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      const user = await adminDb.getUser(req.user.userId);

      if (!user) {
        res.status(404).json({ error: "user_not_found" });
        return;
      }

      // Verificar contraseña actual
      const isValidPassword = await verifyPassword(currentPassword, user.password);

      if (!isValidPassword) {
        res.status(401).json({ error: "invalid_password", message: "Current password is incorrect" });
        return;
      }

      // Actualizar con nueva contraseña (admin-db la hasheará automáticamente)
      const updated = await adminDb.updateUser(user.id, { password: newPassword });

      if (!updated) {
        res.status(500).json({ error: "update_failed", message: "Failed to update password" });
        return;
      }

      res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      logger.error("[Auth] Change password error:", error);
      res.status(500).json({ error: "internal_error", message: "Failed to change password" });
    }
  });

  return router;
}
