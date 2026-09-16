# Woodpecker CI Plugin Implementation Plan

> **For agentic workers:** Implement task-by-task with TDD and verify every command before claiming completion.

**Goal:** Build `@jurislm/woodpecker-ci-plugin`, a public Bun stdio MCP server that mirrors the committed official Woodpecker OpenAPI dev snapshot.

**Architecture:** Generate operation types, Zod schemas, and tool metadata from the official OpenAPI document. Register one explicit MCP tool per operation and route every call through one native-fetch client.

**Tech Stack:** Bun >=1.1, TypeScript, `@modelcontextprotocol/sdk@1.30.0`, `zod@4.6.5`, `openapi-typescript@7.13.0`, `json-schema-to-zod@2.8.1`, `yaml@2.9.1`.

**Spec:** `docs/superpowers/specs/2026-09-16-woodpecker-ci-plugin-design.md`

## Global Constraints

- `WOODPECKER_URL` must be an HTTP(S) API base URL ending in `/api`; `WOODPECKER_API_TOKEN` is required; `DRONE_TOKEN` is ignored.
- Generated code must be reproducible from the committed OpenAPI snapshot without downloading during normal build or tests.
- Every OpenAPI method/path must produce one unique `woodpecker_*` MCP tool.
- Protocol output uses stdout only for MCP messages; diagnostics use stderr.
- Mutations are not retried; destructive tools are annotated but have no confirmation parameter.
- No UI, HTTP transport, OAuth, arbitrary request tool, database, or background job.

### Task 1: Initialize package and spec tooling

Create `.gitignore`, `LICENSE`, `README.md`, `package.json`, `tsconfig.json`, `.env.example`, `openapi/manifest.json`, and the OpenAPI fetch/generation scripts. Pin the official spec URL, checksum, and operation count. Add scripts for `api:fetch`, `api:generate`, `api:check`, `typecheck`, `test`, `build`, and `check`.

### Task 2: Add failing client/config/stream tests, then implement the client

Create tests for config validation, bearer authentication, `/api` normalization, path/query encoding, JSON/text/binary/204 decoding, sanitized non-2xx errors, no mutation retries, and bounded streaming. Implement `src/config.ts`, `src/client.ts`, `src/stream.ts`, and `src/errors.ts` only after the tests fail for the intended reasons.

### Task 3: Generate and register MCP tools

Generate `src/generated/woodpecker-api.ts`, `src/generated/woodpecker-zod.ts`, and `src/generated/operations.ts`. Add `src/server.ts` and `src/index.ts` using `StdioServerTransport` and `McpServer.registerTool`. Test that all generated operations are registered, names are unique, annotations are correct, and a tool call uses the expected HTTP request.

### Task 4: Add package documentation and CI/release workflows

Document local `bunx`/MCP configuration, API coverage, security rules, and live read-only smoke testing. Add `.woodpecker/ci.yml` and `.woodpecker/release.yml`; release only on a matching `v<package.version>` tag and publish with the `NPM_TOKEN` secret.

### Task 5: Verify, commit, and publish the repository state

Run `bun run check`, `bun run api:check`, `bun test`, `bun run build`, and `npm pack --dry-run`. Verify stdio startup and generated tool count. Create the requested public GitHub repository if absent, push `main`, and report GitHub/npm/live Woodpecker readbacks separately.
