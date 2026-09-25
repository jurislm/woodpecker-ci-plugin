import { describe, expect, test } from "bun:test";
import { WoodpeckerApiError, WoodpeckerClient } from "./client.js";
import type { WoodpeckerConfig } from "./config.js";

const config: WoodpeckerConfig = {
  baseUrl: "https://ci.example.com/api",
  token: "secret-token",
  timeoutMs: 30_000,
};

function operation(overrides: Record<string, unknown> = {}) {
  return {
    name: "woodpecker_get_user",
    method: "GET",
    path: "/user",
    parameters: [],
    responseKind: "json",
    stream: false,
    ...overrides,
  } as any;
}

describe("WoodpeckerClient", () => {
  test("sends bearer auth and decodes JSON", async () => {
    let request: { url: string; init?: RequestInit } | undefined;
    const client = new WoodpeckerClient(config, async (url, init) => {
      request = { url: String(url), init };
      return new Response(JSON.stringify({ login: "terry" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    await expect(client.request(operation(), {})).resolves.toMatchObject({
      data: { login: "terry" },
      status: 200,
      request: { method: "GET", path: "/user" },
    });
    expect(request?.url).toBe("https://ci.example.com/api/user");
    expect(new Headers(request?.init?.headers).get("authorization")).toBe("Bearer secret-token");
  });

  test("encodes path and query parameters without exposing headers to the tool input", async () => {
    let url = "";
    const client = new WoodpeckerClient(config, async (input) => {
      url = String(input);
      return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
    });

    await client.request(operation({
      method: "GET",
      path: "/repos/{repo_id}/pipelines",
      parameters: [
        { location: "path", name: "repo_id" },
        { location: "query", name: "branch" },
      ],
    }), { repo_id: 7, branch: "feature/x" });
    expect(url).toBe("https://ci.example.com/api/repos/7/pipelines?branch=feature%2Fx");
  });

  test("sends JSON bodies and does not retry mutation failures", async () => {
    let attempts = 0;
    const client = new WoodpeckerClient(config, async (_input, init) => {
      attempts++;
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify({ branch: "main" }));
      return new Response("bad secret-token", {
        status: 500,
        headers: { "content-type": "text/plain" },
      });
    });

    const error = await client.request(operation({
      method: "POST",
      path: "/repos/{repo_id}/pipelines",
      parameters: [{ location: "path", name: "repo_id" }],
    }), { repo_id: 7, body: { branch: "main" } }).catch((value) => value);
    expect(error).toBeInstanceOf(WoodpeckerApiError);
    expect(attempts).toBe(1);
    expect(error.message).not.toContain("secret-token");
  });

  test("returns null for a 204 response", async () => {
    const client = new WoodpeckerClient(config, async () => new Response(null, { status: 204 }));
    await expect(client.request(operation({ method: "DELETE", path: "/repos/7" }), {}))
      .resolves.toMatchObject({ data: null, status: 204 });
  });

  test("redacts credential-shaped fields from nested API responses", async () => {
    const client = new WoodpeckerClient(config, async () => new Response(JSON.stringify({
      token: "one-time-token",
      registry: { password: "registry-password", username: "ci" },
      details: { authorization: "Bearer other-token", value: "secret-value" },
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await client.request(operation(), {});
    expect(result.data).toEqual({
      token: "[REDACTED]",
      registry: { password: "[REDACTED]", username: "ci" },
      details: { authorization: "[REDACTED]", value: "secret-value" },
    });
  });

  test("rejects dot-only path segments before making a request", async () => {
    let called = false;
    const client = new WoodpeckerClient(config, async () => {
      called = true;
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    });

    await expect(client.request(operation({
      path: "/repos/{repo_id}",
      parameters: [{ location: "path", name: "repo_id" }],
    }), { repo_id: ".." })).rejects.toThrow("Invalid dot-only path parameter: repo_id");
    expect(called).toBe(false);
  });

  test("rejects credentials embedded in the Woodpecker URL", async () => {
    const client = new WoodpeckerClient({ ...config, baseUrl: "https://user:password@ci.example.com/api" }, async () => {
      throw new Error("fetch must not run for credential-bearing URLs");
    });

    await expect(client.request(operation(), {})).rejects.toMatchObject({ message: "WOODPECKER_URL must not include credentials" });
  });
});
