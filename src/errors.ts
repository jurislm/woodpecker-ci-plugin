import { ZodError } from "zod";

export class WoodpeckerApiError extends Error {
  readonly status: number;
  readonly method: string;
  readonly path: string;

  constructor(status: number, method: string, path: string, message: string) {
    super(message);
    this.name = "WoodpeckerApiError";
    this.status = status;
    this.method = method;
    this.path = path;
  }
}

export function redactErrorText(message: string, tokens: Array<string | undefined> = []): string {
  let redacted = message;
  for (const token of tokens) if (token) redacted = redacted.replaceAll(token, "[REDACTED]");
  return redacted.replace(/Bearer\s+[^\s,;]+/giu, "Bearer [REDACTED]");
}

export function formatToolError(error: unknown, tokens: Array<string | undefined>) {
  if (error instanceof ZodError) {
    return {
      code: "WOODPECKER_RESPONSE_SCHEMA_ERROR",
      message: "Woodpecker API returned an unexpected response shape",
    };
  }
  if (error instanceof WoodpeckerApiError) {
    return {
      code: "WOODPECKER_API_ERROR",
      status: error.status,
      method: error.method,
      path: error.path,
      message: redactErrorText(error.message, tokens),
    };
  }
  return {
    code: "WOODPECKER_TOOL_ERROR",
    message: redactErrorText(error instanceof Error ? error.message : String(error), tokens),
  };
}
