import { defineConfig } from 'tsdown'

/**
 * One Node ESM entry: `src/index.ts` bundles `backend.ts` and `next-step.ts`
 * into `lib/index.js`. `@deepseek-ai/*` stays external — those packages are the
 * host's peers (declared in package.json), so a bundled copy would shadow the
 * services the plugin injects.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: true,
})
