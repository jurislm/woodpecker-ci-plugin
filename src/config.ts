export interface WoodpeckerConfig {
  baseUrl: string;
  token: string;
  timeoutMs: number;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function loadConfig(env: Record<string, string | undefined> = process.env): WoodpeckerConfig {
  const rawUrl = env.WOODPECKER_URL?.trim();
  const token = env.WOODPECKER_API_TOKEN?.trim();
  if (!rawUrl) throw new ConfigError("WOODPECKER_URL is required");
  if (!token) throw new ConfigError("WOODPECKER_API_TOKEN is required");

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ConfigError("WOODPECKER_URL must be a valid HTTP(S) URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ConfigError("WOODPECKER_URL must use http:// or https://");
  }
  url.pathname = url.pathname.replace(/\/+$/u, "");
  if (!url.pathname.endsWith("/api")) {
    throw new ConfigError("WOODPECKER_URL must include the /api path");
  }
  if (url.search || url.hash) {
    throw new ConfigError("WOODPECKER_URL must not include a query or fragment");
  }

  return {
    baseUrl: url.toString().replace(/\/$/u, ""),
    token,
    timeoutMs: 30_000,
  };
}
