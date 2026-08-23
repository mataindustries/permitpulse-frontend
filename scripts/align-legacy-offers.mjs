import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const excluded = new Set(['sgv-ev-battery-radar.html']);

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(absolute);
    if (entry.isFile() && entry.name.endsWith('.html') && !excluded.has(entry.name)) return [absolute];
    return [];
  }));
  return nested.flat();
}

function align(source) {
  return source
    .replace(/https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+/g, '/#research-intake')
    .replace(/Permit Review Plus/g, 'Permit Deep Research')
    .replace(/#mission-control/g, '#research-intake')
    .replace(/Mission Control/g, 'Permit Deep Research')
    .replace(/Open Permit Deep Research/g, 'Research an address')
    .replace(/(?:Get|Order|Start) Permit Deep Research(?:\s*—\s*\$149(?:\s*\(Fast-Track\))?)?(?:\s*y arrancamos)?/g, 'Research an address')
    .replace(/Order \$149 Review/g, 'Research an address')
    .replace(/Start Pro\s*—\s*\$29\/mo/g, 'Research an address')
    .replace(/Upgrade now/g, 'Research an address')
    .replace(/\sdata-pp-price="(?:99|149|300)"/g, '')
    .replace(/data-pp-event="pp_checkout_click"/g, 'data-pp-event="research_intake_cta_click"')
    .replace(/href="\/#research-intake"\s+target="_blank"\s+rel="noopener"/g, 'href="/#research-intake"')
    .replace(/href="\/#research-intake"\s+rel="noopener"\s+target="_blank"/g, 'href="/#research-intake"');
}

const files = await htmlFiles(root);
let changed = 0;
for (const file of files) {
  const before = await readFile(file, 'utf8');
  const after = align(before);
  if (after !== before) {
    await writeFile(file, after);
    changed += 1;
  }
}
console.log('Aligned legacy offer references in ' + changed + ' HTML files.');

