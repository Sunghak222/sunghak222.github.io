export function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function safeURL(value = '', asset = false) {
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^assets\/[a-zA-Z0-9_./-]+$/.test(raw) && !raw.split('/').includes('..')) return raw;
  try {
    const url = new URL(raw);
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return raw;
  } catch { /* Invalid URLs are omitted from the page. */ }
  return '';
}

const text = escapeHTML;
export const paragraphs = value => String(value || '').split(/\n\s*\n/).filter(s => s.trim()).map(s => `<p>${text(s).replace(/\n/g, '<br>')}</p>`).join('');
export const external = url => /^https?:/.test(url) ? ' target="_blank" rel="noopener noreferrer"' : '';
export const link = (url, label, className = '', { newTab = false } = {}) => safeURL(url) ? `<a class="${className}" href="${text(safeURL(url))}"${newTab ? ' target="_blank" rel="noopener noreferrer"' : external(url)}>${text(label)} <span aria-hidden="true">↗</span></a>` : '';
