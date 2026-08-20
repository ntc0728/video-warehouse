/// <reference types="vite/client" />

/** 8.3C：Suspense chunk fallback 发生时刻（时间戳，0 = 无/已消费）。
 *  首页据此判断「刚经历过 chunk fallback」以跳过固定 500ms 整页 loading。 */
interface Window {
  __kinoSuspenseFallback?: number;
}

interface ImportMetaEnv {
  /** Capacitor 原生构建标记（build:android 通过 cross-env CAPACITOR=true 注入） */
  readonly CAPACITOR?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
