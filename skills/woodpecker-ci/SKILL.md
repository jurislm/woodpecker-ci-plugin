---
name: woodpecker-ci
description: Use when the user asks to inspect, diagnose, trigger, approve, cancel, restart, or manage Woodpecker CI resources.
---

# Woodpecker CI

Use the Woodpecker MCP tools for live CI state and actions.

- Resolve the repository and exact numeric IDs before pipeline mutations.
- Use read-only tools before write tools.
- Treat pipeline cancellation, deletion, token reset, secret changes, and repository changes as consequential.
- Never expose WOODPECKER_API_TOKEN or credential fields from tool results in narration.
- Pass tokens to local MCP processes through environment variables; never expand a token into command arguments.
- Report source, pipeline number, commit SHA, status, and API error status separately.

## Availability check

When asked whether the installed plugin works, record three separate results:

1. `codex mcp get woodpecker-ci` confirms the effective server command; published stdio `initialize` and `tools/list` confirm package startup and tool count.
2. The current Codex task must expose Woodpecker MCP methods. An empty task tool catalog is a registration failure even when the server is ready.
3. A registered read-only `woodpecker_get_currently_authenticated_user` call confirms provider access. Status 0 with a missing configuration name identifies the MCP child environment; HTTP 200 confirms that read only.

Read the MCP child environment when diagnosing credentials. Shell variables, an installed plugin, and a direct local MCP call do not establish current-task access. Report the package version, tool count, API status, and task registration separately.
