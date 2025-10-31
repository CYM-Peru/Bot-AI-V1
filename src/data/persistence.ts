export interface PersistenceStrategy<T> {
  save: (workspaceId: string, state: T) => Promise<void> | void;
  load: (workspaceId: string) => Promise<T | null> | (T | null);
}

const STORAGE_PREFIX = "flow-builder";

function storageKey(workspaceId: string): string {
  return `${STORAGE_PREFIX}/${workspaceId}`;
}

export function createLocalStorageStrategy<T>(storage?: Storage): PersistenceStrategy<T> {
  const resolvedStorage = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  return {
    async save(workspaceId: string, state: T) {
      if (!resolvedStorage) throw new Error("localStorage is not available");
      resolvedStorage.setItem(storageKey(workspaceId), JSON.stringify(state));
    },
    async load(workspaceId: string) {
      if (!resolvedStorage) throw new Error("localStorage is not available");
      const raw = resolvedStorage.getItem(storageKey(workspaceId));
      if (!raw) return null;
      try {
        return JSON.parse(raw) as T;
      } catch (error) {
        console.error("Failed to parse stored flow", error);
        return null;
      }
    },
  };
}

export interface ApiStrategyOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export function createApiStrategy<T>({ baseUrl, fetchImpl }: ApiStrategyOptions): PersistenceStrategy<T> {
  const fetcher = fetchImpl ?? (typeof fetch !== "undefined" ? fetch : undefined);
  if (!fetcher) {
    throw new Error("Fetch API is not available");
  }
  const normalizeUrl = (workspaceId: string) => {
    const trimmed = baseUrl.replace(/\/+$/, "");
    return `${trimmed}/flows/${encodeURIComponent(workspaceId)}`;
  };
  return {
    async save(workspaceId, state) {
      const response = await fetcher(normalizeUrl(workspaceId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!response.ok) {
        throw new Error(`Failed to persist flow: ${response.status}`);
      }
    },
    async load(workspaceId) {
      const response = await fetcher(normalizeUrl(workspaceId));
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(`Failed to load flow: ${response.status}`);
      }
      return (await response.json()) as T;
    },
  };
}

// Hardcoded to always use API strategy
const useApi = true;
const apiBase = "/api";

let activeStrategy: PersistenceStrategy<any> = useApi && apiBase
  ? createApiStrategy({ baseUrl: apiBase })
  : createLocalStorageStrategy();

export function setPersistenceStrategy(strategy: PersistenceStrategy<any>) {
  activeStrategy = strategy;
}

export async function saveFlow<T>(workspaceId: string, state: T): Promise<void> {
  try {
    await activeStrategy.save(workspaceId, state);
  } catch (error) {
    console.error("Error saving flow", error);
    const message = error instanceof Error ? error.message : String(error);
    const enhanced = new Error(`Error saving flow: ${message}`);
    (enhanced as any).cause = error;
    throw enhanced;
  }
}

export async function loadFlow<T>(workspaceId: string): Promise<T | null> {
  try {
    return await activeStrategy.load(workspaceId);
  } catch (error) {
    console.error("Error loading flow", error);
    const message = error instanceof Error ? error.message : String(error);
    const enhanced = new Error(`Error loading flow: ${message}`);
    (enhanced as any).cause = error;
    throw enhanced;
  }
}
