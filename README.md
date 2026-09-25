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
    "woodpecker-ci": {
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

The server exposes generated OpenAPI operations plus a focused pipeline
inspection tool. Personal-token lifecycle and pprof operations are excluded.
The `/version` operation is also excluded because the configured Woodpecker
instance returns its HTML app shell for that path instead of JSON.
It is a local stdio package, not a hosted ChatGPT plugin endpoint.

Generated tool names, titles, descriptions, input schemas, output schemas, and
annotations live under `src/generated/`. Token request fields are omitted;
token and password fields, plus secret values, are omitted from responses.

The current v2 generated-operation contract is in
`contracts/woodpecker-mcp-v2.json`; the v1 contract remains as the previous
compatibility snapshot. `api/manifest.json` is the canonical snapshot
provenance. `bun run api:check` verifies its SHA-256, path and operation counts,
then checks generated artifacts.

## OpenAI Plugin package

This repository also contains the portable Agent Plugin layer:

- `plugin.json` — portable plugin identity and OpenAI presentation metadata.
- `mcp.json` — stdio MCP server configuration.
- `.codex-plugin/plugin.json` — Codex compatibility fallback.
- `.agents/plugins/marketplace.json` — repository-root Codex marketplace entry.
- `.mcp.json.example` — local configuration example without secrets.
- `skills/woodpecker-ci/SKILL.md` — service-specific tool-selection guidance.
- `.mcp.json` — Codex MCP registration, matching the portable `mcp.json`.
- `.app.json.example` — empty Developer Mode mapping example.

This version is private/local distribution. It does not provide a public
HTTPS `/mcp` endpoint or OAuth flow.

## Codex App installation

From the repository root:

```bash
codex plugin marketplace add .
codex plugin add woodpecker-ci@woodpecker-ci-marketplace
```

The server can initialize and list its tools before credentials are set.
Provider calls require `WOODPECKER_URL` and `WOODPECKER_API_TOKEN` in the MCP
server process environment. A GUI-launched Codex app may not inherit shell
profile variables, so do not rely on `~/.zshenv` alone. Keep token values out
of repository files. Open a new task after installing or updating the plugin
so Codex loads its current tool catalog.

## Development

```bash
bun install
bun run api:fetch
bun run api:check
bun run check
```

`api:fetch` updates the committed snapshot and canonical provenance at
`api/manifest.json`. `api:check` verifies its hash and operation counts before
checking generated artifacts.

For a live read-only configuration check:

```bash
WOODPECKER_URL=https://ci.example.com/api \
WOODPECKER_API_TOKEN=... \
bun run smoke:read
```

Validate the portable Plugin manifests and npm package contents with:

```bash
bun run manifest:check
bun run package:check
```

## Release automation

Merges to `main` run the normal checks and update the Release Please Release
PR. After the `ci` and `release` pipelines succeed, Woodpecker validates and
merges that Release PR. The resulting `vX.Y.Z` tag starts the npm release
pipeline, which publishes the package with the `npm_token` repository secret.

Release Please determines the version from Conventional Commits. The release
workflow requires the `personal_access_tokens_fine_grained_tokens_jurislm`
repository secret; PR pipelines never receive either release secret.

## Security

The configured API token is sent only as bearer authentication and is not
included in logs or tool request metadata. Credential fields are removed from
response schemas and tool results. Mutation requests are not retried
automatically.
