import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { operations } from "../src/generated/operations.js";

const env = Object.fromEntries(
  Object.entries({
    ...process.env,
    WOODPECKER_URL: process.env.WOODPECKER_URL,
    WOODPECKER_API_TOKEN: process.env.WOODPECKER_API_TOKEN,
  }).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
);
const client = new Client({ name: "smoke-client", version: "0.0.0" });
const transport = new StdioClientTransport({
  command: "bun",
  args: ["dist/index.js"],
  env,
});
await client.connect(transport);
const result = await client.listTools();
console.error("stdio tools: " + result.tools.length);
if (result.tools.length !== operations.length + 1) throw new Error("Unexpected Woodpecker tool count");
if (!result.tools.some((tool) => tool.name === "woodpecker_inspect_pipeline")) throw new Error("Pipeline inspection tool is missing");
if (process.env.WOODPECKER_URL && process.env.WOODPECKER_API_TOKEN) {
  const user = await client.callTool({ name: "woodpecker_get_currently_authenticated_user", arguments: {} });
  if (user.isError) throw new Error("Woodpecker MCP read-only call failed: " + JSON.stringify(user.content));
  console.error("stdio call: woodpecker_get_currently_authenticated_user succeeded");
}
const repository = process.env.WOODPECKER_SMOKE_REPO;
const pipelineNumber = Number(process.env.WOODPECKER_SMOKE_PIPELINE);
if (repository && Number.isSafeInteger(pipelineNumber) && pipelineNumber > 0) {
  const report = await client.callTool({
    name: "woodpecker_inspect_pipeline",
    arguments: { repository, pipeline_number: pipelineNumber },
  });
  if (report.isError) throw new Error("Woodpecker pipeline inspection failed: " + JSON.stringify(report.content));
  console.error("stdio call: woodpecker_inspect_pipeline succeeded");
}
await client.close();
