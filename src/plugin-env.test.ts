import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { parsePluginEnv, pluginEnvPath, withPluginEnv } from "./plugin-env.js";

const groups = [["SERVICE_URL", "SERVICE_TOKEN"], ["OTHER_TOKEN"]] as const;
const fileText = "export SERVICE_URL=https://file.example\nexport SERVICE_TOKEN=file-token\nexport OTHER_TOKEN=file-other\nexport UNRELATED=ignored\n";
const missingFile = (path: string): string => {
  throw Object.assign(new Error(`ENOENT: ${path}`), { code: "ENOENT" });
};

describe("parsePluginEnv", () => {
  test("reads export lines, quotes and comments without evaluating shell", () => {
    expect(parsePluginEnv([
      "# comment",
      "export PLAIN=plain-token",
      "DOUBLE=\"https://ci.example/api\"",
      "SINGLE='single quoted # not comment'",
      "TRAILING=https://coolify.example # trailing comment",
      "not a valid line",
      "EMPTY=",
    ].join("\n"))).toEqual({
      PLAIN: "plain-token",
      DOUBLE: "https://ci.example/api",
      SINGLE: "single quoted # not comment",
      TRAILING: "https://coolify.example",
      EMPTY: "",
    });
  });
});

describe("pluginEnvPath", () => {
  test("defaults to ~/.config/jurislm/plugin.env and honours JURISLM_PLUGIN_ENV", () => {
    expect(pluginEnvPath({ HOME: "/home/fixture" })).toBe(join("/home/fixture", ".config", "jurislm", "plugin.env"));
    expect(pluginEnvPath({ HOME: "/home/fixture", JURISLM_PLUGIN_ENV: "/etc/custom.env" })).toBe("/etc/custom.env");
    expect(pluginEnvPath({ HOME: "/home/fixture", JURISLM_PLUGIN_ENV: "${JURISLM_PLUGIN_ENV}" })).toBe(join("/home/fixture", ".config", "jurislm", "plugin.env"));
    expect(pluginEnvPath({ HOME: "/home/fixture", JURISLM_PLUGIN_ENV: "~/custom/plugin.env" })).toBe(join("/home/fixture", "custom", "plugin.env"));
  });
});

describe("withPluginEnv", () => {
  test("fills missing, empty or unsubstituted placeholder groups from the plugin env file", () => {
    const read = (path: string) => {
      expect(path).toBe("/fixture/plugin.env");
      return fileText;
    };
    for (const value of [undefined, "", "  ", "${SERVICE_TOKEN}"]) {
      const env = withPluginEnv({ JURISLM_PLUGIN_ENV: "/fixture/plugin.env", SERVICE_URL: value, SERVICE_TOKEN: value }, groups, read);
      expect(env).toMatchObject({ SERVICE_URL: "https://file.example", SERVICE_TOKEN: "file-token", OTHER_TOKEN: "file-other" });
      expect(env.UNRELATED).toBeUndefined();
    }
  });

  test("never overrides a real host value and skips the file when nothing is missing", () => {
    let reads = 0;
    const host = { SERVICE_URL: "https://host.example", SERVICE_TOKEN: "host-token", OTHER_TOKEN: "host-other" };
    const env = withPluginEnv(host, groups, () => { reads += 1; return fileText; });
    expect(env).toEqual(host);
    expect(reads).toBe(0);
  });

  test("does not pair a host value with a file value inside one credential group", () => {
    const env = withPluginEnv({ SERVICE_URL: "https://host.example", SERVICE_TOKEN: "${SERVICE_TOKEN}" }, groups, () => fileText);
    expect(env.SERVICE_URL).toBe("https://host.example");
    expect("SERVICE_TOKEN" in env).toBe(false);
    expect(env.OTHER_TOKEN).toBe("file-other");
  });

  test("treats unresolved placeholders as absent when the file is missing", () => {
    const warnings: string[] = [];
    const env = withPluginEnv({ SERVICE_URL: "${SERVICE_URL}", SERVICE_TOKEN: "${SERVICE_TOKEN}" }, groups, missingFile, (message) => warnings.push(message));
    expect("SERVICE_URL" in env || "SERVICE_TOKEN" in env).toBe(false);
    expect(warnings).toEqual([]);
  });

  test("reports an unreadable file by path and error code without leaking values", () => {
    const warnings: string[] = [];
    const env = withPluginEnv({ JURISLM_PLUGIN_ENV: "/fixture/plugin.env" }, groups, () => {
      throw Object.assign(new Error("EACCES: secret-ish detail"), { code: "EACCES" });
    }, (message) => warnings.push(message));
    expect(env.SERVICE_TOKEN).toBeUndefined();
    expect(warnings).toEqual(["Could not read plugin env file /fixture/plugin.env (EACCES)"]);
  });
});
