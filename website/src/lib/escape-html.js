/**
 * Shared HTML escaping utility — prevents XSS in dynamic content.
 * Used across all dashboard pages (admin + client).
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
