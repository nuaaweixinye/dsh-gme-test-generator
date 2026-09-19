# Backend setup

[中文](setup.zh.md) | English

`dsh-gme-workflow` is a client of an existing GME Test Generator checkout. It starts and talks to that project's local HTTP backend; it does not ship, copy or replace it. This page is the checklist for that side of the wiring.

## 1. The GME Test Generator checkout

First, get the checkout itself. **It is not bundled with this plugin.** The public copy — the framework, without GME-specific generated data — is [nuaaweixinye/gme-agent](https://github.com/nuaaweixinye/gme-agent):

```powershell
git clone https://github.com/nuaaweixinye/gme-agent.git
cd gme-agent
scripts\install.ps1 -GmeRepo D:\GME   # checks the toolchain, builds .venv, installs the pinned harness wheels + requirements, writes config.local.json
scripts\run_web.ps1                   # starts the backend
```

Its README covers the rest, including generating the module interface catalogs from your own GME checkout (`scripts/generate_interface_catalog.py`) — without them the catalog resource is empty by design, and the specs that read one skip. The full checkout, which carries those generated catalogs and the internal notes, is private; access is granted per person by [@nuaaweixinye](https://github.com/nuaaweixinye).

The directory you set as `backendRoot` must contain:

- `backend/run_backend.py` — the managed entrypoint.
- `config.local.json` — the backend configuration (or another file named by `configFile`): the GME repository path, and the `dsh_home` / `dsh_profile` the coding sessions use.
- `logs/` — the API token lives here as `web-api-token.log` by default, at least 32 characters. Automatic startup creates a random token when the file is missing; with `autoStart: false` the file is required and a missing one fails with `Cannot read GME API token file`.
- The task database and generated-test worktrees the backend already uses.

The GME repository itself, its compiler toolchain, and any dependencies the backend's build/test stages need must be in place, because the plugin triggers those stages rather than bypassing them.

## 2. The Python environment

`pythonPath` must point at an interpreter that has the backend's own dependencies installed, plus version-matched `deepseek-harness-sdk` and `deepseek-harness-runtime-bin` wheels — the backend runs its coding work through the Harness Python SDK. The default is `python`; name the interpreter explicitly when the machine has several.

**clang-format must be 17.0.2.** That is the version behind GME's own `check-format` target (its CI runs `pip install clang-format==17.0.2` before building that target), and clang-format judges the same source differently across major versions: a backend using whatever happened to be on PATH can report the format check passed for source the GME pipeline then rejects.

- `requirements.txt` pins `clang-format==17.0.2`, so installing the dependencies as in section 1 places it at that interpreter's `Scripts\clang-format.exe`;
- the backend resolves in the order **interpreter environment → `clang_format_path` → PATH** and accepts only a version match; a mismatch fails with both versions and the one-line fix named;
- to use another version or another location, set `clang_format_path` in `config.local.json`, or set `allow_clang_format_version_mismatch: true` (warn instead of refuse).

The backend's own environment self-check judges this by version and lists every candidate it found with its version.

## 3. The coding profile

Backend coding sessions run in a separate Harness profile (named by `dsh_profile` in `config.local.json`, conventionally `sdk`). It needs:

- file, search and shell tools, so the coding agent can edit and run tests;
- the DeepSeek credentials the SDK uses, available at the configured `dsh_home`;
- **this plugin excluded**, so generated work cannot create further GME tasks.

The outer workflow dialogue and every backend coding session keep separate histories.

## 4. Harness configuration

Either set the environment before starting Harness:

```powershell
$env:GME_TEST_GENERATOR_ROOT  = 'D:/workspace/gme-test-generator'
$env:GME_TEST_GENERATOR_PYTHON = 'C:/ProgramData/Miniconda3/envs/agent/python.exe'
dsh web
```

These are read at start: changing them requires a restart. Or override the row in the profile patch (`$DSH_HOME/profiles/web/cordis.patch.yml`); a patch row replaces only the keys it names, so keep every field you still want:

```yaml
- id: gme-workflow
  config:
    backendRoot: D:/workspace/gme-test-generator
    pythonPath: C:/ProgramData/Miniconda3/envs/agent/python.exe
    port: 8765
    autoStart: true
```

Confirm what the profile will actually mount before restarting:

```sh
dsh --profile web --dump-config
```

The composed tree prints the `gme-workflow` row with its `!!js` expressions verbatim, so an unresolved or overridden value is visible without booting.

## 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| No `gme_*` tools after a restart — the plugin is running but registers none, and logs `backendRoot is not configured` | `backendRoot` unset, so the row resolved to an empty path | Set `GME_TEST_GENERATOR_ROOT` before starting Harness, or override the row with an explicit `backendRoot`. The legacy `GME_TEST_AGENT_ROOT` remains accepted. |
| `dsh: 1 entry did not activate` at boot, naming this entry | A hand-edited row whose config fails validation (for example `backendRoot: null` in an `!!js` expression) | Fix or remove the override; the shipped row degrades to "unconfigured", it never throws |
| `Cannot read GME API token file: …` | `tokenFile` missing while `autoStart: false` | Create the token file (≥32 characters) or allow automatic startup |
| `GME autoStart requires a Harness subprocess provider` | The profile has no local `subprocess` service | Use a base-backed profile, which provides one |
| `GME backend is unavailable. Start GME Test Generator or enable autoStart.` | Nothing is listening on the port and automatic startup is off | Start the backend yourself, or set `autoStart: true` |
| `The configured port is not an authenticated GME backend` | Another service already holds `port` | Pick a free port, or stop that service; the plugin will not start a second worker over it |
| `GME backend exited during startup` | The Python entrypoint failed immediately | Run `python backend/run_backend.py --config config.local.json` by hand to see the real error (missing dependencies, bad paths) |
| Tool calls work but a task never progresses | The backend job is executing, or a submission was interrupted | Poll with `gme_check`; after a timeout, inspect tasks before resubmitting, because POSTs are never retried automatically |
| `clang-format 17.0.2 is required …, but found: … (22.1.8)` | PATH holds a different major version, and the backend refuses to judge formatting with it | `python -m pip install clang-format==17.0.2` in that interpreter; or point `clang_format_path` at a 17.0.2 binary; or set `allow_clang_format_version_mismatch: true` to accept the mismatch |

## 6. Optional: knowledge injection and trace observability

The backend can inject **local historical-divergence priors plus knowledge-base (WeKnora) references** into the coding session before a generation task starts, and record the inner session's tool calls as task events. The capability is **off by default** and configured entirely on the backend side — none of this plugin's config keys are involved:

1. Add a `knowledge` block to the backend's `config.local.json` (placeholder shape in the backend repo's `config.example.json`):

   ```json
   "knowledge": {
     "enabled": true,
     "weknora": {
       "base_url": "http://<weknora-host>/api/v1",
       "api_key_env": "WEKNORA_API_KEY",
       "timeout_ms": 3000,
       "knowledge_bases": [
         { "label": "kb00", "id": "<kb00-knowledge-base-id>" }
       ]
     },
     "budgets": { "max_priors": 8, "max_kb_hits": 6, "max_chars": 4000 },
     "closed_loop": { "enabled": true, "min_stable_runs": 2 }
   }
   ```

2. The variable named by `api_key_env` (default `WEKNORA_API_KEY`) must exist in the backend **process** environment.
3. Off, the behaviour is byte-identical to the old backend; on, any retrieval failure only degrades (one warning event) and can never fail a task.

**The one intersection with this plugin is the owned worker's environment.** A backend started by `autoStart` inherits exactly one variable — `GME_AGENT_API_TOKEN` — so `WEKNORA_API_KEY` never reaches it and knowledge-base retrieval degrades with `API key is not set` (local priors still inject). If you want KB retrieval, **start the backend yourself** (`scripts\run_web.ps1` inherits your full shell environment) and leave this plugin's `autoStart` as the unattended fallback; the plugin attaches to a backend it finds on the port instead of starting one.

The criteria, the promotion loop and the full degradation table live in the backend repo's `docs/knowledge-injection.md`.
