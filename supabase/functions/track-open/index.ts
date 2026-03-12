import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 1x1 transparent GIF
const PIXEL = Uint8Array.from(atob(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
), c => c.charCodeAt(0));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const recipientId = url.searchParams.get("rid");
    const campaignId = url.searchParams.get("cid");
    const variant = url.searchParams.get("v"); // "A" or "B" for A/B testing

    if (!recipientId || !campaignId) {
      return new Response(PIXEL, {
        headers: { ...corsHeaders, "Content-Type": "image/gif", "Cache-Control": "no-store" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Only update recipient status if not already opened — prevents duplicate counting
    const { data: updated, error: updateErr } = await supabase
      .from("campaign_recipients")
      .update({ stato: "opened", opened_at: new Date().toISOString() })
      .eq("id", recipientId)
      .eq("campaign_id", campaignId)
      .in("stato", ["sent", "delivered"])
      .is("opened_at", null)
      .select("id, contact_id");

    // Only increment campaign counters if the recipient was actually updated (first open)
    if (updated && updated.length > 0) {
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("aperti, aperti_a, aperti_b, ab_test_enabled")
        .eq("id", campaignId)
        .single();

      if (campaign) {
        const updates: Record<string, number> = {
          aperti: (campaign.aperti || 0) + 1,
        };

        // Update A/B variant counters
        if (campaign.ab_test_enabled && variant) {
          if (variant === "A") {
            updates.aperti_a = (campaign.aperti_a || 0) + 1;
          } else if (variant === "B") {
            updates.aperti_b = (campaign.aperti_b || 0) + 1;
          }
        }

        await supabase
          .from("campaigns")
          .update(updates)
          .eq("id", campaignId);
      }

      // Log activity (only on first open)
      const contactId = updated[0]?.contact_id;
      if (contactId) {
        await supabase.from("contact_activities").insert({
          contact_id: contactId,
          campaign_id: campaignId,
          tipo: "email_aperta",
          descrizione: `Email aperta${variant ? ` (variante ${variant})` : ""}`,
          metadata: { recipient_id: recipientId, variant },
        });
      }
    }

    return new Response(PIXEL, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    });
  } catch (_err) {
    // Always return pixel even on error
    return new Response(PIXEL, {
      headers: { ...corsHeaders, "Content-Type": "image/gif", "Cache-Control": "no-store" },
    });
  }
});
