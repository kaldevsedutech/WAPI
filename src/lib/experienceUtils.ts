export type ExperienceMode = 'daily' | 'professional' | 'advanced';

/**
 * Utility to determine if a specific feature should be visible based on the user's active Experience Mode.
 * 
 * Progressive Disclosure breakdown:
 * - Daily (Basic): Minimal essentials only. Core metrics, single QR link, basic single campaigns, simple 2-Way Chat.
 * - Professional: Exposes advanced business tools. Multi-campaign comparison, CSV & manual contacts manager, Campaign Reports.
 * - Advanced: Unrestricted access. Full A/B test variations, microsecond blast staggers, raw inbound simulator, and custom trigger utilities.
 */
export function isFeatureVisible(featureName: string, mode: ExperienceMode = 'daily'): boolean {
  switch (featureName) {
    case 'ab-testing':
    case 'interval-stagger':
    case 'inbound-simulator':
    case 'auto-replies':
    case 'birthday-wishes':
      return mode === 'advanced';

    case 'campaign-reports':
    case 'contacts-manager':
    case 'campaign-comparison':
    case 'deep-analytics':
      return mode === 'professional' || mode === 'advanced';

    default:
      return true; // standard features
  }
}

/**
 * Utility to mask phone numbers for visual privacy on public deployment.
 * Keeps the country code and first 3/last 2 digits of the local number.
 * Example: +919493165230 -> +91 949***30 or +91949***5230
 */
export function maskPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.trim();
  
  // Format for Indian numbers: +919493165230
  if (cleaned.startsWith("+91") && cleaned.length >= 13) {
    return `+91 ${cleaned.slice(3, 6)}***${cleaned.slice(-4)}`;
  }
  
  if (cleaned.startsWith("+") && cleaned.length >= 10) {
    return `${cleaned.slice(0, 4)}***${cleaned.slice(-3)}`;
  }
  
  if (cleaned.length > 6) {
    return `${cleaned.slice(0, 3)}***${cleaned.slice(-3)}`;
  }
  
  return cleaned;
}
