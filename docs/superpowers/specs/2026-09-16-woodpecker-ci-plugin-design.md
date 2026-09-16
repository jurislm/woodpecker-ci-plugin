# Woodpecker CI MCP Plugin Design

## Goal

Expose the current Woodpecker CI API as a local, Bun-based stdio MCP server for agents. The package is public on GitHub and npm, but is not a remote ChatGPT plugin in this iteration.

## Architecture

- Runtime: Bun >=1.1, `@modelcontextprotocol/sdk`, `registerTool`, Zod, stdio transport.
- Authentication: `WOODPECKER_URL` is the Woodpecker API base URL including `/api`; `WOODPECKER_API_TOKEN` is the only accepted token variable.
- API contract: a committed snapshot of the official OpenAPI 3 dev document. Code generation produces request/response TypeScript types, Zod schemas, and an operation registry.
- One MCP tool is registered per OpenAPI operation. No arbitrary URL or arbitrary HTTP request tool exists.
- A shared native-fetch client handles URL construction, bearer authentication, timeout, response decoding, and sanitized errors.
- Successful tools return `{ data, status, request }` in `structuredContent`; protocol logs use stderr only.

## Safety

- GET/HEAD operations are read-only and idempotent.
- Delete, token reset, secret/registry/agent/repository deletion, and equivalent operations are marked destructive.
- Mutation calls are never retried automatically.
- Tokens and request bodies are excluded from request metadata and error logs.
- Streaming operations collect for a bounded duration: default 5 seconds, maximum 30 seconds.

## Acceptance

- The generated registry represents the committed spec exactly and has unique tool names.
- The server starts over stdio and exposes every generated tool.
- Unit tests cover configuration, request construction, response decoding, errors, streams, and MCP registration.
- Woodpecker CI validates generation, typecheck, tests, build, and package contents.
- A tag workflow publishes the matching package version using the Woodpecker `NPM_TOKEN` secret.
