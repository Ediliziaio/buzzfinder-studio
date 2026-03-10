import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ContactList } from "@/types";

async function fetchLists() {
  const { data, error } = await supabase
    .from("lists")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as ContactList[]) || [];
}

export function useLists() {
  const query = useQuery({
    queryKey: ["lists"],
    queryFn: fetchLists,
    staleTime: 30_000,
  });

  return {
    lists: query.data || [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
