import { describe, expect, it } from "vitest";
import { hashObject } from "../src/engine/codec.js";
import { hasRealGit, realGitHashObject } from "./support/real-git.js";

describe.skipIf(!hasRealGit())("Differential: Blob Object ID vs real git", () => {
  it("matches git hash-object for ordinary content", () => {
    const content = new TextEncoder().encode("hello world\n");
    expect(hashObject("blob", content)).toBe(realGitHashObject(content));
  });

  it("matches git hash-object for an empty Blob", () => {
    const content = new Uint8Array(0);
    expect(hashObject("blob", content)).toBe(realGitHashObject(content));
  });

  it("matches git hash-object for content with no trailing newline", () => {
    const content = new TextEncoder().encode("no trailing newline");
    expect(hashObject("blob", content)).toBe(realGitHashObject(content));
  });

  it("matches git hash-object for binary content", () => {
    const content = new Uint8Array([0, 1, 2, 255, 254, 253, 10, 0]);
    expect(hashObject("blob", content)).toBe(realGitHashObject(content));
  });
});

if (!hasRealGit()) {
  console.warn("Skipping differential Blob tests: real git not found on PATH.");
}
