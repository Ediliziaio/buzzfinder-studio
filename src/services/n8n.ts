import axios from "axios";
import { supabase } from "@/integrations/supabase/client";

export async function getN8nSettings() {
  const { data } = await supabase
    .from("app_settings")
    .select("chiave, valore")
    .in("chiave", ["n8n_instance_url", "n8n_api_key", "n8n_webhook_scrape_maps", "n8n_webhook_scrape_websites", "n8n_webhook_send_emails", "n8n_webhook_send_sms", "n8n_webhook_send_whatsapp"]);

  const settings: Record<string, string> = {};
  data?.forEach((s) => {
    settings[s.chiave] = s.valore || "";
  });
  return settings;
}

export async function triggerN8nWebhook(webhookPath: string, payload: Record<string, unknown>) {
  const settings = await getN8nSettings();
  const baseUrl = settings.n8n_instance_url;
  if (!baseUrl) throw new Error("URL n8n non configurato. Vai in Impostazioni → API Keys.");

  const url = `${baseUrl.replace(/\/$/, "")}${webhookPath}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (settings.n8n_api_key) {
    headers["Authorization"] = `Bearer ${settings.n8n_api_key}`;
  }

  const response = await axios.post(url, payload, { headers });
  return response.data;
}
