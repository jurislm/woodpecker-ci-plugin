# @jurislm/woodpecker-ci-plugin

One Woodpecker CI guidance skill backed by a local stdio MCP server. The skill
guides safe tool selection; the server exposes the Woodpecker API.

Official website: https://jurislm.github.io/woodpecker-ci-plugin/

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
inspection tool. It excludes `/user/token`, `/version`, and `/debug/pprof` plus
its subpaths. The OpenAPI snapshot describes `/version` as JSON, but this
configured instance serves its HTML app shell at `/api/version`.
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
- `.cursor-plugin/` — Cursor marketplace, plugin metadata, and MCP variables.
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
server process environment. A desktop app launched by macOS does not read your
interactive shell configuration. Check the MCP child process, not the terminal,
when diagnosing missing credentials.

The portable `mcp.json` has no environment defaults. Native `.mcp.json`
forwards `WOODPECKER_URL` and `WOODPECKER_API_TOKEN` using `env_vars`; this only
forwards values already available to the host and does not source `.zshenv`.
Do not put `${WOODPECKER_URL}` or `${WOODPECKER_API_TOKEN}` in portable `env`:
Codex's portable parser only expands `${PLUGIN_ROOT}` and `${PLUGIN_DATA}`.

For macOS desktop sessions whose token is exported by `.zshenv`, opt into the
shipped launcher. It explicitly sources that file, keeps startup stdout out of
MCP, preserves stderr, and forwards only the Woodpecker connection variables
plus HOME/PATH/TMPDIR/LANG. Startup failures and missing connection settings
stop before the provider starts. No token is copied into Codex configuration.

```bash
mkdir -p "$HOME/.codex/bin"
cp launchers/woodpecker-desktop.zsh "$HOME/.codex/bin/woodpecker-mcp.zsh"
```

Configure the absolute launcher path in `~/.codex/config.toml`, preserve your
existing non-sensitive URL, and disable only the selected bundled server:

```toml
[mcp_servers.woodpecker-ci]
command = "/bin/zsh"
args = ["-f", "/absolute/path/to/.codex/bin/woodpecker-mcp.zsh"]
required = true
startup_timeout_sec = 30

[mcp_servers.woodpecker-ci.env]
WOODPECKER_URL = "https://ci.example.com/api"

[plugins."woodpecker-ci@woodpecker-ci-marketplace".mcp_servers.woodpecker-ci]
enabled = false
```

The launcher requires Bun at `$HOME/.bun/bin/bunx` and continues to use
`@latest`. Read `initialize.serverInfo.version` and match the intended release;
a marketplace cache version is not the resolved running package version.
`codex mcp get` reads a user registration; it does not prove a plugin-provided
instance received that environment.

`required = true` waits for this MCP server during tool discovery. Check
`codex mcp get woodpecker-ci`, then open a new Codex task and confirm that its
Woodpecker tools are present and an authenticated read succeeds. A successful
local stdio check alone does not verify the task's tool catalog. Keep token
values out of repository files and diagnostic output.

See the [JurisLM Plugin Architecture v1](docs/plugin-architecture.md) for shared
packaging, configuration, release and acceptance rules.

## Cursor installation

In Cursor, open Customize → Add Marketplace → Import from GitHub and enter
`https://github.com/jurislm/woodpecker-ci-plugin`. Add Woodpecker CI Plugin,
then use Configure to set `WOODPECKER_URL` and `WOODPECKER_API_TOKEN`. Cursor
stores the values outside this repository.

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
