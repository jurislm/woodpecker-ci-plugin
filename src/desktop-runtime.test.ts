import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

function fixture(spec = "2.1.1", version = "2.1.1") {
  const root = mkdtempSync(join(tmpdir(), "woodpecker-runtime-"));
  const packageRoot = join(root, "node_modules/@jurislm/woodpecker-ci-plugin");
  mkdirSync(join(packageRoot, "dist"), { recursive: true });
  mkdirSync(join(root, "node_modules/.bin"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ dependencies: { "@jurislm/woodpecker-ci-plugin": spec } }));
  writeFileSync(join(root, "bun.lock"), JSON.stringify({ workspaces: { "": { dependencies: { "@jurislm/woodpecker-ci-plugin": spec } } }, packages: { "@jurislm/woodpecker-ci-plugin": [`@jurislm/woodpecker-ci-plugin@${spec}`, "", {}, "sha512-fixture"] } }));
  writeFileSync(join(packageRoot, "package.json"), JSON.stringify({ name: "@jurislm/woodpecker-ci-plugin", version, bin: { "woodpecker-ci-plugin": "dist/index.js" } }));
  writeFileSync(join(packageRoot, "dist/index.js"), "");
  symlinkSync("../@jurislm/woodpecker-ci-plugin/dist/index.js", join(root, "node_modules/.bin/woodpecker-ci-plugin"));
  return root;
}

function validate(root: string) {
  return Bun.spawnSync([process.execPath, "--no-env-file", resolve("launchers/validate-woodpecker-runtime.mjs"), root, "@jurislm/woodpecker-ci-plugin", "woodpecker-ci-plugin"], { stdout: "pipe", stderr: "pipe" });
}

test("runtime validates exact installed identity without protocol output", () => {
  const root = fixture();
  try {
    const result = validate(root);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.length).toBe(0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

for (const spec of ["latest", "^2.1.1", "file:/tmp/elsewhere.tgz"]) {
  test(`runtime rejects mutable or external source ${spec}`, () => {
    const root = fixture(spec);
    try { expect(validate(root).exitCode).not.toBe(0); }
    finally { rmSync(root, { recursive: true, force: true }); }
  });
}

test("runtime rejects a mismatched installed version", () => {
  const root = fixture("2.1.1", "2.1.0");
  try { expect(validate(root).exitCode).not.toBe(0); }
  finally { rmSync(root, { recursive: true, force: true }); }
});

test("runtime rejects missing lock and incomplete entry", () => {
  const root = fixture();
  try {
    const originalLock = readFileSync(join(root, "bun.lock"));
    rmSync(join(root, "bun.lock"));
    expect(validate(root).exitCode).not.toBe(0);
    writeFileSync(join(root, "bun.lock"), originalLock);
    rmSync(join(root, "node_modules/@jurislm/woodpecker-ci-plugin/dist/index.js"));
    expect(validate(root).exitCode).not.toBe(0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("runtime validates an internal fixed tarball and rejects integrity drift", () => {
  const root = fixture("file:./packages/woodpecker.tgz");
  try {
    mkdirSync(join(root, "packages"));
    const staging = join(root, "packing");
    mkdirSync(staging);
    cpSync(join(root, "node_modules/@jurislm/woodpecker-ci-plugin"), join(staging, "package"), { recursive: true });
    const packed = Bun.spawnSync(["tar", "-czf", join(root, "packages/woodpecker.tgz"), "-C", staging, "package"]);
    expect(packed.exitCode).toBe(0);
    const lockPath = join(root, "bun.lock");
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    lock.packages["@jurislm/woodpecker-ci-plugin"] = ["@jurislm/woodpecker-ci-plugin@packages/woodpecker.tgz", {}, "sha512-" + createHash("sha512").update(readFileSync(join(root, "packages/woodpecker.tgz"))).digest("base64")];
    writeFileSync(lockPath, JSON.stringify(lock));
    expect(validate(root).exitCode).toBe(0);
    lock.packages["@jurislm/woodpecker-ci-plugin"][2] = "sha512-wrong";
    writeFileSync(lockPath, JSON.stringify(lock));
    expect(validate(root).exitCode).not.toBe(0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test("runtime rejects resolved lock version drift", () => {
  const root = fixture();
  try {
    const path = join(root, "bun.lock");
    const lock = JSON.parse(readFileSync(path, "utf8"));
    lock.packages["@jurislm/woodpecker-ci-plugin"][0] = "@jurislm/woodpecker-ci-plugin@2.1.0";
    writeFileSync(path, JSON.stringify(lock));
    expect(validate(root).exitCode).not.toBe(0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
