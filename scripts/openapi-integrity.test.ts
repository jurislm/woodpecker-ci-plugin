import { expect, test } from "bun:test";
import { verifyOpenApiManifest } from "./openapi-integrity.js";

test("verifies the committed Woodpecker OpenAPI snapshot against its manifest", async () => {
  await expect(verifyOpenApiManifest(process.cwd())).resolves.toEqual({
    pathCount: 74,
    operationCount: 118,
  });
});
