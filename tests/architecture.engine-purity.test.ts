import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const ENGINE_ROOT = join(import.meta.dirname, "..", "src", "engine");
const FORBIDDEN = [
  /from ["']node:fs/,
  /from ["']node:path/,
  /from ["']fs["']/,
  /from ["']path["']/,
  /\bwindow\./,
  /\bdocument\./,
  /\blocalStorage\b/,
  /\bindexedDB\b/,
];

async function listTsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "storage") continue; // the seam: adapters legitimately touch fs/paths.
      files.push(...(await listTsFiles(full)));
    } else if (entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

describe("Architecture: the engine stays pure (ADR 0002)", () => {
  it("has no path, filesystem, or browser API references outside storage/", async () => {
    const files = await listTsFiles(ENGINE_ROOT);
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      for (const pattern of FORBIDDEN) {
        if (pattern.test(source)) {
          offenders.push(`${file}: matches ${pattern}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
