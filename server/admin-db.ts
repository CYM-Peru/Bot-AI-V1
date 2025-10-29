/**
 * Admin Database - In-memory storage for admin panel data
 * Stores users, roles, queues, CRM field config, and general settings
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "data", "admin");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ============================================
// TYPES
// ============================================

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: "admin" | "asesor" | "supervisor";
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

export interface Queue {
  id: string;
  name: string;
  description: string;
  status: "active" | "inactive";
  distributionMode: "round-robin" | "least-busy" | "manual";
  maxConcurrent: number;
  assignedAdvisors: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CRMFieldConfig {
  enabledFields: string[];
  updatedAt: string;
}

export interface GeneralSettings {
  companyName: string;
  timezone: string;
  language: string;
  dateFormat: string;
  sessionTimeout: number;
  enableNotifications: boolean;
  autoArchiveDays: number;
  maxFileSize: number;
  allowedFileTypes: string;
  defaultStatus: string;
  requireApprovalForTransfers: boolean;
  updatedAt: string;
}

// ============================================
// DEFAULT DATA
// ============================================

const DEFAULT_ROLES: Role[] = [
  {
    id: "admin",
    name: "Administrador",
    description: "Acceso completo al sistema",
    permissions: [
      "crm.view",
      "crm.chat",
      "crm.transfer",
      "crm.archive",
      "crm.notes",
      "crm.bitrix",
      "flows.view",
      "flows.edit",
      "flows.delete",
      "metrics.view",
      "config.view",
      "config.users",
      "config.roles",
      "config.queues",
      "config.general",
    ],
  },
  {
    id: "supervisor",
    name: "Supervisor",
    description: "Supervisa operaciones de CRM y asesores",
    permissions: [
      "crm.view",
      "crm.chat",
      "crm.transfer",
      "crm.archive",
      "crm.notes",
      "crm.bitrix",
      "flows.view",
      "flows.edit",
      "metrics.view",
      "config.view",
      "config.queues",
    ],
  },
  {
    id: "asesor",
    name: "Asesor",
    description: "Atiende conversaciones de clientes",
    permissions: ["crm.view", "crm.chat", "crm.notes", "crm.bitrix"],
  },
];

const DEFAULT_USERS: User[] = [
  {
    id: "user-1",
    username: "admin",
    email: "admin@empresa.com",
    passwordHash: hashPassword("admin123"),
    role: "admin",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_CRM_FIELDS: CRMFieldConfig = {
  enabledFields: [
    "name",
    "lastname",
    "phone",
    "email",
    "document_number",
    "document_type",
    "contact_type",
    "source",
    "assigned_to",
    "company",
    "modified_at",
  ],
  updatedAt: new Date().toISOString(),
};

const DEFAULT_SETTINGS: GeneralSettings = {
  companyName: "Mi Empresa",
  timezone: "America/Lima",
  language: "es-PE",
  dateFormat: "DD/MM/YYYY",
  sessionTimeout: 30,
  enableNotifications: true,
  autoArchiveDays: 30,
  maxFileSize: 10,
  allowedFileTypes: "jpg,jpeg,png,pdf,doc,docx,xls,xlsx",
  defaultStatus: "active",
  requireApprovalForTransfers: false,
  updatedAt: new Date().toISOString(),
};

// ============================================
// STORAGE HELPERS
// ============================================

function loadFromFile<T>(filename: string, defaultData: T): T {
  const filepath = path.join(DATA_DIR, filename);
  try {
    if (fs.existsSync(filepath)) {
      const data = fs.readFileSync(filepath, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`[AdminDB] Error loading ${filename}:`, error);
  }
  return defaultData;
}

function saveToFile<T>(filename: string, data: T): void {
  const filepath = path.join(DATA_DIR, filename);
  try {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error(`[AdminDB] Error saving ${filename}:`, error);
  }
}

// ============================================
// PASSWORD HASHING
// ============================================

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// ============================================
// IN-MEMORY STORAGE
// ============================================

class AdminDatabase {
  private users: Map<string, User>;
  private roles: Map<string, Role>;
  private queues: Map<string, Queue>;
  private crmFieldConfig: CRMFieldConfig;
  private settings: GeneralSettings;

  constructor() {
    this.users = new Map();
    this.roles = new Map();
    this.queues = new Map();
    this.crmFieldConfig = DEFAULT_CRM_FIELDS;
    this.settings = DEFAULT_SETTINGS;
    this.loadAll();
  }

  private loadAll() {
    // Load users
    const users = loadFromFile<User[]>("users.json", DEFAULT_USERS);
    users.forEach((user) => this.users.set(user.id, user));

    // Load roles
    const roles = loadFromFile<Role[]>("roles.json", DEFAULT_ROLES);
    roles.forEach((role) => this.roles.set(role.id, role));

    // Load queues
    const queues = loadFromFile<Queue[]>("queues.json", []);
    queues.forEach((queue) => this.queues.set(queue.id, queue));

    // Load CRM field config
    this.crmFieldConfig = loadFromFile<CRMFieldConfig>("crm-fields.json", DEFAULT_CRM_FIELDS);

    // Load settings
    this.settings = loadFromFile<GeneralSettings>("settings.json", DEFAULT_SETTINGS);

    console.log("[AdminDB] Loaded data:", {
      users: this.users.size,
      roles: this.roles.size,
      queues: this.queues.size,
    });
  }

  private saveAll() {
    saveToFile("users.json", Array.from(this.users.values()));
    saveToFile("roles.json", Array.from(this.roles.values()));
    saveToFile("queues.json", Array.from(this.queues.values()));
    saveToFile("crm-fields.json", this.crmFieldConfig);
    saveToFile("settings.json", this.settings);
  }

  // ============================================
  // USERS
  // ============================================

  getAllUsers(): User[] {
    return Array.from(this.users.values()).map((user) => ({
      ...user,
      passwordHash: "[REDACTED]", // Don't expose password hash
    })) as User[];
  }

  getUserById(id: string): User | undefined {
    const user = this.users.get(id);
    if (user) {
      return { ...user, passwordHash: "[REDACTED]" } as User;
    }
    return undefined;
  }

  getUserByUsername(username: string): User | undefined {
    return Array.from(this.users.values()).find((u) => u.username === username);
  }

  createUser(data: {
    username: string;
    email: string;
    password: string;
    role: "admin" | "asesor" | "supervisor";
    status: "active" | "inactive";
  }): User {
    const id = `user-${Date.now()}`;
    const user: User = {
      id,
      username: data.username,
      email: data.email,
      passwordHash: hashPassword(data.password),
      role: data.role,
      status: data.status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.users.set(id, user);
    this.saveAll();
    return { ...user, passwordHash: "[REDACTED]" } as User;
  }

  updateUser(
    id: string,
    data: {
      username?: string;
      email?: string;
      password?: string;
      role?: "admin" | "asesor" | "supervisor";
      status?: "active" | "inactive";
    }
  ): User | null {
    const user = this.users.get(id);
    if (!user) return null;

    if (data.username) user.username = data.username;
    if (data.email) user.email = data.email;
    if (data.password) user.passwordHash = hashPassword(data.password);
    if (data.role) user.role = data.role;
    if (data.status) user.status = data.status;
    user.updatedAt = new Date().toISOString();

    this.users.set(id, user);
    this.saveAll();
    return { ...user, passwordHash: "[REDACTED]" } as User;
  }

  deleteUser(id: string): boolean {
    const deleted = this.users.delete(id);
    if (deleted) {
      this.saveAll();
    }
    return deleted;
  }

  // ============================================
  // ROLES
  // ============================================

  getAllRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  getRoleById(id: string): Role | undefined {
    return this.roles.get(id);
  }

  createRole(data: { name: string; description: string; permissions: string[] }): Role {
    const id = `role-${Date.now()}`;
    const role: Role = {
      id,
      name: data.name,
      description: data.description,
      permissions: data.permissions,
    };
    this.roles.set(id, role);
    this.saveAll();
    return role;
  }

  updateRole(
    id: string,
    data: { name?: string; description?: string; permissions?: string[] }
  ): Role | null {
    const role = this.roles.get(id);
    if (!role) return null;

    if (data.name) role.name = data.name;
    if (data.description) role.description = data.description;
    if (data.permissions) role.permissions = data.permissions;

    this.roles.set(id, role);
    this.saveAll();
    return role;
  }

  deleteRole(id: string): boolean {
    // Don't allow deleting default roles
    if (["admin", "supervisor", "asesor"].includes(id)) {
      return false;
    }
    const deleted = this.roles.delete(id);
    if (deleted) {
      this.saveAll();
    }
    return deleted;
  }

  // ============================================
  // QUEUES
  // ============================================

  getAllQueues(): Queue[] {
    return Array.from(this.queues.values());
  }

  getQueueById(id: string): Queue | undefined {
    return this.queues.get(id);
  }

  createQueue(data: {
    name: string;
    description: string;
    status: "active" | "inactive";
    distributionMode: "round-robin" | "least-busy" | "manual";
    maxConcurrent: number;
    assignedAdvisors: string[];
  }): Queue {
    const id = `queue-${Date.now()}`;
    const queue: Queue = {
      id,
      name: data.name,
      description: data.description,
      status: data.status,
      distributionMode: data.distributionMode,
      maxConcurrent: data.maxConcurrent,
      assignedAdvisors: data.assignedAdvisors,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.queues.set(id, queue);
    this.saveAll();
    return queue;
  }

  updateQueue(
    id: string,
    data: {
      name?: string;
      description?: string;
      status?: "active" | "inactive";
      distributionMode?: "round-robin" | "least-busy" | "manual";
      maxConcurrent?: number;
      assignedAdvisors?: string[];
    }
  ): Queue | null {
    const queue = this.queues.get(id);
    if (!queue) return null;

    if (data.name) queue.name = data.name;
    if (data.description) queue.description = data.description;
    if (data.status) queue.status = data.status;
    if (data.distributionMode) queue.distributionMode = data.distributionMode;
    if (data.maxConcurrent !== undefined) queue.maxConcurrent = data.maxConcurrent;
    if (data.assignedAdvisors) queue.assignedAdvisors = data.assignedAdvisors;
    queue.updatedAt = new Date().toISOString();

    this.queues.set(id, queue);
    this.saveAll();
    return queue;
  }

  deleteQueue(id: string): boolean {
    const deleted = this.queues.delete(id);
    if (deleted) {
      this.saveAll();
    }
    return deleted;
  }

  // ============================================
  // CRM FIELD CONFIG
  // ============================================

  getCRMFieldConfig(): CRMFieldConfig {
    return this.crmFieldConfig;
  }

  updateCRMFieldConfig(enabledFields: string[]): CRMFieldConfig {
    this.crmFieldConfig = {
      enabledFields,
      updatedAt: new Date().toISOString(),
    };
    this.saveAll();
    return this.crmFieldConfig;
  }

  // ============================================
  // SETTINGS
  // ============================================

  getSettings(): GeneralSettings {
    return this.settings;
  }

  updateSettings(data: Partial<GeneralSettings>): GeneralSettings {
    this.settings = {
      ...this.settings,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.saveAll();
    return this.settings;
  }
}

// Singleton instance
export const adminDb = new AdminDatabase();
