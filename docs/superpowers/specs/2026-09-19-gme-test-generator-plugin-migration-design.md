# GME Test Generator Plugin Migration Design

## Goal

Rename and release the GME DeepSeek Harness plugin under one consistent
identity while preserving repository history and keeping the production web
profile usable throughout the migration.

The final identities are:

- Local development root: `D:/workspace/gme-dsh-plugin`
- Plugin checkout: `D:/workspace/gme-dsh-plugin/gme-test-generator`
- GitHub repository: `nuaaweixinye/dsh-gme-test-generator`
- npm package: `dsh-gme-test-generator@0.2.0`
- Cordis loader ID: `gme-test-generator`
- Harness tools: `gme_generate`, `gme_check`, and `gme_decide`

## Intent And Constraints

This is an in-place identity migration, not a replacement implementation. The
plugin's workflow behavior, backend protocol, tool names, consent gates, and
test-generation semantics must remain unchanged. Git history, GitHub issues,
releases, and old GitHub URL redirects must be retained by renaming the existing
repository instead of creating a second repository.

The development package must not be mounted into the production web profile.
The web profile moves to the registry-published package only after npm reports
the new version and an isolated install smoke test succeeds. The old npm package
must remain available for existing lockfiles; it is deprecated only after the
new package and production profile have both been verified.

## Source Migration

The outer unversioned development directory moves from `ds-plugin` to
`gme-dsh-plugin`. The nested Git repository moves from `gme-workflow` to
`gme-test-generator`; moving it must preserve its `.git` directory, branch, and
working state.

Inside the repository, the package manifest, bundle patch, Cordis row ID,
install tests, setup guidance, READMEs, changelog, repository URLs, live-smoke
environment guidance, and release metadata adopt the new identity. Version
`0.2.0` communicates the breaking package and loader-ID rename. The existing
tool names remain stable because they are the user-facing workflow API.

Files in the unversioned outer directory that contain absolute paths are updated
after the move. Historical changelog entries may retain the old identity when
describing old releases; current instructions must not point to the former
development path or package.

## GitHub Migration

All source changes are committed on `rename/gme-test-generator` and pass local
verification before external mutation. The branch is then fast-forwarded into
`main`. The existing GitHub repository is renamed through GitHub from
`dsh-gme-workflow` to `dsh-gme-test-generator`, after which the local `origin`
URL is updated and `main` is pushed to the renamed repository.

Tag `v0.2.0` is created from the verified `main` commit. The GitHub Release uses
that tag and includes the packed npm tarball as its release asset. No force push,
history rewrite, repository recreation, or deletion is allowed.

## npm Publication

Before publication, `npm pack --dry-run` and the repository verification command
must succeed. The real tarball is then installed into an isolated temporary
profile or package fixture, where its manifest, bundle patch, unconfigured mount,
and tool surface are checked.

Publishing requires an authenticated npm account with permission to create the
unscoped public package. `dsh-gme-test-generator@0.2.0` is published with public
access. The migration stops if authentication, OTP, package publication, or
registry verification fails.

After publication, the registry is queried independently to confirm the package
name, version, dist-tag, and tarball. Only then may production configuration be
changed. The old `dsh-gme-workflow` versions remain installable and are marked
deprecated with a message directing users to `dsh-gme-test-generator` after the
production profile passes verification.

## Web Profile Migration

The production web profile must use `dsh-gme-test-generator@0.2.0` from npm, not
a local `link:` dependency. Its bundle list replaces `dsh-gme-workflow` with
`dsh-gme-test-generator`, and its profile patch targets Cordis ID
`gme-test-generator`. The backend root remains
`D:/workspace/gme-test-generator`.

After an offline-capable lockfile install from the already downloaded published
package, `dsh --profile web --dump-config` must show the new package, new loader
ID, and expected backend root. A controlled runtime smoke verifies that
`gme_generate`, `gme_check`, and `gme_decide` register. Any process started for
verification is stopped before completion.

## Failure Handling And Rollback

The migration uses these gates:

1. Source tests and package smoke pass before GitHub is renamed.
2. GitHub main, tag, and release are valid before npm publication.
3. npm registry verification passes before the web profile changes.
4. The web profile passes configuration and runtime smoke before the old npm
   package is deprecated.

Failure before a gate leaves the next external surface unchanged. If the web
profile migration fails, it is restored to `dsh-gme-workflow@0.1.2` and its old
Cordis ID while the new package remains published for diagnosis. Published npm
versions and GitHub tags are immutable and are not deleted as a rollback
strategy; corrections use a later patch release.

## Verification

The source repository must pass:

- TypeScript type checking and production build
- Full Vitest suite
- Existing package-install smoke test
- `npm pack --dry-run`
- Search for stale current references to the old package, loader ID, repository,
  and local development path
- Git status and diff checks proving unrelated changes were not included

The deployed surfaces must pass:

- GitHub repository, default branch, tag, release, and remote URL checks
- npm identity, version, dist-tag, deprecation, and tarball checks
- Web profile dependency, lockfile, bundle, patch, and composed-config checks
- Runtime registration check for all three stable GME tools
- Final confirmation that test listeners and background processes are stopped

## Non-Goals

- Renaming `gme_generate`, `gme_check`, or `gme_decide`
- Changing the Python backend API or GME Test Generator behavior
- Publishing under an npm scope
- Rewriting Git history or deleting the old npm package
- Updating third-party plugin-marketplace listings in this migration
