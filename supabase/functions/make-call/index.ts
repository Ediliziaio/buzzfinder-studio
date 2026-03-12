import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function getAppSetting(userId: string, chiave: string): Promise<string | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("valore")
    .eq("chiave", chiave)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.valore || null;
}

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const {
      contact_id,
      campaign_id = null,
      agent_id: agentIdOverride = null,
      scheduled_at = null,
      script_contesto = null,
      obiettivo = null,
      automation_rule_id = null,
      recipient_id = null,
      execution_id = null,
    } = await req.json();

    if (!contact_id) return jsonError("contact_id obbligatorio", 400);

    // 1. Verifica JWT — obbligatorio (tranne chiamate interne con service_role)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Authorization header richiesto", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    let callerId: string | null = null;

    // Check if it's the service_role key (internal calls from process-automations)
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (token === serviceRoleKey) {
      // Internal call — skip ownership check
      callerId = null;
    } else {
      const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !caller) {
        return jsonError("Token non valido o scaduto", 401);
      }
      callerId = caller.id;
    }

    // 2. Carica contatto
    const { data: contact, error: contactErr } = await supabase
      .from("contacts")
      .select("id, nome, cognome, azienda, telefono, email, citta, google_categories, sito_web, note, telefono_dnc, totale_chiamate, user_id")
      .eq("id", contact_id)
      .single();

    if (contactErr || !contact) return jsonError("Contatto non trovato", 404);
    if (!contact.user_id) return jsonError("Contatto senza proprietario", 400);

    // Verifica ownership (skip per chiamate interne service_role)
    if (callerId && callerId !== contact.user_id) {
      return jsonError("Non autorizzato: il contatto non ti appartiene", 403);
    }

    const userId = contact.user_id;

    if (!contact.telefono) {
      return jsonError(`Il contatto ${contact.azienda} non ha un numero di telefono.`, 400);
    }
    if (contact.telefono_dnc) {
      return jsonError(`${contact.azienda} è in lista DNC (Do Not Call).`, 400);
    }

    // 2. Legge API key ElevenLabs
    const apiKey = await getAppSetting(userId, "elevenlabs_api_key");
    if (!apiKey) {
      return jsonError("elevenlabs_api_key non configurata. Aggiungila in Impostazioni → API Keys.", 400);
    }

    // 3. Determina quale agente usare
    const agentId = agentIdOverride || await getAppSetting(userId, "elevenlabs_agent_id_default");
    if (!agentId) {
      return jsonError("Nessun agente ElevenLabs configurato. Aggiungilo in Impostazioni → Chiamate AI.", 400);
    }

    // 4. Controlla orario consentito (se chiamata immediata)
    if (!scheduled_at) {
      const orarioInizio = await getAppSetting(userId, "chiamate_orario_inizio") || "09:00";
      const orarioFine = await getAppSetting(userId, "chiamate_orario_fine") || "18:00";
      const soloLavorativi = (await getAppSetting(userId, "chiamate_solo_lavorativi")) === "true";

      const now = new Date();
      const nowIT = new Intl.DateTimeFormat("it-IT", {
        timeZone: "Europe/Rome",
        hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(now);
      const [nowH, nowM] = nowIT.split(":").map(Number);
      const [startH, startM] = orarioInizio.split(":").map(Number);
      const [endH, endM] = orarioFine.split(":").map(Number);
      const nowMins = nowH * 60 + nowM;

      if (nowMins < startH * 60 + startM || nowMins > endH * 60 + endM) {
        return jsonError(
          `Fuori orario consentito (${orarioInizio}–${orarioFine}). Usa scheduled_at per pianificarla.`,
          400
        );
      }

      if (soloLavorativi) {
        const dayOfWeek = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Rome" })).getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          return jsonError("Le chiamate sono consentite solo nei giorni lavorativi.", 400);
        }
      }
    }

    // 5. Crea sessione chiamata nel DB
    const { data: callSession, error: insertErr } = await supabase
      .from("call_sessions")
      .insert({
        user_id: userId,
        campaign_id,
        contact_id,
        recipient_id,
        execution_id,
        automation_rule_id,
        agent_id: agentId,
        phone_number_to: contact.telefono,
        stato: scheduled_at ? "scheduled" : "calling",
        scheduled_at: scheduled_at || new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertErr) throw insertErr;

    // 6. Se è schedulata, non chiamare ancora
    if (scheduled_at) {
      return jsonOk({
        ok: true,
        call_session_id: callSession.id,
        scheduled: true,
        message: `Chiamata schedulata per ${new Date(scheduled_at).toLocaleString("it-IT")}`,
      });
    }

    // 7. Costruisci contesto dinamico per l'agente AI
    const settore = Array.isArray(contact.google_categories) && contact.google_categories.length > 0
      ? contact.google_categories.join(", ")
      : "";
    const contattoContesto = [
      `Stai chiamando: ${contact.nome ? contact.nome + " " + (contact.cognome || "") : "un responsabile"} di ${contact.azienda}.`,
      contact.citta ? `Città: ${contact.citta}.` : "",
      settore ? `Settore: ${settore}.` : "",
      contact.sito_web ? `Sito web: ${contact.sito_web}.` : "",
      contact.note ? `Note: ${contact.note.slice(0, 200)}.` : "",
      script_contesto ? `\nContesto specifico: ${script_contesto}` : "",
      obiettivo ? `\nObiettivo della chiamata: ${obiettivo}` : "",
    ].filter(Boolean).join(" ");

    // 8. Avvia chiamata ElevenLabs Conversational AI
    const phoneNumberId = await getAppSetting(userId, "elevenlabs_phone_number_id");
    const elevenLabsRes = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: agentId,
        agent_phone_number_id: phoneNumberId || undefined,
        to_number: contact.telefono,
        conversation_initiation_client_data: {
          dynamic_variables: {
            nome_contatto: contact.nome || "gentile cliente",
            azienda: contact.azienda,
            citta: contact.citta || "",
            settore: settore,
            sito_web: contact.sito_web || "",
            contesto: contattoContesto,
            obiettivo: obiettivo || "presentare i nostri servizi e valutare interesse",
          },
          conversation_config_override: {
            agent: {
              prompt: {
                prompt: contattoContesto,
              },
            },
          },
        },
      }),
    });

    if (!elevenLabsRes.ok) {
      const errText = await elevenLabsRes.text();
      await supabase
        .from("call_sessions")
        .update({
          stato: "failed",
          error_message: `ElevenLabs ${elevenLabsRes.status}: ${errText.slice(0, 300)}`,
        })
        .eq("id", callSession.id);

      throw new Error(`ElevenLabs API ${elevenLabsRes.status}: ${errText.slice(0, 200)}`);
    }

    const elevenData = await elevenLabsRes.json();
    const elevenCallId = elevenData.call_sid || elevenData.conversation_id || elevenData.id;

    // 9. Aggiorna sessione con ID ElevenLabs
    await supabase
      .from("call_sessions")
      .update({
        elevenlabs_call_id: elevenCallId,
        started_at: new Date().toISOString(),
      })
      .eq("id", callSession.id);

    // 10. Aggiorna statistiche contatto
    await supabase
      .from("contacts")
      .update({
        ultima_chiamata_at: new Date().toISOString(),
        totale_chiamate: (contact.totale_chiamate || 0) + 1,
      })
      .eq("id", contact_id);

    return jsonOk({
      ok: true,
      call_session_id: callSession.id,
      elevenlabs_call_id: elevenCallId,
      scheduled: false,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("make-call error:", message);
    return jsonError(message, 500);
  }
});
