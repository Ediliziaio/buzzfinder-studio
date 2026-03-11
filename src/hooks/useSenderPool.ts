import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SenderPool } from "@/types";

export function useSenderPool(tipo?: "email" | "whatsapp" | "sms") {
  const [senders, setSenders] = useState<SenderPool[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSenders = useCallback(async () => {
    let query = supabase
      .from("sender_pool")
      .select("*")
      .order("health_score", { ascending: false });
    if (tipo) query = query.eq("tipo", tipo);
    const { data, error } = await query;
    if (error) { console.error("Errore caricamento sender pool:", error.message); }
    setSenders((data as unknown as SenderPool[]) || []);
    setLoading(false);
  }, [tipo]);

  useEffect(() => {
    fetchSenders();

    const channel = supabase
      .channel("sender_pool_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sender_pool" },
        fetchSenders
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSenders]);

  const toggleActive = async (id: string, attivo: boolean) => {
    await supabase.from("sender_pool").update({ attivo }).eq("id", id);
    fetchSenders();
  };

  const deleteSender = async (id: string) => {
    await supabase.from("sender_pool").delete().eq("id", id);
    fetchSenders();
  };

  const capacitaOggi = senders
    .filter((s) => s.attivo && s.stato !== "banned")
    .reduce((sum, s) => sum + Math.max(0, s.max_per_day - s.inviati_oggi), 0);

  return { senders, loading, fetchSenders, toggleActive, deleteSender, capacitaOggi };
}
