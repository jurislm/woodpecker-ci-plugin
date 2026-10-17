import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { operations } from "./generated/operations.js";

test("serves tools over stdio without provider configuration", async () => {
  expect(await Bun.file("dist/index.js").exists()).toBe(true);
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  delete env.WOODPECKER_URL;
  delete env.WOODPECKER_API_TOKEN;
  env.JURISLM_PLUGIN_ENV = "/nonexistent/jurislm/plugin.env";
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

test("fills unsubstituted placeholders from the JurisLM plugin env file", async () => {
  const requests: string[] = [];
  const api = Bun.serve({ port: 0, fetch(request) {
    requests.push(`${new URL(request.url).pathname} ${request.headers.get("authorization")}`);
    return Response.json({ id: 1, login: "fixture" });
  } });
  const directory = mkdtempSync(join(tmpdir(), "woodpecker-plugin-env-"));
  try {
    const envFile = join(directory, "plugin.env");
    writeFileSync(envFile, `export WOODPECKER_URL=http://127.0.0.1:${api.port}/api\nexport WOODPECKER_API_TOKEN=fixture-file-token\n`);
    const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
    Object.assign(env, { WOODPECKER_URL: "${WOODPECKER_URL}", WOODPECKER_API_TOKEN: "${WOODPECKER_API_TOKEN}", JURISLM_PLUGIN_ENV: envFile });
    const client = new Client({ name: "stdio-test", version: "0.0.0" });
    await client.connect(new StdioClientTransport({ command: "bun", args: ["dist/index.js"], env, stderr: "pipe" }));
    const result = await client.callTool({ name: "woodpecker_get_currently_authenticated_user", arguments: {} });
    await client.close();
    expect(result.isError).not.toBe(true);
    expect(requests).toEqual(["/api/user Bearer fixture-file-token"]);
  } finally {
    await api.stop(true);
    rmSync(directory, { recursive: true, force: true });
  }
});
