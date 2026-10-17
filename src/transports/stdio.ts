import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "../server.js";
import { CONFIG_VARIABLES, loadConfig } from "../config.js";
import { withPluginEnv } from "../plugin-env.js";

export async function runStdioServer(
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const server = createServer(loadConfig(withPluginEnv(env, CONFIG_VARIABLES)));
  await server.connect(new StdioServerTransport());
}
