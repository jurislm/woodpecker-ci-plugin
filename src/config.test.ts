import { describe, expect, test } from "bun:test";
import { ConfigError, loadConfig } from "./config.js";

describe("loadConfig", () => {
  test("requires the Woodpecker URL and token", () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({ WOODPECKER_URL: "https://ci.example.com/api" })).toThrow(ConfigError);
  });

  test("normalizes one trailing slash and rejects non-http URLs", () => {
    expect(loadConfig({
      WOODPECKER_URL: "https://ci.example.com/api/",
      WOODPECKER_API_TOKEN: "secret",
    })).toEqual({
      baseUrl: "https://ci.example.com/api",
      token: "secret",
      timeoutMs: 30_000,
    });
    expect(() => loadConfig({
      WOODPECKER_URL: "file:///tmp/api",
      WOODPECKER_API_TOKEN: "secret",
    })).toThrow(ConfigError);
  });

  test("does not fall back to the legacy Drone token", () => {
    expect(() => loadConfig({
      WOODPECKER_URL: "https://ci.example.com/api",
      DRONE_TOKEN: "legacy",
    })).toThrow(ConfigError);
  });
});
