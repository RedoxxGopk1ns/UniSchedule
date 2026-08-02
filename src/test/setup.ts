/**
 * Global test setup.
 *
 * The suite is pinned to the mock provider (see `test.env` in vite.config.ts)
 * and must never reach the network — but nothing previously *enforced* that, so
 * a provider change that started issuing real requests would have surfaced as a
 * slow or flaky test rather than an obvious failure. Failing loudly on the
 * first call makes the demo posture ("works offline, no credentials") a
 * property the suite actually checks.
 */
import { beforeAll } from 'vitest'

beforeAll(() => {
  globalThis.fetch = (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    return Promise.reject(
      new Error(
        `Unexpected network request to ${url}. Tests run against the mock provider; ` +
          'stub the call or use the mock rather than reaching out.',
      ),
    )
  }
})
