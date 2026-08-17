import { afterEach, describe, expect, it } from "vitest";
import { writeFile } from "node:fs/promises";
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

describe("CLI: diff", () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await removeTmpDir(dir);
  });

  it("reports a line-level change between two branches", async () => {
    dir = await makeTmpDir();
    const io = makeIO(dir);

    await runCli(["init"], io);
    await writeFile(join(dir, "a.txt"), "one\ntwo\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "first"], io);
    await runCli(["branch", "feature"], io);

    await writeFile(join(dir, "a.txt"), "one\nTWO\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "second, on main"], io);

    io.lines.length = 0;
    const code = await runCli(["diff", "feature", "main"], io);
    expect(code).toBe(0);
    const output = io.lines.join("\n");
    expect(output).toContain("a.txt");
    expect(output).toContain("-two");
    expect(output).toContain("+TWO");
  });

  it("accepts literal commit IDs as well as branch names", async () => {
    dir = await makeTmpDir();
    const io = makeIO(dir);

    await runCli(["init"], io);
    await writeFile(join(dir, "a.txt"), "v1\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "first"], io);
    const firstId = io.lines.at(-1)!;

    await writeFile(join(dir, "a.txt"), "v2\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "second"], io);
    const secondId = io.lines.at(-1)!;

    io.lines.length = 0;
    expect(await runCli(["diff", firstId, secondId], io)).toBe(0);
    expect(io.lines.join("\n")).toContain("a.txt");
  });

  it("reports nothing for a commit diffed against itself", async () => {
    dir = await makeTmpDir();
    const io = makeIO(dir);

    await runCli(["init"], io);
    await writeFile(join(dir, "a.txt"), "v1\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "first"], io);

    io.lines.length = 0;
    expect(await runCli(["diff", "main", "main"], io)).toBe(0);
    expect(io.lines).toEqual([]);
  });
});
