# Woodpecker CI OpenAI Agent Plugin Design

## Goal

Build a complete portable OpenAI Agent Plugin for Woodpecker CI, with the same outer package contract used by the future Coolify and Hetzner plugins. Each service keeps its own API client, schemas, and tools.

OpenAI defines a plugin as a package that can contain skills, an MCP server, or both. The portable package uses root `plugin.json` and root `mcp.json`; `.codex-plugin/plugin.json` is an optional Codex compatibility fallback.

## Canonical package layers

1. Portable plugin package: root `plugin.json`, root `mcp.json`, optional `skills/`, assets, and hooks.
2. OpenAI presentation: `plugin.json.extensions.com.openai.interface`; registered MCP mappings use `.app.json` only when a Developer Mode app ID exists.
3. Runtime package: `package.json`, Bun entrypoints, shared MCP server core, and service API client.
4. Local development: `.mcp.json.example` for stdio; actual credentials stay outside the repository.
5. Remote plugin: Streamable HTTP `/mcp` at a stable public HTTPS origin.

## Unified outer tree

```text
<service>-plugin/
├── plugin.json
├── mcp.json
├── .codex-plugin/plugin.json
├── .mcp.json.example
├── .app.json.example
├── skills/<service>/SKILL.md
├── assets/
├── package.json
├── src/
│   ├── config.ts
│   ├── client.ts
│   ├── server.ts
│   ├── transports/stdio.ts
│   ├── transports/http.ts
│   ├── tools/
│   └── generated/
├── api/
├── scripts/
├── .woodpecker/
├── README.md
└── LICENSE
```

The tree is shared across Woodpecker, Coolify, and Hetzner. `api/`, `src/client.ts`, generated schemas, tool names, and environment variables remain service-specific.

## MCP contract

- One tool per supported user goal or generated API operation.
- `registerTool`, explicit input/output schemas, and accurate readOnly, destructive, idempotent, and open-world annotations.
- Success envelope: `{ data, status, request }` in `structuredContent` plus model-readable text.
- Errors never include tokens, authorization headers, or secret values.
- stdio and Streamable HTTP reuse the same server core and tool registry.
- UI is optional; all three plugins must remain useful headlessly.

## Authentication

- Local stdio uses service-specific environment variables and never commits credentials.
- Remote `/mcp` must use a per-user authentication design; a shared service admin token is not acceptable for a public plugin.
- OAuth 2.1, credential vault, token exchange, and provider-specific identity mapping are deployment decisions that must be resolved before public submission.

## Acceptance

- Portable `plugin.json` and `mcp.json` validate against the official schemas.
- `.codex-plugin/plugin.json` is a compatibility fallback and does not conflict with root `extensions.com.openai`.
- Local stdio starts and lists all tools.
- Remote public HTTPS `/mcp` initializes and passes MCP Inspector.
- Developer Mode discovers the tools and auth flow.
- Package installation, skills discovery, CI, release, and plugin submission readbacks are separate evidence layers.
