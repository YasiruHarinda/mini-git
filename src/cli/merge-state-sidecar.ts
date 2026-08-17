import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PendingMerge } from "../engine/repository.js";

const SIDECAR_FILENAME = "MINI_GIT_MERGE_STATE.json";

/**
 * Mirrors `index-sidecar.ts`: the engine holds an in-progress merge only in
 * memory (ADR 0002), so the CLI — a fresh process per command — persists it
 * here between invocations, alongside `.git/HEAD` rather than inside
 * `.git/objects` or `.git/refs`.
 */
export async function loadMergeStateSidecar(gitDir: string): Promise<PendingMerge | undefined> {
  try {
    const raw = await readFile(join(gitDir, SIDECAR_FILENAME), "utf8");
    return JSON.parse(raw) as PendingMerge;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}

export async function saveMergeStateSidecar(gitDir: string, state: PendingMerge | undefined): Promise<void> {
  const path = join(gitDir, SIDECAR_FILENAME);
  if (state === undefined) {
    await rm(path, { force: true });
    return;
  }
  await writeFile(path, JSON.stringify(state, null, 2) + "\n");
}
