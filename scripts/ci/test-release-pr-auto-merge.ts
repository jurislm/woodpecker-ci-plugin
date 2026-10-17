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
  const changelogPreamble = "All notable changes to this project will be documented in this file.\n\n";
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
    baseChangelogText: `# Changelog\n\n${changelogPreamble}${oldHistory}`,
    headChangelogText: `# Changelog\n\n${changelogPreamble}${newBlock}${oldHistory}`,
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
    jsonResponse({ state: "success", statuses: [
      { context: "ci/woodpecker/push/ci", state: "success" },
      { context: "ci/woodpecker/pr/ci", state: "success" },
    ] }),
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
        jsonResponse({ status: "diverged" }),
      ], staleRequests),
    }),
    "base SHA",
  );
  assert(!staleRequests.some((request) => request.method === "PUT"), "diverged release PR must not be updated or merged");

  const contents = validContents();
  const blockedRequests: Request[] = [];
  const blockedResponses = [
    jsonResponse([candidate()]), jsonResponse(candidate()), jsonResponse(validFiles()),
    contentResponse(contents.baseManifestText), contentResponse(contents.headManifestText),
    contentResponse(contents.basePackageText), contentResponse(contents.headPackageText),
    contentResponse(contents.basePluginManifestText), contentResponse(contents.headPluginManifestText),
    contentResponse(contents.baseFallbackManifestText), contentResponse(contents.headFallbackManifestText),
    contentResponse(contents.baseChangelogText), contentResponse(contents.headChangelogText),
    jsonResponse({ state: "success", statuses: [
      { context: "ci/woodpecker/push/ci", state: "success" },
      { context: "ci/woodpecker/pr/ci", state: "success" },
    ] }),
    jsonResponse({ ...candidate(), mergeable: false }),
  ];
  await expectRejects(
    () => runReleasePrAutoMerge({ token: "token", expectedBaseSha: BASE_SHA, fetchImpl: fakeFetch(blockedResponses, blockedRequests) }),
    "not mergeable",
  );
  assert(!blockedRequests.some((request) => request.method === "PUT"), "blocked release PR must not merge");

  const failedChecksRequests: Request[] = [];
  const failedChecksResponses = [
    jsonResponse([candidate()]), jsonResponse(candidate()), jsonResponse(validFiles()),
    contentResponse(contents.baseManifestText), contentResponse(contents.headManifestText),
    contentResponse(contents.basePackageText), contentResponse(contents.headPackageText),
    contentResponse(contents.basePluginManifestText), contentResponse(contents.headPluginManifestText),
    contentResponse(contents.baseFallbackManifestText), contentResponse(contents.headFallbackManifestText),
    contentResponse(contents.baseChangelogText), contentResponse(contents.headChangelogText),
    jsonResponse({ state: "failure", statuses: [
      { context: "ci/woodpecker/push/ci", state: "failure" },
      { context: "ci/woodpecker/pr/ci", state: "success" },
    ] }),
  ];
  await expectRejects(
    () => runReleasePrAutoMerge({ token: "token", expectedBaseSha: BASE_SHA, fetchImpl: fakeFetch(failedChecksResponses, failedChecksRequests) }),
    "required checks",
  );
  assert(!failedChecksRequests.some((request) => request.method === "PUT"), "failed required checks must not merge");

  const slowChecksRequests: Request[] = [];
  const pendingChecks = { state: "pending", statuses: [
    { context: "ci/woodpecker/push/ci", state: "pending" },
    { context: "ci/woodpecker/pr/ci", state: "pending" },
  ] };
  const slowChecksResponses = [
    jsonResponse([candidate()]), jsonResponse(candidate()), jsonResponse(validFiles()),
    contentResponse(contents.baseManifestText), contentResponse(contents.headManifestText),
    contentResponse(contents.basePackageText), contentResponse(contents.headPackageText),
    contentResponse(contents.basePluginManifestText), contentResponse(contents.headPluginManifestText),
    contentResponse(contents.baseFallbackManifestText), contentResponse(contents.headFallbackManifestText),
    contentResponse(contents.baseChangelogText), contentResponse(contents.headChangelogText),
    ...Array.from({ length: 12 }, () => jsonResponse(pendingChecks)),
    jsonResponse({ state: "success", statuses: [
      { context: "ci/woodpecker/push/ci", state: "success" },
      { context: "ci/woodpecker/pr/ci", state: "success" },
    ] }),
    jsonResponse({ ...candidate(), mergeable: true }),
    jsonResponse({ ref: "refs/heads/main", object: { sha: BASE_SHA } }),
    jsonResponse({ merged: true, sha: "slow-merge-sha" }),
  ];
  const slowChecksResult = await runReleasePrAutoMerge({
    token: "token", expectedBaseSha: BASE_SHA, fetchImpl: fakeFetch(slowChecksResponses, slowChecksRequests), sleep: async () => {},
  });
  assert(slowChecksResult.status === "merged", "slow required checks must eventually merge");

  const logs: string[] = [];
  await runReleasePrAutoMerge({
    token: "secret-must-not-log",
    expectedBaseSha: BASE_SHA,
    fetchImpl: fakeFetch([jsonResponse([])], []),
    logger: { log: (message) => logs.push(message), error: (message) => logs.push(message) },
  });
  assert(!logs.join("\n").includes("secret-must-not-log"), "logs must not contain the token");
}

const CI_SHA = "ci-sha";
const NEW_HEAD_SHA = "new-head-sha";
const GREEN_STATUS = { state: "success", statuses: [
  { context: "ci/woodpecker/push/ci", state: "success" },
  { context: "ci/woodpecker/pr/ci", state: "success" },
] };
const PENDING_STATUS = { state: "pending", statuses: [
  { context: "ci/woodpecker/push/ci", state: "pending" },
  { context: "ci/woodpecker/pr/ci", state: "pending" },
] };

interface FakeRepoOptions {
  prBaseSha?: string;
  compareStatus?: string;
  update?: { headSha: string; baseSha: string } | "never";
  mainSha?: string;
  files?: Array<{ filename: string; status: string }>;
  pendingStatusPolls?: number;
}

function fakeRepo(options: FakeRepoOptions = {}) {
  const contents = validContents();
  const requests: Array<{ method: string; path: string; body: string }> = [];
  const prBaseSha = options.prBaseSha ?? BASE_SHA;
  const withRefs = (baseSha: string, headSha: string) => candidate({
    changed_files: (options.files ?? validFiles()).length,
    base: { ref: "main", sha: baseSha, repo: { full_name: "jurislm/woodpecker-ci-plugin" } },
    head: { ref: RELEASE_BRANCH, sha: headSha, repo: { full_name: "jurislm/woodpecker-ci-plugin" } },
  });
  let current = withRefs(prBaseSha, HEAD_SHA);
  let statusPolls = 0;
  const baseRefs = new Set([BASE_SHA, CI_SHA, "newer-main-sha"]);
  const fileText: Record<string, [string, string]> = {
    ".release-please-manifest.json": [contents.baseManifestText, contents.headManifestText],
    "package.json": [contents.basePackageText, contents.headPackageText],
    "plugin.json": [contents.basePluginManifestText, contents.headPluginManifestText],
    ".codex-plugin/plugin.json": [contents.baseFallbackManifestText, contents.headFallbackManifestText],
    "CHANGELOG.md": [contents.baseChangelogText, contents.headChangelogText],
  };
  const fetchImpl = Object.assign(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const path = url.pathname.replace("/repos/jurislm/woodpecker-ci-plugin", "");
    const body = typeof init?.body === "string" ? init.body : "";
    requests.push({ method, path, body });
    const head = (current.head as { sha: string }).sha;
    if (method === "GET" && path === "/pulls") return jsonResponse([current]);
    if (method === "GET" && path === "/pulls/10") return jsonResponse({ ...current, mergeable: true });
    if (method === "GET" && path.startsWith("/compare/")) return jsonResponse({ status: options.compareStatus ?? "behind" });
    if (method === "PUT" && path === "/pulls/10/update-branch") {
      if ((JSON.parse(body) as Record<string, unknown>).expected_head_sha !== head) return jsonResponse({}, 422);
      if (options.update && options.update !== "never") current = withRefs(options.update.baseSha, options.update.headSha);
      return jsonResponse({ message: "Updating pull request branch." }, 202);
    }
    if (method === "GET" && path === "/pulls/10/files") return jsonResponse(options.files ?? validFiles());
    if (method === "GET" && path.startsWith("/contents/")) {
      const texts = fileText[decodeURIComponent(path.slice("/contents/".length))];
      const ref = url.searchParams.get("ref") ?? "";
      if (!texts) return jsonResponse({}, 404);
      return contentResponse(baseRefs.has(ref) ? texts[0] : texts[1]);
    }
    if (method === "GET" && path === `/commits/${head}/status`) {
      statusPolls += 1;
      return jsonResponse(statusPolls <= (options.pendingStatusPolls ?? 0) ? PENDING_STATUS : GREEN_STATUS);
    }
    if (method === "GET" && path === "/git/ref/heads/main") return jsonResponse({ object: { sha: options.mainSha ?? prBaseSha } });
    if (method === "PUT" && path === "/pulls/10/merge") return jsonResponse({ merged: true, sha: "merge-sha" });
    return jsonResponse({}, 404);
  }, { preconnect: () => {} }) as typeof fetch;
  const merges = () => requests.filter((request) => request.method === "PUT" && request.path.endsWith("/merge"));
  const updates = () => requests.filter((request) => request.method === "PUT" && request.path.endsWith("/update-branch"));
  return { fetchImpl, merges, updates };
}

async function testBehindReleasePr(): Promise<void> {
  const run = (repo: ReturnType<typeof fakeRepo>, maxMergeableAttempts?: number) => runReleasePrAutoMerge({
    token: "token", expectedBaseSha: CI_SHA, fetchImpl: repo.fetchImpl, sleep: async () => {}, maxMergeableAttempts,
  });

  const updated = fakeRepo({ mainSha: CI_SHA, update: { headSha: NEW_HEAD_SHA, baseSha: CI_SHA } });
  const updatedResult = await run(updated);
  assert(updatedResult.status === "merged", "behind release PR must be updated and merged");
  assert(updated.updates().length === 1, "behind release PR must request exactly one branch update");
  assert((JSON.parse(updated.updates()[0]!.body) as Record<string, unknown>).expected_head_sha === HEAD_SHA, "branch update must pin the old head");
  assert((JSON.parse(updated.merges()[0]!.body) as Record<string, unknown>).sha === NEW_HEAD_SHA, "merge must pin the updated head");

  const diverged = fakeRepo({ mainSha: CI_SHA, compareStatus: "diverged", update: { headSha: NEW_HEAD_SHA, baseSha: CI_SHA } });
  await expectRejects(() => run(diverged), "relation=diverged");
  assert(diverged.updates().length === 0 && diverged.merges().length === 0, "diverged release PR must not be updated or merged");

  const stuck = fakeRepo({ mainSha: CI_SHA, update: "never" });
  await expectRejects(() => run(stuck, 3), "branch update");
  assert(stuck.merges().length === 0, "release PR must not merge when the branch update never lands");

  const raced = fakeRepo({ mainSha: "newer-main-sha", update: { headSha: NEW_HEAD_SHA, baseSha: "newer-main-sha" } });
  const racedResult = await run(raced);
  assert(racedResult.status === "no-op" && raced.merges().length === 0, "main advancing during the update must yield");

  const extraFile = fakeRepo({
    mainSha: CI_SHA,
    update: { headSha: NEW_HEAD_SHA, baseSha: CI_SHA },
    files: [...validFiles(), { filename: "src/x.ts", status: "modified" }],
  });
  await expectRejects(() => run(extraFile), "exactly");
  assert(extraFile.merges().length === 0, "updated release PR touching extra files must not merge");

  const slowCi = fakeRepo({ pendingStatusPolls: 119 });
  const slowCiResult = await runReleasePrAutoMerge({ token: "token", expectedBaseSha: BASE_SHA, fetchImpl: slowCi.fetchImpl, sleep: async () => {} });
  assert(slowCiResult.status === "merged", "Woodpecker checks finishing after ten minutes of 5-second polls must still merge");
}

testCandidateAndContents();
await testMergeAndNoOp();
await testFailureGuards();
await testBehindReleasePr();
console.log("release PR auto-merge tests passed");
