# Care Circle runtime

Purpose: start the local demo, stop only runtime-owned processes, check the live stack, and reset synthetic demo data through HTTP. This package has no dependencies or HTTP listener of its own.

## Run

From the repository root, with Node 22 or newer, Python 3 for the hook installer, and the service prerequisites installed. Lifecycle identity checks require POSIX `ps`; hook installation uses POSIX symlinks.

```sh
scripts/setup
scripts/start
scripts/smoke
scripts/demo-reset
scripts/stop
```

`scripts/setup` checks the local Node/Python prerequisites and runs `scripts/install-hooks` for a fresh clone. The installer is safe to run again and refuses to overwrite an unknown hook. The hook blocks credential-like filenames and likely secrets without printing matching content. Setup does not open, initialize, or modify the family GBrain; follow the brain owner's separate prerequisite instructions.

`scripts/start brain` and `scripts/stop brain` select a service. Available names are `brain`, `river`, `ingest`, `brief`, `sponsors`, and `web`. With no names, all services are selected. Start order is brain, River, ingest, brief, sponsors, web. Stop order is reversed. A selected service does not automatically start its dependencies.

Start and demo-reset wait up to 180 seconds per service for health. Use `--timeout-ms 300000` if first-time GBrain startup takes longer. Stop allows 30 seconds for graceful termination by default. Timeouts must be between 1000 and 900000 milliseconds.

Open the family room at <http://127.0.0.1:4700>. All services bind loopback. Ports 4700 through 4706 are the fixed contract ports. Sponsors starts both 4705 and the synthetic clinic on 4706 in one process.

## Checks

```sh
npm test --prefix packages/runtime
scripts/smoke
```

Package tests use synthetic fixture processes on 4715 and 4716, with isolated runtime receipts. The smoke command checks all seven health endpoints, seeded brain pages and graph, medication citations, brief responses, honest sponsor status, the UI safety footer, and the web brain proxy. It performs no ingest or reset. Independent full demo acceptance belongs to `tests/e2e/`.

The static world has no listener. Validate its source package separately with `npm test --prefix packages/world`; runtime observes that data only through brain HTTP.

## Process ownership

Only processes spawned by this runtime receive receipts, under `.runtime/managed/`. Each receipt records service, PID, a unique process-title marker, OS process identity, entry path, and timestamp. Successful stops archive the receipt with a stop timestamp under `history/` before removing it from active ownership. Service stdout and stderr append to local `.log` files in that directory. Runtime never reads credentials or loads environment files, and starting River does not trigger its opt-in training scripts.

Repeated start reuses healthy processes. A healthy listener without a matching receipt remains external and is never adopted. A port that is occupied without the expected health response blocks startup; coordinate with its owner. A partial sponsor group also blocks duplicate startup.

Before sending SIGTERM, stop verifies the receipt's PID and complete OS process identity. Stale or unverifiable receipts cause no signal. Stop never uses process groups, name matching, port-based killing, or SIGKILL. A slow graceful shutdown fails with the receipt retained, so the owner can inspect the service without interrupting a possible brain write.

Start, stop, and demo-reset share a directory lock held throughout the operation. Another command waits up to ten seconds and then reports the active operation. SIGINT and SIGTERM cancel the command and release its lock while retaining service receipts. A later command can recover a stale lock only after proving its recorded PID and OS identity no longer match, taking an exclusive recovery claim, and rechecking that proof before moving the old lock aside. Live or unverifiable locks are left untouched. If an OS crash interrupts the recovery itself or leaves an incomplete lock without an owner record, manual inspection is required. Coordinator files elsewhere in `.runtime/` are unrelated and must remain untouched.

## Reset and safety

`scripts/demo-reset` first ensures the full stack is healthy. It then calls brain `POST /v1/reset` and sponsors `POST /v1/reset`, both with `{}`, and verifies that the recorded synthetic lisinopril baseline is 10 mg. It never opens the family brain database, invokes the brain CLI, or deletes brain directories. The demo's recorded dose is a source claim, not a treatment recommendation.

If a reset request times out, its outcome is uncertain. Runtime reports that uncertainty and does not automatically retry a mutation that could still be running. Coordinate reset and ingest windows with the QA lane so shared demo state remains predictable.

HTTP calls use fixed 127.0.0.1 addresses, reject redirects, and bound response sizes and time. All demo data is synthetic. Not medical advice.

## Files and dependencies

- `cli.mjs`: command parsing and serialized operation dispatch.
- `registry.mjs`: contract ports, endpoint identities, and start order.
- `lifecycle.mjs`: exact process receipts, health waiting, start, and graceful stop.
- `http.mjs`: bounded loopback HTTP requests.
- `checks.mjs`: read-only smoke and HTTP-only demo reset.
- `lifecycle.test.mjs`, `fixtures/`, `hooks.test.mjs`: local synthetic tests.
- `../../scripts/start`, `stop`, `smoke`, `demo-reset`: cwd-independent entrypoints.
- `../../scripts/setup`, `install-hooks`, `hooks/pre-commit`: public repository hook setup.

Depends on shared `contract/index.mjs` and each service's documented HTTP API. Runtime does not import service code or read service storage. GBrain, River, Memorable, and UFO integration reality is reported by their service owners; runtime does not claim sponsor execution based on a health response.
