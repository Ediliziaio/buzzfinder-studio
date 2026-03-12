import axios, { AxiosError } from "axios";
import { supabase } from "@/integrations/supabase/client";

/**
 * Check if n8n instance is reachable. Returns true if healthy, false otherwise.
 */
export async function checkN8nHealth(): Promise<boolean> {
  try {
    const settings = await getN8nSettings();
    const baseUrl = settings.n8n_instance_url;
    if (!baseUrl) return false;
    const requestId = crypto.randomUUID();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/healthz`, {
      signal: controller.signal,
      headers: { "X-Request-ID": requestId },
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

export async function getN8nSettings() {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  let query = supabase
    .from("app_settings")
    .select("chiave, valore")
    .in("chiave", [
      "n8n_instance_url", "n8n_api_key",
      "n8n_webhook_scrape_maps", "n8n_webhook_scrape_websites",
      "n8n_webhook_send_emails", "n8n_webhook_send_sms",
      "n8n_webhook_send_whatsapp", "n8n_webhook_campaign_control",
    ]);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data } = await query;

  const settings: Record<string, string> = {};
  data?.forEach((s) => {
    settings[s.chiave] = s.valore || "";
  });
  return settings;
}

/** Delay helper for backoff */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Check if error is retryable (network error or 5xx) */
function isRetryable(error: AxiosError): boolean {
  if (!error.response) return true; // network error
  return error.response.status >= 500;
}

export async function triggerN8nWebhook(webhookPath: string, payload: Record<string, unknown>) {
  const settings = await getN8nSettings();
  const baseUrl = settings.n8n_instance_url;
  if (!baseUrl) throw new Error("URL n8n non configurato. Vai in Impostazioni → API Keys.");

  const url = `${baseUrl.replace(/\/$/, "")}${webhookPath}`;
  const requestId = crypto.randomUUID();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Request-ID": requestId,
  };
  if (settings.n8n_api_key) {
    headers["Authorization"] = `Bearer ${settings.n8n_api_key}`;
  }

  const MAX_RETRIES = 3;
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(url, payload, {
        headers,
        timeout: 10_000,
      });
      return response.data;
    } catch (err) {
      lastError = err;
      const axiosErr = err as AxiosError;
      if (attempt < MAX_RETRIES - 1 && isRetryable(axiosErr)) {
        await delay(1000 * Math.pow(2, attempt)); // 1s, 2s, 4s
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}
