# Woodpecker CI / Hetzner Plugin Architecture Alignment

## Goal

Align Woodpecker's portable plugin, runtime seams, configuration behavior, integrity checks, package checks, and Codex acceptance with the stable Hetzner plugin where those patterns fit, while preserving Woodpecker's self-hosted API.

## Reference

Read-only reference: `/Users/terrychen/Documents/Github/jurislm/hetzner-plugin` at `34face3012213693519c350cbf62ee56c6654619`.

## Architecture

- `plugin.json` and `mcp.json` are the portable package entry points. `.codex-plugin/plugin.json` remains a compatibility fallback, and the root repository marketplace points to the plugin at `./`.
- `mcp.json` and `.mcp.json` expose the same `woodpecker-ci` local stdio server. They contain no credential values.
- `WOODPECKER_URL` and `WOODPECKER_API_TOKEN` stay host-provided. The server starts without either value, lists tools, and reports missing or invalid configuration on the first provider call.
- The generated OpenAPI catalog remains the complete safe low-level interface: 105 operations from the 118-operation snapshot. `/user/token`, `/debug/pprof/*`, `/version`, and credential fields are excluded from model-visible results. The configured instance serves HTML at `/version` despite the snapshot's JSON schema.
- `src/api.ts` is the injected request seam. Generated tools and focused `src/tools/` workflows share response parsing and error handling. The first retained workflow inspects a pipeline by repository full name.
- `src/client.ts` owns URL construction, bearer authentication, timeout, response decoding, and credential redaction. Generated response schemas are parsed before returning MCP results.
- `api/manifest.json` is the canonical snapshot provenance and integrity record. `bun run api:check` verifies SHA-256, path count, and operation count before comparing generated artifacts.
- The v1 tool contract remains as a compatibility snapshot. The current generated interface is recorded as contract v2; the next package release must reflect the breaking tool-surface change through Release Please.

## Verification and safety

- Automated tests cover config-free MCP startup, stdio initialization and `tools/list`, generated tool contract consistency, response-shape rejection, credential redaction, the retained pipeline workflow, manifest parity, package contents, and OpenAPI integrity.
- Live Codex acceptance verifies the registered tool catalog in a fresh task and makes a read-only Woodpecker call. Write operations are verified with local test transports unless a disposable Woodpecker environment is available.
- This remains a private/local stdio plugin. It does not add public HTTP hosting, OAuth, remote auth, or a UI.
