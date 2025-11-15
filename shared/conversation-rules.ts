/**
 * REGLAS DE CATEGORIZACIÓN DE CONVERSACIONES
 *
 * ⚠️ IMPORTANTE: Este archivo es la ÚNICA FUENTE DE VERDAD
 * para la lógica de categorización de conversaciones.
 *
 * - Backend (server/) usa estas reglas para asignar/transferir
 * - Frontend (src/) usa estas reglas para mostrar categorías
 *
 * ❌ NO DUPLICAR esta lógica en otros archivos
 * ✅ SIEMPRE importar desde aquí
 */

export type ConversationStatus = 'active' | 'attending' | 'archived' | 'closed';

export interface ConversationData {
  status: ConversationStatus;
  assignedTo: string | null;
  botFlowId: string | null;
  queueId: string | null;
  campaignId: string | null;
  transferredFrom?: string | null;
}

export type ConversationCategory =
  | 'MASIVOS'           // Prioridad 1: Tiene campaignId Y status closed
  | 'EN_COLA_BOT'       // Prioridad 2: Sin asesor O con bot activo
  | 'POR_TRABAJAR'      // Prioridad 3: Asignado a asesor humano pero NO aceptó
  | 'TRABAJANDO'        // Prioridad 4: Asesor aceptó (status attending)
  | 'FINALIZADOS';      // Prioridad 5: Closed/archived SIN campaignId

/**
 * Determina la categoría de una conversación
 *
 * REGLAS DE PRIORIDAD (según CATEGORIAS-CRM-PLAN.md líneas 68-73):
 *
 * 1. MASIVOS: campaignId presente Y status = 'closed'
 * 2. EN COLA/BOT:
 *    - status = 'active' Y assignedTo = null (sin asignar)
 *    - status = 'active' Y assignedTo = 'bot' (bot activo)
 * 3. POR TRABAJAR:
 *    - status = 'active' Y assignedTo != null Y assignedTo != 'bot' (asesor humano asignado pero no aceptó)
 * 4. TRABAJANDO:
 *    - status = 'attending' (asesor aceptó y está trabajando)
 * 5. FINALIZADOS:
 *    - (status = 'archived' O status = 'closed') Y NO tiene campaignId
 */
export function getConversationCategory(conv: ConversationData): ConversationCategory {
  // PRIORIDAD 1: MASIVOS
  if (conv.campaignId && conv.status === 'closed') {
    return 'MASIVOS';
  }

  // PRIORIDAD 2: EN COLA/BOT
  // Incluye: sin asignar O asignado al bot
  if (conv.status === 'active' && (!conv.assignedTo || conv.assignedTo === 'bot')) {
    return 'EN_COLA_BOT';
  }

  // PRIORIDAD 3: POR TRABAJAR
  // Tiene asesor HUMANO pero NO aceptó
  if (conv.status === 'active' && conv.assignedTo && conv.assignedTo !== 'bot') {
    return 'POR_TRABAJAR';
  }

  // PRIORIDAD 4: TRABAJANDO
  // Asesor aceptó
  if (conv.status === 'attending') {
    return 'TRABAJANDO';
  }

  // PRIORIDAD 5: FINALIZADOS
  // Closed/archived SIN campaignId
  if ((conv.status === 'archived' || conv.status === 'closed') && !conv.campaignId) {
    return 'FINALIZADOS';
  }

  // FALLBACK: Si no encaja en ninguna categoría, va a EN_COLA_BOT
  return 'EN_COLA_BOT';
}

/**
 * Verifica si una conversación está siendo atendida por el bot
 */
export function isBotActive(conv: ConversationData): boolean {
  return conv.status === 'active' &&
         conv.assignedTo === 'bot' &&
         conv.botFlowId !== null;
}

/**
 * Verifica si una conversación está en cola (sin asignar)
 */
export function isInQueue(conv: ConversationData): boolean {
  return conv.status === 'active' &&
         !conv.assignedTo &&
         !conv.botFlowId;
}

/**
 * Verifica si una conversación está asignada a un asesor humano
 */
export function isAssignedToHuman(conv: ConversationData): boolean {
  return conv.assignedTo !== null &&
         conv.assignedTo !== 'bot';
}

/**
 * Verifica si una conversación puede ser asignada por QueueDistributor
 *
 * REGLA: Solo asignar si:
 * - status = 'active'
 * - NO tiene assignedTo (o es null)
 * - NO tiene bot activo (botFlowId = null)
 */
export function canBeAutoAssigned(conv: ConversationData): boolean {
  return conv.status === 'active' &&
         !conv.assignedTo &&
         !conv.botFlowId;
}

/**
 * Verifica si el bot puede tomar control de una conversación
 *
 * REGLA: Bot puede tomar control si:
 * - NO está asignada a un asesor humano
 * - O status = 'archived' (chat archivado reabierto por cliente)
 */
export function canBotTakeControl(conv: ConversationData): boolean {
  // Si está archivado, bot SIEMPRE puede tomar control (reapertura por cliente)
  if (conv.status === 'archived') {
    return true;
  }

  // Si está activo, solo si NO tiene asesor humano
  return conv.status === 'active' &&
         (!conv.assignedTo || conv.assignedTo === 'bot');
}
