import { readFileSync, realpathSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { normalize, resolve, sep } from "node:path";

try {
  const [directory, name, binary] = process.argv.slice(2);
  const root = realpathSync(directory);
  const inside = (path) => {
    const actual = realpathSync(path);
    if (!actual.startsWith(root + sep)) throw new Error();
    return actual;
  };
  const manifest = JSON.parse(readFileSync(inside(resolve(root, "package.json")), "utf8"));
  const lock = Bun.JSONC.parse(readFileSync(inside(resolve(root, "bun.lock")), "utf8"));
  const spec = manifest.dependencies?.[name];
  if (typeof spec !== "string" || lock.workspaces?.[""]?.dependencies?.[name] !== spec) throw new Error();
  const locked = lock.packages?.[name];
  if (!Array.isArray(locked)) throw new Error();
  let version = spec;
  let resolved = spec;
  if (spec.startsWith("file:")) {
    const relative = spec.slice(5);
    if (relative.startsWith("/") || !relative.endsWith(".tgz")) throw new Error();
    const archive = inside(resolve(root, relative));
    resolved = normalize(relative);
    const integrity = "sha512-" + createHash("sha512").update(readFileSync(archive)).digest("base64");
    if (locked.at(-1) !== integrity) throw new Error();
    const packed = Bun.spawnSync(["tar", "-xOf", archive, "package/package.json"], { stdout: "pipe", stderr: "pipe", env: { PATH: "/usr/bin:/bin" } });
    if (packed.exitCode !== 0) throw new Error();
    const metadata = JSON.parse(new TextDecoder().decode(packed.stdout));
    if (metadata.name !== name) throw new Error();
    version = metadata.version;
  }
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error();
  if (locked[0] !== `${name}@${resolved}`) throw new Error();
  const packageRoot = inside(resolve(root, "node_modules", name));
  const installed = JSON.parse(readFileSync(inside(resolve(packageRoot, "package.json")), "utf8"));
  if (installed.name !== name || installed.version !== version || installed.bin?.[binary] !== "dist/index.js") throw new Error();
  const entry = inside(resolve(packageRoot, installed.bin[binary]));
  if (!entry.startsWith(packageRoot + sep) || !statSync(entry).isFile() || inside(resolve(root, "node_modules/.bin", binary)) !== entry) throw new Error();
} catch {
  console.error("Desktop MCP runtime is missing or inconsistent; reinstall the pinned runtime before starting.");
  process.exit(1);
}
