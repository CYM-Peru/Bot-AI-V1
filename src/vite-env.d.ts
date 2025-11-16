/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_FLOW_API?: string;
  readonly VITE_FLOW_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
