// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

// Safe for server-side calls only (uses the service role key)
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  {
    auth: { persistSession: false },
  }
);
