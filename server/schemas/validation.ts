import { z } from "zod";

/**
 * Auth Schemas
 */
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required").max(100),
  password: z.string().min(1, "Password is required").max(1000),
});

export const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  email: z.string().email("Invalid email format").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(1000),
  name: z.string().min(1, "Name is required").max(255),
  role: z.enum(["admin", "advisor"]).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters").max(1000),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(255).optional(),
  email: z.string().email("Invalid email format").max(255).optional(),
});

/**
 * Flow Schemas
 */
export const flowIdSchema = z.object({
  flowId: z.string().min(1, "Flow ID is required").max(100),
});

export const flowSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }).optional(),
  // Additional flow properties can be added here
});

/**
 * Session Schemas
 */
export const sessionIdSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required").max(255),
});

/**
 * Webhook Schemas
 */
export const whatsappWebhookVerifySchema = z.object({
  "hub.mode": z.literal("subscribe"),
  "hub.verify_token": z.string(),
  "hub.challenge": z.string(),
});

/**
 * User Management Schemas
 */
export const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email().max(255),
  password: z.string().min(6).max(1000),
  name: z.string().min(1).max(255),
  role: z.enum(["admin", "advisor", "asesor", "supervisor"]),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

export const updateUserSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  email: z.string().email().max(255).optional(),
  name: z.string().min(1).max(255).optional(),
  role: z.enum(["admin", "advisor", "asesor", "supervisor"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  isActive: z.boolean().optional(),
});

export const userIdSchema = z.object({
  id: z.string().min(1).max(100),
});

/**
 * Bitrix Schemas
 */
export const bitrixCallbackSchema = z.object({
  code: z.string().optional(),
  domain: z.string().optional(),
  member_id: z.string().optional(),
  state: z.string().optional(),
  server_domain: z.string().optional(),
});

/**
 * Environment Variables Schema
 */
export const envSchema = z.object({
  // Server
  PORT: z.string().optional().default("3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),

  // WhatsApp
  META_WABA_TOKEN: z.string().min(1, "WhatsApp access token is required"),
  META_WABA_VERIFY_TOKEN: z.string().min(1, "WhatsApp verify token is required"),
  META_WABA_PHONE_NUMBER_ID: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(16, "JWT secret must be at least 16 characters for security"),

  // Storage
  SESSION_STORAGE_TYPE: z.enum(["file", "redis"]).optional().default("file"),
  STORAGE_PATH: z.string().optional().default("./data"),

  // Logging
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).optional().default("info"),
  LOG_DIR: z.string().optional().default("logs"),

  // CORS
  CORS_ORIGIN: z.string().optional(),

  // Optional integrations
  BITRIX24_DOMAIN: z.string().optional(),
  BITRIX24_CLIENT_ID: z.string().optional(),
  BITRIX24_CLIENT_SECRET: z.string().optional(),

  // Default flow
  DEFAULT_FLOW_ID: z.string().optional().default("default-flow"),

  // Redis (if using redis storage)
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
});

// Export types for TypeScript
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type FlowInput = z.infer<typeof flowSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type EnvConfig = z.infer<typeof envSchema>;
