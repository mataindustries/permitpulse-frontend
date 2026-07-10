import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const read = (path) => readFileSync(resolve(appRoot, path), "utf8");

function cssFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return cssFiles(path);
    }

    return entry.isFile() && entry.name.endsWith(".css") ? [path] : [];
  });
}

const sources = {
  document: read("index.html"),
  legacy: read("src/client/styles.css"),
  mission: read("src/client/features/mission-control/mission-control.css"),
  shell: read("src/client/os/os.css"),
  primitives: read("src/client/design-system/primitives.css"),
  tokens: read("src/client/styles/tokens.css"),
};

const required = [
  ["Android viewport cover", sources.document, "viewport-fit=cover"],
  ["top safe area", sources.shell, "env(safe-area-inset-top"],
  ["bottom safe area", sources.shell, "env(safe-area-inset-bottom"],
  ["left safe area", sources.shell, "env(safe-area-inset-left"],
  ["right safe area", sources.shell, "env(safe-area-inset-right"],
  ["five bottom destinations", sources.shell, "grid-template-columns: repeat(5"],
  ["44px touch target", sources.tokens, "--pp-touch-target: 2.75rem"],
  ["mobile-first expansion", sources.shell, "@media (min-width: 48rem)"],
  ["responsive mission grid", sources.mission, "@media (min-width: 48rem)"],
  ["reduced-motion tokens", sources.tokens, "@media (prefers-reduced-motion: reduce)"],
  ["near-zero reduced duration", sources.tokens, "--pp-duration-fast: 0.01ms"],
  ["reduced skeleton motion", sources.primitives, "@media (prefers-reduced-motion: reduce)"],
  ["graphite canvas token", sources.tokens, "--pp-surface-canvas"],
  ["jade accent token", sources.tokens, "--pp-jade-500"],
];

const failures = required
  .filter(([, source, needle]) => !source.includes(needle))
  .map(([label]) => `Missing ${label}`);

const visualCss = cssFiles(resolve(appRoot, "src/client"))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

const forbidden = [
  ["gradient", /(?:linear|radial|conic)-gradient\s*\(/i],
  ["glassmorphism blur", /backdrop-filter\s*:/i],
  ["purple-family named color", /\b(?:purple|violet|magenta)\b/i],
  ["neon styling", /\bneon\b/i],
];

for (const [label, pattern] of forbidden) {
  if (pattern.test(visualCss)) {
    failures.push(`Found forbidden ${label}`);
  }
}

if (failures.length > 0) {
  console.error(`PermitPulse OS foundation verification failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("PermitPulse OS foundation verified: safe areas, responsive shell, reduced motion, and visual constraints.");
}
