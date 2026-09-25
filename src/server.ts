import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createApiRequest, withApiErrorHandling } from "./api.js";
import { WoodpeckerClient, redactSensitive, type FetchLike } from "./client.js";
import type { WoodpeckerConfig } from "./config.js";
import { operations } from "./generated/operations.js";
import { registerPipelineTools } from "./tools/pipelines.js";
import packageJson from "../package.json" with { type: "json" };

const outputRequestSchema = z.object({
  method: z.string(),
  path: z.string(),
});

export function createServer(
  config: WoodpeckerConfig,
  fetchImpl?: FetchLike,
): McpServer {
  const client = new WoodpeckerClient(config, fetchImpl);
  const apiRequest = createApiRequest(client);
  const server = new McpServer(
    { name: "woodpecker-ci-plugin", version: packageJson.version },
    {
      instructions:
        "Use read tools to resolve exact Woodpecker IDs and permissions before mutations. Never expose tokens or secret values in tool results, narration, or logs.",
    },
  );

  for (const operation of operations) {
    server.registerTool(
      operation.name,
      {
        title: operation.title,
        description: operation.description,
        inputSchema: operation.inputSchema,
        outputSchema: z.object({
          data: operation.responseSchema,
          status: z.number(),
          request: outputRequestSchema,
        }),
        annotations: operation.annotations,
      },
      async (input) => withApiErrorHandling(async () => {
          const envelope = await apiRequest(operation, input as Record<string, unknown>);
          const structuredContent = {
            data: redactSensitive(envelope.data),
            status: envelope.status,
            request: envelope.request,
          };
          return {
            structuredContent,
            content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
          };
      }, [config.token]),
    );
  }

  registerPipelineTools(server, apiRequest, [config.token]);
  return server;
}
