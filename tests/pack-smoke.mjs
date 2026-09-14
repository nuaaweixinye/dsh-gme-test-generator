/**
 * Smoke the BUILT artefact, not the sources: what npm ships is `lib/index.js`,
 * so that is what has to expose the plugin surface and mount inertly when no
 * backend is configured. Run after `pnpm build` (`pnpm run test:pack`).
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import Tools from '@deepseek-ai/dsh-tools'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const entry = join(root, 'lib', 'index.js')
assert(existsSync(entry), `missing ${entry} — run the build first (pnpm run build)`)

const Workflow = await import(pathToFileURL(entry).href)
assert.equal(Workflow.name, 'gme-workflow')
assert.deepEqual(Workflow.inject, ['tools', 'systemPrompt'])
assert.equal(typeof Workflow.apply, 'function')
assert.ok(Workflow.Config, 'the Config schema must be exported for the Loader to validate a row')

const ctx = new Context()
try {
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(Tools)
  // An empty backendRoot must mount without throwing: a throw here would fail
  // the whole plugin tree at boot rather than merely disabling these tools.
  await ctx.plugin(Workflow, { backendRoot: '' })
  const result = await ctx.tools.execute({
    name: 'gme_check',
    arguments: { resource: 'jobs' },
    signal: new AbortController().signal,
    callId: 'pack-smoke',
  })
  assert.equal(result.isError, true, 'an unconfigured plugin must not register its tools')
  process.stdout.write('lib/index.js: OK (surface complete, unconfigured mount inert)\n')
} finally {
  await ctx.fiber.dispose()
}
