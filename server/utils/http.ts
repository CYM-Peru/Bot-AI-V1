export interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

export interface HttpResponse<T = unknown> {
  ok: boolean;
  status: number;
  body: T | null;
}

export async function httpRequest<T = unknown>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
  const controller = new AbortController();
  const timeout = options.timeoutMs ?? 15000;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    let body: T | null = null;
    try {
      if (response.status !== 204) {
        body = (await response.json()) as T;
      }
    } catch (error) {
      body = null;
    }

    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}
