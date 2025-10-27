import {
  type WebhookDispatcher,
  type WebhookCallConfig,
  type WebhookCallResult,
  type ConversationSession,
} from "../src/runtime/executor";
import type { Flow, FlowNode } from "../src/flow/types";

/**
 * HttpWebhookDispatcher
 *
 * Executes HTTP webhook calls to external services.
 * Supports variable interpolation from session context.
 */
export class HttpWebhookDispatcher implements WebhookDispatcher {
  private readonly defaultTimeout: number = 10000; // 10 seconds

  async callWebhook(
    config: WebhookCallConfig,
    context: { flow: Flow; node: FlowNode; session: ConversationSession }
  ): Promise<WebhookCallResult> {
    const startTime = Date.now();

    try {
      // Interpolate variables in URL, headers, and body
      const interpolatedUrl = this.interpolateVariables(config.url, context.session.variables);
      const interpolatedHeaders = this.interpolateHeaders(config.headers || {}, context.session.variables);
      const interpolatedBody = this.interpolateBody(config.body, context.session.variables);

      console.log(`[INFO] Calling webhook: ${config.method || "POST"} ${interpolatedUrl}`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs || this.defaultTimeout);

      const response = await fetch(interpolatedUrl, {
        method: config.method || "POST",
        headers: {
          "Content-Type": "application/json",
          ...interpolatedHeaders,
        },
        body: interpolatedBody ? JSON.stringify(interpolatedBody) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const duration = Date.now() - startTime;
      let responseData: unknown = null;

      try {
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }
      } catch (parseError) {
        console.warn("[WARN] Failed to parse webhook response body:", parseError);
      }

      const result: WebhookCallResult = {
        ok: response.ok,
        status: response.status,
        response: responseData,
      };

      if (response.ok) {
        console.log(`[INFO] Webhook succeeded (${duration}ms): ${response.status}`);
      } else {
        console.warn(`[WARN] Webhook failed (${duration}ms): ${response.status}`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error instanceof Error && error.name === "AbortError") {
        console.error(`[ERROR] Webhook timeout (${duration}ms)`);
        return {
          ok: false,
          status: 408, // Request Timeout
          response: { error: "Webhook timeout" },
        };
      }

      console.error(`[ERROR] Webhook error (${duration}ms):`, error);
      return {
        ok: false,
        status: 500,
        response: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  /**
   * Interpolate variables in a string.
   * Supports {{variableName}} syntax.
   */
  private interpolateVariables(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return variables[varName] ?? match;
    });
  }

  /**
   * Interpolate variables in headers.
   */
  private interpolateHeaders(
    headers: Record<string, string>,
    variables: Record<string, string>
  ): Record<string, string> {
    const interpolated: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
      interpolated[key] = this.interpolateVariables(value, variables);
    }

    return interpolated;
  }

  /**
   * Interpolate variables in request body.
   * Handles both string and object bodies.
   */
  private interpolateBody(body: unknown, variables: Record<string, string>): unknown {
    if (typeof body === "string") {
      return this.interpolateVariables(body, variables);
    }

    if (typeof body === "object" && body !== null) {
      return this.interpolateObjectDeep(body, variables);
    }

    return body;
  }

  /**
   * Deep interpolation for nested objects.
   */
  private interpolateObjectDeep(obj: unknown, variables: Record<string, string>): unknown {
    if (typeof obj === "string") {
      return this.interpolateVariables(obj, variables);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.interpolateObjectDeep(item, variables));
    }

    if (typeof obj === "object" && obj !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.interpolateObjectDeep(value, variables);
      }
      return result;
    }

    return obj;
  }
}

/**
 * MockWebhookDispatcher
 *
 * Mock implementation for testing that logs calls but doesn't make real HTTP requests.
 */
export class MockWebhookDispatcher implements WebhookDispatcher {
  private calls: Array<{
    config: WebhookCallConfig;
    context: { flow: Flow; node: FlowNode; session: ConversationSession };
    timestamp: string;
  }> = [];

  async callWebhook(
    config: WebhookCallConfig,
    context: { flow: Flow; node: FlowNode; session: ConversationSession }
  ): Promise<WebhookCallResult> {
    this.calls.push({
      config,
      context,
      timestamp: new Date().toISOString(),
    });

    console.log(`[MOCK] Webhook call: ${config.method || "POST"} ${config.url}`);

    return {
      ok: true,
      status: 200,
      response: { mock: true, message: "Mock webhook response" },
    };
  }

  getCalls() {
    return this.calls;
  }

  clearCalls() {
    this.calls = [];
  }
}
