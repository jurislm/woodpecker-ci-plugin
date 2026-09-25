import type { GeneratedOperation } from "./generated/operations.js";
import type { ToolEnvelope, WoodpeckerClient } from "./client.js";
import { formatToolError } from "./errors.js";

export type ApiRequest = (operation: GeneratedOperation, input: Record<string, unknown>) => Promise<ToolEnvelope<unknown>>;

export function createApiRequest(client: WoodpeckerClient): ApiRequest {
  return async (operation, input) => {
    const envelope = await client.request(operation, input);
    const parsed = operation.responseSchema.safeParse(envelope.data);
    if (!parsed.success) {
      throw new Error(`Woodpecker API response did not match ${operation.name} response schema (HTTP ${envelope.status})`);
    }
    return { ...envelope, data: parsed.data };
  };
}

export async function withApiErrorHandling<T>(
  handler: () => Promise<T>,
  tokens: Array<string | undefined> = [],
): Promise<T | { isError: true; content: [{ type: "text"; text: string }] }> {
  try {
    return await handler();
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: JSON.stringify({ error: formatToolError(error, tokens) }) }],
    };
  }
}
