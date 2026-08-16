import { spawnSync } from "node:child_process";

let cached: boolean | undefined;

/** Whether real git is on PATH. Differential tests skip, rather than fail, when it is not. */
export function hasRealGit(): boolean {
  if (cached === undefined) {
    const result = spawnSync("git", ["--version"]);
    cached = result.status === 0;
  }
  return cached;
}

export function realGitHashObject(content: Uint8Array, type: "blob" | "tree" | "commit" = "blob"): string {
  const result = spawnSync("git", ["hash-object", "--stdin", "-t", type], {
    input: Buffer.from(content),
  });
  if (result.status !== 0) {
    throw new Error(`git hash-object failed: ${result.stderr.toString()}`);
  }
  return result.stdout.toString().trim();
}

export function runGit(cwd: string, args: string[]): { stdout: string; stderr: string; status: number } {
  const result = spawnSync("git", args, { cwd });
  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    status: result.status ?? -1,
  };
}
