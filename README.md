# @jurislm/woodpecker-ci-plugin

Local stdio MCP server for Woodpecker CI.

## Requirements

- Bun >= 1.1
- Woodpecker API base URL, including `/api`
- Woodpecker personal access token

## Configuration

```bash
export WOODPECKER_URL=https://ci.example.com/api
export WOODPECKER_API_TOKEN=...
```

The server does not read `DRONE_TOKEN`.

## Local MCP configuration

```json
{
  "mcpServers": {
    "woodpecker": {
      "command": "bunx",
      "args": ["-y", "@jurislm/woodpecker-ci-plugin@latest"],
      "env": {
        "WOODPECKER_URL": "https://ci.example.com/api",
        "WOODPECKER_API_TOKEN": "..."
      }
    }
  }
}
```

The server exposes one MCP tool for each operation in the committed official
Woodpecker OpenAPI snapshot. It is a local stdio package, not a hosted
ChatGPT plugin endpoint.

The current snapshot contains 118 operations. Generated tool names, input
schemas, output schemas, and annotations live under `src/generated/`.

## Development

```bash
bun install
bun run api:fetch
bun run api:generate
bun run check
```

`api:fetch` is the only command that updates the committed API snapshot.

For a live read-only configuration check:

```bash
WOODPECKER_URL=https://ci.example.com/api \
WOODPECKER_API_TOKEN=... \
bun run smoke:read
```

## Security

Tokens are sent only as bearer authentication and are not included in logs or
tool request metadata. Mutation requests are not retried automatically.
