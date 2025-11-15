/**
 * Migración: Sistema de Tickets y Alertas de Mantenimiento
 * Fecha: 2025-11-15
 *
 * Agrega:
 * - Tabla support_tickets: Para reportes de problemas
 * - Tabla maintenance_alerts: Para alertas de mantenimiento en producción
 */

import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
  database: process.env.POSTGRES_DB || "flowbuilder_crm",
  user: process.env.POSTGRES_USER || "whatsapp_user",
  password: process.env.POSTGRES_PASSWORD,
});

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    console.log("🔧 Creando tabla support_tickets...");

    // Tabla de tickets de soporte
    await client.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        ticket_number VARCHAR(20) UNIQUE NOT NULL,
        reporter_id INTEGER REFERENCES crm_users(id) ON DELETE SET NULL,
        reporter_name VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
        priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
        images JSONB DEFAULT '[]',
        admin_comments JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP,
        resolved_by INTEGER REFERENCES crm_users(id) ON DELETE SET NULL
      );
    `);

    // Índices para búsquedas rápidas
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
      CREATE INDEX IF NOT EXISTS idx_tickets_reporter ON support_tickets(reporter_id);
      CREATE INDEX IF NOT EXISTS idx_tickets_created ON support_tickets(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tickets_number ON support_tickets(ticket_number);
    `);

    console.log("✅ Tabla support_tickets creada");

    console.log("🔧 Creando tabla maintenance_alerts...");

    // Tabla de alertas de mantenimiento
    await client.query(`
      CREATE TABLE IF NOT EXISTS maintenance_alerts (
        id SERIAL PRIMARY KEY,
        status VARCHAR(50) DEFAULT 'idle' CHECK (status IN ('idle', 'working', 'completed')),
        message TEXT,
        started_by INTEGER REFERENCES crm_users(id) ON DELETE SET NULL,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Solo debe haber una alerta activa a la vez
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_alert
      ON maintenance_alerts(active)
      WHERE active = true;
    `);

    console.log("✅ Tabla maintenance_alerts creada");

    // Insertar alerta inicial en estado idle
    await client.query(`
      INSERT INTO maintenance_alerts (status, active, message)
      VALUES ('idle', true, 'Sistema operando normalmente')
      ON CONFLICT DO NOTHING;
    `);

    console.log("✅ Alerta inicial creada");

    // Función para auto-actualizar updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Triggers para updated_at
    await client.query(`
      DROP TRIGGER IF EXISTS update_tickets_updated_at ON support_tickets;
      CREATE TRIGGER update_tickets_updated_at
        BEFORE UPDATE ON support_tickets
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_maintenance_updated_at ON maintenance_alerts;
      CREATE TRIGGER update_maintenance_updated_at
        BEFORE UPDATE ON maintenance_alerts
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log("✅ Triggers creados");

    // Función para generar números de ticket secuenciales
    await client.query(`
      CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1;
    `);

    console.log("✅ Secuencia de tickets creada");

    await client.query("COMMIT");
    console.log("\n✅ Migración completada exitosamente\n");

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error en migración:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar migración
migrate().catch(console.error);
