import { mkdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { jsonSchemaToZod } from "json-schema-to-zod";
import YAML from "yaml";

type JsonObject = Record<string, any>;
type OpenApiDocument = {
  info?: { version?: string };
  paths?: Record<string, JsonObject>;
  components?: { schemas?: Record<string, JsonObject> };
};

const inputPath = "openapi/woodpecker-dev.yaml";
const outputDir = "src/generated";
const typeOutput = outputDir + "/woodpecker-api.ts";
const zodOutput = outputDir + "/woodpecker-zod.ts";
const operationsOutput = outputDir + "/operations.ts";
const methods = new Set(["get", "put", "post", "delete", "patch", "head", "options", "trace"]);
const raw = await readFile(inputPath, "utf8");
const document = YAML.parse(raw) as OpenApiDocument;
const schemas = document.components?.schemas ?? {};

await mkdir(outputDir, { recursive: true });

const generated = spawnSync(
  process.cwd() + "/node_modules/.bin/openapi-typescript",
  [inputPath, "-o", typeOutput],
  { encoding: "utf8" },
);
if (generated.status !== 0) {
  throw new Error("openapi-typescript failed:\n" + generated.stdout + "\n" + generated.stderr);
}

function dereference(value: any, seen = new Set<string>()): any {
  if (Array.isArray(value)) return value.map((item) => dereference(item, seen));
  if (!value || typeof value !== "object") return value;
  if (typeof value.$ref === "string" && value.$ref.startsWith("#/components/schemas/")) {
    const name = value.$ref.slice("#/components/schemas/".length);
    if (seen.has(name)) return {};
    return dereference(schemas[name] ?? {}, new Set([...seen, name]));
  }
  const result: JsonObject = {};
  for (const [key, child] of Object.entries(value)) {
    if (key !== "$ref") result[key] = dereference(child, seen);
  }
  if (result.nullable === true) {
    delete result.nullable;
    return { anyOf: [result, { type: "null" }] };
  }
  return result;
}

function schemaText(schema: any, fallback = "z.unknown()", optional = false): string {
  if (!schema) return fallback;
  try {
    const result = jsonSchemaToZod(dereference(schema), { noImport: true }).trim();
    if (!optional || schema.default !== undefined || result.endsWith(".optional()")) return result;
    return result + ".optional()";
  } catch {
    return fallback;
  }
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function toolName(summary: string, method: string, path: string, used: Set<string>): string {
  const stopWords = new Set(["a", "an", "the", "of", "to", "by", "for"]);
  const words = summary
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/u)
    .filter((word) => !stopWords.has(word.toLowerCase()));
  let name = "woodpecker_" + words.join("_").toLowerCase().replace(/_+/gu, "_");
  if (!used.has(name)) return name;
  const suffix = method + "_" + path.replace(/[^a-zA-Z0-9]+/gu, "_").replace(/^_|_$/gu, "");
  name = name + "_" + suffix.toLowerCase();
  let index = 2;
  while (used.has(name)) name = name + "_" + index++;
  return name;
}

function responseInfo(operation: JsonObject): { schema: string; kind: string } {
  const responses = operation.responses ?? {};
  const success = Object.entries(responses).find(([status]) => /^2\d\d$/u.test(status))?.[1] as JsonObject | undefined;
  const content = success?.content ?? {};
  const contentType = Object.keys(content)[0] ?? "application/json";
  if (contentType === "text/event-stream") return { schema: "z.array(z.unknown())", kind: "stream" };
  if (contentType.includes("json")) return { schema: schemaText(content[contentType]?.schema), kind: "json" };
  if (contentType.startsWith("text/") || contentType.includes("xml")) return { schema: "z.string()", kind: "text" };
  return { schema: "z.string()", kind: "binary" };
}

const operations: string[] = [];
const usedNames = new Set<string>();
for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
  for (const [method, operationValue] of Object.entries(pathItem)) {
    if (!methods.has(method)) continue;
    const operation = operationValue as JsonObject;
    const parameters = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])] as JsonObject[];
    const properties: string[] = [];
    const required: string[] = [];
    const parameterMeta: string[] = [];

    for (const parameter of parameters) {
      if (parameter.in === "header") continue;
      const name = String(parameter.name);
      properties.push(quote(name) + ": " + schemaText(parameter.schema ?? { type: "string" }, "z.unknown()", !parameter.required));
      if (parameter.required) required.push(name);
      parameterMeta.push("{ location: " + quote(parameter.in) + ", name: " + quote(name) + " }");
    }

    const requestBody = operation.requestBody as JsonObject | undefined;
    const bodyContent = requestBody?.content ?? {};
    const bodyType = Object.keys(bodyContent)[0];
    if (bodyType) {
      properties.push("body: " + schemaText(bodyContent[bodyType]?.schema, "z.unknown()", !requestBody.required));
      if (requestBody.required) required.push("body");
    }

    const isStream = path.startsWith("/stream/");
    if (isStream) properties.push("duration_ms: z.number().int().min(1).max(30000).optional()");

    const summary = String(operation.summary ?? method.toUpperCase() + " " + path);
    const name = toolName(summary, method, path, usedNames);
    usedNames.add(name);
    const inputSchema = properties.length === 0
      ? "z.object({})"
      : "z.object({ " + properties.join(", ") + " })";
    const response = responseInfo(operation);
    const destructive = method === "delete" || /delete|reset|revoke|remove|destroy/iu.test(summary);
    const annotations = "{ readOnlyHint: " + (method === "get" || method === "head") +
      ", destructiveHint: " + destructive +
      ", idempotentHint: " + (method === "get" || method === "head") +
      ", openWorldHint: false }";

    operations.push(
      "  { name: " + quote(name) +
      ", method: " + quote(method.toUpperCase()) +
      ", path: " + quote(path) +
      ", description: " + quote("Use this when an agent needs to " + summary.toLowerCase() + ".") +
      ", inputSchema: " + inputSchema +
      ", responseSchema: " + response.schema +
      ", responseKind: " + quote(response.kind) +
      ", parameters: [" + parameterMeta.join(", ") + "]" +
      ", stream: " + isStream +
      ", annotations: " + annotations + " }",
    );
  }
}

const componentSchemas = Object.entries(schemas)
  .map(([name, schema]) => "  " + quote(name) + ": " + schemaText(schema))
  .join(",\n");
await Bun.write(
  zodOutput,
  [
    "// Generated by scripts/generate-openapi.ts.",
    'import { z } from "zod";',
    "",
    "export const componentSchemas = {",
    componentSchemas,
    "} as const;",
    "",
  ].join("\n"),
);

await Bun.write(
  operationsOutput,
  [
    "// Generated by scripts/generate-openapi.ts.",
    'import { z } from "zod";',
    "",
    "export type GeneratedOperation = {",
    "  name: string;",
    "  method: string;",
    "  path: string;",
    "  description: string;",
    "  inputSchema: z.ZodType;",
    "  responseSchema: z.ZodType;",
    "  responseKind: string;",
    "  parameters: Array<{ location: string; name: string }>;",
    "  stream: boolean;",
    "  annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean };",
    "};",
    "",
    "export const operations: GeneratedOperation[] = [",
    operations.join(",\n"),
    "];",
    "",
  ].join("\n"),
);

console.error("Generated " + operations.length + " operations");
