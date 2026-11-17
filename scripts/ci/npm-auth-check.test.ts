import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";

test("auth check uses temporary credentials and never publishes", () => {
  const dir = mkdtempSync(join(tmpdir(), "npm-auth-test-"));
  try {
    mkdirSync(join(dir, "bin"));
    const record = join(dir, "record");
    writeFileSync(join(dir, "bin", "npm"), '#!/bin/sh\nprintf "%s\\n" "$*" > "$RECORD"\nprintf "%s\\n" "$NPM_CONFIG_USERCONFIG" >> "$RECORD"\ntest -f "$NPM_CONFIG_USERCONFIG" || exit 3\nprintf "terry.ty\\n"\n', { mode: 0o700 });
    const result = Bun.spawnSync(["sh", "scripts/ci/npm-auth-check.sh"], {
      env: { ...process.env, PATH: `${dir}/bin:${process.env.PATH}`, NPM_TOKEN: "test-only-not-a-real-secret", RECORD: record },
    });
    expect(result.exitCode).toBe(0);
    const output = `${result.stdout}${result.stderr}`;
    expect(output).not.toContain("test-only-not-a-real-secret");
    const [command, config] = readFileSync(record, "utf8").trim().split("\n");
    expect(command).toBe("whoami --registry=https://registry.npmjs.org/ --loglevel=error");
    expect(existsSync(config)).toBe(false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test.each(["wrong-identity", "registry-failure"])("auth check rejects %s and clears credentials", (mode) => {
  const dir = mkdtempSync(join(tmpdir(), "npm-auth-failure-"));
  try {
    mkdirSync(join(dir, "bin"));
    const record = join(dir, "record");
    writeFileSync(join(dir, "bin", "npm"), '#!/bin/sh\nprintf "%s\\n" "$NPM_CONFIG_USERCONFIG" > "$RECORD"\nif test "$MODE" = registry-failure; then printf "%s" "$NPM_TOKEN" >&2; exit 17; fi\nprintf "unexpected-account\\n"\n', { mode: 0o700 });
    const result = Bun.spawnSync(["sh", "scripts/ci/npm-auth-check.sh"], {
      env: { ...process.env, PATH: `${dir}/bin:${process.env.PATH}`, NPM_TOKEN: "test-only-not-a-real-secret", RECORD: record, MODE: mode },
    });
    expect(result.exitCode).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).not.toContain("test-only-not-a-real-secret");
    expect(existsSync(readFileSync(record, "utf8").trim())).toBe(false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("auth check fails closed without a token", () => {
  const result = Bun.spawnSync(["sh", "scripts/ci/npm-auth-check.sh"], { env: { PATH: process.env.PATH, NPM_TOKEN: "" } });
  expect(result.exitCode).not.toBe(0);
});


test("workflow is manual main only and consumes the existing secret", () => {
  const workflow = parse(readFileSync(".woodpecker/npm-auth.yml", "utf8"));
  expect(workflow.when).toEqual([{ event: "manual", branch: "main" }]);
  expect(workflow.steps).toHaveLength(1);
  expect(workflow.steps[0].environment).toEqual({ NPM_TOKEN: { from_secret: "npm_token" } });
  expect(workflow.steps[0].commands).toEqual(["sh scripts/ci/npm-auth-check.sh"]);
  expect(parse(readFileSync(".woodpecker/npm-release.yml", "utf8")).when).toEqual([{ event: "tag" }]);
});

test("cancellation cannot report authentication success", async () => {
  const dir = mkdtempSync(join(tmpdir(), "npm-auth-cancel-"));
  let child: Bun.Subprocess<"ignore", "pipe", "pipe"> | undefined;
  try {
    mkdirSync(join(dir, "bin"));
    const record = join(dir, "record");
    writeFileSync(join(dir, "bin", "npm"), '#!/bin/sh\nprintf "%s" "$NPM_CONFIG_USERCONFIG" > "$RECORD"\nwhile ! test -f "$RELEASE"; do sleep 0.01; done\nprintf "terry.ty\\n"\n', { mode: 0o700 });
    child = Bun.spawn(["sh", "scripts/ci/npm-auth-check.sh"], {
      env: { PATH: `${dir}/bin:/usr/bin:/bin`, NPM_TOKEN: "test-only-not-a-real-secret", RECORD: record, RELEASE: join(dir, "release") },
      stdin: "ignore", stdout: "pipe", stderr: "pipe",
    });
    for (let attempt = 0; attempt < 100 && !existsSync(record); attempt++) await Bun.sleep(10);
    expect(existsSync(record)).toBe(true);
    await Bun.sleep(1500);
    child.kill("SIGTERM");
    writeFileSync(join(dir, "release"), "");
    expect(await child.exited).not.toBe(0);
    expect(await new Response(child.stdout).text()).not.toContain("authentication verified");
    expect(existsSync(readFileSync(record, "utf8"))).toBe(false);
  } finally {
    if (child) {
      child.kill("SIGTERM");
      writeFileSync(join(dir, "release"), "");
      await child.exited;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
