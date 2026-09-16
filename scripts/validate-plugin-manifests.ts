import Ajv2020 from "ajv/dist/2020.js";
import { readFile } from "node:fs/promises";

async function readJson(path: string): Promise<Record<string, any>> {
  return JSON.parse(await readFile(path, "utf8")) as Record<string, any>;
}

export async function validatePluginManifests(): Promise<void> {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const pluginSchema = await readJson("schemas/plugin.schema.json");
  const mcpSchema = await readJson("schemas/mcp.schema.json");
  const validatePlugin = ajv.compile(pluginSchema);
  const validateMcp = ajv.compile(mcpSchema);
  const plugin = await readJson("plugin.json");
  const fallback = await readJson(".codex-plugin/plugin.json");
  const mcp = await readJson("mcp.json");

  if (!validatePlugin(plugin)) throw new Error("plugin.json: " + ajv.errorsText(validatePlugin.errors));
  if (!validatePlugin(fallback)) throw new Error(".codex-plugin/plugin.json: " + ajv.errorsText(validatePlugin.errors));
  if (!validateMcp(mcp)) throw new Error("mcp.json: " + ajv.errorsText(validateMcp.errors));

  if (plugin.name !== "woodpecker-ci") throw new Error("plugin.json has the wrong name");
  if (fallback.name !== plugin.name) throw new Error("Codex fallback identity does not match root manifest");
  const server = mcp.mcpServers?.["woodpecker-ci"];
  if (!server || server.type !== "stdio") throw new Error("mcp.json must define the woodpecker-ci stdio server");
  if (server.command !== "bunx") throw new Error("mcp.json must use bunx");

  const example = await readJson(".mcp.json.example");
  if (!example.mcpServers?.["woodpecker-ci"]) throw new Error(".mcp.json.example is missing woodpecker-ci");
  const exampleText = await readFile(".mcp.json.example", "utf8");
  if (/sk-|ghp_|npm_[A-Za-z0-9]{10,}/u.test(exampleText)) {
    throw new Error(".mcp.json.example contains a credential-looking value");
  }

  const skill = await readFile("skills/woodpecker-ci/SKILL.md", "utf8");
  if (!/^---\nname: woodpecker-ci\n/mu.test(skill)) throw new Error("Woodpecker skill frontmatter is missing");
}

if (import.meta.main) {
  await validatePluginManifests();
  console.error("Plugin manifests validated.");
}
