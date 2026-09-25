import type { GeneratedOperation } from "./generated/operations.js";
import type { WoodpeckerConfig } from "./config.js";
import { redactErrorText, WoodpeckerApiError } from "./errors.js";
import { collectServerSentEvents } from "./stream.js";

export interface ToolEnvelope<T> {
  data: T;
  status: number;
  request: {
    method: string;
    path: string;
  };
}

export interface BinaryEnvelope {
  encoding: "base64";
  contentType: string;
  value: string;
}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const sensitiveKey = /(real_?value|private_?key|token|secret|password|authorization|cookie|^wss_url$)/iu;

export function redactSensitive<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item)) as T;
  if (!value || typeof value !== "object") return value;
  if ((value as unknown as BinaryEnvelope).encoding === "base64" && typeof (value as unknown as BinaryEnvelope).value === "string") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [
    key,
    sensitiveKey.test(key) && child != null ? "[REDACTED]" : redactSensitive(child),
  ])) as T;
}

function pathValue(value: unknown, name: string): string {
  if (value === undefined || value === null) {
    throw new Error("Missing required path parameter: " + name);
  }
  const segment = String(value);
  if (/^\.+$/u.test(segment)) throw new Error("Invalid dot-only path parameter: " + name);
  return encodeURIComponent(segment);
}

function appendQuery(url: URL, name: string, value: unknown): void {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    for (const item of value) url.searchParams.append(name, String(item));
    return;
  }
  url.searchParams.set(name, typeof value === "object" ? JSON.stringify(value) : String(value));
}

function decodeBinary(bytes: ArrayBuffer, contentType: string): BinaryEnvelope {
  return {
    encoding: "base64",
    contentType,
    value: Buffer.from(bytes).toString("base64"),
  };
}

export class WoodpeckerClient {
  constructor(
    private readonly config: WoodpeckerConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async request<T>(
    operation: Pick<GeneratedOperation, "method" | "path" | "parameters" | "stream">,
    input: Record<string, unknown>,
  ): Promise<ToolEnvelope<T | null | BinaryEnvelope | string>> {
    const baseUrl = this.config.baseUrl;
    const token = this.config.token;
    if (!baseUrl) throw new WoodpeckerApiError(0, operation.method, operation.path, "WOODPECKER_URL is required");
    if (!token) throw new WoodpeckerApiError(0, operation.method, operation.path, "WOODPECKER_API_TOKEN is required");

    let path = operation.path;
    for (const parameter of operation.parameters) {
      if (parameter.location !== "path") continue;
      path = path.replace(
        "{" + parameter.name + "}",
        pathValue(input[parameter.name], parameter.name),
      );
    }
    if (path.includes("{")) throw new Error("Unresolved path parameter in " + operation.path);

    let apiUrl: URL;
    try {
      apiUrl = new URL(baseUrl);
    } catch {
      throw new WoodpeckerApiError(0, operation.method, path, "WOODPECKER_URL must be a valid HTTP(S) URL");
    }
    if (apiUrl.protocol !== "http:" && apiUrl.protocol !== "https:") {
      throw new WoodpeckerApiError(0, operation.method, path, "WOODPECKER_URL must use http:// or https://");
    }
    if (apiUrl.username || apiUrl.password) {
      throw new WoodpeckerApiError(0, operation.method, path, "WOODPECKER_URL must not include credentials");
    }
    apiUrl.pathname = apiUrl.pathname.replace(/\/+$/u, "");
    if (!apiUrl.pathname.endsWith("/api")) {
      throw new WoodpeckerApiError(0, operation.method, path, "WOODPECKER_URL must include the /api path");
    }
    if (apiUrl.search || apiUrl.hash) {
      throw new WoodpeckerApiError(0, operation.method, path, "WOODPECKER_URL must not include a query or fragment");
    }
    const url = new URL(apiUrl.toString().replace(/\/$/u, "") + path);
    for (const parameter of operation.parameters) {
      if (parameter.location === "query") appendQuery(url, parameter.name, input[parameter.name]);
    }

    const headers = new Headers({
      accept: operation.stream ? "text/event-stream" : "application/json, text/plain, */*",
      authorization: "Bearer " + token,
    });
    const init: RequestInit = {
      method: operation.method,
      headers,
      signal: AbortSignal.timeout(this.config.timeoutMs),
    };
    if (input.body !== undefined && operation.method !== "GET" && operation.method !== "HEAD") {
      headers.set("content-type", "application/json");
      init.body = JSON.stringify(input.body);
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, init);
    } catch (error) {
      throw new WoodpeckerApiError(
        0,
        operation.method,
        path,
        "Woodpecker request failed for " + operation.method + " " + path + ": " +
          redactErrorText(error instanceof Error ? error.message : String(error), [token]),
      );
    }

    if (!response.ok) {
      throw new WoodpeckerApiError(
        response.status,
        operation.method,
        path,
        "Woodpecker API returned " + response.status + " for " + operation.method + " " + path,
      );
    }

    let data: T | null | BinaryEnvelope | string = null;
    if (operation.stream) {
      const durationMs = Math.min(
        30_000,
        Math.max(1, typeof input.duration_ms === "number" ? input.duration_ms : 5_000),
      );
      data = redactSensitive(await collectServerSentEvents(response, durationMs)) as T;
    } else if (response.status !== 204) {
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (contentType.includes("json")) data = redactSensitive(await response.json()) as T;
      else if (contentType.startsWith("text/") || contentType.includes("xml")) data = await response.text();
      else data = decodeBinary(await response.arrayBuffer(), contentType || "application/octet-stream");
    }

    return {
      data,
      status: response.status,
      request: { method: operation.method, path },
    };
  }
}

export { WoodpeckerApiError };
