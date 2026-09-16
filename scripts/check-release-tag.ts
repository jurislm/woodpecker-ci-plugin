export function assertReleaseTag(tag: string | undefined, version: string): void {
  const expected = "v" + version;
  if (!tag) throw new Error("CI_COMMIT_TAG is required for a release");
  if (tag !== expected) throw new Error("Release tag " + tag + " does not match " + expected);
}

if (import.meta.main) {
  const packageJson = await Bun.file("package.json").json() as { version: string };
  assertReleaseTag(process.env.CI_COMMIT_TAG, packageJson.version);
  console.error("Release tag matches package version.");
}
