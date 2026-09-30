import { expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

function runLauncher(startup: string, url?: string) {
  const home = mkdtempSync(join(tmpdir(), "woodpecker-desktop-"));
  try {
    const bin = join(home, ".bun/bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(home, ".zshenv"), startup);
    const executable = join(bin, "bunx");
    writeFileSync(executable, '#!/bin/sh\n[ "$WOODPECKER_API_TOKEN" = fixture-token ] || exit 11\n[ "$WOODPECKER_URL" = https://ci.example.com/api ] || exit 12\n[ -z "${UNRELATED_SECRET+x}" ] || exit 13\n[ -z "${PARENT_SECRET+x}" ] || exit 14\n[ -z "${SSH_AUTH_SOCK+x}" ] || exit 15\n[ "$1" = -y ] || exit 16\n[ "$2" = @jurislm/woodpecker-ci-plugin@latest ] || exit 17\ncat\n');
    chmodSync(executable, 0o700);
    const result = Bun.spawnSync(["/bin/zsh", "-f", resolve("launchers/woodpecker-desktop.zsh")], {
      env: { HOME: home, ZDOTDIR: home, PATH: "/usr/bin:/bin", PARENT_SECRET: "fixture-parent", SSH_AUTH_SOCK: "/fixture-agent", ...(url ? { WOODPECKER_URL: url } : {}) },
      stdin: Buffer.from('{"jsonrpc":"2.0"}\n'), stdout: "pipe", stderr: "pipe",
    });
    return { code: result.exitCode, stdout: new TextDecoder().decode(result.stdout), stderr: new TextDecoder().decode(result.stderr) };
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

test("desktop launcher loads its token, keeps the host URL and protects stdio", () => {
  const result = runLauncher("print -r -- startup-banner\nprint -u2 -- startup-diagnostic\nexport WOODPECKER_API_TOKEN=fixture-token\nexport UNRELATED_SECRET=fixture-secret\n", "https://ci.example.com/api");
  expect(result).toEqual({ code: 0, stdout: '{"jsonrpc":"2.0"}\n', stderr: "startup-diagnostic\n" });
});

test("desktop launcher reports missing settings without starting the provider", () => {
  const token = runLauncher("", "https://ci.example.com/api");
  expect(token.code).toBe(1);
  expect(token.stdout).toBe("");
  expect(token.stderr).toContain("WOODPECKER_API_TOKEN is required");
  const url = runLauncher("export WOODPECKER_API_TOKEN=fixture-token\n");
  expect(url.code).toBe(1);
  expect(url.stdout).toBe("");
  expect(url.stderr).toContain("WOODPECKER_URL is required");
  expect(url.stderr).not.toContain("fixture-token");
});

test("desktop launcher stops when the explicitly sourced startup file fails", () => {
  const result = runLauncher("export WOODPECKER_API_TOKEN=fixture-token\nreturn 12\n", "https://ci.example.com/api");
  expect(result.code).toBe(12);
  expect(result.stdout).toBe("");
});
