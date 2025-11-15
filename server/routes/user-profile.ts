import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { adminDb } from "../admin-db";
import { requireAuth } from "../auth/middleware";
import crypto from "crypto";

const router = express.Router();

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "data", "avatars");
    // Ensure directory exists
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos de imagen"));
    }
  },
});

// Upload avatar
router.post("/avatar", requireAuth, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: "No se proporcionó ningún archivo" });
    }

    const avatarUrl = `/api/avatars/${req.file.filename}`;

    res.json({
      ok: true,
      avatarUrl,
    });
  } catch (error) {
    console.error("[UserProfile] Error uploading avatar:", error);
    res.status(500).json({ ok: false, message: "Error al subir el avatar" });
  }
});

// Configure multer for chat background uploads
const backgroundStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "data", "chat-backgrounds");
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    const ext = path.extname(file.originalname);
    cb(null, `bg-${uniqueSuffix}${ext}`);
  },
});

const backgroundUpload = multer({
  storage: backgroundStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos de imagen"));
    }
  },
});

// Upload chat background
router.post("/chat-background", requireAuth, backgroundUpload.single("background"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: "No se proporcionó ningún archivo" });
    }

    const backgroundUrl = `/api/user-profile/chat-backgrounds/${req.file.filename}`;

    res.json({
      ok: true,
      backgroundUrl,
    });
  } catch (error) {
    console.error("[UserProfile] Error uploading chat background:", error);
    res.status(500).json({ ok: false, message: "Error al subir el fondo del chat" });
  }
});

// Update profile
router.put("/profile", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autenticado" });
    }

    const { name, email, avatarUrl } = req.body;

    // Validate inputs
    if (!name || !email) {
      return res.status(400).json({ ok: false, message: "Nombre y email son requeridos" });
    }

    // Check if email is already taken by another user
    const allUsers = adminDb.getUsers();
    const existingUser = allUsers.find((u) => u.email === email && u.id !== userId);

    if (existingUser) {
      return res.status(400).json({ ok: false, message: "Este email ya está en uso" });
    }

    // Update user
    const updateData: any = {
      name,
      email,
    };

    if (avatarUrl) {
      updateData.avatarUrl = avatarUrl;
    }

    await adminDb.updateUser(userId, updateData);

    res.json({ ok: true, message: "Perfil actualizado correctamente" });
  } catch (error) {
    console.error("[UserProfile] Error updating profile:", error);
    res.status(500).json({ ok: false, message: "Error al actualizar el perfil" });
  }
});

// Change password
router.put("/password", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autenticado" });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, message: "Todos los campos son requeridos" });
    }

    // Get current user
    const user = adminDb.getUser(userId);

    if (!user) {
      return res.status(404).json({ ok: false, message: "Usuario no encontrado" });
    }

    // Verify current password
    const bcrypt = require("bcrypt");
    const isValid = await bcrypt.compare(currentPassword, user.password);

    if (!isValid) {
      return res.status(400).json({ ok: false, message: "Contraseña actual incorrecta" });
    }

    // Update password
    await adminDb.updateUser(userId, { password: newPassword });

    res.json({ ok: true, message: "Contraseña cambiada correctamente" });
  } catch (error) {
    console.error("[UserProfile] Error changing password:", error);
    res.status(500).json({ ok: false, message: "Error al cambiar la contraseña" });
  }
});

// Get chat theme preferences
router.get("/chat-theme", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autenticado" });
    }

    const preferences = await adminDb.getChatThemePreferences(userId);

    // Return default preferences if none exist
    const defaultPreferences = {
      fontFamily: "system-ui",
      fontSize: "13px",
      fontWeight: "400",
      incomingBubbleBg: "#ffffff",
      incomingTextColor: "#1e293b",
      outgoingBubbleBg: "#10b981",
      outgoingTextColor: "#ffffff",
      chatBackgroundImage: "",
      chatBackgroundColor: "",
    };

    res.json({
      ok: true,
      preferences: preferences || defaultPreferences,
    });
  } catch (error) {
    console.error("[UserProfile] Error getting chat theme preferences:", error);
    res.status(500).json({ ok: false, message: "Error al obtener preferencias de tema" });
  }
});

// Update chat theme preferences
router.put("/chat-theme", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autenticado" });
    }

    const { preferences } = req.body;

    if (!preferences) {
      return res.status(400).json({ ok: false, message: "Preferencias son requeridas" });
    }

    await adminDb.setChatThemePreferences(userId, preferences);

    res.json({ ok: true, message: "Preferencias de tema actualizadas correctamente" });
  } catch (error) {
    console.error("[UserProfile] Error updating chat theme preferences:", error);
    res.status(500).json({ ok: false, message: "Error al actualizar preferencias de tema" });
  }
});

// Serve avatar images
router.get("/avatars/:filename", (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(process.cwd(), "data", "avatars", filename);
  res.sendFile(filepath);
});

// Serve chat background images
router.get("/chat-backgrounds/:filename", (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(process.cwd(), "data", "chat-backgrounds", filename);
  res.sendFile(filepath);
});

export default router;
