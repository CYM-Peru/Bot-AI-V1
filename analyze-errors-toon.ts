/**
 * Extrae errores de logs y genera formato TOON para análisis con LLM
 * Uso: npx tsx analyze-errors-toon.ts [minutos]
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function analyzeErrors(minutes: number = 60) {
  // Extraer errores de logs
  const { stdout } = await execAsync(
    `sudo journalctl -u flowbuilder --since "${minutes} minutes ago" --no-pager | grep -i "error\\|exception\\|failed\\|critical"`
  );

  const lines = stdout.trim().split('\n').filter(l => l.length > 0);

  // Agrupar por tipo
  const errors: Record<string, string[]> = {};

  for (const line of lines) {
    const match = line.match(/\[(.*?)\]/);
    const component = match ? match[1] : 'Unknown';

    if (!errors[component]) {
      errors[component] = [];
    }
    errors[component].push(line);
  }

  // Generar reporte TOON
  console.log('='.repeat(80));
  console.log('🔴 ANÁLISIS DE ERRORES - FORMATO TOON');
  console.log('='.repeat(80));
  console.log('');

  const toonReport = `
analisisErrores:
  periodo: Últimos ${minutes} minutos
  timestamp: ${new Date().toISOString()}
  totalErrores: ${lines.length}

erroresPorComponente[${Object.keys(errors).length}]{componente,cantidad}:
${Object.entries(errors).map(([comp, errs]) => `  ${comp},${errs.length}`).join('\n')}

detalleErrores:
${Object.entries(errors).slice(0, 5).map(([comp, errs]) => `
  ${comp}:
    cantidad: ${errs.length}
    ultimoError: ${errs[errs.length - 1].substring(0, 100)}...
`).join('')}

contexto:
  sistema: FlowBuilder CRM
  serviciosActivos:
    - QueueDistributor (polling)
    - QueueAssignmentService (event-driven)
    - BotTimeoutScheduler
    - AdvisorPresence

prompt:
  Analiza estos errores y:
  1. Identifica el componente más problemático
  2. Determina si son errores críticos o warnings normales
  3. Sugiere acciones correctivas
  4. Prioriza por severidad
`;

  console.log(toonReport);
  console.log('');
  console.log('='.repeat(80));
  console.log('💡 Usa este reporte con AI para diagnosticar problemas');
  console.log('='.repeat(80));
}

const minutes = process.argv[2] ? parseInt(process.argv[2]) : 60;
analyzeErrors(minutes).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
