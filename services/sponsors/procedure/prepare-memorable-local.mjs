import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Explicit package download only. This never executes Memorable, its install hooks or its API.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '.runtime');
mkdirSync(root, { recursive: true });
for (const name of ['user.npmrc', 'global.npmrc']) writeFileSync(resolve(root, name), '');
const nodeBin = dirname(process.execPath);
const result = spawnSync(resolve(nodeBin, 'npm'), [
  '--userconfig', resolve(root, 'user.npmrc'), '--globalconfig', resolve(root, 'global.npmrc'),
  '--cache', resolve(root, 'npm-cache'), 'pack', 'memorable-cli@0.5.30',
  '--ignore-scripts', '--pack-destination', root, '--json'
], { cwd: root, env: { PATH: `${nodeBin}:/usr/bin:/bin` }, encoding: 'utf8', timeout: 30000, maxBuffer: 65536 });
assert.equal(result.status, 0, 'The explicit package download must succeed.');
const archive = resolve(root, 'memorable-cli-0.5.30.tgz');
const integrity = `sha512-${createHash('sha512').update(readFileSync(archive)).digest('base64')}`;
assert.equal(integrity, 'sha512-ba3kTDlKpe+ZKlyzvzBZYZpDjnf+hW/ZrF1Z/gc7tN9Zf0HMsD64R2j2F7QwuTtDtA/IYc4KzQdK1rKjNXZbnA==', 'Downloaded archive must match the reviewed official package.');
const extracted = spawnSync('/usr/bin/tar', ['-xzf', archive, '-C', root], { env: {}, encoding: 'utf8', timeout: 10000, maxBuffer: 65536 });
assert.equal(extracted.status, 0, 'The inspected package must unpack successfully.');
assert.equal(createHash('sha256').update(readFileSync(resolve(root, 'package/dist/cli.js'))).digest('hex'), 'db8a5082b3619fb8c982f67819701a2064b7592bbf652548f9bf8cd4d277934a');
process.stdout.write('Prepared unmodified memorable-cli 0.5.30 locally. No Memorable command or remote extraction ran.\n');
