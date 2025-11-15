export type NodeType = "start" | "menu" | "simple-menu" | "text-menu" | "action";

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
  | "ia_agent"  // NEW: IA Agent with function calling and tools
  | "tool"
  | "ask"
  | "question"
  | "condition"
  | "validation"
  | "validation_bitrix"  // NEW: Bitrix-specific validations
  | "scheduler"
  | "delay"
  | "bitrix_create"  // LEGACY: Keep for backward compatibility
  | "bitrix_crm"  // NEW: Universal CRM operations (create, update, delete)
  | "end";

export type MenuOption = {
  id: string;
  label: string;
  value?: string;
  targetId?: string | null;
  customMessage?: string;  // Custom message when user sends invalid response
};

export type ButtonOption = {
  id: string;
  label: string;
  value: string;
  targetId?: string | null;
  customMessage?: string;  // Custom message when user sends invalid response
};

export type ButtonsActionData = {
  items: ButtonOption[];
  maxButtons: number;
  moreTargetId: string | null;
  customMessage?: string;  // Custom message for invalid responses (fallback if button doesn't have one)
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
  keywordMode?: KeywordMatchMode;  // 'contains' o 'exact' - modo de coincidencia de palabras clave
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

// ============ NEW VALIDATION TYPES ============

// Validation Node (generic validations - no Bitrix)
export type ValidationType =
  | "keywords"         // Keyword matching
  | "format"           // Format validation (email, phone, etc)
  | "variable"         // Variable comparison
  | "range"            // Numeric range
  | "options_list"     // Value in list
  | "length"           // Text length
  | "regex";           // Custom regex

export type FormatType =
  | "email"
  | "phone_pe"         // Peruvian phone (9 digits)
  | "dni"              // DNI (8 digits)
  | "ruc"              // RUC (11 digits)
  | "number"
  | "url"
  | "date"             // DD/MM/YYYY
  | "custom_regex";

export interface ValidationActionData {
  validationType: ValidationType;

  // Keywords validation
  keywordGroups?: ValidationKeywordGroup[];
  keywordGroupLogic?: KeywordGroupLogic;

  // Format validation
  formatType?: FormatType;
  customRegex?: string;
  saveToVariable?: string;

  // Variable validation
  variableName?: string;
  operator?: ConditionOperator;
  compareValue?: string;

  // Range validation
  min?: number;
  max?: number;
  includeMin?: boolean;
  includeMax?: boolean;

  // Options list validation
  validOptions?: string[];
  caseSensitive?: boolean;

  // Length validation
  minLength?: number;
  maxLength?: number;

  // Output routes
  validTargetId?: string | null;
  invalidTargetId?: string | null;

  // Keyword group routes (for dynamic outputs per group)
  groupTargetIds?: Record<string, string | null>; // { groupId: targetNodeId }
  noMatchTargetId?: string | null; // For "no match" fallback
}

// Validation Bitrix Node (Bitrix-specific validations)
export type ValidationBitrixType =
  | "exists"           // Check if entity exists
  | "field"            // Check specific field value
  | "multiple_fields"; // Check multiple fields

export interface BitrixFieldCheck {
  id: string;
  fieldName: string;
  operator: ConditionOperator;
  expectedValue: string;
}

export interface ValidationBitrixActionData {
  validationType: ValidationBitrixType;

  entityType: BitrixEntityType;
  identifierField: string;  // PHONE, EMAIL, etc

  // For "field" and "multiple_fields"
  fieldChecks?: BitrixFieldCheck[];
  matchMode?: "all" | "any";  // For multiple_fields

  // Output routes
  matchTargetId?: string | null;
  noMatchTargetId?: string | null;
  errorTargetId?: string | null;
}

// ============ END NEW VALIDATION TYPES ============

// Bitrix Create Entity Types
export type BitrixEntityType = "lead" | "contact" | "deal" | "company";

export interface BitrixCreateField {
  id: string;
  fieldName: string;    // Campo de Bitrix (ej: "NAME", "PHONE", "TITLE")
  valueType: "static" | "variable";  // Valor estático o variable del flujo
  staticValue?: string;  // Valor fijo
  variableName?: string; // Nombre de variable del flujo (ej: "nombre_cliente")
}

// Bitrix CRM Operations
export type BitrixCrmOperation = "create" | "update" | "delete" | "search";

export interface BitrixSearchFilter {
  id: string;
  fieldName: string;              // Campo de Bitrix (ej: "NAME", "PHONE", "STATUS_ID")
  operator: ConditionOperator;    // Operador de comparación
  valueType: "static" | "variable";  // Valor estático o variable del flujo
  staticValue?: string;           // Valor fijo
  variableName?: string;          // Nombre de variable del flujo
}

export interface BitrixCrmActionData {
  operation?: BitrixCrmOperation;  // Operación a realizar (optional for backward compatibility, defaults to "create")
  entityType: BitrixEntityType;   // Tipo de entidad (lead, contact, deal, company)

  // For CREATE and UPDATE
  fields?: BitrixCreateField[];    // Campos a rellenar/actualizar

  // For UPDATE and DELETE
  identifierType?: "current" | "phone" | "email" | "id";  // Cómo identificar la entidad
  identifierId?: string;           // ID específico (solo si identifierType = "id")

  // For SEARCH
  searchFilters?: BitrixSearchFilter[];  // Filtros de búsqueda
  searchMatchMode?: "all" | "any";       // Modo de coincidencia de filtros
  searchLimit?: number;                  // Límite de resultados (default: 1)
  saveResultsTo?: string;                // Variable donde guardar los resultados
  saveCountTo?: string;                  // Variable donde guardar el número de resultados

  successTargetId: string | null;  // A dónde ir si tiene éxito
  errorTargetId: string | null;    // A dónde ir si falla

  // For SEARCH: additional routing
  foundTargetId?: string | null;     // A dónde ir si se encuentra(n) resultado(s)
  notFoundTargetId?: string | null;  // A dónde ir si no se encuentra nada
}

// LEGACY: Keep for backward compatibility - this is just an alias now
export type BitrixCreateActionData = BitrixCrmActionData;

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
  menuType?: "interactive" | "text";  // Type of menu: interactive buttons or plain text
  customMessage?: string;  // Custom message for menu nodes when user sends invalid response
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
