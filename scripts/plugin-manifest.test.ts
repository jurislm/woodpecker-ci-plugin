import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { validatePluginManifests } from "./validate-plugin-manifests.ts";

async function readJson(path: string): Promise<Record<string, any>> {
  return JSON.parse(await readFile(path, "utf8")) as Record<string, any>;
}

describe("portable Woodpecker Plugin package", () => {
  test("passes Agent Plugins manifest validation", async () => {
    await expect(validatePluginManifests()).resolves.toBeUndefined();
  });

  test("declares a PNG composer icon and logo in both manifests", async () => {
    const plugin = await readJson("plugin.json");
    const fallback = await readJson(".codex-plugin/plugin.json");
    const portableInterface = plugin.extensions["com.openai"].interface;

    expect(portableInterface.composerIcon).toBe("./assets/woodpecker_ci.png");
    expect(portableInterface.logo).toBe("./assets/woodpecker_ci.png");
    expect(fallback.interface.composerIcon).toBe("./assets/woodpecker_ci.png");
    expect(fallback.interface.logo).toBe("./assets/woodpecker_ci.png");
  });

  test("declares the starter prompt in the portable root manifest", async () => {
    const plugin = await readJson("plugin.json");
    const portableInterface = plugin.extensions["com.openai"].interface;

    expect(portableInterface.defaultPrompt).toEqual(["Inspect the current Woodpecker CI status."]);
  });

  test("keeps the root manifest within the portable Agent Plugins schema", async () => {
    const plugin = await readJson("plugin.json");

    expect(plugin.$schema).toBe("https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
    expect(plugin.skills).toBeUndefined();
    expect(plugin.mcpServers).toBeUndefined();
  });

});
