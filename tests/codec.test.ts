import { describe, expect, it } from "vitest";
import { frameObject, hashObject, parseFrame } from "../src/engine/codec.js";

describe("Object codec: Blob framing", () => {
  it("round-trips content through frame and parse", () => {
    const content = new TextEncoder().encode("hello world");
    const frame = frameObject("blob", content);
    const parsed = parseFrame(frame);
    expect(parsed.type).toBe("blob");
    expect(new TextDecoder().decode(parsed.content)).toBe("hello world");
  });

  it("round-trips an empty Blob", () => {
    const content = new Uint8Array(0);
    const parsed = parseFrame(frameObject("blob", content));
    expect(parsed.content.byteLength).toBe(0);
  });

  it("round-trips content with no trailing newline", () => {
    const content = new TextEncoder().encode("no newline here");
    const parsed = parseFrame(frameObject("blob", content));
    expect(new TextDecoder().decode(parsed.content)).toBe("no newline here");
  });

  it("produces a stable 40-character hex Object ID", () => {
    const id = hashObject("blob", new TextEncoder().encode("hello world"));
    expect(id).toMatch(/^[0-9a-f]{40}$/);
  });

  it("gives identical content the same Object ID", () => {
    const a = hashObject("blob", new TextEncoder().encode("same"));
    const b = hashObject("blob", new TextEncoder().encode("same"));
    expect(a).toBe(b);
  });

  it("gives different content different Object IDs", () => {
    const a = hashObject("blob", new TextEncoder().encode("a"));
    const b = hashObject("blob", new TextEncoder().encode("b"));
    expect(a).not.toBe(b);
  });

  it("rejects a frame with no NUL separator", () => {
    expect(() => parseFrame(new TextEncoder().encode("blob 5 hello"))).toThrow();
  });
});
