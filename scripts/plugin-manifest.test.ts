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

  test("registers root skills and the portable MCP config", async () => {
    const plugin = await readJson("plugin.json");
    const mcp = await readJson("mcp.json");
    const localMcp = await readJson(".mcp.json");

    expect(plugin.skills).toBe("./skills/");
    expect(plugin.mcpServers).toBe("./mcp.json");
    expect(mcp.mcpServers).toEqual(localMcp.mcpServers);
  });

  test("uses a provider-owned marketplace name", async () => {
    const marketplace = JSON.parse(await readFile(".agents/plugins/marketplace.json", "utf8")) as Record<string, any>;

    expect(marketplace.name).toBe("woodpecker-ci-marketplace");
    expect(marketplace.plugins[0].name).toBe("woodpecker-ci");
  });
});
