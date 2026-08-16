import { deflateSync, inflateSync } from "node:zlib";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import type { ObjectId, ObjectStorage, RefName } from "./types.js";

const DEFAULT_HEAD: RefName = "refs/heads/main";

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
}

/**
 * Filesystem ObjectStorage. Writes real git loose objects — zlib-compressed,
 * in git's directory layout — so a repository this tool creates can be read
 * by real git (ADR 0001).
 */
export class FilesystemStorage implements ObjectStorage {
  /** @param gitDir Path to the repository's `.git` directory. */
  constructor(private readonly gitDir: string) {}

  private objectPath(id: ObjectId): string {
    return join(this.gitDir, "objects", id.slice(0, 2), id.slice(2));
  }

  async read(id: ObjectId): Promise<Uint8Array | null> {
    try {
      const compressed = await readFile(this.objectPath(id));
      return new Uint8Array(inflateSync(compressed));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async write(id: ObjectId, bytes: Uint8Array): Promise<void> {
    const path = this.objectPath(id);
    if (await exists(path)) return;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, deflateSync(bytes));
  }

  async has(id: ObjectId): Promise<boolean> {
    return exists(this.objectPath(id));
  }

  async listRefs(): Promise<Map<RefName, ObjectId>> {
    const refsDir = join(this.gitDir, "refs");
    const result = new Map<RefName, ObjectId>();
    if (!(await exists(refsDir))) return result;

    async function walk(dir: string): Promise<void> {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else {
          const name = relative(refsDir, full).split(sep).join("/");
          const content = (await readFile(full, "utf8")).trim();
          result.set(`refs/${name}`, content);
        }
      }
    }
    await walk(refsDir);
    return result;
  }

  async setRef(name: RefName, id: ObjectId): Promise<void> {
    const path = join(this.gitDir, ...name.split("/"));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${id}\n`);
  }

  async deleteRef(name: RefName): Promise<void> {
    const path = join(this.gitDir, ...name.split("/"));
    await rm(path, { force: true });
  }

  async readHead(): Promise<RefName> {
    const path = join(this.gitDir, "HEAD");
    if (!(await exists(path))) return DEFAULT_HEAD;
    const content = (await readFile(path, "utf8")).trim();
    const match = content.match(/^ref:\s*(\S+)$/);
    if (!match) throw new Error(`malformed HEAD: "${content}"`);
    return match[1]!;
  }

  async writeHead(name: RefName): Promise<void> {
    // Real git only recognises a directory as a repository once HEAD,
    // objects/ and refs/ all exist; writing HEAD is the moment a
    // FilesystemStorage becomes a real .git directory, so bring the rest
    // of the skeleton along with it.
    await mkdir(join(this.gitDir, "objects"), { recursive: true });
    await mkdir(join(this.gitDir, "refs", "heads"), { recursive: true });
    await writeFile(join(this.gitDir, "HEAD"), `ref: ${name}\n`);
  }
}
