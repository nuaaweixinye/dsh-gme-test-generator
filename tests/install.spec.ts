/**
 * The install contract of this package, checked against the real artefacts:
 * the committed `cordis.patch.yml`, composed through the include's own patch
 * engine and mounted into a real Cordis Loader tree.
 *
 * Two things can break a marketplace install and both are covered here:
 * a manifest/row drift (package.json, row id, row name and patch path no longer
 * agreeing), and the boot hazard this bundle exists to avoid — an inserted row
 * whose required `backendRoot` is unset must stay inert instead of failing the
 * plugin tree ("dsh: 1 entry did not activate").
 */
import { afterEach, describe, expect, it } from 'vitest'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import jsYaml from 'js-yaml'
import { Context } from '@deepseek-ai/cordis'
import Loader, { type EntryOptions } from '@deepseek-ai/cordis-plugin-loader'
import { applyEntryPatches, type PatchOptions } from '@deepseek-ai/cordis-plugin-include'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import Tools from '@deepseek-ai/dsh-tools'
import * as Workflow from '../src/index.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGE_NAME = 'dsh-gme-workflow'
const ROW_ID = 'gme-workflow'
const ROOT_ENV = 'GME_TEST_AGENT_ROOT'

const cleanups: Array<() => Promise<unknown> | unknown> = []
const savedEnv = new Map<string, string | undefined>()

afterEach(async () => {
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  savedEnv.clear()
  while (cleanups.length) await cleanups.pop()!()
})

/** Set an env var for one test, restoring it afterwards. */
function setEnv(key: string, value: string | undefined): void {
  if (!savedEnv.has(key)) savedEnv.set(key, process.env[key])
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}

/**
 * The include's YAML dialect, rebuilt here so the committed patch file can be
 * parsed without importing the include's private `js-yaml` copy. The node shape
 * is what the Loader itself understands (`isJsExpr` is a property predicate).
 */
const JsExpr = new jsYaml.Type('tag:yaml.org,2002:js', {
  kind: 'scalar',
  resolve: (data: unknown) => typeof data === 'string',
  construct: (data: string) => ({ __jsExpr: data }),
})
const schema = jsYaml.JSON_SCHEMA.extend(JsExpr)

async function patchText(): Promise<string> {
  return await readFile(join(ROOT, 'cordis.patch.yml'), 'utf8')
}

async function patchRows(): Promise<PatchOptions[]> {
  const parsed = jsYaml.load(await patchText(), { schema })
  if (!Array.isArray(parsed)) throw new Error('the bundle patch must be a top-level array')
  return parsed as PatchOptions[]
}

/** The single entry this bundle inserts, composed by the real patch engine. */
async function insertedRow(): Promise<EntryOptions> {
  const entries = applyEntryPatches([], await patchRows(), () => {})
  expect(entries).toHaveLength(1)
  return entries[0]!
}

/** Serve an authenticated GME health response so no worker is ever spawned. */
async function stubBackend(): Promise<number> {
  const handle = (req: IncomingMessage, res: ServerResponse): void => {
    res.setHeader('content-type', 'application/json')
    if (req.url === '/api/health') { res.end(JSON.stringify({ ok: true, authenticated: true })); return }
    res.statusCode = 200
    res.end(JSON.stringify({ jobs: [{ id: 'job-1', status: 'needs_review' }] }))
  }
  const server = createServer(handle)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  cleanups.push(() => new Promise<void>((resolve, reject) => {
    server.closeAllConnections()
    server.close(error => { if (error) reject(error); else resolve() })
  }))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing stub port')
  return address.port
}

/** A checkout-shaped directory holding only the API token the transport reads. */
async function checkoutFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'gme-install-'))
  cleanups.push(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'logs'))
  await writeFile(join(root, 'logs', 'web-api-token.log'), 'install-smoke-token-'.repeat(3))
  return root
}

/**
 * Mount one composed row through a real Loader, exactly as boot does, but with
 * the module pipeline stubbed instead of reaching the profile's node_modules.
 */
async function mount(row: EntryOptions): Promise<{ ctx: Context; imported: string[] }> {
  const ctx = new Context()
  cleanups.push(() => ctx.fiber.dispose())
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(Tools)
  await ctx.plugin(Loader)
  const imported: string[] = []
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string): Promise<unknown> {
      imported.push(specifier)
      if (specifier === PACKAGE_NAME) return Workflow
      throw new Error(`Unexpected Loader module ${specifier}`)
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create(row)
  await ctx.loader.await()
  return { ctx, imported }
}

function call(ctx: Context, name: string, args: unknown) {
  return ctx.tools.execute({
    name,
    arguments: args,
    signal: new AbortController().signal,
    callId: ToolCallId(`gme-install-${name}`),
  })
}

describe('the committed dsh.bundle.patch', () => {
  it('inserts exactly one row whose id and module name are the published package', async () => {
    const manifest = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as {
      name: string
      files?: string[]
      dsh?: { bundle?: { patch?: string } }
    }
    const row = await insertedRow()
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(manifest.files).toContain('cordis.patch.yml')
    expect(manifest.name).toBe(PACKAGE_NAME)
    expect(row.id).toBe(ROW_ID)
    expect(row.name).toBe(manifest.name)
  })

  it('carries the deployment paths as expressions, never as machine paths', async () => {
    const row = await insertedRow()
    expect((row.config as Record<string, unknown>).backendRoot).toEqual({ __jsExpr: `process.env.${ROOT_ENV} ?? ''` })
    expect(row.disabled).toEqual({ __jsExpr: `!process.env.${ROOT_ENV}` })
    // Comments may show example paths; the YAML values must not bake in the
    // author's machine.
    const values = (await patchText())
      .split('\n')
      .filter(line => !line.trimStart().startsWith('#'))
      .join('\n')
    expect(values).not.toMatch(/[A-Za-z]:[\\/]/)
    expect(values).not.toMatch(/\/home\/|\/Users\//)
  })
})

describe('a freshly installed, unconfigured row', () => {
  it('stays inert and never imports the plugin when the checkout is unset', async () => {
    setEnv(ROOT_ENV, undefined)
    const { ctx, imported } = await mount(await insertedRow())
    expect(imported).toEqual([])
    expect((await call(ctx, 'gme_check', { resource: 'jobs' })).isError).toBe(true)
  })
})

describe('a row pointed at a configured checkout', () => {
  it('activates and registers all three tools', async () => {
    setEnv(ROOT_ENV, await checkoutFixture())
    const row = await insertedRow()
    // autoStart stays off so the test never spawns a Python worker; the guard,
    // the insert and the config expressions under test are unaffected.
    ;(row.config as Record<string, unknown>).autoStart = false
    ;(row.config as Record<string, unknown>).port = await stubBackend()
    const { ctx, imported } = await mount(row)
    expect(imported).toEqual([PACKAGE_NAME])
    const checked = await call(ctx, 'gme_check', { resource: 'jobs' })
    expect(checked.isError).not.toBe(true)
    expect(JSON.stringify(checked)).toContain('job-1')
    const gated = await call(ctx, 'gme_decide', { decision: 'delete_job', job_id: 'job-1' })
    expect(gated.isError).toBe(true)
    expect(JSON.stringify(gated)).toMatch(/explicit user consent/)
  })
})
