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

The v1 contract is frozen in `contracts/woodpecker-mcp-v1.json`: tool names,
paths, annotations, environment names, structured output, and schema hashes
are checked by `bun run api:check` and the generated contract tests.

## OpenAI Plugin package

This repository also contains the portable Agent Plugin layer:

- `plugin.json` — portable plugin identity and OpenAI presentation metadata.
- `mcp.json` — stdio MCP server configuration.
- `.codex-plugin/plugin.json` — Codex compatibility fallback.
- `.mcp.json.example` — local configuration example without secrets.
- `skills/woodpecker-ci/SKILL.md` — service-specific tool-selection guidance.
- `.mcp.json` and `.app.json` — Codex compatibility companion files.

This version is private/local distribution. It does not provide a public
HTTPS `/mcp` endpoint or OAuth flow.

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

Validate the portable Plugin package with:

```bash
bun run manifest:check
```

For local Codex marketplace testing, add the repository marketplace at
`.agents/plugins/marketplace.json`, then install `woodpecker-ci` from the
`jurislm-woodpecker` marketplace.

## Release automation

Merges to `main` run the normal checks and update the Release Please Release
PR. After the `ci` and `release` pipelines succeed, Woodpecker validates and
merges that Release PR. The resulting `vX.Y.Z` tag starts the npm release
pipeline, which publishes the package with the `npm_token` repository secret.

Release Please determines the version from Conventional Commits. The release
workflow requires the `personal_access_tokens_fine_grained_tokens_jurislm`
repository secret; PR pipelines never receive either release secret.

## Security

Tokens are sent only as bearer authentication and are not included in logs or
tool request metadata. Mutation requests are not retried automatically.
