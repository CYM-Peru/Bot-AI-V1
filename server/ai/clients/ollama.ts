/**
 * Ollama Client
 * Handles API requests to local Ollama instances
 */

import type { AIClient, AIRequestConfig, AIResponse } from '../types';

export class OllamaClient implements AIClient {
  private baseURL: string;

  constructor(baseURL = 'http://localhost:11434') {
    this.baseURL = baseURL;
  }

  async complete(request: AIRequestConfig): Promise<AIResponse> {
    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: false,
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens ?? 1000,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${error}`);
    }

    const data = await response.json();

    return {
      content: data.message?.content ?? '',
      finishReason: data.done ? 'stop' : undefined,
      usage: {
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
    };
  }
}
