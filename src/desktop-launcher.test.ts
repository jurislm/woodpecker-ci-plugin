import { expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

function prepareRuntime(home: string) {
  const runtime = join(home, ".local/share/jurislm/mcp/woodpecker-ci-plugin");
  const installed = join(runtime, "node_modules/@jurislm/woodpecker-ci-plugin");
  mkdirSync(join(installed, "dist"), { recursive: true });
  mkdirSync(join(runtime, "node_modules/.bin"), { recursive: true });
  const dependencies = { "@jurislm/woodpecker-ci-plugin": "2.1.1" };
  writeFileSync(join(runtime, "package.json"), JSON.stringify({ dependencies }));
  writeFileSync(join(runtime, "bun.lock"), JSON.stringify({ workspaces: { "": { dependencies } }, packages: { "@jurislm/woodpecker-ci-plugin": ["@jurislm/woodpecker-ci-plugin@2.1.1", "", {}, "sha512-fixture"] } }));
  writeFileSync(join(installed, "package.json"), JSON.stringify({ name: "@jurislm/woodpecker-ci-plugin", version: "2.1.1", bin: { "woodpecker-ci-plugin": "dist/index.js" } }));
  writeFileSync(join(installed, "dist/index.js"), "");
  symlinkSync("../@jurislm/woodpecker-ci-plugin/dist/index.js", join(runtime, "node_modules/.bin/woodpecker-ci-plugin"));
  symlinkSync(process.execPath, join(home, ".bun/bin/real-bun"));
}

function runLauncher(startup: string, url?: string) {
  const home = mkdtempSync(join(tmpdir(), "woodpecker-desktop-"));
  try {
    const bin = join(home, ".bun/bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(home, ".zshenv"), startup);
    prepareRuntime(home);
    const executable = join(bin, "bun");
    writeFileSync(executable, '#!/bin/sh\n[ "$WOODPECKER_API_TOKEN" = fixture-token ] || exit 11\n[ "$WOODPECKER_URL" = https://ci.example.com/api ] || exit 12\n[ -z "${UNRELATED_SECRET+x}" ] || exit 13\n[ -z "${PARENT_SECRET+x}" ] || exit 14\n[ -z "${SSH_AUTH_SOCK+x}" ] || exit 15\n[ "$1" = --no-env-file ] || exit 16\n[ "$2" = --no-install ] || exit 17\ncase "$3" in */validate-woodpecker-runtime.mjs) exec "$HOME/.bun/bin/real-bun" "$@" ;; esac\n[ "$3" = "$HOME/.local/share/jurislm/mcp/woodpecker-ci-plugin/node_modules/@jurislm/woodpecker-ci-plugin/dist/index.js" ] || exit 18\ncat\n');
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

test("desktop launcher accepts a benign optional-file guard after credentials are set", () => {
  const result = runLauncher('export WOODPECKER_API_TOKEN=fixture-token\n[[ -f "$HOME/absent" ]] && source "$HOME/absent"\n', "https://ci.example.com/api");
  expect(result.code).toBe(0);
  expect(result.stdout).toBe('{"jsonrpc":"2.0"}\n');
});

test("desktop launcher rejects syntax errors before loading credentials", () => {
  const result = runLauncher("export WOODPECKER_API_TOKEN=fixture-token\nif true; then\n", "https://ci.example.com/api");
  expect(result.code).not.toBe(0);
  expect(result.stdout).toBe("");
  expect(result.stderr).not.toContain("fixture-token");
});
