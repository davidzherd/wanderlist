/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_XANO_API_BASE: string
  readonly VITE_XANO_AUTH_GROUP: string
  readonly VITE_XANO_LOCATIONS_GROUP: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
