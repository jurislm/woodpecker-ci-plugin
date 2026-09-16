import { describe, expect, test } from "bun:test";
import { parseServerSentEvents } from "./stream.js";

describe("parseServerSentEvents", () => {
  test("parses data frames and ignores comments", () => {
    expect(parseServerSentEvents(": keep-alive\ndata: {\"id\":1}\n\ndata: hello\n\n"))
      .toEqual([{ id: 1 }, "hello"]);
  });

  test("returns a bounded timeout", () => {
    expect(() => parseServerSentEvents("data: incomplete")).not.toThrow();
    expect(parseServerSentEvents("data: incomplete")).toEqual(["incomplete"]);
  });
});
