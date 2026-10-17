import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "../server.js";
import { CREDENTIAL_GROUPS, loadConfig } from "../config.js";
import { withPluginEnv } from "../plugin-env.js";

export async function runStdioServer(
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const server = createServer(loadConfig(withPluginEnv(env, CREDENTIAL_GROUPS)));
  await server.connect(new StdioServerTransport());
}
