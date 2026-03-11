import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("email");
    const campaignId = url.searchParams.get("campaign_id");

    if (!email) {
      return new Response(
        renderPage("Errore", "Link non valido. Parametro email mancante."),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Look up user_id from the contact
    let userId: string | null = null;
    const { data: contact } = await supabase
      .from("contacts")
      .select("id, user_id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();
    userId = contact?.user_id || null;

    // If no contact found but we have a campaign, get user_id from campaign
    if (!userId && campaignId) {
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("user_id")
        .eq("id", campaignId)
        .maybeSingle();
      userId = campaign?.user_id || null;
    }

    // Add to suppression list
    const { error } = await supabase.from("suppression_list").upsert(
      { email: email.toLowerCase().trim(), motivo: "unsubscribe", campaign_id: campaignId || null, user_id: userId },
      { onConflict: "email" }
    );

    if (error) {
      console.error("Suppression insert error:", error);
      return new Response(
        renderPage("Errore", "Si è verificato un errore. Riprova più tardi."),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // Log activity
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (contact) {
      await supabase.from("contact_activities").insert({
        contact_id: contact.id,
        tipo: "stato_cambiato",
        descrizione: "Disiscrizione ricevuta",
        campaign_id: campaignId || null,
        metadata: { action: "unsubscribe" },
      });
    }

    return new Response(
      renderPage(
        "Disiscrizione confermata",
        `L'indirizzo <strong>${email}</strong> è stato rimosso dalla lista. Non riceverai più comunicazioni.`
      ),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return new Response(
      renderPage("Errore", "Si è verificato un errore imprevisto."),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
    );
  }
});

function renderPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #e5e5e5; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #171717; border: 1px solid #262626; border-radius: 12px; padding: 48px; max-width: 480px; text-align: center; }
    h1 { font-size: 1.5rem; margin-bottom: 16px; font-weight: 700; }
    p { color: #a3a3a3; font-size: 0.875rem; line-height: 1.6; }
    strong { color: #e5e5e5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
