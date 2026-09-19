# GME Test Generator Plugin Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename, publish, and deploy the GME DeepSeek Harness plugin as `dsh-gme-test-generator@0.2.0` while retaining GitHub history, stable tool names, and a working production web profile.

**Architecture:** Treat each externally visible surface as a gated release stage. First make and verify the source identity change, then move local directories, rename the existing GitHub repository, publish and independently verify the new npm package, migrate the production profile to the registry package, and only then deprecate the old npm package.

**Tech Stack:** TypeScript 6, Cordis/DeepSeek Harness plugin loader, Vitest, tsdown, pnpm/npm, Git, GitHub CLI, PowerShell, npm registry.

**Spec:** `docs/superpowers/specs/2026-09-19-gme-test-generator-plugin-migration-design.md`

## Global Constraints

- Final development root is exactly `D:/workspace/gme-dsh-plugin`.
- Final plugin checkout is exactly `D:/workspace/gme-dsh-plugin/gme-test-generator`.
- GitHub repository is the existing repository renamed to `nuaaweixinye/dsh-gme-test-generator`; do not create a second repository or rewrite history.
- npm package is the unscoped public package `dsh-gme-test-generator@0.2.0`.
- Cordis loader ID and exported plugin name are `gme-test-generator`.
- Tool names remain `gme_generate`, `gme_check`, and `gme_decide`.
- The production web profile must use npm version `0.2.0`, never a local `link:` dependency.
- Do not deprecate `dsh-gme-workflow` until the new npm package and production profile are verified.
- Do not delete published packages, tags, releases, repositories, user changes, or Git history.
- Stop any DSH/backend processes started by verification before finishing.

## Review Focus

- **A stale loader ID can make an installed package inert:** Task 1 adds failing manifest/row/section assertions, and Task 2 makes all runtime identity values agree.
- **A local link can masquerade as a successful production install:** Task 8 checks `package.json`, lockfiles, junction targets, and an offline frozen install for registry provenance.
- **A newly published package can be visible but incomplete:** Tasks 3 and 7 install and mount the packed/registry tarball, checking the bundle patch and stable tool surface.
- **Renaming a parent directory can break Git or helper paths:** Task 4 verifies the nested repository, origin, branch, helper scripts, and old-path absence after the move.
- **Deprecating the old package too early can strand users:** Task 9 queries the new package and production profile again immediately before deprecation.

---

### Task 1: Pin The New Plugin Identity With Failing Tests

**Files:**
- Modify: `tests/install.spec.ts`
- Modify: `tests/workflow.spec.ts`
- Modify: `tests/pack-smoke.mjs`

**Interfaces:**
- Consumes: Existing package manifest, `cordis.patch.yml`, exported `name`, setup prompt section, and Loader mount fixture.
- Produces: Test constants `PACKAGE_NAME = 'dsh-gme-test-generator'` and `ROW_ID = 'gme-test-generator'`, plus assertions that every mounted identity uses those values.

- [ ] **Step 1: Update only the test expectations to the new identity**

In `tests/install.spec.ts`, set:

```ts
const PACKAGE_NAME = 'dsh-gme-test-generator'
const ROW_ID = 'gme-test-generator'
```

Replace literal section-name expectations with `ROW_ID`, and require setup guidance to contain:

```ts
expect(sections[0]?.name).toBe(ROW_ID)
expect(sections[0]?.text).toContain('- id: gme-test-generator')
```

In `tests/workflow.spec.ts`, change the fixture plugin module name from
`dsh-gme-workflow` to `dsh-gme-test-generator`, the temporary prefix to
`gme-test-generator-`, and section/ID expectations to `gme-test-generator`.

In `tests/pack-smoke.mjs`, change the built export assertion to:

```js
assert.equal(Workflow.name, 'gme-test-generator')
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
pnpm vitest run tests/install.spec.ts tests/workflow.spec.ts
pnpm run build
pnpm run test:pack
```

Expected: Vitest fails because the manifest, bundle row, section names, and imported package are still `dsh-gme-workflow` / `gme-workflow`; pack smoke fails because the built export is still `gme-workflow`.

- [ ] **Step 3: Inspect the failing output**

Confirm every failure is an identity mismatch. Fix any test syntax or fixture error until the tests fail only because production files still use the old identity.

---

### Task 2: Rename The Source Package And Loader Identity

**Files:**
- Modify: `package.json`
- Modify: `cordis.patch.yml`
- Modify: `src/index.ts`
- Modify: `README.md`
- Modify: `README.zh.md`
- Modify: `docs/setup.md`
- Modify: `docs/setup.zh.md`
- Modify: `CHANGELOG.md`
- Test: `tests/install.spec.ts`
- Test: `tests/workflow.spec.ts`
- Test: `tests/pack-smoke.mjs`

**Interfaces:**
- Consumes: New identity assertions from Task 1.
- Produces: Package `dsh-gme-test-generator@0.2.0`, exported name and Cordis row ID `gme-test-generator`, unchanged `gme_*` tools, and current installation guidance for the renamed GitHub/npm package.

- [ ] **Step 1: Change package and repository metadata**

Set the relevant `package.json` values exactly:

```json
{
  "name": "dsh-gme-test-generator",
  "version": "0.2.0",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/nuaaweixinye/dsh-gme-test-generator.git"
  },
  "homepage": "https://github.com/nuaaweixinye/dsh-gme-test-generator",
  "bugs": {
    "url": "https://github.com/nuaaweixinye/dsh-gme-test-generator/issues"
  }
}
```

Do not change peer dependency ranges or tool definitions.

- [ ] **Step 2: Change the bundle row and exported plugin identity**

In `cordis.patch.yml`, use:

```yaml
- insert:
    - id: gme-test-generator
      name: 'dsh-gme-test-generator'
```

Update current comments and install examples to `dsh-gme-test-generator` and
`gme-test-generator`. Keep the new and legacy backend environment-variable
fallbacks unchanged.

In `src/index.ts`, set:

```ts
export const name = 'gme-test-generator'
```

Use `gme-test-generator` for both system-prompt sections, warning prefixes,
setup YAML, and references to the profile row. Keep all three `defineTool`
names unchanged.

- [ ] **Step 3: Update current documentation and changelog**

Change current install commands to:

```sh
dsh plugin --profile web add dsh-gme-test-generator
```

Change current profile examples to `id: gme-test-generator`. Update README
titles, package references, repository links, setup pages, and development
commands. Add a top `0.2.0` changelog entry explaining the package/repository/
loader-ID rename and stable tool names. Preserve old release entries as history.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
pnpm vitest run tests/install.spec.ts tests/workflow.spec.ts
pnpm run build
pnpm run test:pack
```

Expected: all focused tests pass and pack smoke reports the complete built
surface.

- [ ] **Step 5: Search current surfaces for stale identity references**

Run:

```powershell
rg -n "dsh-gme-workflow|gme-workflow|nuaaweixinye/dsh-gme-workflow" package.json cordis.patch.yml src tests README.md README.zh.md docs/setup.md docs/setup.zh.md
```

Expected: no matches. Historical references are allowed only in `CHANGELOG.md`
and the approved migration spec/plan.

- [ ] **Step 6: Run the full repository verification**

Run:

```powershell
pnpm run verify
npm pack --dry-run
git diff --check
```

Expected: typecheck, build, 42 active tests, package smoke, dry-run contents,
and whitespace checks pass.

- [ ] **Step 7: Commit the source identity migration**

Run:

```powershell
git add package.json cordis.patch.yml src/index.ts README.md README.zh.md docs/setup.md docs/setup.zh.md CHANGELOG.md tests/install.spec.ts tests/workflow.spec.ts tests/pack-smoke.mjs
git commit -m "feat: rename plugin to dsh-gme-test-generator"
```

Expected: only the named source, documentation, and test files are committed.

---

### Task 3: Verify The Actual Packed Artifact In Isolation

**Files:**
- Verify: `dsh-gme-test-generator-0.2.0.tgz`
- Verify: package contents under a temporary directory

**Interfaces:**
- Consumes: Verified source package from Task 2.
- Produces: A release tarball proven to contain and mount the renamed package without relying on the source checkout.

- [ ] **Step 1: Build the release tarball**

Run:

```powershell
$tarball = (npm pack --json | ConvertFrom-Json)[0].filename
if ($tarball -ne 'dsh-gme-test-generator-0.2.0.tgz') { throw "Unexpected tarball: $tarball" }
```

Expected: exactly `dsh-gme-test-generator-0.2.0.tgz`.

- [ ] **Step 2: Inspect tarball contents**

Run:

```powershell
tar -tf $tarball
```

Expected: `package/package.json`, `package/lib/index.js`,
`package/cordis.patch.yml`, READMEs, setup docs, changelog, and license are
present; source tests, `.git`, and machine-local configuration are absent.

- [ ] **Step 3: Install the tarball into a temporary package fixture**

Run from a newly created directory under `$env:TEMP`:

```powershell
npm init -y
npm install "D:\workspace\ds-plugin\gme-workflow\dsh-gme-test-generator-0.2.0.tgz" --ignore-scripts
node -e "const p=require('./node_modules/dsh-gme-test-generator/package.json'); if(p.name!=='dsh-gme-test-generator'||p.version!=='0.2.0') process.exit(1)"
```

Expected: install succeeds and the installed manifest reports the exact name
and version. Remove the temporary fixture after verification.

- [ ] **Step 4: Re-run the built-package smoke from the release commit**

Run:

```powershell
pnpm run test:pack
git status --short --branch
```

Expected: smoke passes; only the ignored tarball may exist and the branch has no
tracked modifications.

---

### Task 4: Move The Development Directories And Repair Local References

**Files:**
- Move: `D:/workspace/ds-plugin` to `D:/workspace/gme-dsh-plugin`
- Move: `D:/workspace/gme-dsh-plugin/gme-workflow` to `D:/workspace/gme-dsh-plugin/gme-test-generator`
- Modify: `D:/workspace/gme-dsh-plugin/README.md`
- Modify: `D:/workspace/gme-dsh-plugin/probe-gme-db.py`
- Modify: `D:/workspace/gme-dsh-plugin/publish-gme-agent.mjs`

**Interfaces:**
- Consumes: Clean nested Git repository and verified tarball from Task 3.
- Produces: Final local development paths with the nested repository history and branch intact.

- [ ] **Step 1: Verify safe absolute source and destination paths**

Use `[System.IO.Path]::GetFullPath` to resolve all four paths. Assert both
sources are directories, both destinations are under `D:/workspace`, and
neither destination exists. Confirm ports 3080 and 8765 have no listeners.

- [ ] **Step 2: Confirm no tracked work is at risk**

Run:

```powershell
git -C D:\workspace\ds-plugin\gme-workflow status --short --branch
git -C D:\workspace\ds-plugin\gme-workflow log -3 --oneline
```

Expected: branch `rename/gme-test-generator`; no uncommitted tracked changes.
The tarball is ignored or explicitly preserved.

- [ ] **Step 3: Move the outer and nested directories**

Use native PowerShell in one shell:

```powershell
Move-Item -LiteralPath 'D:\workspace\ds-plugin' -Destination 'D:\workspace\gme-dsh-plugin'
Move-Item -LiteralPath 'D:\workspace\gme-dsh-plugin\gme-workflow' -Destination 'D:\workspace\gme-dsh-plugin\gme-test-generator'
```

If Windows reports a lock, stop and identify the exact process. Terminate it
only when its executable/command belongs to this DSH/plugin development task;
otherwise ask the user to close it. Do not partially copy the repository as a
fallback.

- [ ] **Step 4: Update outer helper paths**

Update active absolute paths from `D:/workspace/ds-plugin/gme-workflow` to
`D:/workspace/gme-dsh-plugin/gme-test-generator`. Preserve the already-correct
backend root `D:/workspace/gme-test-generator`. Run:

```powershell
node --check D:\workspace\gme-dsh-plugin\publish-gme-agent.mjs
Test-Path D:\workspace\gme-dsh-plugin\gme-test-generator\.git
```

Expected: script syntax is valid and the nested Git repository exists.

- [ ] **Step 5: Verify the moved repository**

Run:

```powershell
git -C D:\workspace\gme-dsh-plugin\gme-test-generator status --short --branch
git -C D:\workspace\gme-dsh-plugin\gme-test-generator remote -v
pnpm run verify
```

Expected: Git history and branch are intact, origin still names the old GitHub
repository until Task 5, and full verification passes from the new path.

---

### Task 5: Fast-Forward Main And Rename The Existing GitHub Repository

**Files:**
- Update: local Git refs and `origin` URL
- External: `github.com/nuaaweixinye/dsh-gme-workflow`

**Interfaces:**
- Consumes: Verified moved checkout on `rename/gme-test-generator`.
- Produces: Existing GitHub repository renamed to `dsh-gme-test-generator`, with verified `main` and preserved history.

- [ ] **Step 1: Fetch and prove the migration branch can fast-forward main**

Run:

```powershell
git fetch origin
git merge-base --is-ancestor origin/main rename/gme-test-generator
git status --short --branch
```

Expected: ancestor check exits 0 and the working tree is clean. Stop if remote
main has diverged; do not force-push.

- [ ] **Step 2: Fast-forward local main**

Run:

```powershell
git switch main
git merge --ff-only rename/gme-test-generator
pnpm run verify
```

Expected: main advances without a merge commit and verification passes.

- [ ] **Step 3: Rename the existing GitHub repository**

Run:

```powershell
gh api --method PATCH repos/nuaaweixinye/dsh-gme-workflow -f name=dsh-gme-test-generator
gh repo view nuaaweixinye/dsh-gme-test-generator --json nameWithOwner,url,visibility,defaultBranchRef
```

Expected: the same public repository now reports
`nuaaweixinye/dsh-gme-test-generator` with default branch `main`.

- [ ] **Step 4: Update origin and push main without force**

Run:

```powershell
git remote set-url origin git@github.com:nuaaweixinye/dsh-gme-test-generator.git
git push origin main
git remote -v
git status --short --branch
```

Expected: origin uses the renamed repository and main tracks `origin/main`
without divergence.

---

### Task 6: Tag And Publish The GitHub Release

**Files:**
- External: Git tag `v0.2.0`
- External: GitHub Release `v0.2.0`
- Asset: `dsh-gme-test-generator-0.2.0.tgz`

**Interfaces:**
- Consumes: Verified main commit and tarball from Tasks 3-5.
- Produces: Immutable source tag and GitHub Release carrying the exact tested tarball.

- [ ] **Step 1: Confirm tag and release do not already exist**

Run:

```powershell
git tag --list v0.2.0
gh release view v0.2.0 --repo nuaaweixinye/dsh-gme-test-generator
```

Expected: neither exists. If either exists, stop and inspect it; do not overwrite
or delete it automatically.

- [ ] **Step 2: Rebuild and checksum the release tarball from main**

Run:

```powershell
pnpm run verify
$tarball = (npm pack --json | ConvertFrom-Json)[0].filename
Get-FileHash -Algorithm SHA256 -LiteralPath $tarball
```

Record the SHA-256 in the execution notes.

- [ ] **Step 3: Create and push the annotated tag**

Run:

```powershell
git tag -a v0.2.0 -m "dsh-gme-test-generator 0.2.0"
git push origin v0.2.0
```

Expected: GitHub resolves `v0.2.0` to the verified main commit.

- [ ] **Step 4: Create the GitHub Release with the tested tarball**

Run:

```powershell
gh release create v0.2.0 .\dsh-gme-test-generator-0.2.0.tgz --repo nuaaweixinye/dsh-gme-test-generator --title "v0.2.0" --generate-notes
gh release view v0.2.0 --repo nuaaweixinye/dsh-gme-test-generator --json tagName,url,isDraft,isPrerelease,assets
```

Expected: a non-draft, non-prerelease release with the tarball asset.

---

### Task 7: Authenticate And Publish The New npm Package

**Files:**
- External: npm package `dsh-gme-test-generator@0.2.0`

**Interfaces:**
- Consumes: Exact tested release tarball and GitHub Release from Task 6.
- Produces: Public npm package verified independently from registry metadata and tarball contents.

- [ ] **Step 1: Authenticate npm interactively**

Run in a TTY:

```powershell
npm login
npm whoami
```

The user completes browser/OTP authentication. Expected: `npm whoami` prints
the intended publisher account. Stop if authentication is unavailable.

- [ ] **Step 2: Reconfirm target package is not already published**

Run:

```powershell
npm view dsh-gme-test-generator@0.2.0 name version --json
```

Expected before first publication: registry returns `E404`. If version `0.2.0`
exists, stop and compare integrity; never overwrite it.

- [ ] **Step 3: Publish the tested package**

Run from the verified repository root:

```powershell
npm publish .\dsh-gme-test-generator-0.2.0.tgz --access public
```

Complete OTP if requested. Expected: npm reports
`+ dsh-gme-test-generator@0.2.0`.

- [ ] **Step 4: Verify registry metadata independently**

Run:

```powershell
npm view dsh-gme-test-generator name version dist-tags repository dist.integrity --json
npm pack dsh-gme-test-generator@0.2.0 --pack-destination $env:TEMP
```

Expected: `latest` points to `0.2.0`, repository points to the renamed GitHub
repository, integrity is present, and registry tarball download succeeds.

- [ ] **Step 5: Install the registry tarball in an isolated fixture**

Create a fresh temporary npm project, install
`dsh-gme-test-generator@0.2.0 --ignore-scripts`, and run:

```powershell
node -e "const p=require('./node_modules/dsh-gme-test-generator/package.json'); if(p.name!=='dsh-gme-test-generator'||p.version!=='0.2.0') process.exit(1)"
```

Also verify `cordis.patch.yml` contains `id: gme-test-generator` and
`name: 'dsh-gme-test-generator'`. Remove the fixture after success.

---

### Task 8: Migrate The Production Web Profile To The Registry Package

**Files:**
- Modify: `C:/Users/xk/.dsh/profiles/web/package.json`
- Modify: `C:/Users/xk/.dsh/profiles/web/pnpm-lock.yaml`
- Modify: `C:/Users/xk/.dsh/profiles/web/pnpm-workspace.yaml`
- Modify: `C:/Users/xk/.dsh/profiles/web/cordis.patch.yml`
- Generated: `C:/Users/xk/.dsh/profiles/web/node_modules`

**Interfaces:**
- Consumes: Registry-verified `dsh-gme-test-generator@0.2.0`.
- Produces: Production web profile mounted from npm with loader ID `gme-test-generator` and backend root `D:/workspace/gme-test-generator`.

- [ ] **Step 1: Snapshot the current production profile files**

Copy the four profile files to timestamped `.before-gme-test-generator-0.2.0`
siblings. Record the current `dsh-gme-workflow` dependency and profile patch so
rollback is exact.

- [ ] **Step 2: Replace dependency, bundle, patch ID, and release-age exception**

In `package.json`, replace the local-link dependency with:

```json
"dsh-gme-test-generator": "0.2.0"
```

Replace the bundle entry `dsh-gme-workflow` with
`dsh-gme-test-generator`. In `cordis.patch.yml`, change only:

```yaml
- id: gme-test-generator
```

Keep `backendRoot: D:/workspace/gme-test-generator`, interpreter, port, and
`autoStart` values unchanged.

In `pnpm-workspace.yaml`, remove stale overrides/exclusions that exist only for
the old GME workflow package and add:

```yaml
minimumReleaseAgeExclude:
  - dsh-gme-test-generator@0.2.0
```

- [ ] **Step 3: Install from npm and prove the dependency is not local**

Run:

```powershell
pnpm install
pnpm install --offline --frozen-lockfile
```

Inspect `package.json`, `pnpm-lock.yaml`, and the installed package. Expected:
no `link:D:/workspace/...` value for the new package; installed manifest reports
`dsh-gme-test-generator@0.2.0`.

- [ ] **Step 4: Verify the composed profile**

From `D:/workspace/deepseek-harness`, run:

```powershell
$output = & pnpm dsh --profile web --dump-config 2>&1
if ($LASTEXITCODE -ne 0) { throw 'dump-config failed' }
$output | Select-String 'gme-test-generator|dsh-gme-test-generator|D:/workspace/gme-test-generator'
```

Expected: one `gme-test-generator` row, module
`dsh-gme-test-generator`, and the correct backend root. No active row may name
`gme-workflow` or `dsh-gme-workflow`.

- [ ] **Step 5: Run a controlled web-profile boot smoke**

Start `pnpm dsh --profile web --no-open --port 3080` in a managed session. Wait
for `127.0.0.1:3080` to listen and confirm boot output contains no inactive-entry
or module-resolution error. Because the configured backend is lazy, do not
submit a generation job. Stop the exact DSH process and confirm ports 3080 and
8765 are closed.

- [ ] **Step 6: Roll back immediately if profile verification fails**

Restore the four timestamped snapshot files, run `pnpm install --offline`, and
verify the former `dsh-gme-workflow@0.1.2` profile. Do not proceed to Task 9 on
failure.

---

### Task 9: Deprecate The Old npm Package And Perform Final Audit

**Files:**
- External: npm metadata for `dsh-gme-workflow@0.1.x`
- Verify: GitHub, npm, local checkout, and production profile

**Interfaces:**
- Consumes: Fully verified new package and production profile.
- Produces: Old package retained but deprecated, with all final surfaces audited and background services stopped.

- [ ] **Step 1: Re-run the release gates immediately before deprecation**

Run:

```powershell
gh repo view nuaaweixinye/dsh-gme-test-generator --json nameWithOwner,url,defaultBranchRef
gh release view v0.2.0 --repo nuaaweixinye/dsh-gme-test-generator --json tagName,url,isDraft,isPrerelease,assets
npm view dsh-gme-test-generator name version dist-tags repository --json
```

Re-run the profile dump from Task 8. Expected: all commands resolve the new
identity and production profile.

- [ ] **Step 2: Deprecate every old package version without deleting it**

Run:

```powershell
npm deprecate "dsh-gme-workflow@*" "Renamed to dsh-gme-test-generator. Install dsh-gme-test-generator instead."
```

Expected: command succeeds; no `npm unpublish` command is used.

- [ ] **Step 3: Verify old-package deprecation and new-package health**

Run:

```powershell
npm view dsh-gme-workflow versions deprecated --json
npm view dsh-gme-test-generator name version dist-tags deprecated --json
```

Expected: old versions remain listed with the migration message; new package
is not deprecated and `latest` remains `0.2.0`.

- [ ] **Step 4: Run final local verification and identity search**

From `D:/workspace/gme-dsh-plugin/gme-test-generator`, run:

```powershell
pnpm run verify
git status --short --branch
git remote -v
rg -n "D:/workspace/ds-plugin|D:\\workspace\\ds-plugin" D:\workspace\gme-dsh-plugin C:\Users\xk\.dsh\profiles\web --glob '!node_modules/**' --glob '!.git/**'
```

Expected: verification passes, main is clean and tracks the renamed origin, and
no active path points to the old development root. Historical specs, plans,
changelog entries, and timestamped profile backups may name the old identity.

- [ ] **Step 5: Confirm all verification processes are stopped**

Run:

```powershell
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in 3080, 8765 } |
  Select-Object LocalAddress, LocalPort, OwningProcess
```

Expected: no rows. If a row remains, resolve its command line and terminate only
the process started by this plan.

- [ ] **Step 6: Record final release evidence**

Report the source commit, `v0.2.0` GitHub Release URL, npm package/version,
tarball SHA-256, production profile package/ID/backend root, old-package
deprecation message, test totals, and any warnings. Do not claim completion
without fresh outputs from Tasks 8 and 9.
