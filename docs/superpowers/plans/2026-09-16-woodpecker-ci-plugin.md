# Complete OpenAI Woodpecker Plugin Implementation Plan

> **For agentic workers:** Implement task-by-task with TDD and verify every command and external readback before claiming completion.

**Goal:** Convert the current Woodpecker MCP package into a complete portable OpenAI Agent Plugin and use the same outer contract for Coolify and Hetzner.

**Architecture:** Keep one service-specific MCP server core and expose it through stdio for local development and Streamable HTTP `/mcp` for the hosted Plugin. Package the server with root `plugin.json`, root `mcp.json`, optional skills/assets/hooks, and a Codex compatibility manifest.

**Tech Stack:** Bun >=1.1, TypeScript, `@modelcontextprotocol/sdk`, Zod, native fetch, OpenAPI code generation where an official spec exists, Agent Plugins `plugin.json` schema, and Agent Plugins `mcp.json` schema.

**Spec:** `docs/superpowers/specs/2026-09-16-woodpecker-ci-plugin-design.md`

## Global Constraints

- Root `plugin.json` and root `mcp.json` are required for a complete portable Plugin containing an MCP server.
- `.codex-plugin/plugin.json` is compatibility fallback only; root `extensions.com.openai` is canonical when present.
- `.mcp.json.example` is local stdio development configuration; never commit credentials.
- `.app.json.example` contains no live Developer Mode app ID; actual `.app.json` mappings are environment-specific.
- The same package contract must work for Woodpecker, Coolify, and Hetzner; service API clients remain separate.
- Local stdio and hosted Streamable HTTP must use the same MCP tool registry.
- A public Plugin requires a stable public HTTPS `/mcp` endpoint and a resolved per-user authentication flow.
- Keep the current Woodpecker OpenAPI snapshot/codegen and 118-tool contract.

### Task 1: Add the portable Plugin manifests

Create:

```text
plugin.json
mcp.json
.codex-plugin/plugin.json
.mcp.json.example
.app.json.example
skills/woodpecker-ci/SKILL.md
assets/.gitkeep
```

`plugin.json` must use the Agent Plugins schema, portable identity fields, and `extensions.com.openai.interface`. `mcp.json` must declare the named MCP server with `type: "streamable-http"` and the hosted `/mcp` URL. `.codex-plugin/plugin.json` must not override root identity. `.mcp.json.example` must use stdio and external env variables only.

### Task 2: Split transport from the MCP server core

Keep generated operations, tool registration, annotations, output envelope, and service client transport-independent. Add:

```text
src/transports/stdio.ts
src/transports/http.ts
```

The stdio entrypoint must preserve the current local smoke test. The HTTP entrypoint must expose `/mcp` through the MCP SDK Streamable HTTP transport, apply request authentication, and never expose the service token in client-visible output.

### Task 3: Resolve remote authentication before public hosting

Choose and document one per-user auth contract:

- OAuth 2.1 mapping to a user-scoped service credential; or
- an approved credential-vault/token-exchange design.

Reject a shared admin token for public usage. Add auth discovery, unauthorized responses, token redaction, and read/write authorization tests. Do not mark the remote Plugin public-ready until the hosted auth flow is read back end-to-end.

### Task 4: Preserve generated service tools

Keep the current Woodpecker OpenAPI snapshot, manifest, codegen pipeline, 118 generated tools, native-fetch client, stream bounds, and annotations. Apply the same generated-tool contract to Coolify and Hetzner without copying their API models.

### Task 5: Add complete Plugin validation

Add checks for:

- root `plugin.json` schema and `extensions.com.openai.interface`;
- root `mcp.json` schema and transport `type`;
- `.codex-plugin/plugin.json` compatibility behavior;
- `.mcp.json.example` stdio startup;
- skill discovery;
- `tools/list`, schemas, annotations, structured output, and error redaction;
- stdio MCP Inspector;
- hosted HTTPS `/mcp` MCP Inspector;
- ChatGPT Developer Mode connection;
- representative direct, indirect, follow-up, write, unauthorized, and unsupported prompts.

### Task 6: Align CI, package, hosting, and submission

Update `.woodpecker/ci.yml` and `.woodpecker/release.yml` to validate both transports and manifest/package contents. Add hosting deployment for stable HTTPS `/mcp`, domain/TLS/readiness checks, logs/metrics, rollback identity, privacy/support URLs, starter prompts, test cases, and public submission artifacts.

### Task 7: Acceptance/readback

Separate the evidence layers:

1. package manifest validation;
2. local stdio startup and 118-tool list;
3. generated API exact-head check;
4. hosted `/mcp` health and MCP initialization;
5. auth discovery and per-user account readback;
6. exact-head Woodpecker CI;
7. npm package version readback;
8. OpenAI Developer Mode discovery;
9. public Plugin submission/review status.

Do not claim complete official Plugin support from npm publication, local stdio, or green CI alone.
