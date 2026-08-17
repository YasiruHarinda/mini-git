import { afterEach, describe, expect, it } from "vitest";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runCli, type CliIO } from "../src/cli/main.js";
import { makeTmpDir, removeTmpDir } from "./support/tmpdir.js";

function makeIO(cwd: string): CliIO & { lines: string[]; errLines: string[] } {
  const lines: string[] = [];
  const errLines: string[] = [];
  return {
    cwd,
    lines,
    errLines,
    stdout: (line) => lines.push(line),
    stderr: (line) => errLines.push(line),
  };
}

describe("CLI: branch and checkout against real files on disk", () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await removeTmpDir(dir);
  });

  it("creates a branch, switches to it, and rewrites the Working Tree to match", async () => {
    dir = await makeTmpDir();
    const io = makeIO(dir);

    await runCli(["init"], io);
    await writeFile(join(dir, "a.txt"), "v1\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "first"], io);

    expect(await runCli(["branch", "feature"], io)).toBe(0);

    io.lines.length = 0;
    expect(await runCli(["branch"], io)).toBe(0);
    expect(io.lines).toEqual(["  feature", "* main"]); // listed alphabetically by name

    await writeFile(join(dir, "a.txt"), "v2\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "second, on main"], io);

    expect(await runCli(["checkout", "feature"], io)).toBe(0);
    expect(await readFile(join(dir, "a.txt"), "utf8")).toBe("v1\n");

    io.lines.length = 0;
    await runCli(["branch"], io);
    expect(io.lines).toContain("* feature");
    expect(io.lines).toContain("  main");
  });

  it("removes files from the Working Tree that are absent from the target Commit", async () => {
    dir = await makeTmpDir();
    const io = makeIO(dir);

    await runCli(["init"], io);
    await writeFile(join(dir, "a.txt"), "v1\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "first"], io);
    await runCli(["branch", "feature"], io);

    await mkdir(join(dir, "sub"), { recursive: true });
    await writeFile(join(dir, "sub", "b.txt"), "new\n");
    await runCli(["add", "sub/b.txt"], io);
    await runCli(["commit", "-m", "add b.txt on main"], io);

    expect(await runCli(["checkout", "feature"], io)).toBe(0);
    await expect(readFile(join(dir, "sub", "b.txt"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(join(dir, "a.txt"), "utf8")).toBe("v1\n");
  });

  it("refuses checkout when it would overwrite uncommitted changes, naming the path", async () => {
    dir = await makeTmpDir();
    const io = makeIO(dir);

    await runCli(["init"], io);
    await writeFile(join(dir, "a.txt"), "v1\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "first"], io);
    await runCli(["branch", "feature"], io);

    await writeFile(join(dir, "a.txt"), "v2\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "second, on main"], io);

    // Uncommitted local edit that checkout would need to overwrite.
    await writeFile(join(dir, "a.txt"), "dirty\n");

    const code = await runCli(["checkout", "feature"], io);
    expect(code).toBe(1);
    expect(io.errLines.join("\n")).toContain("a.txt");
    expect(await readFile(join(dir, "a.txt"), "utf8")).toBe("dirty\n"); // untouched: refused, not overwritten
  });

  it("deleting a branch removes it from the listing", async () => {
    dir = await makeTmpDir();
    const io = makeIO(dir);

    await runCli(["init"], io);
    await writeFile(join(dir, "a.txt"), "v1\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "first"], io);
    await runCli(["branch", "feature"], io);

    expect(await runCli(["branch", "-d", "feature"], io)).toBe(0);

    io.lines.length = 0;
    await runCli(["branch"], io);
    expect(io.lines).toEqual(["* main"]);
  });
});
