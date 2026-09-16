import { describe, expect, test } from "bun:test";
import contract from "../contracts/woodpecker-mcp-v1.json";
import manifest from "../openapi/manifest.json";
import { operations } from "../src/generated/operations.js";

describe("generated OpenAPI contract", () => {
  test("contains the committed operation count with unique names", () => {
    expect(operations).toHaveLength(manifest.operationCount);
    expect(new Set(operations.map((operation) => operation.name)).size).toBe(operations.length);
  });

  test("does not expose authorization headers as tool inputs", () => {
    expect(operations.flatMap((operation) => operation.parameters).some((parameter) => parameter.location === "header")).toBe(false);
  });

  test("matches the frozen v1 tool contract", () => {
    expect(contract.contractVersion).toBe("1.0.0");
    expect(contract.generatedFrom.sha256).toBe(manifest.sha256);
    expect(contract.environment.required).toEqual(["WOODPECKER_URL", "WOODPECKER_API_TOKEN"]);
    expect(contract.environment.rejected).toEqual(["DRONE_TOKEN"]);
    expect(contract.structuredContent.required).toEqual(["data", "status", "request"]);
    expect(operations.map(({ name, method, path, parameters, inputSchemaHash, responseSchemaHash, responseKind, stream, annotations }) => ({
      name,
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
