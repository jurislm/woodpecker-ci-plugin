# Woodpecker CI Complete OpenAI Plugin Implementation Plan

Historical packaging plan. Current architecture alignment and runtime acceptance are tracked in `docs/superpowers/plans/2026-09-25-woodpecker-hetzner-architecture-alignment.md`.

> **For agentic workers:** Implement task-by-task with TDD and verify every command and external readback before claiming completion.

**Goal:** Package the existing Woodpecker stdio MCP server as a complete portable OpenAI Agent Plugin for private/local distribution.

**Scope:** Woodpecker CI only. Coolify and Hetzner are handled in another task and must not be changed or included in this implementation.

**Architecture:** Keep the current transport-independent MCP tool registry and native-fetch client. Add portable Plugin manifests, a Codex compatibility fallback, one service skill, official schema validation, and an official stdio `mcp.json` entry.

**Spec:** `docs/superpowers/specs/2026-09-16-woodpecker-ci-plugin-design.md`

## Global Constraints

- Root `plugin.json` and root `mcp.json` are the canonical portable Plugin files.
- `.codex-plugin/plugin.json` is only a Codex compatibility fallback.
- `.mcp.json.example` and `.app.json.example` contain no credentials or live app IDs.
- `mcp.json` uses `type: "stdio"`; no HTTP transport, OAuth, hosting, or public submission in this scope.
- Existing 118-tool OpenAPI snapshot, generated registry, client contract, and safety annotations remain intact.
- Only `/Users/terrychen/Documents/Github/jurislm/woodpecker-ci-plugin` may change.

### Task 1: Add portable Plugin manifests and service skill

Create root `plugin.json`, root `mcp.json`, `.codex-plugin/plugin.json`, `.mcp.json.example`, `.app.json.example`, `skills/woodpecker-ci/SKILL.md`, and `assets/.gitkeep`. Root manifests use the official Agent Plugins 1.0 schemas. The root MCP entry runs the published Bun package through `bunx`; local env values remain host-provided.

### Task 2: Add official schema snapshots and validation

Fetch and commit the Agent Plugins `plugin.schema.json` and `mcp.schema.json` snapshots. Add an Ajv 2020 validator and tests for root identity, OpenAI interface metadata, stdio MCP transport, Codex fallback identity, credential-free examples, and skill frontmatter. Add `manifest:fetch`, `manifest:check`, and include manifest validation in `bun run check`.

### Task 3: Refactor the existing stdio entrypoint

Move stdio startup into `src/transports/stdio.ts` while preserving `src/index.ts` behavior and the existing 118-tool list. Do not add HTTP, OAuth, UI, hooks, or service code for other products.

### Task 4: Validate package distribution

Include portable Plugin files, skill, assets, and dist output in npm packaging. Validate `npm pack --dry-run`, `bunx` stdio startup, manifest discovery, and local marketplace/package installation instructions. Update README with the private/local Plugin boundary.

### Task 5: Final acceptance/readback

Run `bun run manifest:check`, `bun run api:check`, `bun run typecheck`, `bun test`, `bun run build`, `npm pack --dry-run`, and stdio `tools/list` readback showing 118 tools. Verify GitHub main, npm version, and local Plugin package separately. Do not claim public HTTPS Plugin submission or remote auth.
