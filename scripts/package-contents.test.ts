import { describe, expect, test } from "bun:test";
import { parseBunPackOutput } from "./package-contents.js";

describe("parseBunPackOutput", () => {
  test("reads Bun dry-run paths and file count", () => {
    expect(parseBunPackOutput("bun pack v1.3.14\npacked 1KB package.json\npacked 2KB api/manifest.json\n\nTotal files: 2\n")).toEqual({
      paths: ["package.json", "api/manifest.json"],
      totalFiles: 2,
    });
  });
});
