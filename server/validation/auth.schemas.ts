import { z } from "zod";
import { usernameSchema, passwordSchema, emailSchema, sanitizeString } from "../middleware/validation";

/**
 * Schema para login
 */
export const loginSchema = {
  body: z.object({
    username: usernameSchema,
    password: passwordSchema,
  }),
};

/**
 * Schema para cambio de contraseña
 */
export const changePasswordSchema = {
  body: z.object({
    currentPassword: passwordSchema,
    newPassword: passwordSchema,
  }),
};

/**
 * Schema para actualizar perfil
 */
export const updateProfileSchema = {
  body: z.object({
    name: sanitizeString.min(1, "Name is required").optional(),
    email: emailSchema.optional(),
  }).refine((data) => data.name !== undefined || data.email !== undefined, {
    message: "At least one field (name or email) is required",
  }),
};

/**
 * Schema para crear usuario (admin)
 */
export const createUserSchema = {
  body: z.object({
    username: usernameSchema,
    password: passwordSchema,
    name: sanitizeString.min(1, "Name is required"),
    email: emailSchema,
    role: z.enum(["admin", "advisor", "supervisor", "user"], {
      errorMap: () => ({ message: "Invalid role" }),
    }),
  }),
};

/**
 * Schema para actualizar usuario (admin)
 */
export const updateUserSchema = {
  params: z.object({
    userId: z.string().min(1, "User ID is required"),
  }),
  body: z.object({
    name: sanitizeString.min(1, "Name is required").optional(),
    email: emailSchema.optional(),
    role: z.enum(["admin", "advisor", "supervisor", "user"]).optional(),
    password: passwordSchema.optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  }),
};
