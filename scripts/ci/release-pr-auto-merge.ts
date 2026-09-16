#!/usr/bin/env bun
import { ciMetadataValue } from "./ci-metadata";

const REPOSITORY = "jurislm/woodpecker-ci-plugin";
const BASE_BRANCH = "main";
const RELEASE_BRANCH = "release-please--branches--main--components--woodpecker-ci-plugin";
const RELEASE_AUTHOR = "terry90918";
const RELEASE_BODY_START = ":robot: I have created a release *beep* *boop*";
const RELEASE_BODY_FOOTER =
  "This PR was generated with [Release Please](https://github.com/googleapis/release-please).";
const RELEASE_TITLE = /^chore\(main\): release ((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/;
const RELEASE_FILES = [
  ".release-please-manifest.json",
  "CHANGELOG.md",
  "package.json",
  "plugin.json",
  ".codex-plugin/plugin.json",
] as const;
const GITHUB_API = "https://api.github.com";
const DEFAULT_MERGEABLE_ATTEMPTS = 6;
const DEFAULT_POLL_DELAY_MS = 5_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface Logger {
  log(message: string): void;
  error(message: string): void;
}

export interface AutoMergeOptions {
  token: string;
  expectedBaseSha?: string;
  fetchImpl?: FetchLike;
  sleep?: (milliseconds: number) => Promise<void>;
  maxMergeableAttempts?: number;
  pollDelayMs?: number;
  requestTimeoutMs?: number;
  logger?: Logger;
  apiBaseUrl?: string;
  candidatePullNumber?: number;
  dryRun?: boolean;
}

export type AutoMergeResult =
  | { status: "no-op" }
  | { status: "validated"; pullNumber: number }
  | { status: "merged"; pullNumber: number; mergeSha: string };

export interface ReleaseCandidate {
  number: number;
  version: string;
  baseSha: string;
  headSha: string;
}

export interface ReleaseContents {
  version: string;
  baseManifestText: string;
  headManifestText: string;
  basePackageText: string;
  headPackageText: string;
  basePluginManifestText: string;
  headPluginManifestText: string;
  baseFallbackManifestText: string;
  headFallbackManifestText: string;
  baseChangelogText: string;
  headChangelogText: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`invalid release PR shape: ${label}`);
  return value;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`invalid release PR shape: ${label}`);
  }
  return value;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

function equalJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function parseJsonObject(text: string, label: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  if (!isRecord(value)) throw new Error(`${label} JSON must be an object`);
  return value;
}

function isVersionGreater(target: string, base: string): boolean {
  const parse = (version: string): [number, number, number] | null => {
    const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
    if (!match) return null;
    const parts = match.slice(1).map(Number);
    return parts.length === 3 && parts.every(Number.isSafeInteger) ? parts as [number, number, number] : null;
  };
  const targetParts = parse(target);
  const baseParts = parse(base);
  if (!targetParts || !baseParts) return false;
  for (let index = 0; index < 3; index += 1) {
    if (targetParts[index]! > baseParts[index]!) return true;
    if (targetParts[index]! < baseParts[index]!) return false;
  }
  return false;
}

export function selectReleaseCandidate(
  value: unknown,
  options: { allowClosed?: boolean } = {},
): ReleaseCandidate | null {
  if (!Array.isArray(value)) throw new Error("release PR response must be an array");
  if (value.length === 0) return null;
  if (value.length !== 1) throw new Error("multiple release PR candidates found");
  const pull = requiredRecord(value[0], "pull request");
  if (!Number.isSafeInteger(pull.number) || (pull.number as number) <= 0) throw new Error("invalid release PR shape: number");
  const state = requiredString(pull.state, "state");
  if (state !== "open" && !options.allowClosed) throw new Error("release PR candidate is not open");
  if (typeof pull.draft !== "boolean") throw new Error("invalid release PR shape: draft");
  if (pull.draft) throw new Error("release PR candidate is a draft");
  const title = requiredString(pull.title, "title");
  const titleMatch = RELEASE_TITLE.exec(title);
  if (!titleMatch) throw new Error("release PR title is not an exact release title");
  const body = requiredString(pull.body, "body");
  if (!body.startsWith(RELEASE_BODY_START) || !body.includes(RELEASE_BODY_FOOTER)) {
    throw new Error("release PR body is missing the official release-please markers");
  }
  const user = requiredRecord(pull.user, "user");
  if (user.login !== RELEASE_AUTHOR) throw new Error("release PR author is not allowed");
  const base = requiredRecord(pull.base, "base");
  const baseRepo = requiredRecord(base.repo, "base.repo");
  if (baseRepo.full_name !== REPOSITORY) throw new Error("release PR base repository mismatch");
  if (base.ref !== BASE_BRANCH) throw new Error("release PR base branch mismatch");
  const head = requiredRecord(pull.head, "head");
  const headRepo = requiredRecord(head.repo, "head.repo");
  if (headRepo.full_name !== REPOSITORY) throw new Error("release PR head repository mismatch");
  if (head.ref !== RELEASE_BRANCH) throw new Error("release PR head branch mismatch");
  return {
    number: pull.number as number,
    version: titleMatch[1]!,
    baseSha: requiredString(base.sha, "base.sha"),
    headSha: requiredString(head.sha, "head.sha"),
  };
}

export function validateChangedFiles(value: unknown): void {
  if (!Array.isArray(value)) throw new Error("release PR files response must be an array");
  if (value.length !== RELEASE_FILES.length) throw new Error("release PR must change exactly the five allowed files");
  const filenames = value.map((entry, index) => {
    const file = requiredRecord(entry, `files[${index}]`);
    const filename = requiredString(file.filename, `files[${index}].filename`);
    if (file.status !== "modified") throw new Error(`${filename} must be modified, not added or deleted`);
    return filename;
  }).sort();
  if (filenames.join("\n") !== [...RELEASE_FILES].sort().join("\n")) {
    throw new Error("release PR must change exactly the five allowed files");
  }
}

function validateVersionOnly(baseText: string, headText: string, version: string, label: string): void {
  const base = parseJsonObject(baseText, `base ${label}`);
  const head = parseJsonObject(headText, `head ${label}`);
  if (head.version !== version) throw new Error(`${label} version does not match the release PR title`);
  const baseWithoutVersion = { ...base };
  const headWithoutVersion = { ...head };
  delete baseWithoutVersion.version;
  delete headWithoutVersion.version;
  if (!equalJson(baseWithoutVersion, headWithoutVersion)) throw new Error(`${label} fields changed`);
}

export function validateReleaseContents(contents: ReleaseContents): void {
  const baseManifest = parseJsonObject(contents.baseManifestText, "base manifest");
  const headManifest = parseJsonObject(contents.headManifestText, "head manifest");
  const baseVersion = baseManifest["."];
  if (typeof baseVersion !== "string" || !isVersionGreater(contents.version, baseVersion)) {
    throw new Error("manifest base version must be an earlier version");
  }
  if (headManifest["."] !== contents.version) throw new Error("manifest version does not match the release PR title");
  const baseManifestWithoutVersion = { ...baseManifest };
  const headManifestWithoutVersion = { ...headManifest };
  delete baseManifestWithoutVersion["."];
  delete headManifestWithoutVersion["."];
  if (!equalJson(baseManifestWithoutVersion, headManifestWithoutVersion)) throw new Error("manifest fields changed");
  validateVersionOnly(contents.basePackageText, contents.headPackageText, contents.version, "package");
  validateVersionOnly(contents.basePluginManifestText, contents.headPluginManifestText, contents.version, "plugin manifest");
  validateVersionOnly(contents.baseFallbackManifestText, contents.headFallbackManifestText, contents.version, "fallback plugin manifest");
  const prefix = "# Changelog\n\n";
  if (!contents.baseChangelogText.startsWith(prefix) || !contents.headChangelogText.startsWith(prefix)) {
    throw new Error("CHANGELOG must preserve the standard header");
  }
  const baseHistory = contents.baseChangelogText.slice(prefix.length);
  const headHistory = contents.headChangelogText.slice(prefix.length);
  const firstReleaseHeading = baseHistory.indexOf("## [");
  if (firstReleaseHeading < 0) throw new Error("CHANGELOG must preserve all existing release history");
  const changelogPreamble = baseHistory.slice(0, firstReleaseHeading);
  const baseReleaseHistory = baseHistory.slice(firstReleaseHeading);
  if (!headHistory.startsWith(changelogPreamble)) throw new Error("CHANGELOG preamble changed");
  const headAfterPreamble = headHistory.slice(changelogPreamble.length);
  if (!headAfterPreamble.endsWith(baseReleaseHistory)) throw new Error("CHANGELOG must preserve all existing release history");
  if (!headAfterPreamble.slice(0, headAfterPreamble.length - baseReleaseHistory.length).startsWith(`## [${contents.version}](`)) {
    throw new Error("CHANGELOG must prepend the title version heading");
  }
}

function positiveInteger(value: number | undefined, fallback: number, label: string): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved <= 0) throw new Error(`${label} must be a positive integer`);
  return resolved;
}

function nonNegativeInteger(value: number | undefined, fallback: number, label: string): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < 0) throw new Error(`${label} must be a non-negative integer`);
  return resolved;
}

function contentText(value: unknown, label: string): string {
  const content = requiredRecord(value, label);
  if (content.type !== "file" || content.encoding !== "base64") throw new Error(`${label} is not a base64 file response`);
  const encoded = requiredString(content.content, `${label}.content`).replaceAll("\n", "");
  if (Buffer.from(encoded, "base64").toString("base64") !== encoded) throw new Error(`${label} content is not valid base64`);
  return Buffer.from(encoded, "base64").toString("utf8");
}

export async function runReleasePrAutoMerge(options: AutoMergeOptions): Promise<AutoMergeResult> {
  if (!options.token) throw new Error("GITHUB_API_TOKEN is required");
  if (!options.dryRun && !options.expectedBaseSha) throw new Error("CI commit SHA is required for a mutating release PR auto-merge");
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((milliseconds: number) => Bun.sleep(milliseconds));
  const logger = options.logger ?? console;
  const apiBaseUrl = (options.apiBaseUrl ?? GITHUB_API).replace(/\/$/u, "");
  const maxAttempts = positiveInteger(options.maxMergeableAttempts, DEFAULT_MERGEABLE_ATTEMPTS, "maxMergeableAttempts");
  const pollDelayMs = nonNegativeInteger(options.pollDelayMs, DEFAULT_POLL_DELAY_MS, "pollDelayMs");
  const requestTimeoutMs = positiveInteger(options.requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS, "requestTimeoutMs");

  async function githubRequest(path: string, init: RequestInit = {}): Promise<unknown> {
    const method = init.method ?? "GET";
    const signal = AbortSignal.timeout(requestTimeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(`${apiBaseUrl}${path}`, {
        ...init,
        signal,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${options.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
          ...init.headers,
        },
      });
    } catch {
      throw new Error(`GitHub API ${method} ${path.split("?")[0]} request failed`);
    }
    const text = await response.text();
    if (!response.ok) throw new Error(`GitHub API ${method} ${path.split("?")[0]} failed with status ${response.status}`);
    try { return JSON.parse(text) as unknown; } catch { throw new Error(`GitHub API ${method} ${path.split("?")[0]} did not return valid JSON`); }
  }

  async function compareCommits(base: string, head: string): Promise<string> {
    const value = requiredRecord(await githubRequest(`/repos/${REPOSITORY}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}?per_page=1`), "commit comparison");
    return requiredString(value.status, "commit comparison status");
  }

  async function mainSha(): Promise<string> {
    const value = requiredRecord(await githubRequest(`/repos/${REPOSITORY}/git/ref/heads/${BASE_BRANCH}`), "base branch ref");
    return requiredString(requiredRecord(value.object, "base branch ref.object").sha, "base branch ref.object.sha");
  }

  const candidatePullNumber = options.candidatePullNumber;
  const query = new URLSearchParams({ state: "open", base: BASE_BRANCH, head: `jurislm:${RELEASE_BRANCH}`, per_page: "100" });
  const candidateValue = candidatePullNumber === undefined
    ? await githubRequest(`/repos/${REPOSITORY}/pulls?${query.toString()}`)
    : [await githubRequest(`/repos/${REPOSITORY}/pulls/${candidatePullNumber}`)];
  const candidate = selectReleaseCandidate(candidateValue, { allowClosed: options.dryRun && candidatePullNumber !== undefined });
  if (!candidate) { logger.log("No open release-please Release PR found; nothing to merge."); return { status: "no-op" }; }

  const detailValue = await githubRequest(`/repos/${REPOSITORY}/pulls/${candidate.number}`);
  const detail = selectReleaseCandidate([detailValue], { allowClosed: options.dryRun && candidatePullNumber !== undefined });
  if (!detail || detail.headSha !== candidate.headSha || detail.baseSha !== candidate.baseSha) throw new Error("release PR changed before content validation");
  if (!options.dryRun && options.expectedBaseSha && detail.baseSha !== options.expectedBaseSha) {
    const relation = await compareCommits(options.expectedBaseSha, detail.baseSha);
    if (relation === "ahead") { logger.log(`Release PR is based on a newer build; yielding to ${detail.baseSha}.`); return { status: "no-op" }; }
    throw new Error(`release PR base SHA does not match CI commit (pr=${detail.baseSha}, ci=${options.expectedBaseSha}, relation=${relation})`);
  }

  const detailRecord = requiredRecord(detailValue, "pull request detail");
  const changedFileCount = detailRecord.changed_files;
  if (!Number.isSafeInteger(changedFileCount) || (changedFileCount as number) <= 0 || (changedFileCount as number) > 3000) throw new Error("invalid release PR shape: changed_files");
  const changedFiles: unknown[] = [];
  for (let page = 1; changedFiles.length < (changedFileCount as number); page += 1) {
    const value = await githubRequest(`/repos/${REPOSITORY}/pulls/${detail.number}/files?per_page=100&page=${page}`);
    if (!Array.isArray(value) || value.length === 0 || value.length > 100) throw new Error("release PR files pagination is incomplete");
    changedFiles.push(...value);
  }
  if (changedFiles.length !== changedFileCount) throw new Error("release PR files count does not match changed_files");
  validateChangedFiles(changedFiles);

  async function getFile(path: string, ref: string): Promise<string> {
    return contentText(await githubRequest(`/repos/${REPOSITORY}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`), `${path}@${ref}`);
  }
  const files = await Promise.all([
    getFile(".release-please-manifest.json", detail.baseSha), getFile(".release-please-manifest.json", detail.headSha),
    getFile("package.json", detail.baseSha), getFile("package.json", detail.headSha),
    getFile("plugin.json", detail.baseSha), getFile("plugin.json", detail.headSha),
    getFile(".codex-plugin/plugin.json", detail.baseSha), getFile(".codex-plugin/plugin.json", detail.headSha),
    getFile("CHANGELOG.md", detail.baseSha), getFile("CHANGELOG.md", detail.headSha),
  ]);
  validateReleaseContents({
    version: detail.version,
    baseManifestText: files[0]!, headManifestText: files[1]!,
    basePackageText: files[2]!, headPackageText: files[3]!,
    basePluginManifestText: files[4]!, headPluginManifestText: files[5]!,
    baseFallbackManifestText: files[6]!, headFallbackManifestText: files[7]!,
    baseChangelogText: files[8]!, headChangelogText: files[9]!,
  });
  if (options.dryRun) return { status: "validated", pullNumber: detail.number };

  let mergeable = false;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const currentValue = await githubRequest(`/repos/${REPOSITORY}/pulls/${detail.number}`);
    const current = selectReleaseCandidate([currentValue]);
    if (!current || current.headSha !== detail.headSha || current.baseSha !== detail.baseSha) throw new Error("release PR changed during mergeability check");
    const mergeableValue = requiredRecord(currentValue, "pull request detail").mergeable;
    if (mergeableValue === true) { mergeable = true; break; }
    if (mergeableValue === false) throw new Error("release PR is not mergeable");
    if (mergeableValue !== null) throw new Error("invalid release PR shape: mergeable");
    if (attempt < maxAttempts) await sleep(pollDelayMs);
  }
  if (!mergeable) throw new Error("release PR mergeability check timed out");
  if (await mainSha() !== options.expectedBaseSha) { logger.log("main advanced during validation; yielding to newer build."); return { status: "no-op" }; }

  const merged = requiredRecord(await githubRequest(`/repos/${REPOSITORY}/pulls/${detail.number}/merge`, {
    method: "PUT",
    body: JSON.stringify({ sha: detail.headSha, merge_method: "merge" }),
  }), "merge response");
  if (merged.merged !== true) throw new Error("GitHub merge response did not confirm a merge");
  return { status: "merged", pullNumber: detail.number, mergeSha: requiredString(merged.sha, "merge response sha") };
}

if (import.meta.main) {
  const token = process.env.GITHUB_API_TOKEN;
  if (!token) throw new Error("GITHUB_API_TOKEN is required");
  const dryRunArgument = process.argv.find((argument) => argument.startsWith("--dry-run-pr="));
  await runReleasePrAutoMerge({
    token,
    expectedBaseSha: ciMetadataValue("CI_COMMIT_SHA"),
    candidatePullNumber: dryRunArgument ? Number(dryRunArgument.slice("--dry-run-pr=".length)) : undefined,
    dryRun: Boolean(dryRunArgument),
  });
}
