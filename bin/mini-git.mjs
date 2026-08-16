#!/usr/bin/env -S node --import tsx/esm

import { runCli } from "../src/cli/main.ts";

const exitCode = await runCli(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line),
});

process.exit(exitCode);
