import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

import type { InboxMessage } from "@/types";
export type { InboxMessage };

interface InboxFilters {
  etichetta?: string;
  canale?: string;
  letto?: boolean | null;
}

export function useInbox(filters?: InboxFilters) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    let query = supabase
      .from("inbox_messages")
      .select("*")
      .eq("archiviato", false)
      .order("data_ricezione", { ascending: false })
      .limit(200);

    if (filters?.etichetta && filters.etichetta !== "tutti")
      query = query.eq("etichetta", filters.etichetta);
    if (filters?.canale && filters.canale !== "tutti")
      query = query.eq("canale", filters.canale);
    if (filters?.letto !== undefined && filters.letto !== null)
      query = query.eq("letto", filters.letto);

    const { data } = await query;
    setMessages((data as InboxMessage[]) || []);
    setLoading(false);
  }, [filters?.etichetta, filters?.canale, filters?.letto]);

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel("inbox_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "inbox_messages" }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages]);

  const markAsRead = async (id: string) => {
    await supabase.from("inbox_messages").update({ letto: true }).eq("id", id);
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, letto: true } : m)));
  };

  const updateEtichetta = async (id: string, etichetta: string) => {
    await supabase.from("inbox_messages").update({ etichetta, etichetta_ai: false }).eq("id", id);
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, etichetta, etichetta_ai: false } : m)));
  };

  const archiveMessage = async (id: string) => {
    await supabase.from("inbox_messages").update({ archiviato: true }).eq("id", id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const nonLetti = messages.filter((m) => !m.letto).length;

  return { messages, loading, nonLetti, markAsRead, updateEtichetta, archiveMessage, fetchMessages };
}

export function useInboxUnreadCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      const { count: c } = await supabase
        .from("inbox_messages")
        .select("*", { count: "exact", head: true })
        .eq("letto", false)
        .eq("archiviato", false);
      setCount(c || 0);
    };
    fetch();

    const channel = supabase
      .channel("inbox_unread_count")
      .on("postgres_changes", { event: "*", schema: "public", table: "inbox_messages" }, () => {
        fetch();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return count;
}
