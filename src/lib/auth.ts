import { supabase } from "@/integrations/supabase/client";

/** Returns current user ID or throws if not authenticated */
export async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autenticato");
  return user.id;
}
