# Woodpecker CI Plugin

Portable local-stdio MCP plugin for Woodpecker CI. It keeps the full safe generated operation catalog and adds focused pipeline inspection tools.

## Commands

```sh
bun install --frozen-lockfile
bun run api:check
bun run typecheck
bun run build
bun test
bun run package:check
bun run check
```

Use `bun run api:fetch` only when intentionally updating the committed official OpenAPI snapshot and `api/manifest.json`.

## Runtime architecture

- `src/client.ts` owns Woodpecker HTTP, SSE, binary responses, and credential redaction.
- `src/api.ts` is the injected request seam for generated and retained MCP tools; it validates responses with the generated schema and centralizes tool errors.
- `src/server.ts` registers generated OpenAPI operations and domain tool registrars.
- `src/tools/` contains focused workflows that compose generated operations; each registrar receives the injected `ApiRequest`.
- `src/transports/stdio.ts` is the only transport. The server must initialize and list tools before provider credentials are available.
- `openapi/woodpecker-dev.yaml` is the committed source snapshot; `api/manifest.json` is its provenance and integrity record.

## Configuration

`WOODPECKER_URL` and `WOODPECKER_API_TOKEN` are optional during MCP initialization and required on the first provider call. The URL must be HTTP(S) and end in `/api`. Do not put credential values in tracked manifests or logs.

## Plugin packaging

- `plugin.json`, `mcp.json`, and `.agents/plugins/marketplace.json` are the portable plugin and Codex discovery files.
- `.codex-plugin/plugin.json` is the Codex compatibility fallback; it references the root `.mcp.json` and `skills/`.
- Keep `mcp.json` and `.mcp.json` server entries identical.
- Release Please owns package and manifest versions. Do not edit versions by hand.

## Runtime verification

Verify the stdio tool catalog separately from a fresh Codex task's `ALL_TOOLS`. Run live tests read-only by default; use an isolated disposable Woodpecker resource set before exercising write tools.
