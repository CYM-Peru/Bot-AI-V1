/**
 * Admin Database - In-memory storage for admin panel data
 * Stores users, roles, queues, CRM field config, and general settings
 */

import * as fs from "fs";
import * as path from "path";
import { hashPassword as bcryptHash } from "./auth/password";

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
  password: string; // Ahora se llama password en vez de passwordHash para consistencia con auth routes
  name?: string; // Nombre completo del usuario
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

export interface AdvisorStatus {
  id: string;
  name: string;
  description: string;
  color: string; // Color hex para badge (ej: "#10b981" para verde)
  action: "accept" | "redirect" | "pause"; // accept = acepta chats, redirect = deriva a cola, pause = no acepta
  redirectToQueue?: string; // ID de cola a la que derivar si action = redirect
  isDefault: boolean; // Si es el estado por defecto al iniciar sesión
  order: number; // Orden de visualización
  createdAt: string;
  updatedAt: string;
}

export interface AdvisorStatusAssignment {
  userId: string;
  statusId: string;
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

// Default users will be initialized with hashed passwords
let DEFAULT_USERS: User[] = [];

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

const DEFAULT_ADVISOR_STATUSES: AdvisorStatus[] = [
  {
    id: "status-available",
    name: "Disponible",
    description: "Acepta nuevos chats de clientes",
    color: "#10b981", // emerald-500
    action: "accept",
    isDefault: true,
    order: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "status-busy",
    name: "Ocupado",
    description: "No acepta chats nuevos, los deriva a cola",
    color: "#f59e0b", // amber-500
    action: "redirect",
    isDefault: false,
    order: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "status-break",
    name: "En Refrigerio",
    description: "En pausa, deriva chats a cola",
    color: "#3b82f6", // blue-500
    action: "redirect",
    isDefault: false,
    order: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "status-offline",
    name: "Desconectado",
    description: "No acepta chats",
    color: "#6b7280", // gray-500
    action: "pause",
    isDefault: false,
    order: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

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

// Password hashing is now handled by bcrypt in auth/password.ts
// This function is kept for backwards compatibility but should not be used
// All new code should use bcryptHash from auth/password.ts

// ============================================
// IN-MEMORY STORAGE
// ============================================

class AdminDatabase {
  private users: Map<string, User>;
  private roles: Map<string, Role>;
  private queues: Map<string, Queue>;
  private crmFieldConfig: CRMFieldConfig;
  private settings: GeneralSettings;
  private advisorStatuses: Map<string, AdvisorStatus>;
  private statusAssignments: Map<string, AdvisorStatusAssignment>; // userId -> assignment

  constructor() {
    this.users = new Map();
    this.roles = new Map();
    this.queues = new Map();
    this.crmFieldConfig = DEFAULT_CRM_FIELDS;
    this.settings = DEFAULT_SETTINGS;
    this.advisorStatuses = new Map();
    this.statusAssignments = new Map();
    this.initializeDefaultUsers();
  }

  private async initializeDefaultUsers() {
    // Initialize default admin user with bcrypt hashed password
    if (DEFAULT_USERS.length === 0) {
      DEFAULT_USERS = [
        {
          id: "user-1",
          username: "admin",
          email: "admin@empresa.com",
          password: await bcryptHash("admin123"),
          name: "Administrador",
          role: "admin",
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
    }
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

    // Load advisor statuses
    const statuses = loadFromFile<AdvisorStatus[]>("advisor-statuses.json", DEFAULT_ADVISOR_STATUSES);
    statuses.forEach((status) => this.advisorStatuses.set(status.id, status));

    // Load status assignments
    const assignments = loadFromFile<AdvisorStatusAssignment[]>("status-assignments.json", []);
    assignments.forEach((assignment) => this.statusAssignments.set(assignment.userId, assignment));

    console.log("[AdminDB] Loaded data:", {
      users: this.users.size,
      roles: this.roles.size,
      queues: this.queues.size,
      advisorStatuses: this.advisorStatuses.size,
      statusAssignments: this.statusAssignments.size,
    });
  }

  private saveAll() {
    saveToFile("users.json", Array.from(this.users.values()));
    saveToFile("roles.json", Array.from(this.roles.values()));
    saveToFile("queues.json", Array.from(this.queues.values()));
    saveToFile("crm-fields.json", this.crmFieldConfig);
    saveToFile("settings.json", this.settings);
    saveToFile("advisor-statuses.json", Array.from(this.advisorStatuses.values()));
    saveToFile("status-assignments.json", Array.from(this.statusAssignments.values()));
  }

  // ============================================
  // USERS
  // ============================================

  getAllUsers(): User[] {
    return Array.from(this.users.values()).map((user) => ({
      ...user,
      password: "[REDACTED]", // Don't expose password hash
    })) as User[];
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  getUserById(id: string): User | undefined {
    const user = this.users.get(id);
    if (user) {
      return { ...user, password: "[REDACTED]" } as User;
    }
    return undefined;
  }

  getUserByUsername(username: string): User | undefined {
    return Array.from(this.users.values()).find((u) => u.username === username);
  }

  async createUser(data: {
    username: string;
    email: string;
    password: string;
    name?: string;
    role: "admin" | "asesor" | "supervisor";
    status: "active" | "inactive";
  }): Promise<User> {
    const id = `user-${Date.now()}`;
    const user: User = {
      id,
      username: data.username,
      email: data.email,
      password: await bcryptHash(data.password),
      name: data.name,
      role: data.role,
      status: data.status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.users.set(id, user);
    this.saveAll();
    return { ...user, password: "[REDACTED]" } as User;
  }

  async updateUser(
    id: string,
    data: {
      username?: string;
      email?: string;
      password?: string;
      name?: string;
      role?: "admin" | "asesor" | "supervisor";
      status?: "active" | "inactive";
    }
  ): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;

    if (data.username) user.username = data.username;
    if (data.email) user.email = data.email;
    if (data.password) user.password = await bcryptHash(data.password);
    if (data.name) user.name = data.name;
    if (data.role) user.role = data.role;
    if (data.status) user.status = data.status;
    user.updatedAt = new Date().toISOString();

    this.users.set(id, user);
    this.saveAll();
    return { ...user, password: "[REDACTED]" } as User;
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

  // ============================================
  // ADVISOR STATUSES
  // ============================================

  getAllAdvisorStatuses(): AdvisorStatus[] {
    return Array.from(this.advisorStatuses.values()).sort((a, b) => a.order - b.order);
  }

  getAdvisorStatusById(id: string): AdvisorStatus | undefined {
    return this.advisorStatuses.get(id);
  }

  createAdvisorStatus(data: {
    name: string;
    description: string;
    color: string;
    action: "accept" | "redirect" | "pause";
    redirectToQueue?: string;
    isDefault?: boolean;
  }): AdvisorStatus {
    const id = `status-${Date.now()}`;
    const maxOrder = Math.max(0, ...Array.from(this.advisorStatuses.values()).map(s => s.order));
    const status: AdvisorStatus = {
      id,
      name: data.name,
      description: data.description,
      color: data.color,
      action: data.action,
      redirectToQueue: data.redirectToQueue,
      isDefault: data.isDefault ?? false,
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // If this is default, remove default from others
    if (status.isDefault) {
      this.advisorStatuses.forEach((s) => {
        if (s.isDefault) {
          s.isDefault = false;
        }
      });
    }

    this.advisorStatuses.set(id, status);
    this.saveAll();
    return status;
  }

  updateAdvisorStatus(
    id: string,
    data: {
      name?: string;
      description?: string;
      color?: string;
      action?: "accept" | "redirect" | "pause";
      redirectToQueue?: string;
      isDefault?: boolean;
      order?: number;
    }
  ): AdvisorStatus | null {
    const status = this.advisorStatuses.get(id);
    if (!status) return null;

    if (data.name) status.name = data.name;
    if (data.description) status.description = data.description;
    if (data.color) status.color = data.color;
    if (data.action) status.action = data.action;
    if (data.redirectToQueue !== undefined) status.redirectToQueue = data.redirectToQueue;
    if (data.order !== undefined) status.order = data.order;
    if (data.isDefault !== undefined) {
      // If setting as default, remove default from others
      if (data.isDefault) {
        this.advisorStatuses.forEach((s) => {
          if (s.id !== id && s.isDefault) {
            s.isDefault = false;
          }
        });
      }
      status.isDefault = data.isDefault;
    }
    status.updatedAt = new Date().toISOString();

    this.advisorStatuses.set(id, status);
    this.saveAll();
    return status;
  }

  deleteAdvisorStatus(id: string): boolean {
    const status = this.advisorStatuses.get(id);
    if (!status) return false;

    // Don't allow deleting default status
    if (status.isDefault) {
      return false;
    }

    const deleted = this.advisorStatuses.delete(id);
    if (deleted) {
      // Remove all assignments to this status
      const toRemove: string[] = [];
      this.statusAssignments.forEach((assignment, userId) => {
        if (assignment.statusId === id) {
          toRemove.push(userId);
        }
      });
      toRemove.forEach((userId) => this.statusAssignments.delete(userId));
      this.saveAll();
    }
    return deleted;
  }

  // ============================================
  // ADVISOR STATUS ASSIGNMENTS
  // ============================================

  getAdvisorStatus(userId: string): AdvisorStatusAssignment | null {
    return this.statusAssignments.get(userId) || null;
  }

  setAdvisorStatus(userId: string, statusId: string): AdvisorStatusAssignment {
    const status = this.advisorStatuses.get(statusId);
    if (!status) {
      throw new Error(`Status ${statusId} not found`);
    }

    const assignment: AdvisorStatusAssignment = {
      userId,
      statusId,
      updatedAt: new Date().toISOString(),
    };

    this.statusAssignments.set(userId, assignment);
    this.saveAll();
    return assignment;
  }

  getDefaultAdvisorStatus(): AdvisorStatus | null {
    const statuses = Array.from(this.advisorStatuses.values());
    return statuses.find((s) => s.isDefault) || statuses[0] || null;
  }
}

// Singleton instance
export const adminDb = new AdminDatabase();
