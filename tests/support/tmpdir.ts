import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function makeTmpDir(prefix = "mini-git-test-"): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function removeTmpDir(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}
