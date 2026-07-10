/** Shared href allowlist rules (keep in sync with web/tga-utils.js safeHref). */
export function isAllowedHref(url) {
  if (url == null) return false;
  const s = String(url).trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return false;
  }
  if (/^https?:\/\//i.test(s)) return true;
  if (s.startsWith('/') && s[1] !== '/') return true;
  return false;
}
