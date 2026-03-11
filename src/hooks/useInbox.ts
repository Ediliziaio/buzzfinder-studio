import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { InboxMessage } from "@/types";
export type { InboxMessage };

interface InboxFilters {
  etichetta?: string;
  canale?: string;
  campagna?: string;
  letto?: boolean | null;
  archiviato?: boolean;
  searchQuery?: string;
}

const PAGE_SIZE = 50;

export function useInbox(filters?: InboxFilters) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("inbox_messages")
      .select("*")
      .eq("archiviato", filters?.archiviato ?? false)
      .order("data_ricezione", { ascending: false })
      .limit(PAGE_SIZE);

    if (filters?.etichetta && filters.etichetta !== "tutti")
      query = query.eq("etichetta", filters.etichetta);
    if (filters?.canale && filters.canale !== "tutti")
      query = query.eq("canale", filters.canale);
    if (filters?.campagna && filters.campagna !== "tutti")
      query = query.eq("campaign_id", filters.campagna);
    if (filters?.letto !== undefined && filters.letto !== null)
      query = query.eq("letto", filters.letto);
    if (filters?.searchQuery) {
      query = query.or(
        `da_nome.ilike.%${filters.searchQuery}%,da_email.ilike.%${filters.searchQuery}%,corpo.ilike.%${filters.searchQuery}%,oggetto.ilike.%${filters.searchQuery}%`
      );
    }

    const { data } = await query;
    setMessages((data as InboxMessage[]) || []);
    setLoading(false);
  }, [
    filters?.etichetta, filters?.canale, filters?.letto,
    filters?.campagna, filters?.archiviato, filters?.searchQuery,
  ]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime
  useEffect(() => {
    channelRef.current = supabase
      .channel("inbox_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "inbox_messages" }, (payload) => {
        setMessages((prev) => [payload.new as InboxMessage, ...prev]);
        // Browser notification
        if ("Notification" in window && Notification.permission === "granted") {
          const msg = payload.new as any;
          new Notification("Nuova risposta! 📬", {
            body: `${msg.da_nome || msg.da_email}: ${msg.oggetto || msg.corpo?.slice(0, 60)}`,
            icon: "/favicon.ico",
          });
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "inbox_messages" }, (payload) => {
        setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } as InboxMessage : m)));
      })
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  const markAsRead = async (id: string) => {
    await supabase.from("inbox_messages").update({ letto: true }).eq("id", id);
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, letto: true } : m)));
  };

  const markAsUnread = async (id: string) => {
    await supabase.from("inbox_messages").update({ letto: false }).eq("id", id);
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, letto: false } : m)));
  };

  const updateEtichetta = async (id: string, etichetta: string) => {
    await supabase.from("inbox_messages").update({ etichetta, etichetta_ai: false }).eq("id", id);
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, etichetta, etichetta_ai: false } : m)));
  };

  const archiveMessage = async (id: string) => {
    await supabase.from("inbox_messages").update({ archiviato: true }).eq("id", id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const unarchiveMessage = async (id: string) => {
    await supabase.from("inbox_messages").update({ archiviato: false }).eq("id", id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const saveNote = async (id: string, note: string) => {
    await supabase.from("inbox_messages").update({ note } as any).eq("id", id);
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, note } : m)));
  };

  const nonLetti = messages.filter((m) => !m.letto).length;

  return {
    messages, loading, nonLetti,
    markAsRead, markAsUnread,
    updateEtichetta, archiveMessage, unarchiveMessage,
    saveNote, fetchMessages,
  };
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
