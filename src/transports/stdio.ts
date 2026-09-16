import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "../server.js";
import { loadConfig } from "../config.js";

export async function runStdioServer(
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const server = createServer(loadConfig(env));
  await server.connect(new StdioServerTransport());
}
