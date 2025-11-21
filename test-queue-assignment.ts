/**
 * Script de Pruebas Internas - QueueAssignmentService
 * Simula diferentes escenarios y detecta bugs potenciales
 */

import { Pool } from 'pg';
import { advisorPresence } from './server/crm/advisor-presence';

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'whatsapp_user',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'flowbuilder_crm',
  password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

interface TestResult {
  test: string;
  passed: boolean;
  details: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

const results: TestResult[] = [];

function logTest(test: string, passed: boolean, details: string, severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO') {
  results.push({ test, passed, details, severity });
  const icon = passed ? '✅' : '❌';
  const severityIcon = severity === 'CRITICAL' ? '🔴' : severity === 'WARNING' ? '⚠️' : 'ℹ️';
  console.log(`${icon} ${severityIcon} [${test}] ${details}`);
}

// ============================================================================
// TEST 1: Verificar estructura de base de datos
// ============================================================================
async function test1_DatabaseStructure() {
  console.log('\n📊 TEST 1: Verificando estructura de base de datos...\n');

  try {
    // Verificar tabla crm_conversations
    const convResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'crm_conversations'
      AND column_name IN ('id', 'status', 'assigned_to', 'queue_id', 'bot_flow_id', 'bot_started_at', 'phone', 'phone_number_id')
    `);

    if (convResult.rows.length === 8) {
      logTest('DB Structure', true, 'Todas las columnas necesarias existen en crm_conversations', 'INFO');
    } else {
      logTest('DB Structure', false, `Faltan columnas en crm_conversations: ${8 - convResult.rows.length}`, 'CRITICAL');
    }

    // Verificar tabla crm_queues
    const queueResult = await pool.query(`
      SELECT COUNT(*) as count FROM crm_queues
    `);
    logTest('Queues', true, `${queueResult.rows[0].count} colas configuradas en sistema`, 'INFO');

    // Verificar tabla users
    const usersResult = await pool.query(`
      SELECT COUNT(*) as count FROM users WHERE role = 'advisor'
    `);
    logTest('Advisors', true, `${usersResult.rows[0].count} asesores registrados en sistema`, 'INFO');

  } catch (error) {
    logTest('DB Structure', false, `Error al verificar estructura: ${error}`, 'CRITICAL');
  }
}

// ============================================================================
// TEST 2: Verificar estado actual de conversaciones
// ============================================================================
async function test2_ConversationState() {
  console.log('\n💬 TEST 2: Verificando estado actual de conversaciones...\n');

  try {
    // Conversaciones activas sin asignar (deberían estar en cola)
    const unassignedActive = await pool.query(`
      SELECT COUNT(*) as count
      FROM crm_conversations
      WHERE status = 'active'
      AND assigned_to IS NULL
      AND queue_id IS NOT NULL
      AND bot_flow_id IS NULL
    `);

    logTest('Unassigned Chats', true,
      `${unassignedActive.rows[0].count} chats en cola esperando asignación`,
      unassignedActive.rows[0].count > 10 ? 'WARNING' : 'INFO'
    );

    // Conversaciones asignadas pero asesor NO existe
    const orphanedChats = await pool.query(`
      SELECT c.id, c.phone, c.assigned_to
      FROM crm_conversations c
      LEFT JOIN users u ON c.assigned_to = u.id
      WHERE c.assigned_to IS NOT NULL
      AND u.id IS NULL
    `);

    if (orphanedChats.rows.length > 0) {
      logTest('Orphaned Chats', false,
        `${orphanedChats.rows.length} chats asignados a usuarios inexistentes: ${orphanedChats.rows.map(r => r.phone).join(', ')}`,
        'CRITICAL'
      );
    } else {
      logTest('Orphaned Chats', true, 'No hay chats asignados a usuarios inexistentes', 'INFO');
    }

    // Conversaciones con bot pero sin bot_started_at
    const invalidBotChats = await pool.query(`
      SELECT COUNT(*) as count
      FROM crm_conversations
      WHERE bot_flow_id IS NOT NULL
      AND bot_started_at IS NULL
      AND status = 'active'
    `);

    if (invalidBotChats.rows[0].count > 0) {
      logTest('Invalid Bot State', false,
        `${invalidBotChats.rows[0].count} chats con bot_flow_id pero sin bot_started_at`,
        'WARNING'
      );
    } else {
      logTest('Invalid Bot State', true, 'Todos los chats con bot tienen bot_started_at', 'INFO');
    }

    // Conversaciones asignadas pero sin queue_id
    const noQueueAssigned = await pool.query(`
      SELECT COUNT(*) as count
      FROM crm_conversations
      WHERE assigned_to IS NOT NULL
      AND queue_id IS NULL
      AND status IN ('active', 'attending')
    `);

    if (noQueueAssigned.rows[0].count > 0) {
      logTest('Queue Assignment', false,
        `${noQueueAssigned.rows[0].count} chats asignados sin queue_id`,
        'WARNING'
      );
    } else {
      logTest('Queue Assignment', true, 'Todos los chats asignados tienen queue_id', 'INFO');
    }

  } catch (error) {
    logTest('Conversation State', false, `Error al verificar conversaciones: ${error}`, 'CRITICAL');
  }
}

// ============================================================================
// TEST 3: Verificar configuración de colas
// ============================================================================
async function test3_QueueConfiguration() {
  console.log('\n🎯 TEST 3: Verificando configuración de colas...\n');

  try {
    // Obtener colas sin asesores asignados
    const emptyQueues = await pool.query(`
      SELECT q.id, q.name, q.assigned_advisors
      FROM crm_queues q
      WHERE q.assigned_advisors IS NULL
      OR q.assigned_advisors = '{}'
      OR array_length(q.assigned_advisors, 1) IS NULL
    `);

    if (emptyQueues.rows.length > 0) {
      logTest('Empty Queues', false,
        `${emptyQueues.rows.length} colas sin asesores: ${emptyQueues.rows.map(r => r.name).join(', ')}`,
        'WARNING'
      );
    } else {
      logTest('Empty Queues', true, 'Todas las colas tienen asesores asignados', 'INFO');
    }

    // Verificar que asesores en colas existan
    const allQueues = await pool.query(`
      SELECT id, name, assigned_advisors, supervisors
      FROM crm_queues
    `);

    for (const queue of allQueues.rows) {
      if (queue.assigned_advisors && queue.assigned_advisors.length > 0) {
        for (const advisorId of queue.assigned_advisors) {
          const userExists = await pool.query(
            'SELECT id FROM users WHERE id = $1',
            [advisorId]
          );

          if (userExists.rows.length === 0) {
            logTest('Queue Config', false,
              `Cola "${queue.name}" tiene asesor inexistente: ${advisorId}`,
              'CRITICAL'
            );
          }
        }
      }
    }

    logTest('Queue Config', true, 'Todos los asesores en colas existen', 'INFO');

  } catch (error) {
    logTest('Queue Configuration', false, `Error al verificar colas: ${error}`, 'CRITICAL');
  }
}

// ============================================================================
// TEST 4: Simular búsqueda de asesor disponible
// ============================================================================
async function test4_FindAvailableAdvisor() {
  console.log('\n🔍 TEST 4: Simulando búsqueda de asesor disponible...\n');

  try {
    const queues = await pool.query('SELECT id, name, assigned_advisors, supervisors FROM crm_queues');

    for (const queue of queues.rows) {
      if (!queue.assigned_advisors || queue.assigned_advisors.length === 0) {
        continue;
      }

      console.log(`\n  Cola: "${queue.name}" (${queue.id})`);

      let onlineCount = 0;
      let offlineCount = 0;
      let supervisorCount = 0;

      for (const advisorId of queue.assigned_advisors) {
        const isSupervisor = queue.supervisors && queue.supervisors.includes(advisorId);
        const isOnline = advisorPresence.isOnline(advisorId);

        if (isSupervisor) {
          console.log(`    👔 ${advisorId}: SUPERVISOR (excluido de auto-asignación)`);
          supervisorCount++;
        } else if (isOnline) {
          console.log(`    ✅ ${advisorId}: ONLINE - Puede recibir chats`);
          onlineCount++;
        } else {
          console.log(`    ❌ ${advisorId}: OFFLINE - No puede recibir chats`);
          offlineCount++;
        }
      }

      const eligibleCount = onlineCount;

      if (eligibleCount === 0) {
        logTest(`Queue "${queue.name}"`, false,
          `No hay asesores ONLINE disponibles (${offlineCount} offline, ${supervisorCount} supervisores)`,
          'WARNING'
        );
      } else {
        logTest(`Queue "${queue.name}"`, true,
          `${eligibleCount} asesores ONLINE disponibles`,
          'INFO'
        );
      }
    }

  } catch (error) {
    logTest('Find Available Advisor', false, `Error en simulación: ${error}`, 'CRITICAL');
  }
}

// ============================================================================
// TEST 5: Verificar lógica canBeAutoAssigned
// ============================================================================
async function test5_CanBeAutoAssigned() {
  console.log('\n🤖 TEST 5: Verificando lógica canBeAutoAssigned...\n');

  try {
    // Importar la función
    const { canBeAutoAssigned } = await import('./shared/conversation-rules');

    // Test case 1: Chat en cola sin asignar (DEBERÍA ser auto-asignado)
    const case1 = canBeAutoAssigned({
      status: 'active',
      assignedTo: null,
      botFlowId: null,
      queueId: 'queue-123',
      campaignId: null,
    });

    if (case1) {
      logTest('canBeAutoAssigned Case 1', true, 'Chat en cola sin asignar → TRUE ✓', 'INFO');
    } else {
      logTest('canBeAutoAssigned Case 1', false, 'Chat en cola sin asignar → FALSE (debería ser TRUE)', 'CRITICAL');
    }

    // Test case 2: Chat con bot activo (NO DEBERÍA ser auto-asignado)
    const case2 = canBeAutoAssigned({
      status: 'active',
      assignedTo: null,
      botFlowId: 'flow-123',
      queueId: null,
      campaignId: null,
    });

    if (!case2) {
      logTest('canBeAutoAssigned Case 2', true, 'Chat con bot activo → FALSE ✓', 'INFO');
    } else {
      logTest('canBeAutoAssigned Case 2', false, 'Chat con bot activo → TRUE (debería ser FALSE)', 'CRITICAL');
    }

    // Test case 3: Chat ya asignado (NO DEBERÍA ser auto-asignado de nuevo)
    const case3 = canBeAutoAssigned({
      status: 'active',
      assignedTo: 'user-123',
      botFlowId: null,
      queueId: 'queue-123',
      campaignId: null,
    });

    if (!case3) {
      logTest('canBeAutoAssigned Case 3', true, 'Chat ya asignado → FALSE ✓', 'INFO');
    } else {
      logTest('canBeAutoAssigned Case 3', false, 'Chat ya asignado → TRUE (debería ser FALSE)', 'CRITICAL');
    }

    // Test case 4: Chat cerrado (NO DEBERÍA ser auto-asignado)
    const case4 = canBeAutoAssigned({
      status: 'closed',
      assignedTo: null,
      botFlowId: null,
      queueId: 'queue-123',
      campaignId: null,
    });

    if (!case4) {
      logTest('canBeAutoAssigned Case 4', true, 'Chat cerrado → FALSE ✓', 'INFO');
    } else {
      logTest('canBeAutoAssigned Case 4', false, 'Chat cerrado → TRUE (debería ser FALSE)', 'CRITICAL');
    }

  } catch (error) {
    logTest('canBeAutoAssigned Logic', false, `Error al verificar lógica: ${error}`, 'CRITICAL');
  }
}

// ============================================================================
// TEST 6: Verificar conteo de chats activos
// ============================================================================
async function test6_ActiveChatsCount() {
  console.log('\n📊 TEST 6: Verificando conteo de chats activos por asesor...\n');

  try {
    const advisors = await pool.query(`
      SELECT DISTINCT assigned_to as advisor_id
      FROM crm_conversations
      WHERE assigned_to IS NOT NULL
      AND status IN ('active', 'attending')
    `);

    for (const { advisor_id } of advisors.rows) {
      const activeCount = await pool.query(`
        SELECT COUNT(*) as count
        FROM crm_conversations
        WHERE assigned_to = $1
        AND status = 'active'
      `, [advisor_id]);

      const attendingCount = await pool.query(`
        SELECT COUNT(*) as count
        FROM crm_conversations
        WHERE assigned_to = $1
        AND status = 'attending'
      `, [advisor_id]);

      const totalCount = parseInt(activeCount.rows[0].count) + parseInt(attendingCount.rows[0].count);

      console.log(`  ${advisor_id}: ${totalCount} chats (${attendingCount.rows[0].count} TRABAJANDO + ${activeCount.rows[0].count} POR TRABAJAR)`);

      if (totalCount > 50) {
        logTest('Active Chats Count', false,
          `${advisor_id} tiene ${totalCount} chats activos (parece anormal)`,
          'WARNING'
        );
      }
    }

    logTest('Active Chats Count', true, 'Conteo de chats activos verificado', 'INFO');

  } catch (error) {
    logTest('Active Chats Count', false, `Error al contar chats: ${error}`, 'CRITICAL');
  }
}

// ============================================================================
// TEST 7: Simular evento onChatQueued con datos reales
// ============================================================================
async function test7_SimulateOnChatQueued() {
  console.log('\n📥 TEST 7: Simulando evento onChatQueued con datos reales...\n');

  try {
    // Buscar un chat real en cola sin asignar
    const unassignedChat = await pool.query(`
      SELECT id, phone, queue_id
      FROM crm_conversations
      WHERE status = 'active'
      AND assigned_to IS NULL
      AND queue_id IS NOT NULL
      AND bot_flow_id IS NULL
      LIMIT 1
    `);

    if (unassignedChat.rows.length === 0) {
      logTest('Simulate onChatQueued', true,
        'No hay chats sin asignar para simular (esto es bueno - significa todo está asignado)',
        'INFO'
      );
      return;
    }

    const chat = unassignedChat.rows[0];
    console.log(`  Simulando asignación de chat: ${chat.phone} en cola ${chat.queue_id}`);

    // Verificar que la cola existe y tiene asesores
    const queue = await pool.query(`
      SELECT name, assigned_advisors, supervisors
      FROM crm_queues
      WHERE id = $1
    `, [chat.queue_id]);

    if (queue.rows.length === 0) {
      logTest('Simulate onChatQueued', false,
        `Cola ${chat.queue_id} no existe en base de datos`,
        'CRITICAL'
      );
      return;
    }

    const queueData = queue.rows[0];

    if (!queueData.assigned_advisors || queueData.assigned_advisors.length === 0) {
      logTest('Simulate onChatQueued', false,
        `Cola "${queueData.name}" no tiene asesores asignados`,
        'WARNING'
      );
      return;
    }

    // Buscar asesor ONLINE (excluyendo supervisores)
    let foundOnline = false;
    for (const advisorId of queueData.assigned_advisors) {
      const isSupervisor = queueData.supervisors && queueData.supervisors.includes(advisorId);
      const isOnline = advisorPresence.isOnline(advisorId);

      if (!isSupervisor && isOnline) {
        console.log(`  ✅ Asesor ONLINE encontrado: ${advisorId}`);
        foundOnline = true;
        break;
      }
    }

    if (foundOnline) {
      logTest('Simulate onChatQueued', true,
        `Chat ${chat.phone} PUEDE ser asignado (hay asesores online)`,
        'INFO'
      );
    } else {
      logTest('Simulate onChatQueued', false,
        `Chat ${chat.phone} NO PUEDE ser asignado (no hay asesores online en cola "${queueData.name}")`,
        'WARNING'
      );
    }

  } catch (error) {
    logTest('Simulate onChatQueued', false, `Error en simulación: ${error}`, 'CRITICAL');
  }
}

// ============================================================================
// TEST 8: Detectar posibles race conditions
// ============================================================================
async function test8_RaceConditions() {
  console.log('\n⚡ TEST 8: Detectando posibles race conditions...\n');

  try {
    // Buscar chats que fueron actualizados en los últimos 5 segundos
    const recentUpdates = await pool.query(`
      SELECT
        c1.id,
        c1.phone,
        c1.assigned_to,
        c1.status,
        COUNT(*) OVER (PARTITION BY c1.phone) as update_count
      FROM crm_conversations c1
      WHERE c1.updated_at > NOW() - INTERVAL '5 seconds'
    `);

    if (recentUpdates.rows.length > 0) {
      const multipleUpdates = recentUpdates.rows.filter(r => r.update_count > 1);

      if (multipleUpdates.length > 0) {
        logTest('Race Conditions', false,
          `${multipleUpdates.length} conversaciones actualizadas múltiples veces en 5s (posible race condition)`,
          'WARNING'
        );
      } else {
        logTest('Race Conditions', true,
          `${recentUpdates.rows.length} actualizaciones recientes, ninguna duplicada`,
          'INFO'
        );
      }
    } else {
      logTest('Race Conditions', true,
        'No hay actualizaciones recientes para analizar',
        'INFO'
      );
    }

    // Buscar chats con múltiples mensajes "Asignado automáticamente" (indicador de doble asignación)
    const duplicateAssignments = await pool.query(`
      SELECT
        conversation_id,
        COUNT(*) as assignment_count
      FROM crm_messages
      WHERE text LIKE '%Asignado automáticamente%'
      AND timestamp > EXTRACT(EPOCH FROM NOW() - INTERVAL '1 hour') * 1000
      GROUP BY conversation_id
      HAVING COUNT(*) > 1
    `);

    if (duplicateAssignments.rows.length > 0) {
      logTest('Duplicate Assignments', false,
        `${duplicateAssignments.rows.length} chats fueron asignados múltiples veces en la última hora`,
        'WARNING'
      );
    } else {
      logTest('Duplicate Assignments', true,
        'No hay asignaciones duplicadas en la última hora',
        'INFO'
      );
    }

  } catch (error) {
    logTest('Race Conditions', false, `Error al detectar race conditions: ${error}`, 'CRITICAL');
  }
}

// ============================================================================
// RESUMEN FINAL
// ============================================================================
function printSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 RESUMEN DE PRUEBAS');
  console.log('='.repeat(80) + '\n');

  const critical = results.filter(r => !r.passed && r.severity === 'CRITICAL');
  const warnings = results.filter(r => !r.passed && r.severity === 'WARNING');
  const passed = results.filter(r => r.passed);

  console.log(`✅ PASADAS: ${passed.length}`);
  console.log(`⚠️  WARNINGS: ${warnings.length}`);
  console.log(`🔴 CRÍTICAS: ${critical.length}`);

  if (critical.length > 0) {
    console.log('\n🔴 PROBLEMAS CRÍTICOS ENCONTRADOS:\n');
    critical.forEach(r => {
      console.log(`  ❌ [${r.test}] ${r.details}`);
    });
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS ENCONTRADOS:\n');
    warnings.forEach(r => {
      console.log(`  ⚠️  [${r.test}] ${r.details}`);
    });
  }

  console.log('\n' + '='.repeat(80));

  if (critical.length === 0 && warnings.length === 0) {
    console.log('✅ ¡TODAS LAS PRUEBAS PASARON! El sistema está listo para producción.');
  } else if (critical.length === 0) {
    console.log('⚠️  Hay algunos warnings pero no problemas críticos. Revisar antes de producción.');
  } else {
    console.log('🔴 HAY PROBLEMAS CRÍTICOS. Corregir antes de poner en producción.');
  }

  console.log('='.repeat(80) + '\n');
}

// ============================================================================
// MAIN
// ============================================================================
async function runTests() {
  console.log('🧪 INICIANDO PRUEBAS INTERNAS - QueueAssignmentService\n');
  console.log('=' .repeat(80));

  await test1_DatabaseStructure();
  await test2_ConversationState();
  await test3_QueueConfiguration();
  await test4_FindAvailableAdvisor();
  await test5_CanBeAutoAssigned();
  await test6_ActiveChatsCount();
  await test7_SimulateOnChatQueued();
  await test8_RaceConditions();

  printSummary();

  await pool.end();
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Error fatal en pruebas:', err);
  pool.end();
  process.exit(1);
});
