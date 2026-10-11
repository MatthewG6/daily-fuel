import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { precachePaths } from '../src/offline.js';
const assets = [];
async function collect(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory()) await collect(`${directory}/${entry.name}`, `${path}/`);
    else if (entry.name !== 'sw.js') assets.push(path);
  }
}
await collect('dist');
const hash = createHash('sha256');
for (const asset of assets.sort()) hash.update(await readFile(`dist/${asset}`));
let source = await readFile('dist/sw.js', 'utf8');
source = source.replace("'daily-fuel-v1'", `'daily-fuel-${hash.digest('hex').slice(0, 12)}'`);
source = source.replace(/^const PRECACHE = .*;$/m, `const PRECACHE = ${JSON.stringify(precachePaths(assets))};`);
await writeFile('dist/sw.js', source);
console.log(`Precached ${assets.length} app assets.`);
