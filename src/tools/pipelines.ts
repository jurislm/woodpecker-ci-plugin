import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ApiRequest } from "../api.js";
import { withApiErrorHandling } from "../api.js";
import { operations } from "../generated/operations.js";

function getOperation(name: string) {
  const operation = operations.find((candidate) => candidate.name === name);
  if (!operation) throw new Error("Generated Woodpecker operation is missing: " + name);
  return operation;
}

const lookupRepository = getOperation("woodpecker_lookup_repository_full_name");
const getPipeline = getOperation("woodpecker_get_repositories_pipeline");
const getPipelineMetadata = getOperation("woodpecker_get_metadata_pipeline_or_specific_workflow_including_previous_pipeline_info");

export function registerPipelineTools(server: McpServer, apiRequest: ApiRequest, tokens: Array<string | undefined> = []): void {
  server.registerTool(
    "woodpecker_inspect_pipeline",
    {
      title: "Inspect a pipeline",
      description: "Resolve a repository by full name, then return a pipeline and its commit metadata.",
      inputSchema: z.object({
        repository: z.string().min(1).describe("Repository full name, for example owner/repository."),
        pipeline_number: z.number().int().positive(),
      }).strict(),
      outputSchema: z.object({
        repository: z.object({ id: z.number(), full_name: z.string() }),
        pipeline: z.unknown(),
        metadata: z.unknown(),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ repository: fullName, pipeline_number }) => withApiErrorHandling(async () => {
      const repository = await apiRequest(lookupRepository, { repo_full_name: fullName });
      const repo = repository.data as Record<string, unknown>;
      if (typeof repo.id !== "number") throw new Error("Woodpecker repository lookup returned no numeric ID");
      const [pipeline, metadata] = await Promise.all([
        apiRequest(getPipeline, { repo_id: repo.id, pipeline_number }),
        apiRequest(getPipelineMetadata, { repo_id: repo.id, pipeline_number }),
      ]);
      const structuredContent = {
        repository: { id: repo.id, full_name: typeof repo.full_name === "string" ? repo.full_name : fullName },
        pipeline: pipeline.data,
        metadata: metadata.data,
      };
      return {
        structuredContent,
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
      };
    }, tokens),
  );
}
