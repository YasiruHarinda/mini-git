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

describe("CLI: merge-base and merge", () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await removeTmpDir(dir);
  });

  it("reports the shared ancestor of two diverged branches", async () => {
    dir = await makeTmpDir();
    const io = makeIO(dir);

    await runCli(["init"], io);
    await writeFile(join(dir, "a.txt"), "base\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "base"], io);
    const baseId = io.lines.at(-1)!;
    await runCli(["branch", "feature"], io);

    await writeFile(join(dir, "a.txt"), "main-1\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "on main"], io);

    await runCli(["checkout", "feature"], io);
    await writeFile(join(dir, "a.txt"), "feature-1\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "on feature"], io);

    io.lines.length = 0;
    expect(await runCli(["merge-base", "main", "feature"], io)).toBe(0);
    expect(io.lines).toEqual([baseId]);
  });

  it("fast-forwards main to a feature branch that has moved ahead", async () => {
    dir = await makeTmpDir();
    const io = makeIO(dir);

    await runCli(["init"], io);
    await writeFile(join(dir, "a.txt"), "base\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "base"], io);
    await runCli(["branch", "feature"], io);

    await runCli(["checkout", "feature"], io);
    await writeFile(join(dir, "a.txt"), "feature-1\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "on feature"], io);
    const featureTip = io.lines.at(-1)!;

    await runCli(["checkout", "main"], io);
    io.lines.length = 0;
    expect(await runCli(["merge", "feature"], io)).toBe(0);
    expect(io.lines.join("\n")).toContain(featureTip);

    io.lines.length = 0;
    await runCli(["log"], io);
    expect(io.lines.join("\n")).toContain(featureTip); // main's HEAD advanced to feature's tip
  });

  it("reports already up to date without error", async () => {
    dir = await makeTmpDir();
    const io = makeIO(dir);

    await runCli(["init"], io);
    await writeFile(join(dir, "a.txt"), "base\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "base"], io);
    await runCli(["branch", "old"], io);

    await writeFile(join(dir, "a.txt"), "advanced\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "advance main"], io);

    io.lines.length = 0;
    expect(await runCli(["merge", "old"], io)).toBe(0);
    expect(io.lines).toEqual(["Already up to date."]);
  });

  it("completes a three-way merge with a real Merge Commit when both sides edited different lines", async () => {
    dir = await makeTmpDir();
    const io = makeIO(dir);

    await runCli(["init"], io);
    await writeFile(join(dir, "a.txt"), "one\ntwo\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "base"], io);
    await runCli(["branch", "feature"], io);

    await writeFile(join(dir, "a.txt"), "ONE\ntwo\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "on main"], io);

    await runCli(["checkout", "feature"], io);
    await writeFile(join(dir, "a.txt"), "one\nTWO\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "on feature"], io);

    await runCli(["checkout", "main"], io);
    io.lines.length = 0;
    expect(await runCli(["merge", "feature"], io)).toBe(0);
    expect(io.lines.join("\n")).toContain("Merge made by");
  });

  it("reports a conflict and completes the merge only after resolve", async () => {
    dir = await makeTmpDir();
    const io = makeIO(dir);

    await runCli(["init"], io);
    await writeFile(join(dir, "a.txt"), "one\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "base"], io);
    await runCli(["branch", "feature"], io);

    await writeFile(join(dir, "a.txt"), "ONE\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "on main"], io);

    await runCli(["checkout", "feature"], io);
    await writeFile(join(dir, "a.txt"), "one-alt\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "on feature"], io);

    await runCli(["checkout", "main"], io);
    io.errLines.length = 0;
    expect(await runCli(["merge", "feature"], io)).toBe(1);
    expect(io.errLines.join("\n")).toContain("a.txt");

    // Committing while unresolved fails, and the sidecar persisted the pending Conflict across this new process.
    expect(await runCli(["commit", "-m", "too soon"], io)).toBe(1);

    expect(await runCli(["resolve", "theirs", "a.txt"], io)).toBe(0);

    io.lines.length = 0;
    expect(await runCli(["commit", "-m", "resolve conflict"], io)).toBe(0);
    expect(io.lines).toHaveLength(1); // the merge Commit's Object ID

    io.lines.length = 0;
    await runCli(["log"], io);
    const output = io.lines.join("\n");
    expect(output).toContain("resolve conflict");
  });
});
