/**
 * Basic email validation for lead generation use cases.
 */

const DISPOSABLE_DOMAINS = [
  "mailinator.com", "guerrillamail.com", "tempmail.com", "throwaway.email",
  "yopmail.com", "sharklasers.com", "guerrillamailblock.com", "grr.la",
  "10minutemail.com", "trashmail.com",
];

const ROLE_PREFIXES = [
  "noreply", "no-reply", "donotreply", "info", "admin", "webmaster",
  "postmaster", "hostmaster", "abuse", "support", "sales",
];

export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim().toLowerCase());
}

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return DISPOSABLE_DOMAINS.includes(domain);
}

export function isRoleEmail(email: string): boolean {
  const local = email.split("@")[0]?.toLowerCase();
  return ROLE_PREFIXES.some((p) => local === p || local.startsWith(`${p}.`) || local.startsWith(`${p}_`));
}

export interface EmailQuality {
  valid: boolean;
  disposable: boolean;
  roleAddress: boolean;
  score: number; // 0-100
}

export function assessEmailQuality(email: string | null | undefined): EmailQuality {
  if (!email || !isValidEmail(email)) {
    return { valid: false, disposable: false, roleAddress: false, score: 0 };
  }

  const e = email.trim().toLowerCase();
  const disposable = isDisposableEmail(e);
  const roleAddress = isRoleEmail(e);

  let score = 100;
  if (disposable) score -= 60;
  if (roleAddress) score -= 20;
  // Penalize very short local parts
  if (e.split("@")[0].length < 3) score -= 10;

  return { valid: true, disposable, roleAddress, score: Math.max(0, score) };
}
