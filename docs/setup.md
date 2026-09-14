# Backend setup

[中文](setup.zh.md) | English

`dsh-gme-workflow` is a client of an existing GME Test Agent checkout. It starts and talks to that project's local HTTP backend; it does not ship, copy or replace it. This page is the checklist for that side of the wiring.

## 1. The GME Test Agent checkout

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

## 3. The coding profile

Backend coding sessions run in a separate Harness profile (named by `dsh_profile` in `config.local.json`, conventionally `sdk`). It needs:

- file, search and shell tools, so the coding agent can edit and run tests;
- the DeepSeek credentials the SDK uses, available at the configured `dsh_home`;
- **this plugin excluded**, so generated work cannot create further GME tasks.

The outer workflow dialogue and every backend coding session keep separate histories.

## 4. Harness configuration

Either set the environment before starting Harness:

```powershell
$env:GME_TEST_AGENT_ROOT  = 'D:/workspace/gme-test-agent'
$env:GME_TEST_AGENT_PYTHON = 'C:/ProgramData/Miniconda3/envs/agent/python.exe'
dsh web
```

These are read at start: changing them requires a restart. Or override the row in the profile patch (`$DSH_HOME/profiles/web/cordis.patch.yml`); a patch row replaces only the keys it names, so keep every field you still want:

```yaml
- id: gme-workflow
  config:
    backendRoot: D:/workspace/gme-agent
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
| No `gme_*` tools after a restart — the plugin is running but registers none, and logs `backendRoot is not configured` | `backendRoot` unset, so the row resolved to an empty path | Set `GME_TEST_AGENT_ROOT` before starting Harness, or override the row with an explicit `backendRoot`. The model has been told these steps and will report them if the user asks |
| `dsh: 1 entry did not activate` at boot, naming this entry | A hand-edited row whose config fails validation (for example `backendRoot: null` in an `!!js` expression) | Fix or remove the override; the shipped row degrades to "unconfigured", it never throws |
| `Cannot read GME API token file: …` | `tokenFile` missing while `autoStart: false` | Create the token file (≥32 characters) or allow automatic startup |
| `GME autoStart requires a Harness subprocess provider` | The profile has no local `subprocess` service | Use a base-backed profile, which provides one |
| `GME backend is unavailable. Start GME Test Agent or enable autoStart.` | Nothing is listening on the port and automatic startup is off | Start the backend yourself, or set `autoStart: true` |
| `The configured port is not an authenticated GME backend` | Another service already holds `port` | Pick a free port, or stop that service; the plugin will not start a second worker over it |
| `GME backend exited during startup` | The Python entrypoint failed immediately | Run `python backend/run_backend.py --config config.local.json` by hand to see the real error (missing dependencies, bad paths) |
| Tool calls work but a task never progresses | The backend job is executing, or a submission was interrupted | Poll with `gme_check`; after a timeout, inspect tasks before resubmitting, because POSTs are never retried automatically |
