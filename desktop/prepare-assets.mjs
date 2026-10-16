import {cp, mkdir, readdir, rm, stat} from 'node:fs/promises';
import {dirname, extname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const desktop = dirname(fileURLToPath(import.meta.url));
const source = resolve(desktop, '..');
const output = join(desktop, 'web-dist');
const extensions = new Set(['.html', '.css', '.js', '.mjs', '.json', '.woff2', '.txt']);
const excluded = new Set(['desktop', 'dist', 'tests', '__pycache__', 'macos']);

await rm(output, {recursive: true, force: true});
await mkdir(output, {recursive: true});

async function copyDirectory(directory) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    if (excluded.has(entry.name)) continue;
    const sourcePath = join(directory, entry.name);
    if (entry.isDirectory()) await copyDirectory(sourcePath);
    else if (entry.isFile() && extensions.has(extname(entry.name))) {
      const destination = join(output, relative(source, sourcePath));
      await mkdir(dirname(destination), {recursive: true});
      await cp(sourcePath, destination);
    }
  }
}

await copyDirectory(source);
if (!(await stat(join(output, 'index.html'))).isFile()) throw new Error('index.html não foi empacotado.');
console.log(`Recursos estáticos preparados em ${output}`);
