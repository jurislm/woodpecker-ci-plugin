import { parseBunPackOutput } from "./package-contents.js";

const result = Bun.spawnSync([process.execPath, "pm", "pack", "--dry-run"], {
  cwd: process.cwd(),
  stdout: "pipe",
  stderr: "pipe",
});
if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
const packed = parseBunPackOutput(new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr));
const paths = new Set(packed.paths);
for (const path of [
  "dist/index.js",
  "README.md",
  "LICENSE",
  "assets/woodpecker_ci.png",
  "plugin.json",
  "mcp.json",
  ".mcp.json",
  ".mcp.json.example",
  ".app.json.example",
  ".codex-plugin/plugin.json",
  "skills/woodpecker-ci/SKILL.md",
  "api/manifest.json",
  "openapi/woodpecker-dev.yaml",
  "contracts/woodpecker-mcp-v1.json",
  "contracts/woodpecker-mcp-v2.json",
  "schemas/plugin.schema.json",
  "schemas/mcp.schema.json",
]) {
  if (!paths.has(path)) throw new Error(`Package is missing ${path}`);
}
const manifests = packed.paths.filter((path) => /(^|\/)manifest\.json$/u.test(path));
if (JSON.stringify(manifests) !== JSON.stringify(["api/manifest.json"])) {
  throw new Error(`Package must ship only api/manifest.json, found ${manifests.join(", ")}`);
}
if (packed.paths.some((path) => /(^|\/)(\.env|.*\.pem|.*\.key)$/iu.test(path))) {
  throw new Error("Package must not contain credential files");
}
console.error(`Package contents valid: ${packed.totalFiles} files`);
