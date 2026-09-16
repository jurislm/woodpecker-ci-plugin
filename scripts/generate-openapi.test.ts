import { describe, expect, test } from "bun:test";
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
});
