/**
 * Monitor de Servicios de Asignación
 * Analiza los logs para distinguir entre QueueDistributor (viejo) y QueueAssignmentService (nuevo)
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface AssignmentEvent {
  timestamp: string;
  service: 'QueueDistributor' | 'QueueAssignmentService';
  type: 'assignment' | 'warning' | 'error' | 'info';
  message: string;
}

async function analyzeLogs(minutes: number = 60): Promise<void> {
  console.log('📊 MONITOR DE SERVICIOS DE ASIGNACIÓN');
  console.log('=' .repeat(80));
  console.log(`Analizando últimos ${minutes} minutos...\n`);

  // Obtener logs
  const { stdout } = await execAsync(`sudo journalctl -u flowbuilder --since "${minutes} minutes ago" --no-pager`);
  const lines = stdout.split('\n');

  const events: AssignmentEvent[] = [];
  let queueDistributorAssignments = 0;
  let queueAssignmentServiceAssignments = 0;
  let queueDistributorWarnings = 0;
  let queueAssignmentServiceErrors = 0;

  for (const line of lines) {
    // QueueDistributor (viejo)
    if (line.includes('[QueueDistributor]')) {
      const timestamp = line.substring(0, 15);
      const message = line.substring(line.indexOf('[QueueDistributor]'));

      if (message.includes('✅') || message.includes('Asignado')) {
        queueDistributorAssignments++;
        events.push({ timestamp, service: 'QueueDistributor', type: 'assignment', message });
      } else if (message.includes('⚠️') || message.includes('no hay asesores')) {
        queueDistributorWarnings++;
        events.push({ timestamp, service: 'QueueDistributor', type: 'warning', message });
      } else if (message.includes('❌') || message.includes('Error')) {
        events.push({ timestamp, service: 'QueueDistributor', type: 'error', message });
      }
    }

    // QueueAssignmentService (nuevo)
    if (line.includes('[QueueAssignment]')) {
      const timestamp = line.substring(0, 15);
      const message = line.substring(line.indexOf('[QueueAssignment]'));

      if (message.includes('✅') || message.includes('Chat') && message.includes('→')) {
        queueAssignmentServiceAssignments++;
        events.push({ timestamp, service: 'QueueAssignmentService', type: 'assignment', message });
      } else if (message.includes('⚠️')) {
        events.push({ timestamp, service: 'QueueAssignmentService', type: 'warning', message });
      } else if (message.includes('❌') || message.includes('Error')) {
        queueAssignmentServiceErrors++;
        events.push({ timestamp, service: 'QueueAssignmentService', type: 'error', message });
      } else if (message.includes('📥') || message.includes('👤')) {
        events.push({ timestamp, service: 'QueueAssignmentService', type: 'info', message });
      }
    }
  }

  // RESUMEN
  console.log('📈 RESUMEN DE ACTIVIDAD:\n');

  console.log('🔵 QueueDistributor (VIEJO - Polling cada 10s):');
  console.log(`   Asignaciones realizadas: ${queueDistributorAssignments}`);
  console.log(`   Warnings (no asesores): ${queueDistributorWarnings}`);

  console.log('\n🟢 QueueAssignmentService (NUEVO - Event-driven):');
  console.log(`   Asignaciones realizadas: ${queueAssignmentServiceAssignments}`);
  console.log(`   Errores detectados: ${queueAssignmentServiceErrors}`);

  // DIAGNÓSTICO
  console.log('\n' + '='.repeat(80));
  console.log('🔍 DIAGNÓSTICO:\n');

  if (queueAssignmentServiceAssignments > 0) {
    console.log('✅ El servicio NUEVO está funcionando y asignando chats');
  } else {
    console.log('⚠️  El servicio NUEVO no ha asignado chats aún');
    console.log('   Posibles razones:');
    console.log('   - No hubo eventos (no llegaron chats nuevos a cola)');
    console.log('   - No hay asesores online');
    console.log('   - El servicio no se activó correctamente');
  }

  if (queueDistributorAssignments > 0) {
    console.log('\n⚠️  El servicio VIEJO está asignando chats');
    console.log('   Esto puede indicar que el nuevo no está capturando todos los casos');
  }

  if (queueAssignmentServiceErrors > 0) {
    console.log(`\n🔴 ATENCIÓN: ${queueAssignmentServiceErrors} errores en el servicio NUEVO`);
    console.log('   Revisar logs detallados abajo');
  }

  // EVENTOS IMPORTANTES
  console.log('\n' + '='.repeat(80));
  console.log('📋 EVENTOS IMPORTANTES (últimos 20):\n');

  const importantEvents = events.filter(e =>
    e.type === 'assignment' || e.type === 'error'
  ).slice(-20);

  if (importantEvents.length === 0) {
    console.log('   No hay asignaciones ni errores en el período analizado');
  } else {
    for (const event of importantEvents) {
      const icon = event.service === 'QueueDistributor' ? '🔵' : '🟢';
      const typeIcon = event.type === 'error' ? '🔴' : event.type === 'assignment' ? '✅' : 'ℹ️';
      console.log(`${icon} ${typeIcon} ${event.timestamp} - ${event.service}`);
      console.log(`   ${event.message}\n`);
    }
  }

  // CÓMO DISTINGUIR
  console.log('='.repeat(80));
  console.log('📖 CÓMO DISTINGUIR CADA SERVICIO:\n');

  console.log('🔵 QueueDistributor (VIEJO):');
  console.log('   Patrón: Se ejecuta cada 10 segundos (polling)');
  console.log('   Logs:');
  console.log('   - "[QueueDistributor] 🎯 Distribuyendo chats..."');
  console.log('   - "[QueueDistributor] ✅ Chat XXXX asignado a [Nombre]"');
  console.log('   - "[QueueDistributor] ⚠️  Cola "XXX": N chats esperando..."');

  console.log('\n🟢 QueueAssignmentService (NUEVO):');
  console.log('   Patrón: Se ejecuta SOLO cuando hay eventos (reactivo)');
  console.log('   Logs:');
  console.log('   - "[QueueAssignment] 📥 Chat XXX entró a cola YYY"');
  console.log('   - "[QueueAssignment] 👤 Asesor XXX está ONLINE - buscando chats"');
  console.log('   - "[QueueAssignment] ✅ Chat XXXX → [Nombre] (chat_queued|advisor_online)"');
  console.log('   - "[QueueAssignment] ❌ Error en onChatQueued:" (si falla)');

  console.log('\n💡 SEÑALES DE QUE EL NUEVO FALLÓ:');
  console.log('   1. Ves logs "[QueueAssignment] ❌ Error"');
  console.log('   2. Llega un chat nuevo a cola pero NO ves "[QueueAssignment] 📥 Chat entró a cola"');
  console.log('   3. Un asesor se loguea pero NO ves "[QueueAssignment] 👤 Asesor está ONLINE"');
  console.log('   4. Chats quedan sin asignar aunque hay asesores online');
  console.log('   5. QueueDistributor asigna chats que debieron ser asignados por el nuevo');

  console.log('\n' + '='.repeat(80));
}

// Ejecutar
const minutes = process.argv[2] ? parseInt(process.argv[2]) : 60;
analyzeLogs(minutes).catch(err => {
  console.error('Error al analizar logs:', err);
  process.exit(1);
});
