import { Request, Response, NextFunction } from "express";

export type UserRole = "admin" | "supervisor" | "asesor";

/**
 * Middleware to check if user has required role
 * @param allowedRoles - Array of roles that can access this route
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      console.log(`[Auth] ❌ 401 - No authenticated user for ${req.method} ${req.path}`);
      res.status(401).json({ error: "not_authenticated" });
      return;
    }

    const userRole = req.user.role as UserRole;

    if (!allowedRoles.includes(userRole)) {
      console.log(`[Auth] ❌ 403 - User role '${userRole}' not allowed for ${req.method} ${req.path}. Required: ${allowedRoles.join(" or ")}`);
      res.status(403).json({
        error: "forbidden",
        message: `Se requiere rol: ${allowedRoles.join(" o ")}. Tu rol actual: ${userRole}`
      });
      return;
    }

    console.log(`[Auth] ✅ User '${req.user.userId}' (${userRole}) authorized for ${req.method} ${req.path}`);
    next();
  };
}

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = requireRole("admin");

/**
 * Middleware to check if user is admin or supervisor
 * Also accepts Gerencia role (role-1761832887172)
 */
export function requireSupervisor(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    console.log(`[Auth] ❌ 401 - No authenticated user for ${req.method} ${req.path}`);
    res.status(401).json({ error: "not_authenticated" });
    return;
  }

  const userRole = req.user.role as string;
  const allowedRoles = ["admin", "supervisor", "role-1761832887172", "gerencia"];

  if (!allowedRoles.includes(userRole)) {
    console.log(`[Auth] ❌ 403 - User role '${userRole}' not allowed for ${req.method} ${req.path}. Required: admin, supervisor, or gerencia`);
    res.status(403).json({
      error: "forbidden",
      message: `Se requiere rol: admin, supervisor o gerencia. Tu rol actual: ${userRole}`
    });
    return;
  }

  console.log(`[Auth] ✅ User '${req.user.userId}' (${userRole}) authorized for ${req.method} ${req.path}`);
  next();
}

/**
 * Middleware to check if user is any advisor role (including admin and supervisor)
 */
export const requireAdvisor = requireRole("admin", "supervisor", "asesor");
