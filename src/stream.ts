export function parseServerSentEvents(input: string): unknown[] {
  const frames = input.split(/\r?\n\r?\n/u);
  const values: unknown[] = [];
  for (const frame of frames) {
    const data = frame
      .split(/\r?\n/u)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) continue;
    try {
      values.push(JSON.parse(data));
    } catch {
      values.push(data);
    }
  }
  return values;
}

export async function collectServerSentEvents(
  response: Response,
  durationMs: number,
): Promise<{ events: unknown[]; timed_out: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) return { events: [], timed_out: false };

  const decoder = new TextDecoder();
  let text = "";
  let timedOut = false;
  const deadline = Date.now() + durationMs;
  try {
    while (true) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        timedOut = true;
        await reader.cancel();
        break;
      }
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        reader.read().finally(() => timeout && clearTimeout(timeout)),
        new Promise<ReadableStreamReadResult<Uint8Array>>((resolve) => {
          timeout = setTimeout(() => resolve({ done: true, value: undefined }), remaining);
        }),
      ]);
      if (result.done) {
        if (Date.now() >= deadline) timedOut = true;
        break;
      }
      text += decoder.decode(result.value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
  return { events: parseServerSentEvents(text), timed_out: timedOut };
}
