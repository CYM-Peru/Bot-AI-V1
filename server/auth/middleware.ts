import type { Request, Response, NextFunction } from "express";
import { extractToken, verifyToken, type JwtPayload } from "./jwt";

// Extender el tipo Request de Express para incluir user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware que verifica si el usuario está autenticado
 * Agrega req.user con los datos del usuario si el token es válido
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req.headers.cookie, req.headers.authorization);

  if (!token) {
    res.status(401).json({ error: "unauthorized", message: "No token provided" });
    return;
  }

  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: "unauthorized", message: "Invalid or expired token" });
    return;
  }

  // Agregar usuario al request
  req.user = payload;
  next();
}

/**
 * Middleware que verifica si el usuario tiene un rol específico
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "unauthorized", message: "Authentication required" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: "forbidden", message: "Insufficient permissions" });
      return;
    }

    next();
  };
}

/**
 * Middleware opcional de autenticación
 * No bloquea la petición si no hay token, solo agrega req.user si hay uno válido
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req.headers.cookie, req.headers.authorization);

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }

  next();
}
