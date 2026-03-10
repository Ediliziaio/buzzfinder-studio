import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ScrapingSession } from "@/types";

export function useScrapingSession(sessionId: string | null) {
  const [session, setSession] = useState<ScrapingSession | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    // Initial fetch
    supabase
      .from("scraping_sessions")
      .select("*")
      .eq("id", sessionId)
      .single()
      .then(({ data }) => {
        if (data) setSession(data as unknown as ScrapingSession);
      });

    // Realtime subscription
    const channel = supabase
      .channel(`scraping-session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "scraping_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          setSession(payload.new as unknown as ScrapingSession);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return session;
}

export function useScrapingSessions() {
  const [sessions, setSessions] = useState<ScrapingSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    const { data } = await supabase
      .from("scraping_sessions")
      .select("*")
      .eq("tipo", "google_maps")
      .order("created_at", { ascending: false })
      .limit(10);
    setSessions((data as unknown as ScrapingSession[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return { sessions, loading, refetch: fetchSessions };
}
