# Changelog

## 0.2.0

- Rename the package to `dsh-gme-test-generator`, the GitHub repository to
  `nuaaweixinye/dsh-gme-test-generator`, and the Cordis loader ID to
  `gme-test-generator`.
- Keep the public workflow tools `gme_generate`, `gme_check`, and `gme_decide`
  unchanged.
- Continue accepting the former `GME_TEST_AGENT_*` environment variables as
  migration aliases for the current `GME_TEST_GENERATOR_*` names.

## 0.1.3

- Rename the backend product to GME Test Generator in current runtime copy and
  documentation.
- Prefer `GME_TEST_GENERATOR_ROOT` and `GME_TEST_GENERATOR_PYTHON`, while
  retaining the former `GME_TEST_AGENT_*` variables as migration aliases.

## 0.1.2

Documentation and setup-guidance release; the tools, schemas and transport are
unchanged, and the package still requires a GME Test Agent checkout.

- The READMEs point at the backend repository's own reference docs
  (`docs/backend-overview.md`, `docs/knowledge-injection.md`) and summarise its
  optional, off-by-default knowledge-injection capability.
- `docs/setup.md` / `docs/setup.zh.md` gain section 6: how to enable knowledge
  injection on the backend, and the one real intersection with this plugin — an
  `autoStart`-owned worker inherits only `GME_AGENT_API_TOKEN`, so
  `WEKNORA_API_KEY` never reaches it and KB retrieval degrades; start the
  backend yourself if you want it.
- The requirement list, both READMEs, the setup docs and the shipped setup
  guidance now state that the backend insists on **clang-format 17.0.2** — the
  version behind GME's own `check-format` target. The backend resolves the
  formatter from the interpreter environment, then `clang_format_path`, then
  PATH, and refuses a different version instead of reporting a format verdict the
  GME pipeline may not agree with. A troubleshooting row covers the refusal.

## 0.1.1

An unconfigured install can now tell the model how to finish its setup.

- The inserted row is always mounted. Previously the shipped guard disabled it
  until `GME_TEST_AGENT_ROOT` existed, which meant a fresh install had no plugin
  surface at all: the model could only answer "no such tool". The configuration
  path is still an expression, so an unresolved value is an empty string rather
  than a validation failure, and the row still never throws.
- With no `backendRoot`, the plugin registers no tools (they could only fail)
  and instead publishes the full setup procedure as a system-prompt section:
  where the backend comes from, `scripts/install.ps1`, `config.local.json`, the
  two ways to point this plugin at a checkout, the interface-catalog step, and
  the instruction to report these steps instead of pretending the workflow
  exists. One warning is logged alongside it.
- Once `backendRoot` resolves, the workflow guidance replaces the setup
  procedure, and the three tools are registered as before.
- Docs: the README, `docs/setup.md` and `cordis.patch.yml` no longer describe a
  `disabled` guard or a required `disabled: false` override.

## 0.1.0

First public release as a standalone, installable DeepSeek Harness plugin.

- Three tools: `gme_generate` (autonomous generation, batch, fix, extend,
  retry), `gme_check` (side-effect-free reads with continuation offsets), and
  `gme_decide` (PRs, skips, removal, cleanup, delete — gated behind
  `confirm: true`).
- Authenticated loopback transport to the GME Test Agent Python backend,
  including optional ownership of a worker it starts itself.
- Only an owned worker is terminated on disposal; an independently started
  backend survives.
- Ships as a `dsh.bundle.patch` package: `dsh plugin --profile web add
  dsh-gme-workflow` installs and mounts it with no profile edit.
- An unconfigured install registered nothing and logged one warning, so it
  could never fail the plugin tree.
