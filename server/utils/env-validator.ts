/**
 * Environment Variable Validator
 * Validates required and optional environment variables on startup
 */

import { logError, logWarn, logInfo } from "./file-logger";

interface EnvVarConfig {
  name: string;
  required: boolean;
  requiredInProduction?: boolean;
  default?: string;
  description: string;
  validator?: (value: string) => boolean;
  validatorMessage?: string;
}

const ENV_VARS: EnvVarConfig[] = [
  // Server Configuration
  {
    name: "PORT",
    required: false,
    default: "3000",
    description: "Server port",
    validator: (val) => !isNaN(parseInt(val)) && parseInt(val) > 0 && parseInt(val) < 65536,
    validatorMessage: "PORT must be a number between 1 and 65535",
  },
  {
    name: "NODE_ENV",
    required: false,
    default: "development",
    description: "Node environment (development, production, test)",
    validator: (val) => ["development", "production", "test"].includes(val),
    validatorMessage: "NODE_ENV must be one of: development, production, test",
  },

  // JWT Authentication
  {
    name: "JWT_SECRET",
    required: false,
    requiredInProduction: true,
    description: "JWT secret key for token signing",
    validator: (val) => val.length >= 32,
    validatorMessage: "JWT_SECRET must be at least 32 characters long",
  },
  {
    name: "JWT_EXPIRES_IN",
    required: false,
    default: "7d",
    description: "JWT token expiration time",
  },

  // WhatsApp Configuration
  {
    name: "WSP_BASE_URL",
    required: false,
    default: "https://graph.facebook.com",
    description: "WhatsApp API base URL",
    validator: (val) => val.startsWith("http://") || val.startsWith("https://"),
    validatorMessage: "WSP_BASE_URL must be a valid HTTP(S) URL",
  },
  {
    name: "WSP_API_VERSION",
    required: false,
    default: "v20.0",
    description: "WhatsApp API version",
  },
  {
    name: "WSP_PHONE_NUMBER_ID",
    required: false,
    description: "WhatsApp phone number ID",
  },
  {
    name: "WSP_ACCESS_TOKEN",
    required: false,
    description: "WhatsApp access token",
  },
  {
    name: "WSP_VERIFY_TOKEN",
    required: false,
    description: "WhatsApp webhook verify token",
  },

  // Flow Configuration
  {
    name: "DEFAULT_FLOW_ID",
    required: false,
    default: "default-flow",
    description: "Default flow ID for new conversations",
  },

  // Storage Configuration
  {
    name: "FLOW_STORAGE_TYPE",
    required: false,
    default: "local",
    description: "Flow storage type (local or database)",
    validator: (val) => ["local", "database"].includes(val),
    validatorMessage: "FLOW_STORAGE_TYPE must be either 'local' or 'database'",
  },
  {
    name: "SESSION_STORAGE_TYPE",
    required: false,
    default: "file",
    description: "Session storage type (memory, file, or redis)",
    validator: (val) => ["memory", "file", "redis"].includes(val),
    validatorMessage: "SESSION_STORAGE_TYPE must be one of: memory, file, redis",
  },

  // Logging
  {
    name: "LOG_LEVEL",
    required: false,
    default: "info",
    description: "Logging level (error, warn, info, http, debug)",
    validator: (val) => ["error", "warn", "info", "http", "debug"].includes(val),
    validatorMessage: "LOG_LEVEL must be one of: error, warn, info, http, debug",
  },

  // Security
  {
    name: "TRUST_PROXY",
    required: false,
    default: "0",
    description: "Trust proxy setting (0 or 1)",
    validator: (val) => ["0", "1", "true", "false"].includes(val),
    validatorMessage: "TRUST_PROXY must be 0, 1, true, or false",
  },

  // CORS
  {
    name: "CORS_ORIGIN",
    required: false,
    default: "http://localhost:5173",
    description: "CORS allowed origins",
  },
];

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvironmentValidationError";
  }
}

/**
 * Get environment variable value or default
 */
function getEnvValue(name: string, defaultValue?: string): string | undefined {
  const value = process.env[name];
  if (value !== undefined && value.trim() !== "") {
    return value.trim();
  }
  return defaultValue;
}

/**
 * Check if running in production
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Validate a single environment variable
 */
function validateEnvVar(config: EnvVarConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const value = getEnvValue(config.name, config.default);

  // Check if required
  const isRequired = config.required || (config.requiredInProduction && isProduction());

  if (isRequired && !value) {
    errors.push(
      `${config.name} is required${isProduction() ? " in production" : ""}: ${config.description}`
    );
    return { valid: false, errors };
  }

  // If no value and not required, skip validation
  if (!value) {
    return { valid: true, errors };
  }

  // Run custom validator if present
  if (config.validator && !config.validator(value)) {
    errors.push(config.validatorMessage || `${config.name} has an invalid value`);
    return { valid: false, errors };
  }

  return { valid: true, errors };
}

/**
 * Validate all environment variables
 */
export function validateEnvironment(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  logInfo("Validating environment variables...", { component: "EnvValidator" });

  for (const config of ENV_VARS) {
    const result = validateEnvVar(config);

    if (!result.valid) {
      errors.push(...result.errors);
    }

    // Warn if using default value in production
    const value = getEnvValue(config.name);
    if (!value && config.default && isProduction()) {
      warnings.push(
        `${config.name} is using default value "${config.default}" in production`
      );
    }
  }

  // Check for insecure JWT secret in production
  const jwtSecret = getEnvValue("JWT_SECRET");
  if (
    isProduction() &&
    jwtSecret &&
    (jwtSecret === "your-secret-key-change-in-production" ||
      jwtSecret === "your-super-secret-jwt-key-change-in-production" ||
      jwtSecret.length < 32)
  ) {
    errors.push(
      "JWT_SECRET must be changed from default value and be at least 32 characters in production"
    );
  }

  // Log warnings
  if (warnings.length > 0) {
    for (const warning of warnings) {
      logWarn(warning, { component: "EnvValidator" });
    }
  }

  // If there are errors, throw
  if (errors.length > 0) {
    const errorMessage = `Environment validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`;
    logError("Environment validation failed", new Error(errorMessage), {
      component: "EnvValidator",
      errors,
    });

    throw new ValidationError(errorMessage);
  }

  logInfo("Environment validation passed", {
    component: "EnvValidator",
    environment: process.env.NODE_ENV || "development",
    warningCount: warnings.length,
  });
}

/**
 * Get validated environment configuration
 */
export function getValidatedEnv() {
  return {
    // Server
    port: parseInt(getEnvValue("PORT", "3000")!),
    nodeEnv: getEnvValue("NODE_ENV", "development")!,

    // JWT
    jwtSecret: getEnvValue("JWT_SECRET", "your-secret-key-change-in-production")!,
    jwtExpiresIn: getEnvValue("JWT_EXPIRES_IN", "7d")!,

    // WhatsApp
    whatsapp: {
      baseUrl: getEnvValue("WSP_BASE_URL", "https://graph.facebook.com")!,
      apiVersion: getEnvValue("WSP_API_VERSION", "v20.0")!,
      phoneNumberId: getEnvValue("WSP_PHONE_NUMBER_ID"),
      accessToken: getEnvValue("WSP_ACCESS_TOKEN"),
      verifyToken: getEnvValue("WSP_VERIFY_TOKEN"),
    },

    // Storage
    flowStorageType: getEnvValue("FLOW_STORAGE_TYPE", "local")!,
    sessionStorageType: getEnvValue("SESSION_STORAGE_TYPE", "file")!,

    // Logging
    logLevel: getEnvValue("LOG_LEVEL", "info")!,

    // Security
    trustProxy: getEnvValue("TRUST_PROXY", "1") === "1" || getEnvValue("TRUST_PROXY") === "true",

    // CORS
    corsOrigin: getEnvValue("CORS_ORIGIN", "http://localhost:5173")!,
  };
}

/**
 * Print environment configuration (sanitized, without secrets)
 */
export function printEnvironmentConfig(): void {
  const config = getValidatedEnv();

  logInfo("Environment Configuration:", {
    component: "EnvValidator",
    port: config.port,
    nodeEnv: config.nodeEnv,
    flowStorageType: config.flowStorageType,
    sessionStorageType: config.sessionStorageType,
    logLevel: config.logLevel,
    trustProxy: config.trustProxy,
    corsOrigin: config.corsOrigin,
    whatsapp: {
      configured: !!(config.whatsapp.phoneNumberId && config.whatsapp.accessToken),
      apiVersion: config.whatsapp.apiVersion,
    },
    jwt: {
      configured: !!config.jwtSecret,
      expiresIn: config.jwtExpiresIn,
    },
  });
}
