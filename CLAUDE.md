# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

> **Full project guide: See [AGENTS.md](./AGENTS.md)** — architecture, page diagrams, flowcharts, proxy config, data sources, domain terminology, and key directories.

## Quick Reference

- **Project**: Video Warehouse (KinoTV) — React 18 + TypeScript + Vite 6 + Zustand
- **Architecture**: 4-layer (Pages → Zustand Stores → Services → External APIs)
- **Page diagrams & flowcharts**: `docs/page-diagrams/` — open `index.html` in browser
- **Flowchart**: `docs/page-diagrams/flowchart.html` — interactive SVG, click nodes to navigate
- **Data fetch script**: `scripts/fetch-diagram-data.mjs` — generates real API data for diagrams
- **Domain terms**: `CONTEXT.md`
- **Proxies**: Video Proxy `https://your-video-proxy.example.com/proxy?url=` (CORS), IPTV Proxy `https://your-iptv-proxy.example.com/m3u8-proxy?url=` (M3U8 stream)
- **Keep-Alive**: AppLayout keeps all visited pages mounted, switches visibility via CSS `display`
- **Dev server**: `npm run dev` → http://127.0.0.1:3001
- **Lint**: `npm run lint:all`
- **Test**: `npm run test` (Vitest) / `npx playwright test` (E2E)
- **文档同步**: 完成代码变更后，必须按 AGENTS.md "文档同步协议" 检查是否需要更新测试/记忆/知识库/原理图/流程图
