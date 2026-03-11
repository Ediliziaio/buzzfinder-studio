import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DISMISS_KEY = "sender_alerts_dismissed_at";
const DISMISS_HOURS = 24;

export function useSenderAlerts() {
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    // Check if dismissed recently
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - Number(dismissedAt);
      if (elapsed < DISMISS_HOURS * 60 * 60 * 1000) return;
    }

    const checkAlerts = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: senders } = await supabase
        .from("sender_pool")
        .select("nome, bounce_rate, spam_rate, tipo, attivo")
        .eq("user_id", user.id)
        .eq("attivo", true);

      if (!senders?.length) return;

      let alerted = false;

      for (const s of senders) {
        const bounceRate = Number(s.bounce_rate) || 0;
        const spamRate = Number(s.spam_rate) || 0;

        if (bounceRate > 0.05) {
          toast.error(`🚨 ${s.nome}: bounce rate critico (${(bounceRate * 100).toFixed(1)}%)`, {
            description: "Rischio blocco da parte dei provider. Verifica gli indirizzi.",
            duration: 10000,
          });
          alerted = true;
        } else if (bounceRate > 0.02) {
          toast.warning(`⚠️ ${s.nome}: bounce rate alto (${(bounceRate * 100).toFixed(1)}%)`, {
            description: "Consigliato verificare le email prima dell'invio.",
            duration: 8000,
          });
          alerted = true;
        }

        if (spamRate > 0.003) {
          toast.error(`🚨 ${s.nome}: spam rate critico (${(spamRate * 100).toFixed(2)}%)`, {
            description: "Gmail blocca a >0.3%. Rivedi il contenuto delle email.",
            duration: 10000,
          });
          alerted = true;
        } else if (spamRate > 0.001) {
          toast.warning(`⚠️ ${s.nome}: spam rate elevato (${(spamRate * 100).toFixed(2)}%)`, {
            description: "Attenzione: avvicinamento alla soglia critica.",
            duration: 8000,
          });
          alerted = true;
        }
      }

      if (alerted) {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      }
    };

    // Delay to avoid blocking initial render
    const timer = setTimeout(checkAlerts, 3000);
    return () => clearTimeout(timer);
  }, []);
}
