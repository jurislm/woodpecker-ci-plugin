import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WoodpeckerClient, WoodpeckerApiError } from "./client.js";
import type { FetchLike } from "./client.js";
import type { WoodpeckerConfig } from "./config.js";
import { operations } from "./generated/operations.js";

const outputRequestSchema = z.object({
  method: z.string(),
  path: z.string(),
});

export function createServer(
  config: WoodpeckerConfig,
  fetchImpl?: FetchLike,
): McpServer {
  const client = new WoodpeckerClient(config, fetchImpl);
  const server = new McpServer(
    { name: "woodpecker-ci-plugin", version: "1.0.2" },
    {
      instructions:
        "Use read tools to resolve exact Woodpecker IDs and permissions before mutations. Never expose tokens or secret values in narration or logs.",
    },
  );

  for (const operation of operations) {
    server.registerTool(
      operation.name,
      {
        title: operation.name,
        description: operation.description,
        inputSchema: operation.inputSchema,
        outputSchema: z.object({
          data: operation.responseSchema,
          status: z.number(),
          request: outputRequestSchema,
        }),
        annotations: operation.annotations,
      },
      async (input) => {
        try {
          const envelope = await client.request(operation, input as Record<string, unknown>);
          const structuredContent = {
            data: envelope.data,
            status: envelope.status,
            request: envelope.request,
          };
          return {
            structuredContent,
            content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
          };
        } catch (error) {
          const details = error instanceof WoodpeckerApiError
            ? {
                code: "WOODPECKER_API_ERROR",
                status: error.status,
                method: error.method,
                path: error.path,
                message: error.message,
              }
            : {
                code: "WOODPECKER_TOOL_ERROR",
                message: error instanceof Error ? error.message : String(error),
              };
          return {
            isError: true,
            content: [{ type: "text" as const, text: JSON.stringify({ error: details }) }],
          };
        }
      },
    );
  }

  return server;
}
