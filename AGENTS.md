# Repository Instructions

## Project Scope

- This repository contains one Woodpecker CI guidance skill at
  `skills/woodpecker-ci/SKILL.md` and a local stdio MCP server. It does not
  provide a hosted `/mcp` endpoint or OAuth flow.
- For live Woodpecker resources or CI status, follow the canonical skill. Prefer
  the Woodpecker API for CI state and resolve names and IDs with read calls
  before mutations.

## Source of Truth

- `openapi/woodpecker-dev.yaml` is the committed API snapshot; `api/manifest.json` records its source and integrity data.
- `src/generated/` and `contracts/woodpecker-mcp-v2.json` are generated from
  that snapshot. Do not edit them by hand. Use `bun run api:fetch` only to
  intentionally refresh the upstream snapshot, then run
  `bun run api:generate`. `bun run api:check` verifies snapshot integrity and
  that generated artifacts match the staged files.
- Keep the Woodpecker server entries in `mcp.json` and `.mcp.json` aligned.
  Release Please owns package and plugin manifest versions.

## Credentials and Validation

- Pass `WOODPECKER_URL` and `WOODPECKER_API_TOKEN` through the MCP server
  environment. Never commit credential values or expose them in command
  arguments, logs, tool output, or narration. `DRONE_TOKEN` is not read.
- Run `bun run check` for code, manifest, or package changes. Use
  `bun run api:check` for API snapshot or generated-artifact changes and
  `bun run manifest:check` for plugin-manifest changes.

## Tool and Writing Preferences

- When relevant, prefer tools in this order: built-in browser, Exa, local Docker Firecrawl, Context7, Notion, Woodpecker API, GitHub, Coolify, Hetzner.
- Use direct, concise prose. Do not add comments in code.
