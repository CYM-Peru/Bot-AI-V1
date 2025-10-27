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

  async getFlow(flowId: string): Promise<Flow | null> {
    // Check cache first
    if (this.flowCache.has(flowId)) {
      return this.flowCache.get(flowId)!;
    }

    try {
      const filePath = this.getFlowPath(flowId);
      const fileContent = await fs.readFile(filePath, "utf-8");
      const flow = JSON.parse(fileContent) as Flow;

      // Cache the flow
      this.flowCache.set(flowId, flow);

      return flow;
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
    // TODO: Implement database query
    // Example with Prisma:
    // const flow = await this.db.flow.findUnique({ where: { id: flowId } });
    // return flow ? JSON.parse(flow.data) : null;

    throw new Error("DatabaseFlowProvider not implemented yet");
  }

  async saveFlow(flowId: string, flow: Flow): Promise<void> {
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
