const viteEnv = (import.meta as ImportMeta & {
  env?: Record<string, string | undefined>;
}).env;

const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : '';

export const API_BASE = (viteEnv?.VITE_API_BASE_URL || fallbackOrigin).replace(/\/$/, '');

export const apiUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
};

export default apiUrl;
