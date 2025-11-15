/**
 * Admin Database - PostgreSQL version
 * Reads admin panel data from PostgreSQL instead of JSON files
 */

import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'whatsapp_user',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'flowbuilder_crm',
  password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  max: 20,
});

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  name?: string;
  role: "admin" | "asesor" | "supervisor";
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

export interface Queue {
  id: string;
  name: string;
  description: string;
}

export interface AdvisorStatus {
  id: string;
  name: string;
  color: string;
  action: "accept" | "redirect" | "pause";
}

export interface WhatsAppNumber {
  numberId: string;
  displayName: string;
  phoneNumber: string;
  queueId: string;
}

class AdminDatabasePostgres {
  async getUsers(): Promise<User[]> {
    const result = await pool.query('SELECT id, username, email, password_hash as password, name, role, created_at, updated_at FROM crm_users');
    return result.rows.map(row => ({
      id: row.id,
      username: row.username,
      email: row.email,
      password: row.password,
      name: row.name,
      role: row.role,
      createdAt: new Date(parseInt(row.created_at)).toISOString(),
      updatedAt: new Date(parseInt(row.updated_at)).toISOString(),
    }));
  }

  async getUserById(id: string): Promise<User | null> {
    const result = await pool.query('SELECT id, username, email, password_hash as password, name, role, created_at, updated_at FROM crm_users WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      password: row.password,
      name: row.name,
      role: row.role,
      createdAt: new Date(parseInt(row.created_at)).toISOString(),
      updatedAt: new Date(parseInt(row.updated_at)).toISOString(),
    };
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const result = await pool.query('SELECT id, username, email, password_hash as password, name, role, created_at, updated_at FROM crm_users WHERE username = $1', [username]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      password: row.password,
      name: row.name,
      role: row.role,
      createdAt: new Date(parseInt(row.created_at)).toISOString(),
      updatedAt: new Date(parseInt(row.updated_at)).toISOString(),
    };
  }

  async getRoles(): Promise<Role[]> {
    const result = await pool.query('SELECT id, name, permissions FROM crm_roles');
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      permissions: row.permissions || [],
    }));
  }

  async getQueues(): Promise<Queue[]> {
    const result = await pool.query('SELECT id, name, description FROM crm_queues');
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
    }));
  }

  async getQueueById(id: string): Promise<Queue | null> {
    const result = await pool.query('SELECT id, name, description FROM crm_queues WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
    };
  }

  async getAdvisorStatuses(): Promise<AdvisorStatus[]> {
    const result = await pool.query('SELECT id, name, color, action FROM crm_advisor_statuses ORDER BY id');
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      color: row.color,
      action: row.action,
    }));
  }

  async getWhatsAppNumbers(): Promise<WhatsAppNumber[]> {
    const result = await pool.query('SELECT number_id, display_name, phone_number, queue_id FROM crm_whatsapp_numbers');
    return result.rows.map(row => ({
      numberId: row.number_id,
      displayName: row.display_name,
      phoneNumber: row.phone_number,
      queueId: row.queue_id,
    }));
  }

  async getQueueMembers(queueId: string): Promise<string[]> {
    const result = await pool.query('SELECT user_id FROM queue_members WHERE queue_id = $1', [queueId]);
    return result.rows.map(row => row.user_id);
  }

  async getUserQueues(userId: string): Promise<string[]> {
    const result = await pool.query('SELECT queue_id FROM queue_members WHERE user_id = $1', [userId]);
    return result.rows.map(row => row.queue_id);
  }

  // Alias methods for compatibility
  async getAllQueues(): Promise<Queue[]> {
    return this.getQueues();
  }

  async getAllUsers(): Promise<User[]> {
    return this.getUsers();
  }

  async getAllWhatsAppNumbers(): Promise<WhatsAppNumber[]> {
    return this.getWhatsAppNumbers();
  }

  async getUser(userId: string): Promise<User | null> {
    return this.getUserById(userId);
  }

  async getAllRoles(): Promise<Role[]> {
    return this.getRoles();
  }

  async getAllAdvisorStatuses(): Promise<AdvisorStatus[]> {
    return this.getAdvisorStatuses();
  }

  async getAdvisorStatus(userId: string): Promise<{ status: AdvisorStatus | null; isManuallyOffline: boolean } | null> {
    const result = await pool.query(`
      SELECT s.id, s.name, s.color, s.action, a.is_manually_offline
      FROM crm_advisor_status_assignments a
      JOIN crm_advisor_statuses s ON a.status_id = s.id
      WHERE a.user_id = $1
    `, [userId]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      status: {
        id: row.id,
        name: row.name,
        color: row.color,
        action: row.action,
      },
      isManuallyOffline: row.is_manually_offline || false,
    };
  }

  async getAdvisorStatusById(statusId: string): Promise<AdvisorStatus | null> {
    const result = await pool.query('SELECT id, name, color, action FROM crm_advisor_statuses WHERE id = $1', [statusId]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      action: row.action,
    };
  }

  async setAdvisorStatus(userId: string, statusId: string, isManuallyOffline: boolean = false): Promise<any> {
    // Upsert: insert if not exists, update if exists
    await pool.query(`
      INSERT INTO crm_advisor_status_assignments (user_id, status_id, is_manually_offline, updated_at)
      VALUES ($1, $2, $3, EXTRACT(EPOCH FROM NOW()) * 1000)
      ON CONFLICT (user_id)
      DO UPDATE SET
        status_id = $2,
        is_manually_offline = $3,
        updated_at = EXTRACT(EPOCH FROM NOW()) * 1000
    `, [userId, statusId, isManuallyOffline]);

    // Log activity
    const status = await this.getAdvisorStatusById(statusId);
    const user = await this.getUserById(userId);

    await pool.query(`
      INSERT INTO advisor_activity_logs (
        id, user_id, user_name, event_type, status_id, status_name, timestamp, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      user?.name || user?.username || userId,
      'status_change',
      statusId,
      status?.name || statusId,
      Date.now(),
      JSON.stringify({})
    ]);

    return { userId, statusId };
  }

  async getAIConfig(): Promise<{ apiKey: string; model: string } | null> {
    try {
      const result = await pool.query('SELECT api_key, model FROM ai_config LIMIT 1');
      if (result.rows.length === 0) return null;
      return {
        apiKey: result.rows[0].api_key,
        model: result.rows[0].model || 'gpt-4o-mini'
      };
    } catch (error) {
      console.error('[AI Config] Error fetching AI config:', error);
      return null;
    }
  }

  async setAIConfig(apiKey: string, model: string = 'gpt-4o-mini'): Promise<void> {
    await pool.query(
      `INSERT INTO ai_config (id, api_key, model, updated_at)
       VALUES (1, $1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET api_key = $1, model = $2, updated_at = $3`,
      [apiKey, model, Date.now()]
    );
  }

  async getChatThemePreferences(userId: string): Promise<any | null> {
    try {
      const result = await pool.query(
        'SELECT chat_theme_preferences FROM crm_users WHERE id = $1',
        [userId]
      );
      if (result.rows.length === 0) return null;
      return result.rows[0].chat_theme_preferences;
    } catch (error) {
      console.error('[ChatTheme] Error fetching theme preferences:', error);
      return null;
    }
  }

  async setChatThemePreferences(userId: string, preferences: any): Promise<void> {
    await pool.query(
      'UPDATE crm_users SET chat_theme_preferences = $1 WHERE id = $2',
      [JSON.stringify(preferences), userId]
    );
  }
}

export const adminDb = new AdminDatabasePostgres();
