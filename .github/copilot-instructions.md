# GitHub Copilot Instructions

> Full project guide: See [AGENTS.md](../AGENTS.md) in the repository root.

## Project: Video Warehouse (KinoTV)

React 18 + TypeScript + Vite 6 + Zustand 影视聚合平台。

## Architecture

4-layer: Pages (React) → Zustand Stores → Services → External APIs
- TMDB API: direct (CORS supported)
- CMS API: via Video Proxy `https://your-video-proxy.example.com/proxy?url=`
- IPTV M3U: via Video Proxy for fetch, IPTV Proxy `https://your-iptv-proxy.example.com/m3u8-proxy?url=` for streaming

## Documentation

- `docs/page-diagrams/` — 10 page diagrams + interactive flowchart with real API data
- `docs/page-diagrams/flowchart.html` — page navigation map + data flow + playback flow
- `CONTEXT.md` — domain terminology (vod_id, vod_play_url, Adapter, etc.)
- `scripts/fetch-diagram-data.mjs` — data fetch script for diagrams

## Key patterns

- Keep-Alive routing: AppLayout keeps all visited pages mounted, CSS display toggles visibility
- CMS vod_play_url parsing: `$$$` splits lines, `#` splits episodes, `$` splits title/url
- Adapter pattern: `.m3u8` → HLSAdapter, `.mpd` → DashAdapter, other → NativeAdapter
- Sensitive settings (TMDB token, API keys) stored with AES-GCM encryption in localStorage

## Doc sync protocol

After code changes, check AGENTS.md "文档同步协议" section for required updates to:
tests (same commit) / memory (after session) / knowledge base (if architecture changed) / page diagrams (if layout changed) / flowchart (if navigation changed)
