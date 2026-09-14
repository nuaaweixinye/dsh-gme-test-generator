# Changelog

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
- The inserted row is disabled until `GME_TEST_AGENT_ROOT` is set, and the
  plugin no-ops with a logged warning when no `backendRoot` is configured, so a
  fresh install can never fail the plugin tree.
