export type NodeType = "start" | "menu" | "action";

export type ActionKind =
  | "start"
  | "message"
  | "buttons"
  | "attachment"
  | "webhook_out"
  | "webhook_in"
  | "transfer"
  | "handoff"
  | "ia_rag"
  | "tool"
  | "ask"
  | "question"
  | "condition"
  | "validation"
  | "scheduler"
  | "delay"
  | "end";

export type MenuOption = {
  id: string;
  label: string;
  value?: string;
  targetId?: string | null;
};

export type ButtonOption = {
  id: string;
  label: string;
  value: string;
  targetId?: string | null;
};

export type ButtonsActionData = {
  items: ButtonOption[];
  maxButtons: number;
  moreTargetId: string | null;
};

export type AskValidation =
  | { type: "none" }
  | { type: "regex"; pattern: string }
  | { type: "options"; options: string[] };

export type AskActionData = {
  questionText: string;
  varName: string;
  varType: "text" | "number" | "option";
  validation: AskValidation;
  retryMessage?: string;
  answerTargetId: string | null;
  invalidTargetId: string | null;
};

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface TimeWindow {
  weekdays: Weekday[];
  start: string;
  end: string;
  overnight?: boolean;
}

export interface DateException {
  date: string;
  closed?: boolean;
  start?: string;
  end?: string;
}

export interface CustomSchedule {
  timezone: string;
  windows: TimeWindow[];
  exceptions?: DateException[];
}

export type SchedulerMode = "custom" | "bitrix";

export interface SchedulerNodeData {
  mode: SchedulerMode;
  custom?: CustomSchedule;
  inWindowTargetId: string | null;
  outOfWindowTargetId: string | null;
}

// Condition Types
export type ConditionOperator =
  | "equals"           // Igual a
  | "not_equals"       // Diferente de
  | "contains"         // Contiene
  | "not_contains"     // No contiene
  | "starts_with"      // Empieza con
  | "ends_with"        // Termina con
  | "matches_regex"    // Coincide con regex
  | "greater_than"     // Mayor que (números)
  | "less_than"        // Menor que (números)
  | "is_empty"         // Está vacío
  | "is_not_empty";    // No está vacío

export type ConditionSource =
  | "user_message"     // El mensaje del usuario
  | "variable"         // Una variable guardada
  | "bitrix_field"     // Campo de Bitrix24
  | "keyword";         // Palabra clave

export interface ConditionRule {
  id: string;
  source: ConditionSource;
  sourceValue?: string;        // Nombre de la variable o campo de Bitrix
  operator: ConditionOperator;
  compareValue?: string;       // Valor a comparar
  keywords?: string[];         // Lista de palabras clave
  caseSensitive?: boolean;     // Si importa mayúsculas/minúsculas
  targetId?: string | null;    // A dónde ir si se cumple
}

export interface ConditionActionData {
  rules: ConditionRule[];
  matchMode: "any" | "all";    // Si debe cumplir cualquiera o todas las reglas
  defaultTargetId: string | null;  // A dónde ir si no se cumple ninguna regla
  bitrixConfig?: {
    entityType: "lead" | "deal" | "contact" | "company";
    identifierField: string;     // Campo para identificar la entidad (ej: "PHONE")
    fieldsToCheck: string[];     // Campos a verificar
  };
  keywordGroups?: ValidationKeywordGroup[];
  keywordGroupLogic?: KeywordGroupLogic;
  matchTargetId?: string | null;
  noMatchTargetId?: string | null;
  errorTargetId?: string | null;
}

export type KeywordMatchMode = "contains" | "exact";

export type KeywordGroupLogic = "and" | "or";

export interface ValidationKeywordGroup {
  id: string;
  label?: string;
  mode: KeywordMatchMode;
  keywords: string[];
}

export type FlowAction = {
  kind: ActionKind;
  data?: Record<string, any>;
};

export type FlowNode = {
  id: string;
  label: string;
  type: NodeType;
  description?: string;
  action?: FlowAction;
  menuOptions?: MenuOption[];
  children: string[];
  delay?: number; // Delay in seconds before executing next node
};

export type ChannelType = 'whatsapp' | 'facebook' | 'instagram' | 'telegram';

export type WhatsAppNumberAssignment = {
  numberId: string;        // Unique ID for the WhatsApp number
  displayName: string;     // Friendly name (e.g., "Ventas", "Soporte")
  phoneNumber: string;     // Actual WhatsApp number
  queueId?: string;        // CRITICAL: Queue ID for bot transfers - prevents conversations from going to limbo
};

export type FlowChannelAssignment = {
  channelType: ChannelType;
  whatsappNumbers?: string[];  // Array of numberId values
  enabled: boolean;
};

export type Flow = {
  version: number;
  id: string;
  name: string;
  rootId: string;
  nodes: Record<string, FlowNode>;
  // Bot/Channel assignment (optional for backward compatibility)
  channelAssignments?: FlowChannelAssignment[];
};

export type OutputHandle = {
  id: string;
  label: string;
  side: "left" | "right";
  type: "input" | "output";
  order: number;
};

export type ChannelKey = "whatsapp" | "facebook" | "telegram" | "web";

export type ChannelButtonLimit = {
  channel: ChannelKey;
  max: number;
  source: string;
  note?: string;
};
