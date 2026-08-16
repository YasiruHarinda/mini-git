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

export interface RealTreeEntry {
  mode: "100644" | "40000";
  name: string;
  id: string;
}

/** Real git's mktree sorts its own input, so entry order here does not matter. */
export function realGitMktree(entries: RealTreeEntry[]): string {
  const input = entries
    .map((e) => `${e.mode} ${e.mode === "40000" ? "tree" : "blob"} ${e.id}\t${e.name}\n`)
    .join("");
  // --missing: this hashes structure only, so the referenced objects need not
  // actually be written to git's own object database.
  const result = spawnSync("git", ["mktree", "--missing"], { input });
  if (result.status !== 0) {
    throw new Error(`git mktree failed: ${result.stderr.toString()}`);
  }
  return result.stdout.toString().trim();
}

export interface RealSignatureEnv {
  name: string;
  email: string;
  date: string; // "<unix-seconds> <+HHMM>"
}

export function realGitCommitTree(
  tree: string,
  parents: string[],
  message: string,
  author: RealSignatureEnv,
  committer: RealSignatureEnv,
): string {
  const args = ["commit-tree", tree];
  for (const parent of parents) args.push("-p", parent);
  const result = spawnSync("git", args, {
    input: message,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: author.name,
      GIT_AUTHOR_EMAIL: author.email,
      GIT_AUTHOR_DATE: author.date,
      GIT_COMMITTER_NAME: committer.name,
      GIT_COMMITTER_EMAIL: committer.email,
      GIT_COMMITTER_DATE: committer.date,
    },
  });
  if (result.status !== 0) {
    throw new Error(`git commit-tree failed: ${result.stderr.toString()}`);
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
