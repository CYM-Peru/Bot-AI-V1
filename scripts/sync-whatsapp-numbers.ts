#!/usr/bin/env tsx
/**
 * Script para sincronizar números de WhatsApp desde whatsapp-connections.json
 * a la tabla crm_whatsapp_numbers de PostgreSQL
 *
 * Uso:
 *   npx tsx scripts/sync-whatsapp-numbers.ts
 */

import fs from 'fs/promises';
import path from 'path';
import pg from 'pg';

const { Pool } = pg;

interface WhatsAppConnection {
  id: string;
  alias: string;
  phoneNumberId: string;
  displayNumber: string;
  accessToken: string;
  verifyToken: string;
  wabaId?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

interface WhatsAppConnectionsData {
  connections: WhatsAppConnection[];
}

async function main() {
  console.log('🔄 Sincronizando números de WhatsApp con la base de datos...\n');

  // 1. Leer conexiones desde el archivo
  const connectionsPath = path.join(process.cwd(), 'data', 'whatsapp-connections.json');
  const data = await fs.readFile(connectionsPath, 'utf-8');
  const parsed: WhatsAppConnectionsData = JSON.parse(data);
  const connections = parsed.connections || [];

  console.log(`📋 Encontrados ${connections.length} números en whatsapp-connections.json`);

  // 2. Conectar a PostgreSQL
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    database: process.env.POSTGRES_DB || 'flowbuilder_crm',
    user: process.env.POSTGRES_USER || 'whatsapp_user',
    password: process.env.POSTGRES_PASSWORD,
  });

  try {
    // 3. Para cada conexión, verificar si existe en la DB
    for (const conn of connections) {
      const { phoneNumberId, displayNumber, alias, isActive } = conn;

      if (!phoneNumberId || !displayNumber) {
        console.log(`⚠️  Saltando conexión sin phoneNumberId o displayNumber: ${alias}`);
        continue;
      }

      // Verificar si ya existe
      const existingQuery = await pool.query(
        'SELECT * FROM crm_whatsapp_numbers WHERE number_id = $1',
        [phoneNumberId]
      );

      if (existingQuery.rows.length > 0) {
        // Ya existe - actualizar solo si es necesario
        const existing = existingQuery.rows[0];
        if (existing.phone_number !== displayNumber || existing.display_name !== alias) {
          await pool.query(
            `UPDATE crm_whatsapp_numbers
             SET phone_number = $1,
                 display_name = $2,
                 updated_at = $3
             WHERE number_id = $4`,
            [displayNumber, alias, Date.now(), phoneNumberId]
          );
          console.log(`✅ Actualizado: ${alias} (${phoneNumberId})`);
        } else {
          console.log(`✓  Ya existe: ${alias} (${phoneNumberId})`);
        }
      } else {
        // No existe - verificar si hay un registro con el mismo número pero ID diferente
        const normalizePhone = (phone: string) => phone.replace(/[\s\+\-\(\)]/g, '');
        const normalizedDisplay = normalizePhone(displayNumber);

        const duplicateQuery = await pool.query(
          `SELECT * FROM crm_whatsapp_numbers
           WHERE REPLACE(REPLACE(REPLACE(phone_number, '+', ''), ' ', ''), '-', '') = $1`,
          [normalizedDisplay]
        );

        if (duplicateQuery.rows.length > 0) {
          // Hay un duplicado con ID incorrecto - actualizar el ID
          const duplicate = duplicateQuery.rows[0];
          await pool.query(
            `UPDATE crm_whatsapp_numbers
             SET number_id = $1,
                 phone_number = $2,
                 display_name = $3,
                 updated_at = $4
             WHERE number_id = $5`,
            [phoneNumberId, displayNumber, alias, Date.now(), duplicate.number_id]
          );
          console.log(`🔄 Actualizado ID: ${duplicate.number_id} → ${phoneNumberId} (${alias})`);
        } else {
          // No existe en absoluto - insertar nuevo (sin cola por defecto)
          await pool.query(
            `INSERT INTO crm_whatsapp_numbers
             (number_id, phone_number, display_name, queue_id, created_at, updated_at)
             VALUES ($1, $2, $3, NULL, $4, $5)`,
            [phoneNumberId, displayNumber, alias, Date.now(), Date.now()]
          );
          console.log(`➕ Nuevo número registrado: ${alias} (${phoneNumberId}) - ⚠️  SIN COLA ASIGNADA`);
        }
      }
    }

    // 4. Mostrar resumen final
    console.log('\n📊 Resumen de números en la base de datos:\n');
    const allNumbers = await pool.query(`
      SELECT
        n.number_id,
        n.phone_number,
        n.display_name,
        COALESCE(q.name, '❌ SIN COLA') as queue_name
      FROM crm_whatsapp_numbers n
      LEFT JOIN crm_queues q ON n.queue_id = q.id
      ORDER BY n.created_at
    `);

    console.log('┌─────────────────┬─────────────────┬──────────────────────┬──────────────┐');
    console.log('│ Phone Number ID │ Display Number  │ Display Name         │ Queue        │');
    console.log('├─────────────────┼─────────────────┼──────────────────────┼──────────────┤');
    for (const row of allNumbers.rows) {
      const id = row.number_id.substring(0, 15).padEnd(15);
      const number = row.phone_number.padEnd(15);
      const name = row.display_name.substring(0, 20).padEnd(20);
      const queue = row.queue_name.padEnd(12);
      console.log(`│ ${id} │ ${number} │ ${name} │ ${queue} │`);
    }
    console.log('└─────────────────┴─────────────────┴──────────────────────┴──────────────┘');

    // 5. Advertencia sobre colas sin asignar
    const withoutQueue = allNumbers.rows.filter(r => r.queue_name === '❌ SIN COLA');
    if (withoutQueue.length > 0) {
      console.log('\n⚠️  ATENCIÓN: Los siguientes números NO tienen cola asignada:');
      withoutQueue.forEach(r => {
        console.log(`   - ${r.display_name} (${r.phone_number})`);
      });
      console.log('\n💡 Para asignar colas, usa la interfaz web o ejecuta SQL manualmente.');
    }

    console.log('\n✅ Sincronización completada exitosamente!\n');
  } catch (error) {
    console.error('❌ Error durante la sincronización:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
