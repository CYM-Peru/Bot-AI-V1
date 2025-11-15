import rateLimit from "express-rate-limit";

/**
 * Rate limiter for authentication endpoints (login, register)
 * More restrictive to prevent brute force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: "Too many authentication attempts. Please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip successful requests from counting against the limit
  skipSuccessfulRequests: false,
});

/**
 * Rate limiter for general API endpoints
 * Moderate limits for normal API usage
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for WhatsApp webhook endpoint
 * More lenient as it receives legitimate traffic from Meta
 */
export const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit to 60 requests per minute (1 per second average)
  message: {
    error: "Webhook rate limit exceeded.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting based on custom logic if needed
  skip: (req) => {
    // Optionally, you could skip rate limiting for verified Meta requests
    // by checking specific headers or IPs
    return false;
  },
});

/**
 * Rate limiter for flow creation/update endpoints
 * Prevent abuse of resource-intensive operations
 */
export const flowLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit to 30 flow operations per 15 minutes
  message: {
    error: "Too many flow operations. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for metrics endpoints
 * More lenient for real-time dashboard updates with polling
 */
export const metricsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // Limit to 120 requests per minute (2 per second average)
  message: {
    error: "Metrics rate limit exceeded. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
