/**
 * Variable replacement utility for flow messages
 * Supports {{contact:field}}, {{lead:field}}, {{deal:field}}, {{company:field}}
 */

interface VariableContext {
  contact?: Record<string, any>;
  lead?: Record<string, any>;
  deal?: Record<string, any>;
  company?: Record<string, any>;
  custom?: Record<string, string>;  // Custom variables from flow execution
}

/**
 * Replace variables in text with actual values
 * Supports formats:
 * - {{contact:FIELD_NAME}} - Contact field from Bitrix
 * - {{lead:FIELD_NAME}} - Lead field from Bitrix
 * - {{deal:FIELD_NAME}} - Deal field from Bitrix
 * - {{company:FIELD_NAME}} - Company field from Bitrix
 * - {{variable_name}} - Custom variable from flow
 */
export function replaceVariables(text: string, context: VariableContext): string {
  if (!text) return text;

  let result = text;

  // Replace {{contact:field}}
  result = result.replace(/\{\{contact:([A-Z_]+)\}\}/gi, (match, field) => {
    const value = context.contact?.[field] || context.contact?.[field.toUpperCase()];
    return value !== undefined && value !== null ? String(value) : match;
  });

  // Replace {{lead:field}}
  result = result.replace(/\{\{lead:([A-Z_]+)\}\}/gi, (match, field) => {
    const value = context.lead?.[field] || context.lead?.[field.toUpperCase()];
    return value !== undefined && value !== null ? String(value) : match;
  });

  // Replace {{deal:field}}
  result = result.replace(/\{\{deal:([A-Z_]+)\}\}/gi, (match, field) => {
    const value = context.deal?.[field] || context.deal?.[field.toUpperCase()];
    return value !== undefined && value !== null ? String(value) : match;
  });

  // Replace {{company:field}}
  result = result.replace(/\{\{company:([A-Z_]+)\}\}/gi, (match, field) => {
    const value = context.company?.[field] || context.company?.[field.toUpperCase()];
    return value !== undefined && value !== null ? String(value) : match;
  });

  // Replace {{variable_name}} - custom variables from flow
  result = result.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (match, varName) => {
    const value = context.custom?.[varName];
    return value !== undefined && value !== null ? value : match;
  });

  return result;
}

/**
 * Extract all variables from text
 * Returns array of {type: 'contact'|'lead'|'deal'|'company'|'custom', field: string}
 */
export function extractVariables(text: string): Array<{type: string; field: string}> {
  if (!text) return [];

  const variables: Array<{type: string; field: string}> = [];

  // Extract {{entity:field}} patterns
  const entityPattern = /\{\{(contact|lead|deal|company):([A-Z_]+)\}\}/gi;
  let match;
  while ((match = entityPattern.exec(text)) !== null) {
    variables.push({
      type: match[1].toLowerCase(),
      field: match[2].toUpperCase(),
    });
  }

  // Extract {{variable_name}} patterns
  const customPattern = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
  while ((match = customPattern.exec(text)) !== null) {
    // Skip if already matched as entity:field
    if (!match[0].includes(':')) {
      variables.push({
        type: 'custom',
        field: match[1],
      });
    }
  }

  return variables;
}
