import { advisorPresence } from './server/crm/advisor-presence';

const advisorsToCheck = [
  'user-1761954566426', // Rosario (ATC)
  'user-1761954617719', // Angela (ATC)
  'user-1761954747002', // Ana (Counter)
  'user-1761954642084', // Martha (Counter)
  'user-1762179224034', // Carlos (Prospectos)
];

console.log('🔍 Verificando estado ONLINE de asesores:\n');

for (const advisorId of advisorsToCheck) {
  const isOnline = advisorPresence.isOnline(advisorId);
  const icon = isOnline ? '✅' : '❌';
  console.log(`${icon} ${advisorId}: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
}

console.log('\n📊 Resumen:');
const onlineCount = advisorsToCheck.filter(id => advisorPresence.isOnline(id)).length;
console.log(`Total: ${advisorsToCheck.length} asesores`);
console.log(`Online: ${onlineCount}`);
console.log(`Offline: ${advisorsToCheck.length - onlineCount}`);

if (onlineCount === 0) {
  console.log('\n⚠️  No hay asesores ONLINE - por eso los 21 chats están sin asignar (esto es CORRECTO)');
} else {
  console.log('\n🔴 HAY asesores ONLINE pero chats sin asignar - posible problema');
}

process.exit(0);
