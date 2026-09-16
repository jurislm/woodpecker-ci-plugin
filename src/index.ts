#!/usr/bin/env bun

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { loadConfig } from "./config.js";

try {
  const server = createServer(loadConfig());
  await server.connect(new StdioServerTransport());
} catch (error) {
  console.error("Woodpecker MCP server failed:", error);
  process.exitCode = 1;
}
