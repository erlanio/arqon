import {spawnSync} from 'node:child_process';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));

let generated = false;
for (const command of ['python3', 'python']) {
  const result = spawnSync(command, ['generate-icons.py'], {cwd: directory, stdio: 'inherit'});
  if (!result.error && result.status === 0) {
    generated = true;
    break;
  }
  if (result.error?.code !== 'ENOENT') throw result.error || new Error(`Falha ao gerar ícones com ${command}.`);
}
if (!generated) throw new Error('Python 3 com Pillow não está disponível.');
await import('./prepare-assets.mjs');
