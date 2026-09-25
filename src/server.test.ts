import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, test } from "bun:test";
import type { WoodpeckerConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { operations } from "./generated/operations.js";
import { createServer } from "./server.js";

const config: WoodpeckerConfig = {
  baseUrl: "https://ci.example.com/api",
  token: "secret-token",
  timeoutMs: 30_000,
};

describe("MCP server", () => {
  test("lists tools without provider configuration and reports it on first call", async () => {
    let called = false;
    const server = createServer(loadConfig({}), async () => {
      called = true;
      throw new Error("fetch must not run without configuration");
    });
    const client = new Client({ name: "test-client", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const tools = await client.listTools();
    const result = await client.callTool({ name: "woodpecker_get_currently_authenticated_user", arguments: {} });
    expect(tools.tools).toHaveLength(operations.length + 1);
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("WOODPECKER_URL is required");
    expect(called).toBe(false);
    await client.close();
    await server.close();
  });

  test("registers every generated operation and retained pipeline tool", async () => {
    const server = createServer(config, async () => new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const client = new Client({ name: "test-client", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.listTools();
    expect(result.tools).toHaveLength(operations.length + 1);
    expect(new Set(result.tools.map((tool) => tool.name)).size).toBe(operations.length + 1);
    await client.close();
    await server.close();
  });

  test("calls a generated tool through the shared client", async () => {
    let called = "";
    const server = createServer(config, async (input) => {
      called = String(input);
      return new Response(JSON.stringify({ login: "terry" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const client = new Client({ name: "test-client", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({ name: "woodpecker_get_currently_authenticated_user", arguments: {} });
    expect(called).toBe("https://ci.example.com/api/user");
    expect(result.isError).not.toBe(true);
    expect(JSON.stringify(result.structuredContent)).toContain("terry");
    await client.close();
    await server.close();
  });

  test("rejects API responses that do not match the generated response schema", async () => {
    const server = createServer(config, async () => new Response(JSON.stringify({ response_marker: "must-not-leak" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const client = new Client({ name: "test-client", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({ name: "woodpecker_list_users", arguments: {} });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("woodpecker_list_users response schema (HTTP 200)");
    expect(JSON.stringify(result.content)).not.toContain("must-not-leak");
    await client.close();
    await server.close();
  });
});
