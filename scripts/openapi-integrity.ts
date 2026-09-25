import { createHash } from "node:crypto";
import { join } from "node:path";
import YAML from "yaml";

type Manifest = {
  sourceUrl: string;
  fetchedAt: string;
  sha256: string;
  specVersion: string;
  pathCount: number;
  operationCount: number;
};

const methods = new Set(["get", "put", "post", "delete", "patch", "head", "options", "trace"]);

export function persistedSnapshot(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}

export function hashSnapshot(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function verifyOpenApiManifest(root: string): Promise<{ pathCount: number; operationCount: number }> {
  const manifest = JSON.parse(await Bun.file(join(root, "api/manifest.json")).text()) as Manifest;
  const snapshot = await Bun.file(join(root, "openapi/woodpecker-dev.yaml")).text();
  if (hashSnapshot(snapshot) !== manifest.sha256) throw new Error("Woodpecker OpenAPI snapshot hash does not match manifest");
  const document = YAML.parse(snapshot) as { paths?: Record<string, Record<string, unknown>> };
  const paths = document.paths ?? {};
  const pathCount = Object.keys(paths).length;
  const operationCount = Object.values(paths).reduce(
    (count, pathItem) => count + Object.keys(pathItem).filter((method) => methods.has(method)).length,
    0,
  );
  if (pathCount !== manifest.pathCount) throw new Error(`Woodpecker OpenAPI path count ${pathCount} does not match manifest ${manifest.pathCount}`);
  if (operationCount !== manifest.operationCount) throw new Error(`Woodpecker OpenAPI operation count ${operationCount} does not match manifest ${manifest.operationCount}`);
  return { pathCount, operationCount };
}
