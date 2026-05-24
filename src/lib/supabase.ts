// Supabase client wrappers. Two flavors:
//   - getServerSupabase(): uses SUPABASE_SERVICE_ROLE_KEY, full DB access,
//     bypasses Row Level Security. Use in API routes, scrapers, and any
//     server-side code. NEVER ship this key to the browser.
//   - getBrowserSupabase(): uses NEXT_PUBLIC_SUPABASE_ANON_KEY, subject to
//     RLS policies. Only needed if you ever add direct browser→Supabase
//     queries; today the app talks to its own /api routes which then use
//     the server client.
//
// During the migration, this module sits side-by-side with src/lib/db.ts
// (the SQLite client). Callsites switch over one at a time.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _serverClient: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient {
  if (_serverClient) return _serverClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY in .env.local (see MIGRATION.md)."
    );
  }
  _serverClient = createClient(url, key, {
    auth: {
      // Service-role: no session, no auto-refresh — we authenticate via the
      // key in the Authorization header on every request.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return _serverClient;
}

let _browserClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (_browserClient) return _browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (see MIGRATION.md)."
    );
  }
  _browserClient = createClient(url, key);
  return _browserClient;
}
