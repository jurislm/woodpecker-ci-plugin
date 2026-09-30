# JurisLM Plugin Architecture v1

## Package and host configuration

Each plugin keeps its own repository, package identity and release. Portable
`plugin.json` and `mcp.json` are the canonical package entry points. Native
Codex, Cursor and existing Claude manifests are host adapters. Validate every
format independently and compare server identity, transport and launch target;
host-only fields such as Codex `env_vars` may differ.

Portable MCP configuration must not contain `env_vars`, private service URLs,
token defaults or ordinary `${ENVIRONMENT_VARIABLE}` interpolation. Native
Codex stdio declarations forward their supported credential variable names.
Forwarding only reads values already available in the owning environment; it
does not load shell startup files or another MCP registration's settings.

Hetzner, Coolify and Woodpecker provide Bun/TypeScript stdio servers. Higgsfield
uses its official remote HTTP/OAuth server and separately authenticated CLI;
its package must not replace those with a local server. Preserve existing tool
names, inputs, output schemas, text representations and provider workflows.

## Local stdio implementation

Keep configuration, HTTP requests, error handling, registration and provider
tools at distinct seams. Generated and custom tools share the same HTTP client
and safe error handling, with adapters preserving their existing MCP outputs.
The internal HTTP envelope is `{ data, status, request: { method, path } }`.
Provider errors retain their existing codes and output format. Never log token
values, authorization headers or unsanitized provider error bodies.

Ordinary initialization and tool discovery work without credentials. Validate
required connection settings before sending a provider request. Keep health
authentication exceptions and provider-specific normalization. Coolify selects
URL/token pairs from one variable group; never fill a partial pair from another
group. Preserve Hetzner credential-return allowlists, SSH agent requirements,
pagination and partial-failure semantics, and binary/stream output behavior.

## Opt-in macOS launcher

Each local server ships `launchers/<provider>-desktop.zsh`. The host invokes it
with `/bin/zsh -f`. It explicitly sources `${ZDOTDIR:-$HOME}/.zshenv`, suppresses
startup stdout, preserves stderr, checks required credentials, and execs the
absolute `$HOME/.bun/bin/bunx` path. Source failures must stop startup. Startup
values may override inherited values, matching ordinary zsh source behavior.

Retain only HOME, PATH, TMPDIR, LANG and the provider's supported connection
variables. Hetzner also retains SSH_AUTH_SOCK. Fix PATH to
`$HOME/.bun/bin:/usr/bin:/bin`. Do not pass credentials in command arguments.
Woodpecker's URL is supplied by the user MCP `env` setting or existing shell
environment; the launcher does not parse global Codex configuration.

Installing this launcher is opt-in. Keep the portable bunx manifest unchanged,
disable only the selected plugin's bundled server, and use a user MCP
registration with startup_timeout_sec=30. Keep skills enabled. Preserve
unrelated plugin registrations and existing credential sources.

## Validation and release

Use Bun 1.3.14 for development and CI. Keep SDK 1.30.0 and Zod 4.6.5 pinned for
the three local servers. A complete `bun run check` validates manifests,
snapshot integrity/generated parity where applicable, lint, typechecking,
build, offline tests, release workflows and package contents. Generated
artifacts are regenerated from committed inputs, never edited by hand.

Use Hetzner's existing lint configuration and pinned dependencies as the local
server baseline. Tests exercise public tool contracts and process boundaries;
they do not require live credentials. Packages include their launcher and
exclude credentials. Release Please owns package and plugin versions.

Higgsfield has a private development package for package/skill validation and
Git releases, with no npm runtime publication. Record the source revision and
hashes of vendored skills without silently rewriting their upstream workflows.

## Acceptance evidence

Report source SHA, package/marketplace version, resolved MCP server version,
tool catalog and each authenticated read separately. Local launchers continue
using `@latest`; accept a delivered release only after `initialize.serverInfo`
matches the target release. Higgsfield's remote server and CLI versions are
independent of its plugin package version.

An offline check, direct stdio read, merge or publication does not prove a
fresh ordinary host chat has registered and successfully called the selected
plugin's tools. Record the actual server/plugin source, input, HTTP status and
returned counts without secrets. Retest missing settings and authentication
failures in that target environment. OAuth login and opening a fresh chat are
explicit acceptance dependencies; leave those layers pending until read back.
