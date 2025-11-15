import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { BadRequestError } from "../utils/errors";

/**
 * Middleware to validate request data against a Zod schema
 * @param schema - Zod schema to validate against
 * @param source - Where to find the data to validate ('body', 'query', 'params')
 */
export function validate(
  schema: z.ZodSchema,
  source: "body" | "query" | "params" = "body"
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate the request data
      const validated = schema.parse(req[source]);

      // Replace the request data with validated data
      // This ensures type safety and removes any extra fields
      req[source] = validated;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format validation errors
        const errors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));

        // Throw BadRequestError with detailed validation errors
        next(
          new BadRequestError(
            `Validation failed: ${errors.map((e) => e.message).join(", ")}`,
            "validation_error"
          )
        );
      } else {
        next(error);
      }
    }
  };
}

/**
 * Middleware to validate query parameters
 */
export function validateQuery(schema: z.ZodSchema) {
  return validate(schema, "query");
}

/**
 * Middleware to validate URL parameters
 */
export function validateParams(schema: z.ZodSchema) {
  return validate(schema, "params");
}

/**
 * Middleware to validate request body
 */
export function validateBody(schema: z.ZodSchema) {
  return validate(schema, "body");
}
