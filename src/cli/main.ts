import { readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { Repository } from "../engine/repository.js";
import { FilesystemStorage } from "../engine/storage/filesystem.js";
import { loadIndexSidecar, saveIndexSidecar } from "./index-sidecar.js";

export interface CliIO {
  cwd: string;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

function gitDirFor(cwd: string): string {
  return join(cwd, ".git");
}

function toRepoPath(cwd: string, argPath: string): string {
  const abs = join(cwd, argPath);
  return relative(cwd, abs).split(sep).join("/");
}

async function withRepository<T>(io: CliIO, fn: (repo: Repository, gitDir: string) => Promise<T>): Promise<T> {
  const gitDir = gitDirFor(io.cwd);
  const storage = new FilesystemStorage(gitDir);
  const repo = new Repository(storage);
  repo.restoreIndex(await loadIndexSidecar(gitDir));
  const result = await fn(repo, gitDir);
  await saveIndexSidecar(gitDir, repo.readIndex());
  return result;
}

function formatTimestamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString();
}

export async function runCli(argv: string[], io: CliIO): Promise<number> {
  const [command, ...rest] = argv;

  switch (command) {
    case "init": {
      const storage = new FilesystemStorage(gitDirFor(io.cwd));
      const repo = new Repository(storage);
      await repo.init();
      io.stdout(`Initialized empty mini-git repository in ${gitDirFor(io.cwd)}`);
      return 0;
    }

    case "add": {
      if (rest.length === 0) {
        io.stderr("usage: mini-git add <path...>");
        return 1;
      }
      await withRepository(io, async (repo) => {
        for (const argPath of rest) {
          const content = await readFile(join(io.cwd, argPath));
          await repo.add(toRepoPath(io.cwd, argPath), new Uint8Array(content));
        }
      });
      return 0;
    }

    case "unstage": {
      if (rest.length === 0) {
        io.stderr("usage: mini-git unstage <path...>");
        return 1;
      }
      await withRepository(io, async (repo) => {
        for (const argPath of rest) {
          repo.unstage(toRepoPath(io.cwd, argPath));
        }
      });
      return 0;
    }

    case "commit": {
      const messageFlagIndex = rest.findIndex((arg) => arg === "-m" || arg === "--message");
      const message = messageFlagIndex === -1 ? undefined : rest[messageFlagIndex + 1];
      if (!message) {
        io.stderr("usage: mini-git commit -m <message>");
        return 1;
      }
      try {
        const result = await withRepository(io, (repo) => repo.commit({ message }));
        io.stdout(result.id);
        return 0;
      } catch (err) {
        io.stderr((err as Error).message);
        return 1;
      }
    }

    case "log": {
      const entries = await withRepository(io, (repo) => repo.log());
      for (const entry of entries) {
        io.stdout(`commit ${entry.id}`);
        io.stdout(`Author: ${entry.author.name} <${entry.author.email}>`);
        io.stdout(`Date:   ${formatTimestamp(entry.author.timestamp)}`);
        io.stdout("");
        io.stdout(`    ${entry.message}`);
        io.stdout("");
      }
      return 0;
    }

    default:
      io.stderr(`unknown command: ${command ?? "(none)"}`);
      return 1;
  }
}
