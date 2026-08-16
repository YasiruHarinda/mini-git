import { afterEach, describe, expect, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runCli, type CliIO } from "../src/cli/main.js";
import { hasRealGit, runGit } from "./support/real-git.js";
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

describe("CLI: init, add, commit, log against real files on disk", () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await removeTmpDir(dir);
  });

  it("builds real history a session at the terminal would produce", async () => {
    dir = await makeTmpDir();
    const io = makeIO(dir);

    expect(await runCli(["init"], io)).toBe(0);

    await writeFile(join(dir, "README.md"), "hello mini-git\n");
    await mkdir(join(dir, "src"), { recursive: true });
    await writeFile(join(dir, "src", "main.js"), "console.log('hi');\n");

    expect(await runCli(["add", "README.md", "src/main.js"], io)).toBe(0);
    expect(await runCli(["commit", "-m", "first commit"], io)).toBe(0);
    const firstId = io.lines.at(-1);
    expect(firstId).toMatch(/^[0-9a-f]{40}$/);

    // Index persists across CLI invocations via the sidecar, so a second
    // commit that only touches one file still carries README.md forward.
    await writeFile(join(dir, "src", "main.js"), "console.log('updated');\n");
    expect(await runCli(["add", "src/main.js"], io)).toBe(0);
    expect(await runCli(["commit", "-m", "second commit"], io)).toBe(0);
    const secondId = io.lines.at(-1);
    expect(secondId).not.toBe(firstId);

    io.lines.length = 0;
    expect(await runCli(["log"], io)).toBe(0);
    const output = io.lines.join("\n");
    expect(output).toContain(firstId!);
    expect(output).toContain(secondId!);
    expect(output).toContain("first commit");
    expect(output).toContain("second commit");
  });

  it("refuses to commit with nothing staged and reports why", async () => {
    dir = await makeTmpDir();
    const io = makeIO(dir);
    await runCli(["init"], io);
    const code = await runCli(["commit", "-m", "nope"], io);
    expect(code).toBe(1);
    expect(io.errLines.join("\n")).toMatch(/empty/i);
  });

  it.skipIf(!hasRealGit())("real git log reads the resulting repository and shows the same history", async () => {
    dir = await makeTmpDir();
    const io = makeIO(dir);

    await runCli(["init"], io);
    await writeFile(join(dir, "a.txt"), "content a\n");
    await runCli(["add", "a.txt"], io);
    await runCli(["commit", "-m", "commit via mini-git"], io);
    const commitId = io.lines.at(-1)!;

    const log = runGit(dir, ["log", "--format=%H %s"]);
    expect(log.status).toBe(0);
    expect(log.stdout.trim()).toBe(`${commitId} commit via mini-git`);

    const catFile = runGit(dir, ["cat-file", "-p", `${commitId}:a.txt`]);
    expect(catFile.status).toBe(0);
    expect(catFile.stdout).toBe("content a\n");
  });
});

if (!hasRealGit()) {
  console.warn("Skipping CLI/real-git differential test: real git not found on PATH.");
}
