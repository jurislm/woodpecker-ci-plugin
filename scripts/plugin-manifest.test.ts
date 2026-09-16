import { describe, expect, test } from "bun:test";
import { validatePluginManifests } from "./validate-plugin-manifests.ts";

describe("portable Woodpecker Plugin package", () => {
  test("passes Agent Plugins manifest validation", async () => {
    await expect(validatePluginManifests()).resolves.toBeUndefined();
  });
});
