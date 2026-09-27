import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, resolve, sep } from 'node:path';
import { realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const WRAPPER = resolve(ROOT, 'scripts/brain');
const MAX_OUTPUT = 12_000_000;

export class BrainCommandError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BrainCommandError';
    this.code = code;
  }
}

// Deliberately do not inherit provider credentials, remote DB overrides or
// another track's GBrain home. The repository wrapper selects the family brain.
function command(args, input = '') {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(WRAPPER, args, {
      cwd: ROOT,
      env: { PATH: process.env.PATH, HOME: homedir(), NO_COLOR: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    let diagnostic = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      // Do not kill the wrapper while its GBrain child may hold PGLite open.
      // HTTP has its own deadline. Keep this queue occupied until the exact
      // command exits so recovery cannot overlap an uncertain writer.
    }, 120_000);
    child.stdout.setEncoding('utf8').on('data', chunk => {
      if (output.length < MAX_OUTPUT) output += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', chunk => {
      if (diagnostic.length < 100_000) diagnostic += chunk;
    });
    child.stdin.on('error', () => {});
    child.on('error', () => {
      clearTimeout(timer);
      reject(new BrainCommandError('gbrain_unavailable', 'The family GBrain wrapper could not start.'));
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (timedOut) return reject(new BrainCommandError('gbrain_timeout', 'GBrain operation timed out; retry the same request.'));
      if (output.length >= MAX_OUTPUT) return reject(new BrainCommandError('gbrain_output_limit', 'GBrain result exceeded the service limit.'));
      if (code !== 0) {
        // Raw CLI diagnostics may contain local configuration. Expose only its
        // structured code and our own message, never raw stderr or environment.
        let errorCode;
        let receipt;
        try {
          const result = JSON.parse(output);
          errorCode = result.error;
          receipt = result.write_request;
        } catch {}
        errorCode ||= diagnostic.match(/Error \[([a-z_]+)\]/)?.[1];
        const error = new BrainCommandError(errorCode || 'gbrain_failure', 'GBrain rejected the storage operation.');
        error.receipt = receipt;
        error.stage = args[0] === 'config' ? `config-${args[1]}` : args[0];
        error.exitCode = code;
        return reject(error);
      }
      resolveCommand(output);
    });
    child.stdin.end(input);
  });
}

function json(text) {
  try { return JSON.parse(text); } catch {
    throw new BrainCommandError('gbrain_invalid_response', 'GBrain returned an unreadable response.');
  }
}

async function committedCommand(args, input = '', run = command) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const receipt = json(await run(args, input));
      if (receipt.state === 'committed') return receipt;
      if (['failed', 'conflict', 'cancelled'].includes(receipt.state)) {
        throw new BrainCommandError('gbrain_uncommitted', 'GBrain did not commit the storage operation.');
      }
    } catch (error) {
      // GBrain 0.59 returns nonterminal queued/running/recovering receipts as
      // exit 1 with write_pending. Replay the exact intent and request UUID.
      if (error.code !== 'write_pending') throw error;
    }
  }
  throw new BrainCommandError('gbrain_uncommitted', 'GBrain has not confirmed the write; recovery must drain its journal.');
}

export class GBrain {
  constructor({ run = command, resolvePath = realpath } = {}) {
    this.run = run;
    this.resolvePath = resolvePath;
  }

  async preflight() {
    // Engine status is engine-free and redacts URLs. Refuse remote or misplaced
    // storage before any command opens a database. Never print the report.
    const engine = json(await this.run(['engine', 'status', '--json']));
    const familyRoot = await this.resolvePath(resolve(homedir(), 'Workspace/care-circle-brain'));
    const databasePath = engine.database_path ? await this.resolvePath(engine.database_path) : null;
    if (engine.effective_engine !== 'pglite' || engine.thin_client !== false || !databasePath?.startsWith(`${familyRoot}${sep}`)) {
      throw new BrainCommandError('unsafe_brain_storage', 'The family brain must use local PGLite storage inside its dedicated Care Circle directory.');
    }
    const embedding = await this.run(['config', 'get', 'embedding_disabled']);
    if (embedding.trim() !== 'true') {
      throw new BrainCommandError('external_processing_disabled', 'Family GBrain must have embedding_disabled=true before service startup.');
    }
    // Import must never cause subsequent writes to modify the world package.
    await this.run(['config', 'set', 'sync.write_through', 'false']);
  }

  async get(slug) {
    try {
      return json(await this.run(['call', 'get_page', JSON.stringify({ slug, include_content: true, source_id: 'default' })]));
    } catch (error) {
      if (error.code === 'page_not_found') return null;
      throw error;
    }
  }

  async put(slug, content, { expectedRevision, requestId = randomUUID(), force = false } = {}) {
    const args = ['put', slug, '--source-id', 'default', '--request-id', requestId];
    if (expectedRevision) args.push('--expected-revision', expectedRevision);
    else if (force) args.push('--force');
    // CLI stdin avoids OS argv size limits and never goes through a shell.
    return committedCommand(args, content, this.run);
  }

  async barrier() {
    // GBrain 0.59's persistence journal drains database-only writes FIFO for
    // one source incarnation. A committed later write proves prior admitted
    // writes reached terminal state, even after a crash lost their UUIDs.
    // Always do this BEFORE choosing the canonical snapshot during recovery.
    await this.put('care-circle/storage-barrier', `---\ntype: note\ntitle: Care Circle storage recovery barrier\nembed_skip: true\n---\n# Internal storage recovery barrier\n\n${randomUUID()}\n`, { force: true });
    await this.requireImportQuiescence();
  }

  async writerStatus() {
    return json(await this.run(['sources', 'writer', 'status', 'default', '--json']));
  }

  async requireImportQuiescence(status = null) {
    status ??= await this.writerStatus();
    const binding = status.bindings?.find(item => item.source_id === 'default');
    const worktree = status.worktrees?.find(item => item.id === binding?.worktree_id);
    if (!binding || !worktree || typeof binding.worktree_id !== 'string' || !binding.worktree_id.trim() ||
      ['queued', 'running', 'recovering', 'recovering_effects', 'recovery_bytes']
        .some(key => worktree[key] !== 0 && worktree[key] !== '0')) {
      // Managed imports use a worktree queue, distinct from database-only
      // writes. Never assume our DB barrier fenced an unfinished file import.
      throw new BrainCommandError('gbrain_import_pending', 'Native source import recovery is still pending.');
    }
    return status;
  }

  async remove(slug) {
    const page = await this.get(slug);
    if (!page) return;
    await committedCommand(['call', 'delete_page', JSON.stringify({
      slug, source_id: 'default', expected_revision: page.revision, request_id: randomUUID(),
    })], '', this.run);
  }

  async importWorld(directory) {
    // Managed GBrain imports require a canonical file owner even when later
    // page writes are database-only. Inspect only safe ownership metadata and
    // permit import write-through solely into this product brain's own root.
    const status = await this.requireImportQuiescence();
    const binding = status.bindings?.find(item => item.source_id === 'default');
    const familyRoot = await this.resolvePath(resolve(homedir(), 'Workspace/care-circle-brain'));
    const canonicalRoot = binding?.local_path ? await this.resolvePath(resolve(binding.local_path, binding.relative_path || '')) : null;
    const localHost = typeof status.host_id === 'string' && status.host_id.trim().length > 0;
    const ownerHost = typeof binding?.owner_host_id === 'string' && binding.owner_host_id.trim().length > 0;
    if (!canonicalRoot?.startsWith(`${familyRoot}${sep}`) || binding?.state !== 'active' ||
        !localHost || !ownerHost || binding.owner_host_id !== status.host_id) {
      throw new BrainCommandError('unsafe_import_owner', 'Native import requires an active canonical owner inside the dedicated Care Circle family brain.');
    }
    try {
      await this.run(['config', 'set', 'sync.write_through', 'true']);
      const result = json(await this.run(['import', directory, '--source-id', 'default', '--no-embed', '--allow-noncanonical-root', '--json']));
      if (result.errors || result.status !== 'success') throw new BrainCommandError('gbrain_import_failed', 'Native world import did not commit all source pages.');
      await this.requireImportQuiescence();
      return result;
    } finally {
      await this.run(['config', 'set', 'sync.write_through', 'false']);
    }
  }

  async extractLinks() {
    await this.run(['extract', 'links', '--source', 'db', '--source-id', 'default']);
  }
}
