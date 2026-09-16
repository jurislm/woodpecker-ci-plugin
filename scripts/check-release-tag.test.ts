import { describe, expect, test } from "bun:test";
import { assertReleaseTag } from "./check-release-tag.ts";

describe("assertReleaseTag", () => {
  test("accepts the package version tag", () => {
    expect(() => assertReleaseTag("v0.1.0", "0.1.0")).not.toThrow();
  });

  test("rejects a missing or mismatched tag", () => {
    expect(() => assertReleaseTag(undefined, "0.1.0")).toThrow();
    expect(() => assertReleaseTag("v0.2.0", "0.1.0")).toThrow();
  });
});
