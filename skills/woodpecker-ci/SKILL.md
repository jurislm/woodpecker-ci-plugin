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
- Report source, pipeline number, commit SHA, status, and API error status separately.
