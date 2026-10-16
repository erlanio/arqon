import {spawnSync} from 'node:child_process';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));

let generated = false;
const interpreters = process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python'];
for (const command of interpreters) {
  const result = spawnSync(command, ['generate-icons.py'], {cwd: directory, stdio: 'inherit'});
  if (!result.error && result.status === 0) {
    generated = true;
    break;
  }
}
if (!generated) throw new Error('Python 3 com Pillow não está disponível.');
await import('./prepare-assets.mjs');
