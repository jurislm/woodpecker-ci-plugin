#!/usr/bin/env bun
import {
  runReleasePrAutoMerge,
  selectReleaseCandidate,
  validateChangedFiles,
  validateReleaseContents,
} from "./release-pr-auto-merge";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectThrows(run: () => unknown, expected: string): void {
  try {
    run();
  } catch (error) {
    assert(error instanceof Error && error.message.includes(expected), `expected ${expected}`);
    return;
  }
  throw new Error(`expected error containing ${expected}`);
}

async function expectRejects(run: () => Promise<unknown>, expected: string): Promise<void> {
  try {
    await run();
  } catch (error) {
    assert(error instanceof Error && error.message.includes(expected), `expected ${expected}`);
    return;
  }
  throw new Error(`expected rejection containing ${expected}`);
}

const VERSION = "1.0.3";
const BASE_SHA = "base-sha";
const HEAD_SHA = "head-sha";
const RELEASE_BRANCH = "release-please--branches--main--components--woodpecker-ci-plugin";
const RELEASE_BODY =
  ":robot: I have created a release *beep* *boop*\n\nThis PR was generated with [Release Please](https://github.com/googleapis/release-please).";

function candidate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    number: 10,
    state: "open",
    draft: false,
    title: `chore(main): release ${VERSION}`,
    body: RELEASE_BODY,
    changed_files: 5,
    user: { login: "terry90918" },
    base: { ref: "main", sha: BASE_SHA, repo: { full_name: "jurislm/woodpecker-ci-plugin" } },
    head: { ref: RELEASE_BRANCH, sha: HEAD_SHA, repo: { full_name: "jurislm/woodpecker-ci-plugin" } },
    ...overrides,
  };
}

function validFiles(): Array<{ filename: string; status: string }> {
  return [
    { filename: ".release-please-manifest.json", status: "modified" },
    { filename: "CHANGELOG.md", status: "modified" },
    { filename: "package.json", status: "modified" },
    { filename: "plugin.json", status: "modified" },
    { filename: ".codex-plugin/plugin.json", status: "modified" },
  ];
}

function validContents(): Parameters<typeof validateReleaseContents>[0] {
  const basePackage = { name: "@jurislm/woodpecker-ci-plugin", version: "1.0.2", private: false };
  const headPackage = { ...basePackage, version: VERSION };
  const basePlugin = { name: "woodpecker-ci", version: "1.0.2", description: "plugin" };
  const headPlugin = { ...basePlugin, version: VERSION };
  const oldHistory = "## [1.0.2](https://github.com/jurislm/woodpecker-ci-plugin/releases/tag/v1.0.2)\n\nInitial release\n";
  const newBlock = `## [${VERSION}](https://github.com/jurislm/woodpecker-ci-plugin/releases/tag/v${VERSION})\n\n### Bug Fixes\n\n* safe release\n\n`;
  return {
    version: VERSION,
    baseManifestText: JSON.stringify({ ".": "1.0.2" }),
    headManifestText: JSON.stringify({ ".": VERSION }),
    basePackageText: JSON.stringify(basePackage),
    headPackageText: JSON.stringify(headPackage),
    basePluginManifestText: JSON.stringify(basePlugin),
    headPluginManifestText: JSON.stringify(headPlugin),
    baseFallbackManifestText: JSON.stringify(basePlugin),
    headFallbackManifestText: JSON.stringify(headPlugin),
    baseChangelogText: `# Changelog\n\n${oldHistory}`,
    headChangelogText: `# Changelog\n\n${newBlock}${oldHistory}`,
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function contentResponse(text: string): Response {
  return jsonResponse({ type: "file", encoding: "base64", content: Buffer.from(text).toString("base64") });
}

function fakeFetch(responses: Response[], requests: Request[]): typeof fetch {
  return Object.assign(async (input: string | URL | Request, init?: RequestInit) => {
    requests.push(new Request(input, init));
    const response = responses.shift();
    if (!response) throw new Error("unexpected request");
    return response;
  }, { preconnect: () => {} }) as typeof fetch;
}

function testCandidateAndContents(): void {
  assert(selectReleaseCandidate([]) === null, "no candidate must be a no-op");
  expectThrows(() => selectReleaseCandidate([candidate(), candidate({ number: 11 })]), "multiple");
  assert(selectReleaseCandidate([candidate()])?.number === 10, "valid candidate should be selected");
  expectThrows(() => selectReleaseCandidate([candidate({ draft: true })]), "draft");
  expectThrows(() => selectReleaseCandidate([candidate({ title: "chore: release latest" })]), "title");
  validateChangedFiles(validFiles());
  expectThrows(() => validateChangedFiles([...validFiles(), { filename: "src/x.ts", status: "modified" }]), "exactly");
  validateReleaseContents(validContents());
  const drift = validContents();
  drift.headPluginManifestText = JSON.stringify({ name: "changed", version: VERSION, description: "plugin" });
  expectThrows(() => validateReleaseContents(drift), "plugin manifest fields");
}

async function testMergeAndNoOp(): Promise<void> {
  const contents = validContents();
  const requests: Request[] = [];
  const responses = [
    jsonResponse([candidate()]),
    jsonResponse(candidate()),
    jsonResponse(validFiles()),
    contentResponse(contents.baseManifestText), contentResponse(contents.headManifestText),
    contentResponse(contents.basePackageText), contentResponse(contents.headPackageText),
    contentResponse(contents.basePluginManifestText), contentResponse(contents.headPluginManifestText),
    contentResponse(contents.baseFallbackManifestText), contentResponse(contents.headFallbackManifestText),
    contentResponse(contents.baseChangelogText), contentResponse(contents.headChangelogText),
    jsonResponse({ ...candidate(), mergeable: null }),
    jsonResponse({ ...candidate(), mergeable: true }),
    jsonResponse({ ref: "refs/heads/main", object: { sha: BASE_SHA } }),
    jsonResponse({ merged: true, sha: "merge-sha" }),
  ];
  const result = await runReleasePrAutoMerge({
    token: "must-not-log",
    expectedBaseSha: BASE_SHA,
    fetchImpl: fakeFetch(responses, requests),
    sleep: async () => {},
  });
  assert(result.status === "merged", "valid release PR should merge");
  const mergeRequest = requests.at(-1);
  assert(mergeRequest?.method === "PUT", "last request must merge");
  const body = JSON.parse(await mergeRequest.text()) as Record<string, unknown>;
  assert(body.sha === HEAD_SHA && body.merge_method === "merge", "merge must pin head SHA and method");
  assert(!JSON.stringify(requests).includes("must-not-log"), "token must not leak into request assertions");

  const noOp = await runReleasePrAutoMerge({ token: "token", expectedBaseSha: BASE_SHA, fetchImpl: fakeFetch([jsonResponse([])], []) });
  assert(noOp.status === "no-op", "missing release PR must be a no-op");
}

async function testFailureGuards(): Promise<void> {
  await expectRejects(
    () => runReleasePrAutoMerge({
      token: "token",
      expectedBaseSha: BASE_SHA,
      fetchImpl: async () => new Response("server error", { status: 500 }),
    }),
    "status 500",
  );
  await expectRejects(
    () => runReleasePrAutoMerge({
      token: "token",
      expectedBaseSha: BASE_SHA,
      fetchImpl: async () => new Response("not-json", { status: 200 }),
    }),
    "valid JSON",
  );

  const staleRequests: Request[] = [];
  await expectRejects(
    () => runReleasePrAutoMerge({
      token: "token",
      expectedBaseSha: "newer-ci-sha",
      fetchImpl: fakeFetch([
        jsonResponse([candidate({ base: { ref: "main", sha: BASE_SHA, repo: { full_name: "jurislm/woodpecker-ci-plugin" } } })]),
        jsonResponse(candidate({ base: { ref: "main", sha: BASE_SHA, repo: { full_name: "jurislm/woodpecker-ci-plugin" } } })),
        jsonResponse({ status: "behind" }),
      ], staleRequests),
    }),
    "base SHA",
  );
  assert(!staleRequests.some((request) => request.method === "PUT"), "stale release PR must not merge");

  const contents = validContents();
  const blockedRequests: Request[] = [];
  const blockedResponses = [
    jsonResponse([candidate()]), jsonResponse(candidate()), jsonResponse(validFiles()),
    contentResponse(contents.baseManifestText), contentResponse(contents.headManifestText),
    contentResponse(contents.basePackageText), contentResponse(contents.headPackageText),
    contentResponse(contents.basePluginManifestText), contentResponse(contents.headPluginManifestText),
    contentResponse(contents.baseFallbackManifestText), contentResponse(contents.headFallbackManifestText),
    contentResponse(contents.baseChangelogText), contentResponse(contents.headChangelogText),
    jsonResponse({ ...candidate(), mergeable: false }),
  ];
  await expectRejects(
    () => runReleasePrAutoMerge({ token: "token", expectedBaseSha: BASE_SHA, fetchImpl: fakeFetch(blockedResponses, blockedRequests) }),
    "not mergeable",
  );
  assert(!blockedRequests.some((request) => request.method === "PUT"), "blocked release PR must not merge");

  const logs: string[] = [];
  await runReleasePrAutoMerge({
    token: "secret-must-not-log",
    expectedBaseSha: BASE_SHA,
    fetchImpl: fakeFetch([jsonResponse([])], []),
    logger: { log: (message) => logs.push(message), error: (message) => logs.push(message) },
  });
  assert(!logs.join("\n").includes("secret-must-not-log"), "logs must not contain the token");
}

testCandidateAndContents();
await testMergeAndNoOp();
await testFailureGuards();
console.log("release PR auto-merge tests passed");
