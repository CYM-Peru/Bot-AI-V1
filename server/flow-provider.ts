import { type Flow } from "../src/flow/types";
import { type FlowProvider } from "../src/runtime/engine";
import { promises as fs } from "fs";
import path from "path";

/**
 * LocalStorageFlowProvider
 *
 * Stores flows as JSON files in a local directory.
 * In production, you should replace this with a database-backed implementation.
 */
export class LocalStorageFlowProvider implements FlowProvider {
  private readonly storageDir: string;
  private flowCache: Map<string, Flow> = new Map();

  constructor(storageDir: string = "./data/flows") {
    this.storageDir = storageDir;
    this.ensureStorageDir();
  }

  async getFlow(flowId: string): Promise<any> {
    // Check cache first
    if (this.flowCache.has(flowId)) {
      const cached = this.flowCache.get(flowId)!;
      // Handle both formats: {flow, positions, viewport} or just flow
      const flow = cached.flow || cached;
      console.log(`[FlowProvider] 📦 Returning CACHED flow ${flowId}:`, {
        flowId: flow.id,
        rootId: flow.rootId,
        nodeCount: Object.keys(flow.nodes || {}).length,
        hasWrappedFormat: !!cached.flow
      });
      return cached;
    }

    try {
      const filePath = this.getFlowPath(flowId);
      const fileContent = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(fileContent);

      console.log(`[FlowProvider] 📄 Parsed file for ${flowId}:`, {
        hasWrappedFormat: !!parsed.flow,
        hasPositions: !!parsed.positions,
        hasViewport: !!parsed.viewport,
        topLevelKeys: Object.keys(parsed).slice(0, 5)
      });

      // Validate we have a valid flow
      const flow = parsed.flow || parsed;

      console.log(`[FlowProvider] 🔍 Extracted flow:`, {
        flowId: flow.id,
        rootId: flow.rootId,
        nodeCount: Object.keys(flow.nodes || {}).length,
        hasNodes: !!flow.nodes
      });

      if (!flow.id) {
        console.error(`[ERROR] Flow ${flowId} is missing an ID field`);
        return null;
      }

      // FIXED: Return the COMPLETE object {flow, positions, viewport} if it exists
      // This preserves node positions and viewport when loading in the editor
      // For backward compatibility, also handle legacy format (just the flow object)
      const result = parsed.flow ? parsed : flow;

      // Cache the full object
      this.flowCache.set(flowId, result);
      console.log(`[FlowProvider] ✅ Cached flow ${flowId} with positions:`, !!parsed.positions);

      return result;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      console.error(`[ERROR] Failed to load flow ${flowId}:`, error);
      return null;
    }
  }

  async saveFlow(flowId: string, flow: Flow): Promise<void> {
    try {
      const filePath = this.getFlowPath(flowId);
      await fs.writeFile(filePath, JSON.stringify(flow, null, 2), "utf-8");

      // Update cache
      this.flowCache.set(flowId, flow);

      console.log(`[INFO] Flow ${flowId} saved successfully`);
    } catch (error) {
      console.error(`[ERROR] Failed to save flow ${flowId}:`, error);
      throw error;
    }
  }

  async listFlows(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.storageDir);
      return files
        .filter((file) => file.endsWith(".json"))
        .map((file) => file.replace(".json", ""));
    } catch (error) {
      console.error("[ERROR] Failed to list flows:", error);
      return [];
    }
  }

  async getAllFlows(): Promise<Flow[]> {
    try {
      const flowIds = await this.listFlows();
      const flows: Flow[] = [];
      for (const id of flowIds) {
        const stored = await this.getFlow(id);
        if (stored) {
          // Extract flow from wrapped format if needed
          const flow = stored.flow || stored;
          if (flow) flows.push(flow);
        }
      }
      return flows;
    } catch (error) {
      console.error("[ERROR] Failed to get all flows:", error);
      return [];
    }
  }

  async findFlowByWhatsAppNumber(phoneNumberId: string): Promise<Flow | null> {
    try {
      // CRITICAL: Map phoneNumberId (from Meta) to numberId (from admin panel)
      // This is needed because flows store numberId, but webhook sends phoneNumberId
      const numberIdMappings = await this.getPhoneNumberIdMappings();
      const matchingNumberIds = [phoneNumberId]; // Start with direct phoneNumberId

      // Add mapped numberId if found
      if (numberIdMappings[phoneNumberId]) {
        matchingNumberIds.push(numberIdMappings[phoneNumberId]);
      }

      const allFlows = await this.getAllFlows();
      for (const flow of allFlows) {
        const assignments = flow.channelAssignments || [];
        const whatsappAssignment = assignments.find((a: any) => a.channelType === 'whatsapp');
        if (whatsappAssignment && whatsappAssignment.whatsappNumbers) {
          // Check if any of the matching IDs is in the assignment
          for (const numberId of matchingNumberIds) {
            if (whatsappAssignment.whatsappNumbers.includes(numberId)) {
              return flow;
            }
          }
        }
      }
      return null;
    } catch (error) {
      console.error("[ERROR] Failed to find flow by WhatsApp number:", error);
      return null;
    }
  }

  /**
   * Maps phoneNumberId (from Meta/WhatsApp) to numberId (from admin panel)
   * Returns a mapping object: { phoneNumberId: numberId }
   */
  private async getPhoneNumberIdMappings(): Promise<Record<string, string>> {
    try {
      // Load WhatsApp connections from PostgreSQL (has phoneNumberId + displayNumber)
      const { Pool } = await import('pg');
      const pool = new Pool({
        user: process.env.POSTGRES_USER || 'whatsapp_user',
        host: process.env.POSTGRES_HOST || 'localhost',
        database: process.env.POSTGRES_DB || 'flowbuilder_crm',
        password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
      });

      const result = await pool.query(
        'SELECT phone_number_id, display_number FROM whatsapp_connections WHERE is_active = true'
      );

      await pool.end();

      const connections = result.rows.map(row => ({
        phoneNumberId: row.phone_number_id,
        displayNumber: row.display_number
      }));

      // Load admin WhatsApp numbers (has numberId + phoneNumber)
      const adminNumbersPath = path.join(process.cwd(), "data", "admin", "whatsapp-numbers.json");
      const adminNumbersData = await fs.readFile(adminNumbersPath, "utf-8");
      const adminNumbers = JSON.parse(adminNumbersData);

      // Create mapping: phoneNumberId -> numberId
      const mapping: Record<string, string> = {};

      for (const conn of connections) {
        const phoneNumberId = conn.phoneNumberId;
        const displayNumber = conn.displayNumber;

        // Find matching admin number by phone number (normalized)
        const normalizedDisplay = displayNumber.replace(/\s/g, '');
        const adminNumber = adminNumbers.find((num: any) =>
          num.phoneNumber.replace(/\s/g, '') === normalizedDisplay
        );

        if (adminNumber) {
          mapping[phoneNumberId] = adminNumber.numberId;
          console.log(`[INFO] Mapped phoneNumberId ${phoneNumberId} -> numberId ${adminNumber.numberId} (${displayNumber})`);
        }
      }

      return mapping;
    } catch (error) {
      console.error("[ERROR] Failed to get phoneNumberId mappings:", error);
      return {};
    }
  }

  async deleteFlow(flowId: string): Promise<void> {
    try {
      const filePath = this.getFlowPath(flowId);
      await fs.unlink(filePath);

      // Remove from cache
      this.flowCache.delete(flowId);

      console.log(`[INFO] Flow ${flowId} deleted successfully`);
    } catch (error) {
      console.error(`[ERROR] Failed to delete flow ${flowId}:`, error);
      throw error;
    }
  }

  clearCache(): void {
    this.flowCache.clear();
    console.log("[INFO] Flow cache cleared");
  }

  private getFlowPath(flowId: string): string {
    // Sanitize flowId to prevent directory traversal
    const sanitizedId = flowId.replace(/[^a-zA-Z0-9-_]/g, "_");
    return path.join(this.storageDir, `${sanitizedId}.json`);
  }

  private ensureStorageDir(): void {
    try {
      fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      console.error("[ERROR] Failed to create storage directory:", error);
    }
  }
}

/**
 * DatabaseFlowProvider
 *
 * Example implementation for database-backed flow storage.
 * Implement this when you add a database (PostgreSQL, MongoDB, etc.)
 */
export class DatabaseFlowProvider implements FlowProvider {
  // private db: DatabaseConnection;

  constructor(/* dbConnection: DatabaseConnection */) {
    // this.db = dbConnection;
  }

  async getFlow(flowId: string): Promise<Flow | null> {
    void flowId;
    // TODO: Implement database query
    // Example with Prisma:
    // const flow = await this.db.flow.findUnique({ where: { id: flowId } });
    // return flow ? JSON.parse(flow.data) : null;

    throw new Error("DatabaseFlowProvider not implemented yet");
  }

  async saveFlow(flowId: string, flow: Flow): Promise<void> {
    void flowId;
    void flow;
    // TODO: Implement database save
    // Example with Prisma:
    // await this.db.flow.upsert({
    //   where: { id: flowId },
    //   update: { data: JSON.stringify(flow) },
    //   create: { id: flowId, data: JSON.stringify(flow) }
    // });

    throw new Error("DatabaseFlowProvider not implemented yet");
  }

  async listFlows(): Promise<string[]> {
    throw new Error("DatabaseFlowProvider not implemented yet");
  }
}

/**
 * InMemoryFlowProvider
 *
 * Simple in-memory flow storage for testing.
 * WARNING: All flows are lost when the server restarts!
 */
export class InMemoryFlowProvider implements FlowProvider {
  private flows: Map<string, Flow> = new Map();

  async getFlow(flowId: string): Promise<Flow | null> {
    return this.flows.get(flowId) ?? null;
  }

  async saveFlow(flowId: string, flow: Flow): Promise<void> {
    this.flows.set(flowId, flow);
  }

  async listFlows(): Promise<string[]> {
    return Array.from(this.flows.keys());
  }

  async deleteFlow(flowId: string): Promise<void> {
    this.flows.delete(flowId);
  }

  clearAll(): void {
    this.flows.clear();
  }
}
