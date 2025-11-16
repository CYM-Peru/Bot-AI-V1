/**
 * Campaign Health Check System
 * Validates WhatsApp connections and templates before sending campaigns
 * Prevents configuration errors and failures
 */

import { fetchMessageTemplates } from '../../src/api/whatsapp-sender';
import { getWhatsAppConnection } from '../services/whatsapp-connections';

interface HealthCheckResult {
  ok: boolean;
  issues: string[];
  warnings: string[];
}

interface WhatsAppConnection {
  id: string;
  alias: string;
  phoneNumberId: string;
  displayNumber: string;
  accessToken: string;
  wabaId: string;
  isActive: boolean;
}

/**
 * Validate WhatsApp connection health
 */
export async function validateWhatsAppConnection(phoneNumberId: string): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    ok: true,
    issues: [],
    warnings: [],
  };

  try {
    // Read from PostgreSQL
    const connection = await getWhatsAppConnection(phoneNumberId);

    if (!connection) {
      result.ok = false;
      result.issues.push(`phoneNumberId ${phoneNumberId} not found in connections`);
      return result;
    }

    if (!connection.isActive) {
      result.ok = false;
      result.issues.push(`Connection ${connection.alias} is not active`);
    }

    if (!connection.accessToken) {
      result.ok = false;
      result.issues.push(`No access token for ${connection.alias}`);
    }

    if (!connection.wabaId) {
      result.warnings.push(`No WABA ID configured for ${connection.alias}`);
    }

    // Validate token format (should be a long string)
    if (connection.accessToken && connection.accessToken.length < 50) {
      result.warnings.push(`Access token for ${connection.alias} seems too short - may be invalid`);
    }

  } catch (error) {
    result.ok = false;
    result.issues.push(`Failed to read connections: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Validate template exists and is approved
 */
export async function validateTemplate(
  phoneNumberId: string,
  templateName: string
): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    ok: true,
    issues: [],
    warnings: [],
  };

  try {
    // Read from PostgreSQL
    const connection = await getWhatsAppConnection(phoneNumberId);

    if (!connection || !connection.wabaId || !connection.accessToken) {
      result.ok = false;
      result.issues.push('Cannot validate template: Connection info missing');
      return result;
    }

    // Fetch templates from WhatsApp API
    const templatesResult = await fetchMessageTemplates(connection.wabaId, connection.accessToken);

    if (!templatesResult.ok) {
      result.ok = false;
      result.issues.push(`Failed to fetch templates: HTTP ${templatesResult.status}`);
      return result;
    }

    const template = templatesResult.templates.find((t: any) => t.name === templateName);

    if (!template) {
      result.ok = false;
      result.issues.push(`Template "${templateName}" not found for this WhatsApp number`);
      return result;
    }

    if (template.status !== 'APPROVED') {
      result.ok = false;
      result.issues.push(`Template "${templateName}" is not approved (status: ${template.status})`);
    }

    // Success!
    result.warnings.push(`Template "${templateName}" validated successfully (${template.language})`);

  } catch (error) {
    result.ok = false;
    result.issues.push(`Template validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Run full health check for a campaign configuration
 */
export async function runCampaignHealthCheck(
  phoneNumberId: string,
  templateName: string
): Promise<HealthCheckResult> {
  console.log(`[Health Check] Running for phoneNumberId: ${phoneNumberId}, template: ${templateName}`);

  const result: HealthCheckResult = {
    ok: true,
    issues: [],
    warnings: [],
  };

  // Check 1: Validate WhatsApp connection
  const connectionCheck = await validateWhatsAppConnection(phoneNumberId);
  result.issues.push(...connectionCheck.issues);
  result.warnings.push(...connectionCheck.warnings);
  if (!connectionCheck.ok) {
    result.ok = false;
  }

  // Check 2: Validate template (only if connection is OK)
  if (connectionCheck.ok) {
    const templateCheck = await validateTemplate(phoneNumberId, templateName);
    result.issues.push(...templateCheck.issues);
    result.warnings.push(...templateCheck.warnings);
    if (!templateCheck.ok) {
      result.ok = false;
    }
  }

  // Log results
  if (result.ok) {
    console.log(`[Health Check] ✅ PASSED - Campaign configuration is valid`);
  } else {
    console.error(`[Health Check] ❌ FAILED - Issues found:`, result.issues);
  }

  if (result.warnings.length > 0) {
    console.warn(`[Health Check] ⚠️  Warnings:`, result.warnings);
  }

  return result;
}
