import { mkdir } from "node:fs/promises";

const schemas = {
  "plugin.schema.json": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "mcp.schema.json": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
};

await mkdir("schemas", { recursive: true });
for (const [name, url] of Object.entries(schemas)) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Schema download failed: " + response.status + " " + url);
  await Bun.write("schemas/" + name, JSON.stringify(await response.json(), null, 2) + "\n");
}
console.error("Updated Agent Plugins schemas.");
