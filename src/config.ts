export interface WoodpeckerConfig {
  baseUrl: string | undefined;
  token: string | undefined;
  timeoutMs: number;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): WoodpeckerConfig {
  const baseUrl = env.WOODPECKER_URL?.trim().replace(/\/+$/u, "");
  const token = env.WOODPECKER_API_TOKEN?.trim();
  return {
    baseUrl: baseUrl || undefined,
    token: token || undefined,
    timeoutMs: 30_000,
  };
}
