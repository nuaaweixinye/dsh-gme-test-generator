import { defineConfig } from 'vitest/config'

/**
 * Node-only suite. The specs drive real HTTP fixtures and, in
 * `install.spec.ts`, a real Cordis Loader tree, so the default 5s timeout is
 * too tight on a cold Windows run.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
