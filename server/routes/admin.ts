/**
 * Admin API Routes
 * Handles users, roles, queues, CRM field config, and general settings
 */

import { Router } from "express";
import { adminDb } from "../admin-db";
import { validateBody, validateParams } from "../middleware/validate";
import { createUserSchema, updateUserSchema, userIdSchema } from "../schemas/validation";
import logger from "../utils/logger";
import { getCrmGateway } from "../crm/ws";
import { requireAdmin, requireSupervisor } from "../middleware/roles";

export function createAdminRouter(): Router {
  const router = Router();

  // ============================================
  // USERS ENDPOINTS
  // ============================================

  /**
   * GET /api/admin/users
   * Get all users
   */
  router.get("/users", (req, res) => {
    try {
      const users = adminDb.getAllUsers();
      res.json({ users });
    } catch (error) {
      logger.error("[Admin] Error getting users:", error);
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  /**
   * GET /api/admin/users/:id
   * Get user by ID
   */
  router.get("/users/:id", validateParams(userIdSchema), (req, res) => {
    try {
      const { id } = req.params;
      const user = adminDb.getUserById(id);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.json({ user });
    } catch (error) {
      logger.error("[Admin] Error getting user:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  /**
   * POST /api/admin/users
   * Create new user
   */
  router.post("/users", requireAdmin, validateBody(createUserSchema), async (req, res) => {
    try {
      const { username, email, password, name, role, status } = req.body;

      // Check if username already exists
      const existingUser = adminDb.getUserByUsername(username);
      if (existingUser) {
        res.status(409).json({ error: "Username already exists" });
        return;
      }

      const user = await adminDb.createUser({
        username,
        email,
        password,
        name,
        role,
        status, // Will be "active" by default from schema
      });

      res.status(201).json({ user });
    } catch (error) {
      logger.error("[Admin] Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  /**
   * PUT /api/admin/users/:id
   * Update user
   */
  router.put("/users/:id", requireAdmin, validateParams(userIdSchema), validateBody(updateUserSchema), async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const user = await adminDb.updateUser(id, updates);

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({ user });
    } catch (error) {
      logger.error("[Admin] Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  /**
   * DELETE /api/admin/users/:id
   * Delete user
   */
  router.delete("/users/:id", requireAdmin, validateParams(userIdSchema), (req, res) => {
    try {
      const { id } = req.params;
      const deleted = adminDb.deleteUser(id);

      if (!deleted) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      logger.error("[Admin] Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // ============================================
  // ROLES ENDPOINTS
  // ============================================

  /**
   * GET /api/admin/roles
   * Get all roles
   */
  router.get("/roles", (req, res) => {
    try {
      const roles = adminDb.getAllRoles();
      res.json({ roles });
    } catch (error) {
      logger.error("[Admin] Error getting roles:", error);
      res.status(500).json({ error: "Failed to get roles" });
    }
  });

  /**
   * GET /api/admin/roles/:id
   * Get role by ID
   */
  router.get("/roles/:id", (req, res) => {
    try {
      const { id } = req.params;
      const role = adminDb.getRoleById(id);
      if (!role) {
        res.status(404).json({ error: "Role not found" });
        return;
      }
      res.json({ role });
    } catch (error) {
      console.error("[Admin] Error getting role:", error);
      res.status(500).json({ error: "Failed to get role" });
    }
  });

  /**
   * POST /api/admin/roles
   * Create new role
   */
  router.post("/roles", (req, res) => {
    try {
      const { name, description, permissions } = req.body;

      if (!name || !description) {
        res.status(400).json({ error: "Name and description are required" });
        return;
      }

      const role = adminDb.createRole({
        name,
        description,
        permissions: permissions || [],
      });

      res.status(201).json({ role });
    } catch (error) {
      console.error("[Admin] Error creating role:", error);
      res.status(500).json({ error: "Failed to create role" });
    }
  });

  /**
   * PUT /api/admin/roles/:id
   * Update role
   */
  router.put("/roles/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, permissions } = req.body;

      const role = adminDb.updateRole(id, {
        name,
        description,
        permissions,
      });

      if (!role) {
        res.status(404).json({ error: "Role not found" });
        return;
      }

      res.json({ role });
    } catch (error) {
      console.error("[Admin] Error updating role:", error);
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  /**
   * DELETE /api/admin/roles/:id
   * Delete role
   */
  router.delete("/roles/:id", (req, res) => {
    try {
      const { id } = req.params;
      const deleted = adminDb.deleteRole(id);

      if (!deleted) {
        res.status(400).json({ error: "Cannot delete default system roles" });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[Admin] Error deleting role:", error);
      res.status(500).json({ error: "Failed to delete role" });
    }
  });

  // ============================================
  // QUEUES ENDPOINTS
  // ============================================

  /**
   * GET /api/admin/queues
   * Get all queues
   */
  router.get("/queues", (req, res) => {
    try {
      const queues = adminDb.getAllQueues();
      res.json({ queues });
    } catch (error) {
      console.error("[Admin] Error getting queues:", error);
      res.status(500).json({ error: "Failed to get queues" });
    }
  });

  /**
   * GET /api/admin/queues/:id
   * Get queue by ID
   */
  router.get("/queues/:id", (req, res) => {
    try {
      const { id } = req.params;
      const queue = adminDb.getQueueById(id);
      if (!queue) {
        res.status(404).json({ error: "Queue not found" });
        return;
      }
      res.json({ queue });
    } catch (error) {
      console.error("[Admin] Error getting queue:", error);
      res.status(500).json({ error: "Failed to get queue" });
    }
  });

  /**
   * POST /api/admin/queues
   * Create new queue
   */
  router.post("/queues", requireSupervisor, (req, res) => {
    try {
      const { name, description, status, distributionMode, maxConcurrent, assignedAdvisors } = req.body;

      if (!name || !description) {
        res.status(400).json({ error: "Name and description are required" });
        return;
      }

      const queue = adminDb.createQueue({
        name,
        description,
        status: status || "active",
        distributionMode: distributionMode || "round-robin",
        maxConcurrent: maxConcurrent || 5,
        assignedAdvisors: assignedAdvisors || [],
      });

      res.status(201).json({ queue });
    } catch (error) {
      console.error("[Admin] Error creating queue:", error);
      res.status(500).json({ error: "Failed to create queue" });
    }
  });

  /**
   * PUT /api/admin/queues/:id
   * Update queue
   */
  router.put("/queues/:id", requireSupervisor, (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, status, distributionMode, maxConcurrent, assignedAdvisors } = req.body;

      const queue = adminDb.updateQueue(id, {
        name,
        description,
        status,
        distributionMode,
        maxConcurrent,
        assignedAdvisors,
      });

      if (!queue) {
        res.status(404).json({ error: "Queue not found" });
        return;
      }

      res.json({ queue });
    } catch (error) {
      console.error("[Admin] Error updating queue:", error);
      res.status(500).json({ error: "Failed to update queue" });
    }
  });

  /**
   * DELETE /api/admin/queues/:id
   * Delete queue
   */
  router.delete("/queues/:id", requireSupervisor, (req, res) => {
    try {
      const { id } = req.params;
      const deleted = adminDb.deleteQueue(id);

      if (!deleted) {
        res.status(404).json({ error: "Queue not found" });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[Admin] Error deleting queue:", error);
      res.status(500).json({ error: "Failed to delete queue" });
    }
  });

  // ============================================
  // CRM FIELD CONFIG ENDPOINTS
  // ============================================

  /**
   * GET /api/admin/crm-fields
   * Get CRM field configuration
   */
  router.get("/crm-fields", (req, res) => {
    try {
      const config = adminDb.getCRMFieldConfig();
      res.json({ config });
    } catch (error) {
      console.error("[Admin] Error getting CRM field config:", error);
      res.status(500).json({ error: "Failed to get CRM field config" });
    }
  });

  /**
   * PUT /api/admin/crm-fields
   * Update CRM field configuration
   */
  router.put("/crm-fields", (req, res) => {
    try {
      const { enabledFields } = req.body;

      if (!Array.isArray(enabledFields)) {
        res.status(400).json({ error: "enabledFields must be an array" });
        return;
      }

      const config = adminDb.updateCRMFieldConfig(enabledFields);
      res.json({ config });
    } catch (error) {
      console.error("[Admin] Error updating CRM field config:", error);
      res.status(500).json({ error: "Failed to update CRM field config" });
    }
  });

  // ============================================
  // SETTINGS ENDPOINTS
  // ============================================

  /**
   * GET /api/admin/settings
   * Get general settings
   */
  router.get("/settings", (req, res) => {
    try {
      const settings = adminDb.getSettings();
      res.json({ settings });
    } catch (error) {
      console.error("[Admin] Error getting settings:", error);
      res.status(500).json({ error: "Failed to get settings" });
    }
  });

  /**
   * PUT /api/admin/settings
   * Update general settings
   */
  router.put("/settings", (req, res) => {
    try {
      const settings = adminDb.updateSettings(req.body);
      res.json({ settings });
    } catch (error) {
      console.error("[Admin] Error updating settings:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // ============================================
  // ADVISORS LIST (for queue assignment)
  // ============================================

  /**
   * GET /api/admin/advisors
   * Get list of advisors (users with role asesor or supervisor)
   */
  router.get("/advisors", (req, res) => {
    try {
      const allUsers = adminDb.getAllUsers();
      const advisors = allUsers
        .filter((user) => (user.role === "asesor" || user.role === "supervisor") && user.status === "active")
        .map((user) => ({
          id: user.id,
          name: user.username,
          email: user.email,
          role: user.role,
        }));
      res.json({ advisors });
    } catch (error) {
      console.error("[Admin] Error getting advisors:", error);
      res.status(500).json({ error: "Failed to get advisors" });
    }
  });

  // ============================================
  // ADVISOR STATUSES ENDPOINTS
  // ============================================

  /**
   * GET /api/admin/advisor-statuses
   * Get all advisor statuses
   */
  router.get("/advisor-statuses", (req, res) => {
    try {
      const statuses = adminDb.getAllAdvisorStatuses();
      res.json({ statuses });
    } catch (error) {
      console.error("[Admin] Error getting advisor statuses:", error);
      res.status(500).json({ error: "Failed to get advisor statuses" });
    }
  });

  /**
   * GET /api/admin/advisor-statuses/:id
   * Get advisor status by ID
   */
  router.get("/advisor-statuses/:id", (req, res) => {
    try {
      const { id } = req.params;
      const status = adminDb.getAdvisorStatusById(id);
      if (!status) {
        res.status(404).json({ error: "Advisor status not found" });
        return;
      }
      res.json({ status });
    } catch (error) {
      console.error("[Admin] Error getting advisor status:", error);
      res.status(500).json({ error: "Failed to get advisor status" });
    }
  });

  /**
   * POST /api/admin/advisor-statuses
   * Create new advisor status
   */
  router.post("/advisor-statuses", requireAdmin, (req, res) => {
    try {
      const { name, description, color, action, redirectToQueue, isDefault } = req.body;

      if (!name || !description || !color || !action) {
        res.status(400).json({ error: "Name, description, color, and action are required" });
        return;
      }

      const status = adminDb.createAdvisorStatus({
        name,
        description,
        color,
        action,
        redirectToQueue,
        isDefault,
      });

      res.status(201).json({ status });
    } catch (error) {
      console.error("[Admin] Error creating advisor status:", error);
      res.status(500).json({ error: "Failed to create advisor status" });
    }
  });

  /**
   * PUT /api/admin/advisor-statuses/:id
   * Update advisor status
   */
  router.put("/advisor-statuses/:id", requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, color, action, redirectToQueue, isDefault, order } = req.body;

      const status = adminDb.updateAdvisorStatus(id, {
        name,
        description,
        color,
        action,
        redirectToQueue,
        isDefault,
        order,
      });

      if (!status) {
        res.status(404).json({ error: "Advisor status not found" });
        return;
      }

      res.json({ status });
    } catch (error) {
      console.error("[Admin] Error updating advisor status:", error);
      res.status(500).json({ error: "Failed to update advisor status" });
    }
  });

  /**
   * DELETE /api/admin/advisor-statuses/:id
   * Delete advisor status
   */
  router.delete("/advisor-statuses/:id", requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const deleted = adminDb.deleteAdvisorStatus(id);

      if (!deleted) {
        res.status(400).json({ error: "Cannot delete default status or status not found" });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[Admin] Error deleting advisor status:", error);
      res.status(500).json({ error: "Failed to delete advisor status" });
    }
  });

  // ============================================
  // ADVISOR STATUS ASSIGNMENT ENDPOINTS
  // ============================================

  /**
   * GET /api/admin/advisor-status/:userId
   * Get current status of an advisor
   */
  router.get("/advisor-status/:userId", (req, res) => {
    try {
      const { userId } = req.params;
      const assignment = adminDb.getAdvisorStatus(userId);

      if (!assignment) {
        // Return default status if no assignment
        const defaultStatus = adminDb.getDefaultAdvisorStatus();
        res.json({ assignment: null, defaultStatus });
        return;
      }

      const status = adminDb.getAdvisorStatusById(assignment.statusId);
      res.json({ assignment, status });
    } catch (error) {
      console.error("[Admin] Error getting advisor status assignment:", error);
      res.status(500).json({ error: "Failed to get advisor status assignment" });
    }
  });

  /**
   * POST /api/admin/advisor-status/:userId
   * Set current status of an advisor
   */
  router.post("/advisor-status/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { statusId } = req.body;

      if (!statusId) {
        res.status(400).json({ error: "statusId is required" });
        return;
      }

      const assignment = adminDb.setAdvisorStatus(userId, statusId);
      const status = adminDb.getAdvisorStatusById(statusId);

      // Emit real-time presence update via WebSocket
      const gateway = getCrmGateway();
      if (gateway) {
        const { crmDb } = await import("../crm/db");
        const user = adminDb.getUserById(userId);

        if (user) {
          // Count active conversations for this advisor
          const conversations = crmDb.listConversations();
          const activeConversations = conversations.filter(
            conv => conv.assignedTo === userId && conv.status === "attending"
          ).length;

          // Simple online detection: if status is NOT "offline", consider online
          const isOnline = status ? status.id !== "status-offline" : false;

          const presencePayload = {
            userId: user.id,
            user: { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role },
            status,
            isOnline,
            activeConversations,
          };

          gateway.emitAdvisorPresenceUpdate(presencePayload);

          // RELEASE CONVERSATIONS: If advisor becomes unavailable, release assigned conversations
          if (status?.action === "pause" || status?.action === "redirect") {
            const advisorConversations = conversations.filter(
              conv => conv.assignedTo === userId && conv.status === "attending"
            );

            if (advisorConversations.length > 0) {
              logger.info(`[Status-change] Advisor ${userId} is now ${status.action}. Releasing ${advisorConversations.length} conversation(s)`);

              for (const conv of advisorConversations) {
                // Release conversation (back to active/queue)
                crmDb.releaseConversation(conv.id);

                // If status has redirectToQueue, assign to that queue
                if (status.action === "redirect" && status.redirectToQueue) {
                  crmDb.updateConversationQueue(conv.id, status.redirectToQueue);
                  logger.info(`[Status-change] ✅ Conversation ${conv.id} redirected to queue: ${status.redirectToQueue}`);
                } else {
                  logger.info(`[Status-change] ✅ Conversation ${conv.id} released back to queue`);
                }

                // Emit WebSocket update
                gateway.emitConversationUpdate({
                  conversation: crmDb.getConversationById(conv.id)!
                });

                // Create system message
                crmDb.appendMessage({
                  convId: conv.id,
                  direction: "outgoing",
                  type: "system",
                  text: `⏸️ Asesor ${user.name || user.username} cambió su estado - Conversación devuelta a la cola`,
                  mediaUrl: null,
                  mediaThumb: null,
                  repliedToId: null,
                  status: "sent",
                });
              }

              // Try to reassign to other available advisors
              const allQueues = adminDb.getAllQueues();
              for (const conv of advisorConversations) {
                const updatedConv = crmDb.getConversationById(conv.id);
                if (updatedConv && updatedConv.queueId) {
                  const queue = allQueues.find(q => q.id === updatedConv.queueId);
                  if (queue) {
                    // Find available advisor in this queue
                    for (const advisorId of queue.assignedAdvisors) {
                      if (advisorId === userId) continue; // Skip the advisor who just went unavailable

                      const otherAdvisorStatus = adminDb.getAdvisorStatus(advisorId);
                      if (otherAdvisorStatus) {
                        const otherStatus = adminDb.getAdvisorStatusById(otherAdvisorStatus.statusId);
                        if (otherStatus?.action === "accept") {
                          crmDb.assignConversation(updatedConv.id, advisorId);
                          logger.info(`[Status-change] 🎯 Auto-reassigned conversation ${updatedConv.id} to advisor ${advisorId}`);

                          gateway.emitConversationUpdate({
                            conversation: crmDb.getConversationById(updatedConv.id)!
                          });
                          break;
                        }
                      }
                    }
                  }
                }
              }
            }
          }

          // AUTO-ASSIGNMENT: If advisor becomes available, assign waiting conversations
          if (status?.action === "accept") {
            // Find queues where this advisor is assigned
            const allQueues = adminDb.getAllQueues();
            const advisorQueues = allQueues.filter(q => q.assignedAdvisors.includes(userId));

            if (advisorQueues.length > 0) {
              logger.info(`[Auto-assign] Advisor ${userId} is now available. Checking queues:`, advisorQueues.map(q => q.id));

              // Get all waiting conversations in advisor's queues
              for (const queue of advisorQueues) {
                const waitingConversations = conversations.filter(
                  conv => conv.queueId === queue.id &&
                          conv.status === "active" &&
                          !conv.assignedTo
                );

                if (waitingConversations.length > 0) {
                  // Sort by creation time (oldest first)
                  waitingConversations.sort((a, b) =>
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                  );

                  // Assign the oldest waiting conversation
                  const conversationToAssign = waitingConversations[0];
                  crmDb.assignConversation(conversationToAssign.id, userId);
                  logger.info(`[Auto-assign] ✅ Assigned conversation ${conversationToAssign.id} to advisor ${userId} from queue ${queue.name}`);

                  // Emit WebSocket update for the assigned conversation
                  gateway.emitConversationUpdate({
                    conversation: crmDb.getConversationById(conversationToAssign.id)!
                  });

                  // Only assign one conversation at a time
                  break;
                }
              }
            }
          }
        }
      }

      res.json({ assignment, status });
    } catch (error) {
      console.error("[Admin] Error setting advisor status:", error);
      res.status(500).json({ error: "Failed to set advisor status" });
    }
  });

  // ============================================
  // WHATSAPP NUMBER ASSIGNMENTS ENDPOINTS
  // ============================================

  /**
   * GET /api/admin/whatsapp-numbers
   * Get all WhatsApp number assignments
   */
  router.get("/whatsapp-numbers", (req, res) => {
    try {
      const numbers = adminDb.getAllWhatsAppNumbers();
      res.json({ numbers });
    } catch (error) {
      logger.error("[Admin] Error getting WhatsApp numbers:", error);
      res.status(500).json({ error: "Failed to get WhatsApp numbers" });
    }
  });

  /**
   * POST /api/admin/whatsapp-numbers
   * Add new WhatsApp number assignment
   */
  router.post("/whatsapp-numbers", (req, res) => {
    try {
      const { displayName, phoneNumber, queueId } = req.body;

      if (!displayName || !phoneNumber) {
        res.status(400).json({ error: "displayName and phoneNumber are required" });
        return;
      }

      const number = adminDb.createWhatsAppNumber({
        displayName,
        phoneNumber,
        queueId,
      });

      res.status(201).json({ number });
    } catch (error) {
      logger.error("[Admin] Error creating WhatsApp number:", error);
      res.status(500).json({ error: "Failed to create WhatsApp number" });
    }
  });

  /**
   * PUT /api/admin/whatsapp-numbers/:id
   * Update WhatsApp number assignment
   */
  router.put("/whatsapp-numbers/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { displayName, phoneNumber, queueId } = req.body;

      const number = adminDb.updateWhatsAppNumber(id, {
        displayName,
        phoneNumber,
        queueId,
      });

      if (!number) {
        res.status(404).json({ error: "WhatsApp number not found" });
        return;
      }

      res.json({ number });
    } catch (error) {
      logger.error("[Admin] Error updating WhatsApp number:", error);
      res.status(500).json({ error: "Failed to update WhatsApp number" });
    }
  });

  /**
   * DELETE /api/admin/whatsapp-numbers/:id
   * Delete WhatsApp number assignment
   */
  router.delete("/whatsapp-numbers/:id", (req, res) => {
    try {
      const { id } = req.params;
      const deleted = adminDb.deleteWhatsAppNumber(id);

      if (!deleted) {
        res.status(404).json({ error: "WhatsApp number not found" });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      logger.error("[Admin] Error deleting WhatsApp number:", error);
      res.status(500).json({ error: "Failed to delete WhatsApp number" });
    }
  });

  // ============================================
  // ADVISOR PRESENCE ENDPOINT
  // ============================================

  /**
   * GET /api/admin/advisor-presence
   * Get real-time presence status of all advisors
   * Shows: online status, current status (disponible, ocupado, etc), active conversations count
   */
  router.get("/advisor-presence", async (req, res) => {
    try {
      const { crmDb } = await import("../crm/db");
      const users = adminDb.getAllUsers();
      const statuses = adminDb.getAllAdvisorStatuses();

      // Filter only advisors and supervisors
      const advisorUsers = users.filter(u => u.role === "asesor" || u.role === "supervisor");

      const advisorPresence = advisorUsers.map(user => {
        // Get current status assignment
        const assignment = adminDb.getAdvisorStatus(user.id);
        const status = assignment ? adminDb.getAdvisorStatusById(assignment.statusId) : null;

        // Count active conversations for this advisor
        const conversations = crmDb.listConversations();
        const activeConversations = conversations.filter(
          conv => conv.assignedTo === user.id && conv.status === "attending"
        ).length;

        // Simple online detection: if status is NOT "offline", consider online
        // TODO: Enhance with WebSocket presence tracking
        const isOnline = status ? status.id !== "status-offline" : false;

        return {
          userId: user.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
            role: user.role
          },
          status,
          isOnline,
          activeConversations
        };
      });

      res.json({ advisors: advisorPresence });
    } catch (error) {
      logger.error("[Admin] Error getting advisor presence:", error);
      res.status(500).json({ error: "Failed to get advisor presence" });
    }
  });

  return router;
}
