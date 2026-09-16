#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import YAML from "yaml";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function readWorkflow(path: string): Promise<Record<string, any>> {
  return YAML.parse(await readFile(path, "utf8")) as Record<string, any>;
}

const release = await readWorkflow(".woodpecker/release.yml");
const autoMerge = await readWorkflow(".woodpecker/release-pr-auto-merge.yml");
const npmRelease = await readWorkflow(".woodpecker/npm-release.yml");
const ci = await readWorkflow(".woodpecker/ci.yml");
const ciSteps = Array.isArray(ci.steps) ? ci.steps : Object.values(ci.steps ?? {});

assert(ci.when?.some((entry: any) => entry.event === "pull_request"), "ci must run on pull requests");
assert(ciSteps.every((step: any) => !step.environment?.GITHUB_API_TOKEN && !step.environment?.NPM_TOKEN), "ci must not receive release secrets");

assert(release.when?.[0]?.event === "push", "release must trigger on push");
assert(release.when?.[0]?.branch === "main", "release must target main pushes");
assert(release.steps?.[0]?.name === "github-release", "release must run github-release first");
assert(release.steps?.[1]?.name === "release-pr", "release must run release-pr second");
assert(release.steps?.[1]?.depends_on?.includes("github-release"), "release-pr must depend on github-release");
assert(release.steps?.every((step: any) => !step.environment?.NPM_TOKEN), "release must not receive npm token");

assert(autoMerge.when?.[0]?.event === "push", "auto-merge must trigger on push");
assert(autoMerge.when?.[0]?.branch === "main", "auto-merge must target main pushes");
assert(autoMerge.depends_on?.includes("ci"), "auto-merge must depend on ci");
assert(autoMerge.depends_on?.includes("release"), "auto-merge must depend on release");
assert(autoMerge.concurrency?.limit === 1, "auto-merge must be serialized");
assert(autoMerge.steps?.[0]?.environment?.GITHUB_API_TOKEN?.from_secret, "auto-merge must use a GitHub secret");

assert(npmRelease.when?.[0]?.event === "tag", "npm release must trigger on tags");
assert(npmRelease.steps?.[1]?.environment?.NPM_TOKEN?.from_secret === "npm_token", "npm release must use npm_token");
assert(npmRelease.steps?.[0]?.commands?.some((command: string) => command.includes("check-release-tag")), "npm release must validate the tag");

console.log("release workflow contracts passed");
