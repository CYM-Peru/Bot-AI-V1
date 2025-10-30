import { Router } from "express";
import { generateToken } from "../auth/jwt";
import { verifyPassword } from "../auth/password";
import { requireAuth } from "../auth/middleware";
import { adminDb } from "../admin-db";

export function createAuthRouter() {
  const router = Router();

  /**
   * POST /api/auth/login
   * Login con usuario y contraseña
   */
  router.post("/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({ error: "missing_credentials", message: "Username and password required" });
        return;
      }

      // Buscar usuario por username
      const user = adminDb.getUserByUsername(username);

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
      console.error("[Auth] Login error:", error);
      res.status(500).json({ error: "internal_error", message: "Login failed" });
    }
  });

  /**
   * POST /api/auth/logout
   * Cerrar sesión
   */
  router.post("/logout", (_req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
  });

  /**
   * GET /api/auth/me
   * Obtener información del usuario autenticado
   */
  router.get("/me", requireAuth, (req, res) => {
    if (!req.user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    // Buscar usuario completo en la DB
    const user = adminDb.getUser(req.user.userId);

    if (!user) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }

    res.json({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      email: user.email,
      createdAt: user.createdAt,
    });
  });

  /**
   * PATCH /api/auth/profile
   * Actualizar perfil del usuario autenticado (nombre y email)
   */
  router.patch("/profile", requireAuth, async (req, res) => {
    try {
      const { name, email } = req.body;

      if (!name && !email) {
        res.status(400).json({ error: "missing_fields", message: "At least one field (name or email) is required" });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      const user = adminDb.getUser(req.user.userId);

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
      console.error("[Auth] Update profile error:", error);
      res.status(500).json({ error: "internal_error", message: "Failed to update profile" });
    }
  });

  /**
   * POST /api/auth/change-password
   * Cambiar contraseña del usuario autenticado
   */
  router.post("/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: "missing_fields", message: "Current and new password required" });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      const user = adminDb.getUser(req.user.userId);

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
      console.error("[Auth] Change password error:", error);
      res.status(500).json({ error: "internal_error", message: "Failed to change password" });
    }
  });

  return router;
}
