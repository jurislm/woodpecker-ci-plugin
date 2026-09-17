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
});
