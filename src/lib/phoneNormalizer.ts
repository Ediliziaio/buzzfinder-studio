/**
 * Normalize Italian phone numbers to +39XXXXXXXXXX format.
 */
export function normalizeItalianPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;

  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, "");

  // Remove leading + if present, track it
  const hadPlus = cleaned.startsWith("+");
  if (hadPlus) cleaned = cleaned.substring(1);

  // Already has Italian country code
  if (cleaned.startsWith("39") && cleaned.length >= 11 && cleaned.length <= 13) {
    return `+${cleaned}`;
  }

  // Starts with 0 (local format like 02, 06, 3xx)
  if (cleaned.startsWith("0") && cleaned.length >= 9 && cleaned.length <= 11) {
    return `+39${cleaned}`;
  }

  // Mobile number without prefix (3xx...)
  if (cleaned.startsWith("3") && cleaned.length === 10) {
    return `+39${cleaned}`;
  }

  // If it has 00 international prefix
  if (cleaned.startsWith("0039")) {
    return `+${cleaned.substring(2)}`;
  }

  // Can't normalize reliably
  return hadPlus ? `+${cleaned}` : phone;
}

/**
 * Validate if a phone number looks like a valid Italian number.
 */
export function isValidItalianPhone(phone: string | null | undefined): boolean {
  const normalized = normalizeItalianPhone(phone);
  if (!normalized) return false;
  // Italian numbers: +39 followed by 9-11 digits
  return /^\+39\d{9,11}$/.test(normalized);
}
