import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { expect, test } from "bun:test";
import { operations } from "./generated/operations.js";

test("serves tools over stdio without provider configuration", async () => {
  expect(await Bun.file("dist/index.js").exists()).toBe(true);
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  delete env.WOODPECKER_URL;
  delete env.WOODPECKER_API_TOKEN;
  const transport = new StdioClientTransport({ command: "bun", args: ["dist/index.js"], env, stderr: "pipe" });
  const client = new Client({ name: "stdio-test", version: "0.0.0" });
  await client.connect(transport);
  const tools = await client.listTools();
  expect(tools.tools).toHaveLength(operations.length + 1);
  expect(tools.tools.some((tool) => tool.name === "woodpecker_inspect_pipeline")).toBe(true);
  const result = await client.callTool({ name: "woodpecker_get_currently_authenticated_user", arguments: {} });
  expect(result.isError).toBe(true);
  expect(result.content).toContainEqual(expect.objectContaining({ text: expect.stringContaining("WOODPECKER_URL is required") }));
  await client.close();
});
