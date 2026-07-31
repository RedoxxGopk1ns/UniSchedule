// `vitest/config` rather than `vite` — same function, but its type knows about
// the `test` block below.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // The suite must never depend on whoever's .env.local is on disk. Without
    // this, VITE_DATA_SOURCE=supabase leaks in and the render smoke tests hit a
    // real project instead of the mock provider they assert against.
    env: {
      VITE_DATA_SOURCE: 'mock',
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
      VITE_ENABLE_CALENDAR_SYNC: 'false',
    },
  },
})
