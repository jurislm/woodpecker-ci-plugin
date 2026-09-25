# Woodpecker CI / Hetzner Plugin Architecture Alignment Implementation Plan

> **For agentic workers:** Implement and verify each task in the isolated Woodpecker worktree. Preserve the v1 contract and do not run live write operations against production.

**Goal:** Align Woodpecker's plugin packaging, runtime seams, validation, and Codex acceptance with the stable Hetzner plugin where the patterns apply.

**Architecture:** Keep the self-hosted Woodpecker URL/token configuration and the complete filtered OpenAPI operation catalog. Defer provider configuration errors until the first API request, add an injected request seam plus a focused pipeline inspection registrar, and validate package and OpenAPI integrity as part of `bun run check`.

**Tech Stack:** Bun, TypeScript, `@modelcontextprotocol/sdk`, Zod, YAML, OpenAPI snapshots.

**Spec:** `docs/superpowers/specs/2026-09-25-woodpecker-hetzner-architecture-alignment.md`

## Global Constraints

- Work only in the existing isolated Woodpecker worktree and preserve its hardening changes.
- Keep stdio as the only transport; do not add public hosting or OAuth.
- Keep `WOODPECKER_URL` and `WOODPECKER_API_TOKEN` out of tracked manifests and logs.
- Do not issue writes to the production Woodpecker instance.
- Keep Hetzner reference files read-only.

## Review Focus

- Missing Woodpecker credentials must not prevent MCP initialization or `tools/list`.
- Malformed URLs, dot-only path segments, fetch errors, and schema failures must return actionable errors without leaking credentials.
- Tool catalog and v2 generated contract must remain synchronized after regeneration.
- The repository marketplace must point to the root plugin and package contents must exclude credentials and development-only files.
- Codex tool registration is task-snapshot state; test in a fresh runtime and report it separately from local stdio checks.

---

### Task 1: Defer provider configuration and centralize API handling

**Files:** `src/config.ts`, `src/client.ts`, `src/errors.ts`, `src/api.ts`, `src/server.ts`, `src/config.test.ts`, `src/client.test.ts`, `src/server.test.ts`

- [x] Allow MCP startup without provider environment variables.
- [x] Validate URL and token on the first provider request.
- [x] Add a shared `ApiRequest` seam and response-schema validation.
- [x] Redact credential-shaped values from responses and error messages.
- [x] Reject URL-embedded credentials and dot-only path segments.

### Task 2: Add a focused pipeline workflow

**Files:** `src/tools/pipelines.ts`, `src/tools/pipelines.test.ts`, `src/server.ts`, `src/server.test.ts`

- [x] Add a read-only pipeline inspection tool that resolves a repository, fetches the pipeline, and fetches commit metadata.
- [x] Inject the shared `ApiRequest` rather than constructing a client inside the tool.
- [x] Cover the calls and output with a fixture-backed test.

### Task 3: Align plugin discovery, snapshot integrity, and package validation

**Files:** `.agents/plugins/marketplace.json`, `.codex-plugin/plugin.json`, `.mcp.json`, `.mcp.json.example`, `mcp.json`, `api/manifest.json`, `scripts/check-openapi.ts`, `scripts/openapi-integrity.ts`, `scripts/package-contents.ts`, `scripts/package-contents-check.ts`, `scripts/validate-plugin-manifests.ts`, `package.json`, `README.md`, `CLAUDE.md`

- [x] Register the repository-root plugin in a local Codex marketplace and keep the root and compatibility MCP server mappings identical.
- [x] Remove the empty app mapping while retaining the credential-free Developer Mode example.
- [x] Move canonical OpenAPI provenance to `api/manifest.json` and verify snapshot hash and counts.
- [x] Add exact package-content validation and include the API snapshots in the published package.
- [x] Document the runtime/configuration and Codex marketplace workflow.

### Task 4: Local and Codex runtime acceptance

**Files:** `src/stdio-protocol.test.ts`, `scripts/smoke-stdio.ts`, `package.json`

- [x] Build before the stdio protocol test and verify that `tools/list` works without provider configuration.
- [x] Keep mutation coverage on local transports unless a disposable provider environment is identified.
- [ ] Install the local plugin in Codex, reopen a task, verify the complete tool catalog, and make one live read-only call.
- [ ] Record the active-task `ALL_TOOLS` result separately from local `tools/list`.
