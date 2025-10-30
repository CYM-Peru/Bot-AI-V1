import jwt from "jsonwebtoken";

// Validate JWT_SECRET in production
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// Fail fast if JWT_SECRET is not set properly in production
if (process.env.NODE_ENV === "production") {
  if (
    !JWT_SECRET ||
    JWT_SECRET === "your-secret-key-change-in-production" ||
    JWT_SECRET === "your-super-secret-jwt-key-change-in-production" ||
    JWT_SECRET.length < 32
  ) {
    throw new Error(
      "JWT_SECRET must be set and be at least 32 characters long in production. " +
      "Generate a secure secret with: openssl rand -base64 32"
    );
  }
}

export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
}

/**
 * Genera un token JWT para un usuario
 */
export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verifica y decodifica un token JWT
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Extrae el token de las cookies o del header Authorization
 */
export function extractToken(cookieHeader: string | undefined, authHeader: string | undefined): string | null {
  // Primero intentar desde cookie
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    if (cookies.token) {
      return cookies.token;
    }
  }

  // Si no, intentar desde header Authorization
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Parse simple de cookies
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  cookieHeader.split(";").forEach((cookie) => {
    const [key, value] = cookie.trim().split("=");
    if (key && value) {
      cookies[key] = decodeURIComponent(value);
    }
  });
  return cookies;
}
