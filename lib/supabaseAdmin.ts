import { createClient } from "@supabase/supabase-js";

function cleanEnvValue(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, "");
}

function normalizeSupabaseUrl(value: string | undefined) {
  const cleanedValue = cleanEnvValue(value);

  if (!cleanedValue) {
    return null;
  }

  return cleanedValue.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

export function createSupabaseAdmin() {
  const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });
}
