import { Request, Response, NextFunction } from "express";

export type UserRole = "admin" | "supervisor" | "asesor";

/**
 * Middleware to check if user has required role
 * @param allowedRoles - Array of roles that can access this route
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "not_authenticated" });
      return;
    }

    const userRole = req.user.role as UserRole;

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        error: "forbidden",
        message: `Se requiere rol: ${allowedRoles.join(" o ")}. Tu rol actual: ${userRole}`
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = requireRole("admin");

/**
 * Middleware to check if user is admin or supervisor
 */
export const requireSupervisor = requireRole("admin", "supervisor");

/**
 * Middleware to check if user is any advisor role (including admin and supervisor)
 */
export const requireAdvisor = requireRole("admin", "supervisor", "asesor");
