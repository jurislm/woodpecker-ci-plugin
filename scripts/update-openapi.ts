import { mkdir } from "node:fs/promises";

const sourceUrl = "https://woodpecker-ci.org/redocusaurus/plugin-redoc-0.yaml";
const specPath = "openapi/woodpecker-dev.yaml";
const manifestPath = "openapi/manifest.json";
const methods = new Set(["get", "put", "post", "delete", "patch", "head", "options", "trace"]);

const response = await fetch(sourceUrl);
if (!response.ok) throw new Error(`OpenAPI download failed: ${response.status} ${response.statusText}`);

const text = await response.text();
await mkdir("openapi", { recursive: true });
await Bun.write(specPath, text.endsWith("\n") ? text : `${text}\n`);

const spec = Bun.YAML.parse(text) as {
  info?: { version?: string };
  paths?: Record<string, Record<string, unknown>>;
};
const operationCount = Object.values(spec.paths ?? {}).reduce(
  (count, pathItem) => count + Object.keys(pathItem).filter((method) => methods.has(method)).length,
  0,
);
const hash = new Bun.CryptoHasher("sha256");
hash.update(text);

await Bun.write(
  manifestPath,
  `${JSON.stringify(
    {
      sourceUrl,
      fetchedAt: new Date().toISOString(),
      sha256: hash.digest("hex"),
      specVersion: spec.info?.version ?? "unknown",
      operationCount,
    },
    null,
    2,
  )}\n`,
);

console.error(`Fetched ${operationCount} OpenAPI operations to ${specPath}`);
