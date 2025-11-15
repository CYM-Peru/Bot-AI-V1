import jwt from "jsonwebtoken";

// Lazy loading of JWT_SECRET to allow dotenv to load first
let JWT_SECRET: string | undefined;
let JWT_EXPIRES_IN: string;

function getJwtSecret(): string {
  if (!JWT_SECRET) {
    JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET || JWT_SECRET.length < 32) {
      throw new Error(
        "JWT_SECRET must be set in environment variables and be at least 32 characters long. " +
        "Generate a strong secret with: openssl rand -base64 32"
      );
    }
  }
  return JWT_SECRET;
}

function getJwtExpiresIn(): string {
  if (!JWT_EXPIRES_IN) {
    JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h"; // Reduced from 7d to 24h for better security
  }
  return JWT_EXPIRES_IN;
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
  // @ts-ignore - Type mismatch with jsonwebtoken library version
  return jwt.sign(payload, getJwtSecret(), { expiresIn: getJwtExpiresIn() });
}

/**
 * Verifica y decodifica un token JWT
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
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
