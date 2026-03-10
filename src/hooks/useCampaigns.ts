import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Campaign } from "@/types";

async function fetchCampaigns() {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as Campaign[]) || [];
}

export function useCampaigns() {
  const query = useQuery({
    queryKey: ["campaigns"],
    queryFn: fetchCampaigns,
    staleTime: 30_000,
  });

  return {
    campaigns: query.data || [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
