import { build } from "esbuild";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const outputDirectory = await mkdtemp(
  path.join(tmpdir(), "permitpulse-ai-eval-local-"),
);
const outfile = path.join(outputDirectory, "ai-eval-local.mjs");

await build({
  bundle: true,
  entryPoints: [path.join(import.meta.dirname, "ai-eval-local-entry.ts")],
  format: "esm",
  logLevel: "silent",
  outfile,
  platform: "node",
  target: "node22",
});

await import(pathToFileURL(outfile).href);
