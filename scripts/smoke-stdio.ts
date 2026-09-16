import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

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
if (result.tools.length !== 118) throw new Error("Expected 118 tools");
await client.close();
