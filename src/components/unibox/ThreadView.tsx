import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { InboxMessage } from "@/hooks/useInbox";

interface Props {
  message: InboxMessage;
}

export function ThreadView({ message }: Props) {
  const [thread, setThread] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        let query = supabase.from("inbox_messages").select("*");

        if (message.thread_id) {
          query = query.eq("thread_id", message.thread_id);
        } else if (message.da_email && message.campaign_id) {
          query = query.eq("campaign_id", message.campaign_id)
            .or(`da_email.eq.${message.da_email}`);
        } else {
          // Fallback: just show this message
          if (!cancelled) { setThread([message]); setLoading(false); }
          return;
        }

        const { data } = await query.order("data_ricezione", { ascending: true }).limit(100);
        if (!cancelled) setThread((data as InboxMessage[]) || [message]);
      } catch {
        if (!cancelled) setThread([message]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [message.id, message.thread_id, message.da_email, message.campaign_id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (thread.length <= 1) {
    // Single message — render normally
    const msg = thread[0] || message;
    return (
      <div>
        {msg.corpo_html ? (
          <div className="prose prose-sm max-w-none font-mono text-sm" dangerouslySetInnerHTML={{ __html: msg.corpo_html }} />
        ) : (
          <pre className="font-mono text-sm whitespace-pre-wrap text-foreground">{msg.corpo}</pre>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
        Thread ({thread.length} messaggi)
      </div>
      {thread.map((msg) => {
        const isOutgoing = msg.etichetta === "risposta_inviata";
        const isCurrent = msg.id === message.id;

        return (
          <div
            key={msg.id}
            className={cn(
              "max-w-[85%] rounded-lg border p-3 space-y-1",
              isOutgoing
                ? "ml-auto bg-primary/10 border-primary/20"
                : "mr-auto bg-card border-border",
              isCurrent && "ring-2 ring-primary/40"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] font-bold text-foreground">
                {isOutgoing ? "Tu" : (msg.da_nome || msg.da_email || msg.da_telefono)}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">
                {format(new Date(msg.data_ricezione), "dd/MM HH:mm")}
              </span>
            </div>
            {msg.oggetto && (
              <p className="font-mono text-[10px] text-muted-foreground truncate">📌 {msg.oggetto}</p>
            )}
            <div className="font-mono text-xs text-foreground">
              {msg.corpo_html ? (
                <div className="prose prose-sm max-w-none text-xs" dangerouslySetInnerHTML={{ __html: msg.corpo_html }} />
              ) : (
                <pre className="whitespace-pre-wrap">{msg.corpo}</pre>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
