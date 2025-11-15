/**
 * Centralized Zod validation schemas for API endpoints
 */
import { z } from 'zod';

// ==================== USER SCHEMAS ====================

export const userLoginSchema = z.object({
  username: z.string().min(1, "Username is required").max(100),
  password: z.string().min(1, "Password is required"),
});

export const userCreateSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email format").optional(),
  role: z.enum(['admin', 'supervisor', 'asesor', 'gerencia']),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const userUpdateSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'supervisor', 'asesor', 'gerencia']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  password: z.string().min(6).optional(),
});

// ==================== CONVERSATION SCHEMAS ====================

export const conversationIdSchema = z.object({
  id: z.string().uuid("Invalid conversation ID format"),
});

export const phoneNumberSchema = z.string()
  .regex(/^\d{8,15}$/, "Phone number must be 8-15 digits");

export const conversationSearchSchema = z.object({
  query: z.string().min(1).max(200).optional(),
  status: z.enum(['active', 'attending', 'archived']).optional(),
  assignedTo: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

// ==================== MESSAGE SCHEMAS ====================

export const messageCreateSchema = z.object({
  conversationId: z.string().uuid(),
  text: z.string().max(4096).optional(),
  type: z.enum(['text', 'image', 'video', 'audio', 'document', 'location', 'system', 'event']),
  mediaUrl: z.string().url().optional(),
  repliedToId: z.string().uuid().optional(),
});

// ==================== CAMPAIGN SCHEMAS ====================

export const campaignCreateSchema = z.object({
  name: z.string().min(1, "Campaign name is required").max(200),
  description: z.string().max(1000).optional(),
  templateId: z.string().optional(),
  scheduledFor: z.number().int().positive().optional(),
  status: z.enum(['draft', 'scheduled', 'running', 'completed', 'cancelled']).default('draft'),
});

export const campaignUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['draft', 'scheduled', 'running', 'completed', 'cancelled']).optional(),
  scheduledFor: z.number().int().positive().optional(),
});

// ==================== ADVISOR SCHEMAS ====================

export const advisorStatusSchema = z.object({
  statusId: z.string().uuid(),
  note: z.string().max(500).optional(),
});

// ==================== FLOW SCHEMAS ====================

export const flowIdSchema = z.object({
  id: z.string().uuid(),
});

export const flowCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  nodes: z.array(z.any()), // Complex validation for flow nodes
  edges: z.array(z.any()),
  isActive: z.boolean().default(true),
});

// ==================== WEBHOOK SCHEMAS ====================

export const whatsappWebhookSchema = z.object({
  object: z.string(),
  entry: z.array(z.object({
    id: z.string(),
    changes: z.array(z.object({
      value: z.any(),
      field: z.string(),
    })),
  })),
});

// ==================== ATTACHMENT SCHEMAS ====================

export const attachmentUploadSchema = z.object({
  messageId: z.string().uuid().optional(),
  filename: z.string().min(1).max(255),
  mimetype: z.string().regex(/^[a-z]+\/[a-z0-9\-\+\.]+$/i, "Invalid MIME type"),
  size: z.number().int().positive().max(100 * 1024 * 1024), // 100MB max
});

// ==================== QUERY PARAMS ====================

export const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).default("50"),
});

export const timestampRangeSchema = z.object({
  startDate: z.string().regex(/^\d+$/).transform(Number).optional(),
  endDate: z.string().regex(/^\d+$/).transform(Number).optional(),
});

// ==================== HELPER TYPES ====================

export type UserLoginInput = z.infer<typeof userLoginSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type ConversationSearchInput = z.infer<typeof conversationSearchSchema>;
export type MessageCreateInput = z.infer<typeof messageCreateSchema>;
export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>;
