/**
 * Generate tracking pixel URL for email open tracking.
 */
export function getTrackingPixelUrl(recipientId: string, campaignId: string, variant?: string): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const baseUrl = `https://${projectId}.supabase.co/functions/v1/track-open`;
  const params = new URLSearchParams({ rid: recipientId, cid: campaignId });
  if (variant) params.set("v", variant);
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate tracking pixel HTML to embed in email body.
 */
export function getTrackingPixelHtml(recipientId: string, campaignId: string, variant?: string): string {
  const url = getTrackingPixelUrl(recipientId, campaignId, variant);
  return `<img src="${url}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;
}
