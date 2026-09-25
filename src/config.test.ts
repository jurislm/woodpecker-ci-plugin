import { describe, expect, test } from "bun:test";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  test("allows MCP startup before provider configuration is available", () => {
    expect(loadConfig({})).toEqual({
      baseUrl: undefined,
      token: undefined,
      timeoutMs: 30_000,
    });
  });

  test("normalizes a trailing slash and defers URL validation until a request", () => {
    expect(loadConfig({
      WOODPECKER_URL: "https://ci.example.com/api/",
      WOODPECKER_API_TOKEN: "secret",
    })).toEqual({
      baseUrl: "https://ci.example.com/api",
      token: "secret",
      timeoutMs: 30_000,
    });
    expect(loadConfig({
      WOODPECKER_URL: "file:///tmp/api",
      WOODPECKER_API_TOKEN: "secret",
    }).baseUrl).toBe("file:///tmp/api");
  });

  test("does not fall back to the legacy Drone token", () => {
    expect(loadConfig({
      WOODPECKER_URL: "https://ci.example.com/api",
      DRONE_TOKEN: "legacy",
    })).toEqual({
      baseUrl: "https://ci.example.com/api",
      token: undefined,
      timeoutMs: 30_000,
    });
  });
});
