# Woodpecker CI Complete OpenAI Agent Plugin Design

Historical packaging baseline. The current runtime and validation design is documented in `docs/superpowers/specs/2026-09-25-woodpecker-hetzner-architecture-alignment.md`.

## Goal

Package the existing Woodpecker MCP server as a complete portable OpenAI Agent Plugin for private/local distribution. This scope is only Woodpecker CI; Coolify and Hetzner are handled elsewhere.

OpenAI portable plugins use a root plugin.json and root mcp.json. A Codex compatibility manifest can live at .codex-plugin/plugin.json. The MCP server is the service capability layer; the manifests are the install/discovery layer.

## Package tree

```text
woodpecker-ci-plugin/
├── plugin.json
├── mcp.json
├── .codex-plugin/plugin.json
├── .mcp.json.example
├── .app.json.example
├── skills/woodpecker-ci/SKILL.md
├── assets/
├── package.json
├── src/
│   ├── config.ts
│   ├── client.ts
│   ├── server.ts
│   ├── transports/stdio.ts
│   └── generated/
├── openapi/
├── scripts/
├── .woodpecker/
├── README.md
└── LICENSE
```

## Manifest contract

- plugin.json uses Agent Plugins 1.0 schema and contains portable identity plus extensions.com.openai.interface.
- mcp.json uses Agent Plugins MCP 1.0 schema and declares one woodpecker-ci server with type stdio, command bunx, and the published package.
- .codex-plugin/plugin.json is a compatibility fallback with matching identity; it does not replace root plugin.json.
- .mcp.json.example is local developer configuration and never contains credentials.
- .app.json.example is an empty Developer Mode mapping example; no ephemeral app ID is committed.
- one minimal skills/woodpecker-ci/SKILL.md provides tool-selection and safety guidance.

## Runtime contract

- Bun >=1.1, @modelcontextprotocol/sdk, Zod, native fetch.
- StdioServerTransport is the only transport in this scope.
- One generated registerTool entry per current Woodpecker OpenAPI operation.
- GET/HEAD tools are read-only/idempotent; destructive operations carry destructiveHint.
- Success: { data, status, request } in structuredContent plus model-readable text.
- Errors exclude bearer tokens, request bodies, and secret values.
- WOODPECKER_URL and WOODPECKER_API_TOKEN are host-provided; DRONE_TOKEN is ignored.

## Explicit exclusions

- No Streamable HTTP /mcp.
- No public hosting, OAuth, credential broker, universal Plugin Directory submission, or remote per-user auth.
- No Coolify or Hetzner changes.
- No UI, hooks, database, background job, or arbitrary HTTP request tool.

## Acceptance

- Official plugin.json and mcp.json schemas validate.
- Codex fallback and local examples validate without credentials.
- Plugin skill is discoverable.
- stdio startup lists all 118 generated tools.
- Existing OpenAPI generation, client, annotations, errors, and tests remain green.
- npm package contains runtime plus portable Plugin files.
- GitHub public repo, local marketplace/package install, and npm readback are reported separately.
