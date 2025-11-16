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
 * Authenticated fetch wrapper that automatically includes the JWT token from localStorage
 * in the Authorization header.
 */
export const authFetch = async (path: string, options: RequestInit = {}): Promise<Response> => {
  const token = localStorage.getItem('token');

  const headers = new Headers(options.headers);

  // Add Authorization header if token exists
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Merge headers back into options
  const finalOptions: RequestInit = {
    ...options,
    headers,
  };

  return fetch(apiUrl(path), finalOptions);
};

export default apiUrl;
