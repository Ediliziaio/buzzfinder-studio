import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Campaign } from "@/types";

export function useActiveCampaigns() {
  const [activeCampaigns, setActiveCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("*")
        .in("stato", ["in_corso", "pausa"])
        .order("started_at", { ascending: false });
      setActiveCampaigns((data as unknown as Campaign[]) || []);
    };

    load();

    const channel = supabase
      .channel("active-campaigns-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "campaigns" }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { activeCampaigns };
}
