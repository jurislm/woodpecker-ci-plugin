import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { parsePluginEnv, pluginEnvPath, withPluginEnv } from "./plugin-env.js";

const names = ["WOODPECKER_API_TOKEN"] as const;
const missingFile = (path: string): string => {
  throw Object.assign(new Error(`ENOENT: ${path}`), { code: "ENOENT" });
};

describe("parsePluginEnv", () => {
  test("reads export lines, quotes and comments without evaluating shell", () => {
    expect(parsePluginEnv([
      "# comment",
      "export HETZNER_API_TOKEN=plain-token",
      "WOODPECKER_URL=\"https://ci.example/api\"",
      "COOLIFY_ACCESS_TOKEN='single quoted # not comment'",
      "COOLIFY_BASE_URL=https://coolify.example # trailing comment",
      "not a valid line",
      "EMPTY=",
    ].join("\n"))).toEqual({
      HETZNER_API_TOKEN: "plain-token",
      WOODPECKER_URL: "https://ci.example/api",
      COOLIFY_ACCESS_TOKEN: "single quoted # not comment",
      COOLIFY_BASE_URL: "https://coolify.example",
      EMPTY: "",
    });
  });
});

describe("pluginEnvPath", () => {
  test("defaults to ~/.config/jurislm/plugin.env and honours JURISLM_PLUGIN_ENV", () => {
    expect(pluginEnvPath({ HOME: "/home/fixture" })).toBe(join("/home/fixture", ".config", "jurislm", "plugin.env"));
    expect(pluginEnvPath({ HOME: "/home/fixture", JURISLM_PLUGIN_ENV: "/etc/custom.env" })).toBe("/etc/custom.env");
    expect(pluginEnvPath({ HOME: "/home/fixture", JURISLM_PLUGIN_ENV: "${JURISLM_PLUGIN_ENV}" })).toBe(join("/home/fixture", ".config", "jurislm", "plugin.env"));
  });
});

describe("withPluginEnv", () => {
  test("fills a missing, empty or unsubstituted placeholder value from the plugin env file", () => {
    const read = (path: string) => {
      expect(path).toBe("/fixture/plugin.env");
      return "export WOODPECKER_API_TOKEN=file-token\nexport HETZNER_API_TOKEN=ignored\n";
    };
    for (const value of [undefined, "", "  ", "${WOODPECKER_API_TOKEN}"]) {
      const env = withPluginEnv({ JURISLM_PLUGIN_ENV: "/fixture/plugin.env", WOODPECKER_API_TOKEN: value }, names, read);
      expect(env.WOODPECKER_API_TOKEN).toBe("file-token");
      expect(env.HETZNER_API_TOKEN).toBeUndefined();
    }
  });

  test("never overrides a real host value and skips the file when nothing is missing", () => {
    let reads = 0;
    const env = withPluginEnv({ WOODPECKER_API_TOKEN: "host-token" }, names, () => { reads += 1; return "WOODPECKER_API_TOKEN=file-token"; });
    expect(env.WOODPECKER_API_TOKEN).toBe("host-token");
    expect(reads).toBe(0);
  });

  test("treats an unresolved placeholder as absent when the file is missing", () => {
    const warnings: string[] = [];
    const env = withPluginEnv({ WOODPECKER_API_TOKEN: "${WOODPECKER_API_TOKEN}" }, names, missingFile, (message) => warnings.push(message));
    expect("WOODPECKER_API_TOKEN" in env).toBe(false);
    expect(warnings).toEqual([]);
  });

  test("reports an unreadable file by path and error code without leaking values", () => {
    const warnings: string[] = [];
    const env = withPluginEnv({ JURISLM_PLUGIN_ENV: "/fixture/plugin.env" }, names, () => {
      throw Object.assign(new Error("EACCES: secret-ish detail"), { code: "EACCES" });
    }, (message) => warnings.push(message));
    expect(env.WOODPECKER_API_TOKEN).toBeUndefined();
    expect(warnings).toEqual(["Could not read plugin env file /fixture/plugin.env (EACCES)"]);
  });
});
