import { z } from "zod";
import { flowIdSchema, sanitizeString } from "../middleware/validation";

/**
 * Schema para crear/actualizar flow
 */
export const saveFlowSchema = {
  params: z.object({
    flowId: flowIdSchema,
  }),
  body: z.object({
    id: flowIdSchema,
    name: sanitizeString.min(1, "Flow name is required").max(100),
    nodes: z.array(z.any()), // Validación básica, los nodos tienen su propia validación
    edges: z.array(z.any()),
    // Campos opcionales
    description: sanitizeString.max(500).optional(),
    version: z.string().optional(),
    tags: z.array(sanitizeString).optional(),
  }),
};

/**
 * Schema para obtener un flow
 */
export const getFlowSchema = {
  params: z.object({
    flowId: flowIdSchema,
  }),
};

/**
 * Schema para simular inicio de conversación
 */
export const simulateStartSchema = {
  body: z.object({
    flowId: flowIdSchema,
    sessionId: z.string().min(1, "Session ID is required").max(100),
    contactId: sanitizeString.min(1, "Contact ID is required").max(100),
    channel: z.enum(["whatsapp", "web", "api"], {
      errorMap: () => ({ message: "Invalid channel" }),
    }).default("web"),
  }),
};

/**
 * Schema para simular mensaje
 */
export const simulateMessageSchema = {
  body: z.object({
    sessionId: z.string().min(1, "Session ID is required").max(100),
    message: sanitizeString.min(1, "Message is required").max(4096),
  }),
};

/**
 * Schema para validar flow
 */
export const validateFlowSchema = {
  body: z.object({
    flow: z.object({
      nodes: z.array(z.any()).min(1, "Flow must have at least one node"),
      edges: z.array(z.any()),
    }),
    channel: z.enum(["whatsapp", "web", "api"]).optional(),
  }),
};
