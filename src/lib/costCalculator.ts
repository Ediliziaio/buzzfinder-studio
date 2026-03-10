export interface CostBreakdown {
  provider: string;
  unitCost: number;
  totalCost: number;
  tiers?: { name: string; cost: number; note: string }[];
  warnings: string[];
  recommendation?: string;
}

export function calculateEmailCost(recipientCount: number): CostBreakdown {
  const tiers = [
    { name: "Free (100/giorno)", cost: 0, note: `${Math.ceil(recipientCount / 100)} giorni necessari` },
    { name: "Pro ($20/mese)", cost: recipientCount <= 50000 ? 0 : ((recipientCount - 50000) / 1000) * 0.80, note: recipientCount <= 50000 ? "Incluso nel piano" : `${recipientCount - 50000} extra × $0.80/1000` },
    { name: "Business", cost: (recipientCount / 1000) * 0.80, note: `${recipientCount} × $0.80/1000` },
  ];

  const warnings: string[] = [];
  if (recipientCount > 100) warnings.push("Piano Free: max 100 email/giorno");

  return {
    provider: "Resend",
    unitCost: recipientCount <= 50000 ? 0 : 0.0008,
    totalCost: tiers[1].cost,
    tiers,
    warnings,
    recommendation: recipientCount <= 50000 ? "Con piano Pro ($20/mo) questa campagna costa €0.00" : undefined,
  };
}

export function calculateSmsCost(recipientCount: number, messageLength: number): CostBreakdown {
  // GSM7 vs UCS-2 aware SMS counting
  const { isGsm7Only } = require("@/lib/campaignHelpers");
  // We can't import dynamically, so inline the logic
  const GSM7 = new Set(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ !\"#¤%&'()*+,-./:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
    "ÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà0123456789{}"
  );
  // For cost calculation we don't have the actual text, just the length
  // The caller should pass accurate smsCount if needed; here we use 160 as default
  const smsCount = messageLength === 0 ? 0 : messageLength > 160 ? Math.ceil(messageLength / 153) : 1;
  const unitCost = 0.0085;
  const totalCost = recipientCount * unitCost * (smsCount || 1);

  const warnings: string[] = [];
  if (smsCount > 1) warnings.push(`Testo lungo: ${smsCount} SMS per messaggio — costo ×${smsCount}`);

  return {
    provider: "Telnyx",
    unitCost,
    totalCost,
    tiers: [
      { name: "Telnyx", cost: totalCost, note: `€${unitCost}/SMS × ${recipientCount}${smsCount > 1 ? ` × ${smsCount}` : ""}` },
      { name: "Brevo (confronto)", cost: recipientCount * 0.050 * smsCount, note: "€0.050/SMS" },
      { name: "Twilio (confronto)", cost: recipientCount * 0.075 * smsCount, note: "€0.075/SMS" },
    ],
    warnings,
    recommendation: "Telnyx: miglior rapporto qualità/prezzo per SMS Italia",
  };
}

export function calculateWhatsappCost(recipientCount: number): CostBreakdown {
  const unitCost = 0.0622;
  const totalCost = recipientCount * unitCost;
  const daysNeeded = Math.ceil(recipientCount / 1000);

  const warnings: string[] = [
    `Limite: 1.000 conversazioni/giorno per numero`,
    `Questa campagna richiede ~${daysNeeded} giorn${daysNeeded > 1 ? "i" : "o"}`,
    "Solo template pre-approvati da Meta",
  ];

  return {
    provider: "Meta Cloud API",
    unitCost,
    totalCost,
    warnings,
    recommendation: recipientCount > 500 ? "Considera di suddividere in batch per ridurre il rischio segnalazioni" : undefined,
  };
}

export function calculateCost(tipo: string, recipientCount: number, messageLength = 0): CostBreakdown {
  switch (tipo) {
    case "email": return calculateEmailCost(recipientCount);
    case "sms": return calculateSmsCost(recipientCount, messageLength);
    case "whatsapp": return calculateWhatsappCost(recipientCount);
    default: return { provider: "N/A", unitCost: 0, totalCost: 0, warnings: [] };
  }
}
