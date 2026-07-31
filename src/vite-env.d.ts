/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'mock' (default) or 'supabase'. See src/lib/data/provider.ts */
  readonly VITE_DATA_SOURCE?: 'mock' | 'supabase'
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /**
   * 'true' requests the Google Calendar scope at sign-in and pushes events via
   * the sync-schedule Edge Function. Off by default: the schedule persists to
   * Postgres either way. See src/lib/supabase.ts
   */
  readonly VITE_ENABLE_CALENDAR_SYNC?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
