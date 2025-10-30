import { Router } from "express";
import { generateToken } from "../auth/jwt";
import { verifyPassword } from "../auth/password";
import { requireAuth } from "../auth/middleware";
import { adminDb } from "../admin-db";
import { authLimiter } from "../middleware/rate-limit";
import { validate } from "../middleware/validation";
import { loginSchema, changePasswordSchema, updateProfileSchema } from "../validation/auth.schemas";
import { logError } from "../utils/file-logger";
import { asyncHandler } from "../middleware/error-handler";
import { BadRequestError, UnauthorizedError, NotFoundError, InternalServerError } from "../utils/errors";

export function createAuthRouter() {
  const router = Router();

  /**
   * POST /api/auth/login
   * Login con usuario y contraseña
   */
  router.post("/login", authLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      throw new BadRequestError("Username and password required", "missing_credentials");
    }

    // Buscar usuario por username
    const user = adminDb.getUserByUsername(username);

    if (!user) {
      throw new UnauthorizedError("Invalid username or password", "invalid_credentials");
    }

    // Verificar contraseña
    const isValidPassword = await verifyPassword(password, user.password);

    if (!isValidPassword) {
      throw new UnauthorizedError("Invalid username or password", "invalid_credentials");
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
  }));

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
  router.get("/me", requireAuth, asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError("Not authenticated");
    }

    // Buscar usuario completo en la DB
    const user = adminDb.getUser(req.user.userId);

    if (!user) {
      throw new NotFoundError("User not found", "user_not_found");
    }

    res.json({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      email: user.email,
      createdAt: user.createdAt,
    });
  }));

  /**
   * PATCH /api/auth/profile
   * Actualizar perfil del usuario autenticado (nombre y email)
   */
  router.patch("/profile", requireAuth, validate(updateProfileSchema), async (req, res) => {
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
      logError("Update profile error", error);
      res.status(500).json({ error: "internal_error", message: "Failed to update profile" });
    }
  });

  /**
   * POST /api/auth/change-password
   * Cambiar contraseña del usuario autenticado
   */
  router.post("/change-password", authLimiter, requireAuth, validate(changePasswordSchema), asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new BadRequestError("Current and new password required", "missing_fields");
    }

    if (!req.user) {
      throw new UnauthorizedError("Not authenticated");
    }

    const user = adminDb.getUser(req.user.userId);

    if (!user) {
      throw new NotFoundError("User not found", "user_not_found");
    }

    // Verificar contraseña actual
    const isValidPassword = await verifyPassword(currentPassword, user.password);

    if (!isValidPassword) {
      throw new UnauthorizedError("Current password is incorrect", "invalid_password");
    }

    // Actualizar con nueva contraseña (admin-db la hasheará automáticamente)
    const updated = await adminDb.updateUser(user.id, { password: newPassword });

    if (!updated) {
      throw new InternalServerError("Failed to update password", "update_failed");
    }

    res.json({ success: true, message: "Password changed successfully" });
  }));

  return router;
}
