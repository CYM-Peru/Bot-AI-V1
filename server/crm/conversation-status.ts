/**
 * Conversation Status Management
 *
 * BLINDAJE: Type-safe status transitions and validation
 */

/**
 * Valid conversation statuses
 *
 * - active: Conversation in queue, no advisor assigned
 * - attending: Advisor is actively attending the conversation
 * - archived: Auto-closed by system after 24h of client inactivity
 * - closed: Manually closed by advisor OR campaign message (not responded)
 */
export enum ConversationStatus {
  ACTIVE = 'active',
  ATTENDING = 'attending',
  ARCHIVED = 'archived',
  CLOSED = 'closed',
}

/**
 * Valid status transition map
 * Prevents invalid state changes
 */
const VALID_TRANSITIONS: Record<ConversationStatus, ConversationStatus[]> = {
  [ConversationStatus.ACTIVE]: [
    ConversationStatus.ATTENDING,  // Advisor accepts
    ConversationStatus.ARCHIVED,   // Auto-archive
    ConversationStatus.CLOSED,     // Manual close
  ],
  [ConversationStatus.ATTENDING]: [
    ConversationStatus.ACTIVE,     // Transfer/unassign
    ConversationStatus.ARCHIVED,   // Auto-archive
    ConversationStatus.CLOSED,     // Manual close
  ],
  [ConversationStatus.ARCHIVED]: [
    ConversationStatus.ACTIVE,     // Client writes back / unarchive
  ],
  [ConversationStatus.CLOSED]: [
    ConversationStatus.ACTIVE,     // Client responds to campaign / reopen
  ],
};

/**
 * Validate if status transition is allowed
 */
export function isValidTransition(from: string, to: string): boolean {
  // Convert strings to enum values
  const fromStatus = from as ConversationStatus;
  const toStatus = to as ConversationStatus;

  // Check if both are valid statuses
  if (!Object.values(ConversationStatus).includes(fromStatus)) {
    console.error(`[Status] Invalid source status: ${from}`);
    return false;
  }

  if (!Object.values(ConversationStatus).includes(toStatus)) {
    console.error(`[Status] Invalid target status: ${to}`);
    return false;
  }

  // Allow same status (no-op)
  if (fromStatus === toStatus) {
    return true;
  }

  // Check if transition is allowed
  const allowedTransitions = VALID_TRANSITIONS[fromStatus] || [];
  return allowedTransitions.includes(toStatus);
}

/**
 * Validate status value
 */
export function isValidStatus(status: string): status is ConversationStatus {
  return Object.values(ConversationStatus).includes(status as ConversationStatus);
}

/**
 * Get all valid statuses as array
 */
export function getAllStatuses(): string[] {
  return Object.values(ConversationStatus);
}

/**
 * Safe status change with validation
 * Returns error message if transition is invalid
 */
export function validateStatusChange(
  currentStatus: string,
  newStatus: string
): { valid: boolean; error?: string } {
  if (!isValidStatus(currentStatus)) {
    return {
      valid: false,
      error: `Invalid current status: "${currentStatus}". Valid: ${getAllStatuses().join(', ')}`,
    };
  }

  if (!isValidStatus(newStatus)) {
    return {
      valid: false,
      error: `Invalid target status: "${newStatus}". Valid: ${getAllStatuses().join(', ')}`,
    };
  }

  if (!isValidTransition(currentStatus, newStatus)) {
    return {
      valid: false,
      error: `Invalid transition: "${currentStatus}" → "${newStatus}". Allowed: ${VALID_TRANSITIONS[currentStatus as ConversationStatus].join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Get human-readable status description
 */
export function getStatusDescription(status: string): string {
  switch (status) {
    case ConversationStatus.ACTIVE:
      return 'En cola, sin asesor asignado';
    case ConversationStatus.ATTENDING:
      return 'Siendo atendido por asesor';
    case ConversationStatus.ARCHIVED:
      return 'Archivado automáticamente por inactividad';
    case ConversationStatus.CLOSED:
      return 'Cerrado manualmente o campaña masiva';
    default:
      return `Estado desconocido: ${status}`;
  }
}

/**
 * Check if status represents a "finished" conversation
 */
export function isFinishedStatus(status: string): boolean {
  return status === ConversationStatus.ARCHIVED || status === ConversationStatus.CLOSED;
}

/**
 * Check if status represents an "open" conversation
 */
export function isOpenStatus(status: string): boolean {
  return status === ConversationStatus.ACTIVE || status === ConversationStatus.ATTENDING;
}
