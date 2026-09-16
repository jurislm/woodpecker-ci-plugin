import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, test } from "bun:test";
import type { WoodpeckerConfig } from "./config.js";
import { createServer } from "./server.js";

const config: WoodpeckerConfig = {
  baseUrl: "https://ci.example.com/api",
  token: "secret-token",
  timeoutMs: 30_000,
};

describe("MCP server", () => {
  test("registers every generated operation", async () => {
    const server = createServer(config, async () => new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const client = new Client({ name: "test-client", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.listTools();
    expect(result.tools).toHaveLength(118);
    expect(new Set(result.tools.map((tool) => tool.name)).size).toBe(118);
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
});
