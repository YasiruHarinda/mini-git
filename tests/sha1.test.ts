import { describe, expect, it } from "vitest";
import { sha1Hex } from "../src/engine/sha1.js";

const enc = (s: string) => new TextEncoder().encode(s);

describe("sha1Hex", () => {
  it("matches the well-known SHA-1 test vectors", () => {
    expect(sha1Hex(enc(""))).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
    expect(sha1Hex(enc("abc"))).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    expect(sha1Hex(enc("The quick brown fox jumps over the lazy dog"))).toBe(
      "2fd4e1c67a2d28fced849ee1bb76e7391b93eb12",
    );
  });

  it("matches for input that spans multiple 64-byte chunks", () => {
    // 90 bytes: crosses the first 64-byte block boundary, exercising the multi-chunk path.
    const input = "a".repeat(90);
    expect(sha1Hex(enc(input))).toBe("ec2706428417e71c758791805a187ec0075370d4");
  });
});
