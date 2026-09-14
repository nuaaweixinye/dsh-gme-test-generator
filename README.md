# dsh-gme-workflow

English | [中文](README.zh.md)

GME Test Agent workflows inside [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`): three tools that pick interfaces, drive autonomous test generation and repair in a local Python backend, poll the task until review, and gate outward actions behind explicit user consent.

This is a community plugin, not an official DeepSeek package, and it needs an existing GME Test Agent checkout with its Python dependencies — it drives that project rather than replacing it.

## Requirements

- DeepSeek Harness `0.1.2-alpha.1` or newer on the `0.1.x` line, with a base-backed profile that provides `tools` and `systemPrompt`.
- A GME Test Agent checkout containing `backend/run_backend.py`, its `config.local.json`, its task database, and the GME repository and compiler toolchain it needs. **The backend is not bundled with this plugin**: its public copy — the framework, without GME-specific generated data — is [nuaaweixinye/gme-agent](https://github.com/nuaaweixinye/gme-agent), which documents cloning, configuration and how to generate the interface catalogs locally. The full checkout, which additionally carries those generated catalogs and the internal notes, is private: access is granted per person by [@nuaaweixinye](https://github.com/nuaaweixinye).
- A Python interpreter with that backend's dependencies installed, plus matching `deepseek-harness-sdk` and `deepseek-harness-runtime-bin` wheels in it.
- For automatic startup, a local `subprocess` service in the profile (every shipped profile has one).

The Python backend runs its coding work through the DeepSeek Harness Python SDK in a separate `sdk` profile. Build, tests and the memory audit run inside the backend as automatic stages of every task, not as chat actions. That coding profile includes file, search and PowerShell tools and excludes this plugin, so tasks never recurse.

## Install

From the plugin market (Settings → Plugin Market) — one click — or:

```sh
dsh plugin --profile web add dsh-gme-workflow
```

The command installs the package and appends it to the profile's `dsh.profile.bundles`; this package ships a `dsh.bundle.patch` layer, so **no profile file needs editing**. Restart `dsh web` afterwards.

## Configure

`backendRoot` is a deployment path, so it has no default and is never a model argument. Until it is set, the inserted row stays **disabled** (an `!!js` guard) and the plugin registers nothing — an unconfigured install is inert, never fatal.

**Option 1 — environment variables**, read when Harness starts:

```powershell
$env:GME_TEST_AGENT_ROOT  = 'D:/workspace/gme-test-agent'
$env:GME_TEST_AGENT_PYTHON = 'C:/ProgramData/Miniconda3/envs/agent/python.exe'   # optional, default 'python'
dsh web
```

**Option 2 — a profile patch**, in `$DSH_HOME/profiles/<profile>/cordis.patch.yml`:

```yaml
- id: gme-workflow
  disabled: false            # required: a config-only override keeps the `!!js` guard
  config:
    backendRoot: D:/workspace/gme-test-agent
    pythonPath: C:/ProgramData/Miniconda3/envs/agent/python.exe
    port: 8765
    autoStart: true
```

A patch row replaces only the keys it names, entire `config` included, and leaves other keys alone — which is why the guard has to be turned off explicitly when you supply paths this way.

| Config key | Default | Meaning |
|---|---|---|
| `backendRoot` | *(required)* | GME Test Agent checkout holding `backend/run_backend.py` |
| `pythonPath` | `python` | Interpreter with the backend's dependencies |
| `configFile` | `config.local.json` | Backend config, absolute or relative to `backendRoot` |
| `tokenFile` | `logs/web-api-token.log` | API token; created on automatic startup when missing |
| `port` | `8765` | Backend TCP port on IPv4 loopback |
| `autoStart` | `true` | Start an owned Python worker when the port refuses connections |
| `timeoutMs` | `15000` | Deadline for one HTTP request including its body |
| `startupTimeoutMs` | `45000` | Deadline for an owned worker to become healthy |
| `maxResponseBytes` | `8388608` | Maximum bytes retained from one response |
| `pageChars` | `12000` | Characters per returned report page (256–50000) |

If an older profile separately enables `tool-gme`, disable that row; installing this plugin does not remove other packages.

## Tools

| Tool | Zone |
|---|---|
| `gme_generate` | Autonomous generation: create tests from interface IDs or a free-form goal, batch creation, fix recorded failures, extend or retry a task |
| `gme_check` | Side-effect-free reads: interface catalogs, tasks, incremental events, failures with observations, test results, artifacts |
| `gme_decide` | Consent-gated decisions requiring `confirm: true`: task PR, known-failure skip PR, selected-tests PR, remove selected tests, cleanup, delete task |

For tests and extension, pass either catalog `interface_ids` or a free-form `goal`, never both: the backend discards a free-form goal when IDs are supplied, and the plugin rejects the combination. Batches require IDs. Query interfaces before choosing IDs, and use backend job IDs rather than Harness session IDs.

Generation runs autonomously from acceptance to `needs_review`; the model polls with `gme_check` and does not steer the intermediate build, test and memory-audit stages. Every response carries a `suggested_next` signpost whose `phase` moves poll → report → decide → done: keep polling while a task executes, report the summary, failures and diff at `needs_review`, and leave outward steps to the user. A `gme_decide` call without `confirm: true` fails with guidance and never reaches the backend.

Generation and decisions can return `accepted: true`; that means queued work, not successful validation. Report pages expose `content` (a slice of serialized JSON), `total_characters` and `next_offset`; repeat the same query with that offset. Growing lists may shift between pages; use bounded incremental `events.after` queries for live progress and completed artifacts for stable reports. A returned job with `status: failed` is a valid query result; infrastructure failures appear as tool errors.

## Behaviour and limits

- **Worker lifetime.** The first request reuses a server only after an authenticated health response; otherwise `autoStart: true` starts the configured Python entrypoint, and concurrent calls share that startup. Authentication failure, or another service on the port, fails without starting a worker. Disposal terminates only a backend this plugin started, including its children — so closing or reloading Harness can interrupt owned jobs, while an independently started backend survives. An owned worker that exits is restarted by a subsequent request; the interrupted job is not retried for you. Aborting a tool stops waiting but does not cancel an accepted backend job, and POST requests are never retried automatically: inspect tasks after an uncertain submission.
- **Credentials.** The token comes from `tokenFile`. It never appears in tool arguments, and only the API token is explicitly forwarded to the managed child. The coding SDK uses the `dsh_home` and `dsh_profile` configured in the backend; credentials must exist there. The outer workflow dialogue and each backend coding session keep separate histories.
- **Known limitations.** The Python checkout and its toolchain stay required; the backend has no cancellation endpoint and no automatic restart recovery; the `gme_decide` consent gate is a plugin-side `confirm: true` check, while the backend still applies its own submission and cleanup rules; free-form tasks inherit the backend's own selection and validation behaviour; large reports are character windows, not immutable snapshots or structured tables.

## Development

```sh
pnpm install
pnpm run verify        # typecheck + build + tests + packaged-artefact smoke
pnpm run test:live     # read-only smoke against a real backend (needs GME_TEST_AGENT_ROOT)
```

`src/backend.ts` owns authenticated transport and worker lifetime, `src/index.ts` owns tool schemas, route mapping, presentation and the unconfigured-mount guard, and `src/next-step.ts` maps backend statuses to the `suggested_next` signpost. `tests/install.spec.ts` composes the committed `cordis.patch.yml` through the include's real patch engine and mounts the resulting row into a real Loader tree. No invariant companion is published: backend state is authoritative and the plugin keeps no duplicate durable task state.

## License

MIT
