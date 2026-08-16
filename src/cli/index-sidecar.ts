import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { IndexEntry } from "../engine/index-entries.js";

const SIDECAR_FILENAME = "MINI_GIT_INDEX.json";

/**
 * The engine holds the Index only in memory (ADR 0002 keeps it ignorant of
 * files), so the CLI — which runs as a fresh process per command, unlike
 * the long-lived web session — persists it here between invocations. This
 * is mini-git's own bookkeeping, not a git object or ref, so it lives
 * alongside `.git/HEAD` rather than inside `.git/objects` or `.git/refs`.
 */
export async function loadIndexSidecar(gitDir: string): Promise<IndexEntry[]> {
  try {
    const raw = await readFile(join(gitDir, SIDECAR_FILENAME), "utf8");
    return JSON.parse(raw) as IndexEntry[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function saveIndexSidecar(gitDir: string, entries: readonly IndexEntry[]): Promise<void> {
  await writeFile(join(gitDir, SIDECAR_FILENAME), JSON.stringify(entries, null, 2) + "\n");
}
