import { describe, expect, test } from "bun:test";
import contract from "../contracts/woodpecker-mcp-v2.json";
import manifest from "../api/manifest.json";
import { operations } from "../src/generated/operations.js";

describe("generated OpenAPI contract", () => {
  test("contains the committed tool contract with unique names", () => {
    expect(operations).toHaveLength(contract.operations.length);
    expect(new Set(operations.map((operation) => operation.name)).size).toBe(operations.length);
  });

  test("does not expose the version route that returns the web UI on the configured server", () => {
    expect(operations.some((operation) => operation.path === "/version")).toBe(false);
  });

  test("does not expose authorization headers as tool inputs", () => {
    expect(operations.flatMap((operation) => operation.parameters).some((parameter) => parameter.location === "header")).toBe(false);
  });

  test("accepts Woodpecker's nullable and string-encoded optional repository fields", () => {
    const operation = operations.find((candidate) => candidate.name === "woodpecker_lookup_repository_full_name");
    expect(operation?.responseSchema.safeParse({
      id: 42,
      approval_allowed_users: null,
      netrc_trusted: null,
      secret_extension_netrc: "true",
    }).success).toBe(true);
  });

  test("matches the current v2 tool contract", () => {
    expect(contract.contractVersion).toBe("2.0.0");
    expect(contract.generatedFrom.sha256).toBe(manifest.sha256);
    expect(contract.environment.required).toEqual(["WOODPECKER_URL", "WOODPECKER_API_TOKEN"]);
    expect(contract.environment.rejected).toEqual(["DRONE_TOKEN"]);
    expect(contract.structuredContent.required).toEqual(["data", "status", "request"]);
    expect(operations.map(({ name, title, description, method, path, parameters, inputSchemaHash, responseSchemaHash, responseKind, stream, annotations }) => ({
      name,
      title,
      description,
      method,
      path,
      parameters,
      inputSchemaHash,
      responseSchemaHash,
      responseKind,
      stream,
      annotations,
    }))).toEqual(contract.operations);
  });
});
