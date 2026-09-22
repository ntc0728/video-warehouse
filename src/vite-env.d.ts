/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Capacitor 原生构建标记（build:android 通过 cross-env CAPACITOR=true 注入） */
  readonly CAPACITOR?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
