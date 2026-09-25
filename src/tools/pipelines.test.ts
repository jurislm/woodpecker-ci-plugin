import { describe, expect, test } from "bun:test";
import { registerPipelineTools } from "./pipelines.js";

describe("pipeline tools", () => {
  test("resolves a repository then returns pipeline and metadata", async () => {
    const calls: Array<{ name: string; input: Record<string, unknown> }> = [];
    const registered: Array<{ name: string; options: any; handler: (input: any) => Promise<any> }> = [];
    const apiRequest = async (operation: { name: string }, input: Record<string, unknown>) => {
      calls.push({ name: operation.name, input });
      if (operation.name === "woodpecker_lookup_repository_full_name") {
        return { data: { id: 42, full_name: "owner/repo" }, status: 200, request: { method: "GET", path: "/repos/lookup/owner/repo" } };
      }
      if (operation.name === "woodpecker_get_repositories_pipeline") {
        return { data: { number: 12, status: "failure" }, status: 200, request: { method: "GET", path: "/repos/42/pipelines/12" } };
      }
      return { data: { curr: { commit: { sha: "abc123" } } }, status: 200, request: { method: "GET", path: "/repos/42/pipelines/12/metadata" } };
    };

    registerPipelineTools({
      registerTool: (name: string, options: any, handler: (input: any) => Promise<any>) => registered.push({ name, options, handler }),
    } as any, apiRequest as any);

    const tool = registered.find(({ name }) => name === "woodpecker_inspect_pipeline");
    expect(tool).toBeDefined();
    const result = await tool!.handler({ repository: "owner/repo", pipeline_number: 12 });

    expect(calls.map(({ name }) => name)).toEqual([
      "woodpecker_lookup_repository_full_name",
      "woodpecker_get_repositories_pipeline",
      "woodpecker_get_metadata_pipeline_or_specific_workflow_including_previous_pipeline_info",
    ]);
    expect(result.structuredContent).toEqual({
      repository: { id: 42, full_name: "owner/repo" },
      pipeline: { number: 12, status: "failure" },
      metadata: { curr: { commit: { sha: "abc123" } } },
    });
    expect(tool!.options.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, idempotentHint: true });
  });
});
