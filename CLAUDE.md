# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

> **Full project guide: See [AGENTS.md](./AGENTS.md)** — architecture, page diagrams, flowcharts, proxy config, data sources, domain terminology, and key directories.
> **AGENTS.md 已瘦身为索引**（2026-09-09）：架构/页面/模式/测试等详情按需读 `docs/agents/`；测试用例见 `docs/test-cases/`、知识库见 `docs/knowledge/`。

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
- **文档同步**: 改完先写 `changelogs/_pending/` 片段；push 前按 `docs/agents/docs-protocol.md` 的「文档同步协议」提炼归位到 测试/知识库/原理图/流程图/本地记忆
