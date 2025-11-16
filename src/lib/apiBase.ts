const viteEnv = (import.meta as ImportMeta & {
  env?: Record<string, string | undefined>;
}).env;

const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : '';

export const API_BASE = (viteEnv?.VITE_API_BASE_URL || fallbackOrigin).replace(/\/$/, '');

export const apiUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
};

/**
 * Helper function to make authenticated API requests
 * Automatically adds the Authorization header with the token from localStorage
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = apiUrl(path);

  // Get token from localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  // Merge headers
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Always include credentials for cookies
  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
  };

  return fetch(url, fetchOptions);
}

export default apiUrl;
