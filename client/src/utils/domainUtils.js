// Utility functions for domain classification and URL helpers
export const protectedDomains = ['dewflare', 'cloudveil', 'breezefall', 'frostblink'];

export function isProtectedDomain(url) {
  try {
    const host = new URL(url).hostname;
    return protectedDomains.some(d => host.includes(d));
  } catch (e) {
    return false;
  }
}

export function getProxyUrl(url) {
  // For subtitle files, try server proxy endpoint if available
  if (url && (url.includes('.vtt') || url.includes('.srt'))) {
    return `/api/subtitle-proxy?url=${encodeURIComponent(url)}`;
  }
  // For everything else, return the direct URL (no proxy)
  return url;
} 