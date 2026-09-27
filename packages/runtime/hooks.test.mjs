import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const filenameMessage = 'pre-commit: credential-like filename blocked; keep credentials outside the repository.';
const contentMessage = 'pre-commit: possible secret in added content; blocked without printing it.';

function fixture(t, { initialize = true } = {}) {
  const temporary = mkdtempSync(join(tmpdir(), 'carecircle-hooks-'));
  const repo = join(temporary, 'repository with spaces');
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (name.startsWith('GIT_')) delete environment[name];
  }
  environment.GIT_CONFIG_NOSYSTEM = '1';
  environment.GIT_CONFIG_GLOBAL = join(temporary, 'empty-git-config');
  writeFileSync(environment.GIT_CONFIG_GLOBAL, '');
  mkdirSync(join(repo, 'scripts', 'hooks'), { recursive: true });
  for (const name of ['install-hooks', 'hooks/pre-commit']) {
    copyFileSync(join(root, 'scripts', name), join(repo, 'scripts', name));
    chmodSync(join(repo, 'scripts', name), 0o755);
  }
  const run = (command, args, cwd = repo) => spawnSync(command, args, {
    cwd, env: environment, encoding: 'utf8', timeout: 10_000,
  });
  const git = (...args) => run('git', args);
  const install = () => run(join(repo, 'scripts', 'install-hooks'), [], temporary);
  if (initialize) {
    const template = join(temporary, 'empty-template');
    mkdirSync(template);
    assert.equal(git('init', '--quiet', `--template=${template}`).status, 0);
    assert.equal(git('config', 'user.name', 'Synthetic Hook Test').status, 0);
    assert.equal(git('config', 'user.email', 'synthetic@example.invalid').status, 0);
    assert.equal(git('config', 'commit.gpgsign', 'false').status, 0);
  }
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const hook = join(repo, '.git', 'hooks', 'pre-commit');
  const stage = (name, contents = 'Synthetic fixture only.\n') => {
    const path = join(repo, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
    assert.equal(git('add', '--', name).status, 0);
  };
  return { repo, hook, git, install, stage, temporary };
}

function rejectedCommit(f, message, forbiddenOutput = []) {
  const result = f.git('commit', '--quiet', '-m', 'Synthetic hook verification');
  assert.notEqual(result.status, 0, 'the installed hook must reject this commit');
  assert.equal(result.stderr.trim(), message);
  const output = result.stdout + result.stderr;
  for (const value of forbiddenOutput) {
    assert.equal(output.includes(value), false, 'hook diagnostics must omit fixture contents');
  }
  assert.notEqual(f.git('rev-parse', '--verify', 'HEAD').status, 0, 'rejection must leave no commit');
}

test('fresh installation works from another directory and is idempotent', (t) => {
  const f = fixture(t);
  assert.equal(f.install().status, 0);
  assert.equal(lstatSync(f.hook).isSymbolicLink(), true);
  assert.equal(resolve(dirname(f.hook), readlinkSync(f.hook)), join(f.repo, 'scripts/hooks/pre-commit'));
  assert.equal(f.install().status, 0);
  f.stage('notes.txt');
  assert.equal(f.git('commit', '--quiet', '-m', 'Synthetic safe commit').status, 0);
});

test('an identical original hook is preserved and made executable', (t) => {
  const f = fixture(t);
  mkdirSync(dirname(f.hook), { recursive: true });
  copyFileSync(join(f.repo, 'scripts/hooks/pre-commit'), f.hook);
  chmodSync(f.hook, 0o644);
  const before = lstatSync(f.hook);
  assert.equal(f.install().status, 0);
  assert.equal(lstatSync(f.hook).ino, before.ino);
  assert.equal(lstatSync(f.hook).mode & 0o111, 0o111);
  assert.deepEqual(readFileSync(f.hook), readFileSync(join(f.repo, 'scripts/hooks/pre-commit')));
  assert.equal(f.install().status, 0);
});

test('an unfamiliar existing hook is refused and preserved', (t) => {
  const f = fixture(t);
  mkdirSync(dirname(f.hook), { recursive: true });
  const custom = '#!/bin/sh\nexit 1\n';
  writeFileSync(f.hook, custom, { mode: 0o755 });
  const before = lstatSync(f.hook);
  const result = f.install();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unfamiliar pre-commit hook/);
  assert.equal(readFileSync(f.hook, 'utf8'), custom);
  assert.equal(lstatSync(f.hook).ino, before.ino);
});

test('an unfamiliar hook symlink is refused and preserved', (t) => {
  const f = fixture(t);
  mkdirSync(dirname(f.hook), { recursive: true });
  const elsewhere = join(f.temporary, 'other-hook');
  writeFileSync(elsewhere, '#!/bin/sh\nexit 1\n', { mode: 0o644 });
  symlinkSync(elsewhere, f.hook);
  assert.equal(f.install().status, 1);
  assert.equal(readlinkSync(f.hook), elsewhere);
  assert.equal(lstatSync(elsewhere).mode & 0o777, 0o644);
});

test('an unfamiliar hook directory is refused and preserved', (t) => {
  const f = fixture(t);
  mkdirSync(f.hook, { recursive: true });
  assert.equal(f.install().status, 1);
  assert.equal(lstatSync(f.hook).isDirectory(), true);
});

test('an unfamiliar hook pipe is refused without waiting for a writer', (t) => {
  const f = fixture(t);
  mkdirSync(dirname(f.hook), { recursive: true });
  const created = spawnSync('python3', ['-c', 'import os, sys; os.mkfifo(sys.argv[1])', f.hook]);
  assert.equal(created.status, 0);
  assert.equal(f.install().status, 1);
  assert.equal(lstatSync(f.hook).isFIFO(), true);
});

test('configured hook paths are preserved and require manual integration', (t) => {
  const f = fixture(t);
  assert.equal(f.git('config', 'core.hooksPath', 'custom-hooks').status, 0);
  const result = f.install();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /core\.hooksPath is configured/);
  assert.equal(existsSync(f.hook), false);
  assert.equal(existsSync(join(f.repo, 'custom-hooks')), false);
});

test('a non-repository fails without creating Git metadata', (t) => {
  const f = fixture(t, { initialize: false });
  assert.equal(f.install().status, 1);
  assert.equal(existsSync(join(f.repo, '.git')), false);
});

test('every existing credential filename restriction rejects commits', async (t) => {
  const names = ['.env', '.env.local', 'nested/.env', 'nested/.env.synthetic',
    'auth.json', 'nested/custom-auth.json.backup', 'credentials.json',
    'nested/credentials.json.copy', 'synthetic.pem', 'nested/synthetic.key.backup'];
  for (const [index, name] of names.entries()) {
    await t.test(`filename restriction ${index + 1}`, (t) => {
      const f = fixture(t);
      assert.equal(f.install().status, 0);
      f.stage(name);
      rejectedCommit(f, filenameMessage, [name]);
    });
  }
});

test('every existing added-content restriction rejects without printing matches', async (t) => {
  // Every value is deliberately synthetic and generated locally, never a credential.
  const cases = [
    ['provider token', () => 'sk-' + 'SyntheticOnly'.repeat(3)],
    ['classic repository token', () => 'ghp_' + 'SyntheticOnly'.repeat(3)],
    ['fine-grained repository token', () => 'github_pat_' + 'SyntheticOnly'.repeat(3)],
    ['cloud identifier', () => 'AKIA' + 'S'.repeat(16)],
    ...'baprs'.split('').map((suffix) => [`chat token ${suffix}`, () => `xox${suffix}-` + 'SyntheticOnly'.repeat(2)]),
    ['private key header', () => ['-----BEGIN ', 'PRIVATE KEY-----'].join('')],
    ['typed private key header', () => ['-----BEGIN RSA ', 'PRIVATE KEY-----'].join('')],
    ...['apiKey', 'api_key', 'api-key', 'secret', 'token', 'PASSWORD'].map((label) => [
      `quoted assignment ${label}`, () => `${label} = '${'SyntheticOnly'.repeat(2)}'`,
    ]),
  ];
  for (const [label, create] of cases) {
    await t.test(label, (t) => {
      const f = fixture(t);
      assert.equal(f.install().status, 0);
      const value = create();
      f.stage('synthetic.txt', value + '\n');
      rejectedCommit(f, contentMessage, [value]);
    });
  }
});

test('staged content is checked even after the working copy becomes safe', (t) => {
  const f = fixture(t);
  assert.equal(f.install().status, 0);
  const value = 'sk-' + 'SyntheticOnly'.repeat(3);
  f.stage('synthetic.txt', value + '\n');
  writeFileSync(join(f.repo, 'synthetic.txt'), 'Safe synthetic replacement.\n');
  rejectedCommit(f, contentMessage, [value]);
});

test('unstaged synthetic matches do not reject a safe staged snapshot', (t) => {
  const f = fixture(t);
  assert.equal(f.install().status, 0);
  f.stage('synthetic.txt', 'Safe synthetic staged note.\n');
  writeFileSync(join(f.repo, 'synthetic.txt'), 'sk-' + 'SyntheticOnly'.repeat(3) + '\n');
  assert.equal(f.git('commit', '--quiet', '-m', 'Synthetic staged snapshot').status, 0);
  assert.equal(f.git('show', 'HEAD:synthetic.txt').stdout, 'Safe synthetic staged note.\n');
});
