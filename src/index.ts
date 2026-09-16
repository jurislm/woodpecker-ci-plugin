#!/usr/bin/env bun

import { runStdioServer } from "./transports/stdio.js";

try {
  await runStdioServer();
} catch (error) {
  console.error("Woodpecker MCP server failed:", error);
  process.exitCode = 1;
}
