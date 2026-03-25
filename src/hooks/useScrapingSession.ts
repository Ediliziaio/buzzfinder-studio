import { useState, useEffect, useCallback, useRef } from "react";
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
      .maybeSingle()
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
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 10;
  // useRef avoids stale closure on sessions.length — offset always reflects current count
  const sessionsLenRef = useRef(0);

  const fetchSessions = useCallback(async (appendMode = false) => {
    const offset = appendMode ? sessionsLenRef.current : 0;
    const { data } = await supabase
      .from("scraping_sessions")
      .select("*")
      .eq("tipo", "google_maps")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    const newSessions = (data as unknown as ScrapingSession[]) || [];
    if (appendMode) {
      setSessions((prev) => {
        const merged = [...prev, ...newSessions];
        sessionsLenRef.current = merged.length;
        return merged;
      });
    } else {
      setSessions(newSessions);
      sessionsLenRef.current = newSessions.length;
    }
    setHasMore(newSessions.length === PAGE_SIZE);
    setLoading(false);
  }, []); // no deps — uses ref for offset

  useEffect(() => {
    fetchSessions(false);
  }, [fetchSessions]);

  const loadMore = useCallback(() => fetchSessions(true), [fetchSessions]);

  return { sessions, loading, hasMore, loadMore, refetch: () => fetchSessions(false) };
}
