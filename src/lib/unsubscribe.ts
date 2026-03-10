/**
 * Generate unsubscribe link for email campaigns.
 * Uses the Supabase edge function URL.
 */
export function getUnsubscribeLink(email: string, campaignId?: string): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const baseUrl = `https://${projectId}.supabase.co/functions/v1/unsubscribe`;
  const params = new URLSearchParams({ email });
  if (campaignId) params.set("campaign_id", campaignId);
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate the HTML unsubscribe footer to append to email body.
 */
export function getUnsubscribeFooterHtml(email: string, campaignId?: string): string {
  const link = getUnsubscribeLink(email, campaignId);
  return `
<div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; text-align: center;">
  <p style="font-size: 11px; color: #737373; font-family: system-ui, sans-serif;">
    Non vuoi più ricevere queste email? 
    <a href="${link}" style="color: #737373; text-decoration: underline;">Disiscriviti</a>
  </p>
</div>`;
}
