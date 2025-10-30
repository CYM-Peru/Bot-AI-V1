import { Request, Response, NextFunction } from "express";
import { z, ZodError, ZodSchema } from "zod";
import { logError } from "../utils/file-logger";

/**
 * Middleware de validación genérico usando Zod
 * Valida body, query params, o params según el schema proporcionado
 */
export function validate(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validar body si existe schema
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }

      // Validar query params si existe schema
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }

      // Validar route params si existe schema
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Formatear errores de validación de forma amigable
        const errors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
          code: err.code,
        }));

        res.status(400).json({
          error: "validation_error",
          message: "Invalid request data",
          details: errors,
        });
        return;
      }

      // Error inesperado
      logError("Validation unexpected error", error);
      res.status(500).json({
        error: "internal_error",
        message: "Validation failed",
      });
    }
  };
}

/**
 * Sanitización básica de strings
 * Remueve caracteres peligrosos para prevenir XSS
 */
export const sanitizeString = z.string().transform((val) => {
  return val
    .trim()
    .replace(/[<>]/g, "") // Remueve < y > para prevenir tags HTML
    .replace(/javascript:/gi, "") // Remueve javascript: URLs
    .replace(/on\w+=/gi, ""); // Remueve event handlers (onclick=, onerror=, etc)
});

/**
 * Validación de email
 */
export const emailSchema = z.string().email("Invalid email format").toLowerCase();

/**
 * Validación de username
 * Solo alfanuméricos, guiones y guiones bajos, 3-30 caracteres
 */
export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Username can only contain letters, numbers, hyphens and underscores"
  );

/**
 * Validación de password
 * Mínimo 6 caracteres (puede ser más estricto según necesidad)
 */
export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(100, "Password is too long");

/**
 * Validación de ID (MongoDB ObjectId o UUID)
 */
export const idSchema = z.string().min(1, "ID is required");

/**
 * Validación de flow ID
 */
export const flowIdSchema = z
  .string()
  .min(1, "Flow ID is required")
  .max(100, "Flow ID is too long")
  .regex(/^[a-zA-Z0-9_-]+$/, "Flow ID contains invalid characters");
