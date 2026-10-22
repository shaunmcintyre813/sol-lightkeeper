import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const dist = join(repo, 'dist');
const { build, version } = JSON.parse(await readFile(join(repo, 'content-version.json'), 'utf8'));
if (!Number.isInteger(build) || build < 1 || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid content version');
const files = [];
async function visit(folder) {
  for (const item of await readdir(folder, { withFileTypes: true })) {
    const full = join(folder, item.name);
    const path = relative(dist, full).split(sep).join('/');
    if (path === 'downloads' || path === 'update.manifest') continue;
    if (item.isDirectory()) await visit(full);
    else if (item.isFile()) files.push(path);
  }
}
await visit(dist);
files.sort();
const lines = [`sol-lightkeeper-content-v1\t${build}\t${version}`];
for (const path of files) {
  if (!/^[A-Za-z0-9._/-]+$/.test(path) || path.includes('..') || path.startsWith('/')) throw new Error(`Unsafe content path: ${path}`);
  const bytes = await readFile(join(dist, path));
  lines.push(`${path}\t${bytes.length}\t${createHash('sha256').update(bytes).digest('hex')}`);
}
const manifest = lines.join('\n') + '\n';
const output = join(dist, 'update.manifest');
if (process.argv.includes('--check')) {
  if (await readFile(output, 'utf8') !== manifest) throw new Error('Stale update.manifest; run node tools/update-manifest.mjs');
} else {
  await writeFile(output, manifest);
}
console.log(`Content ${version} build ${build}: ${files.length} files`);
