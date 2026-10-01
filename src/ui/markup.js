/**
 * Minimal markup in lesson and glossary text: **bold** and `code`, escaped otherwise.
 * Every authored string shown as HTML goes through this.
 */
export function markup(s) {
  const escaped = String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped
    .replace(/`([^`]+)`/g, (m, code) => `<code class="ls-inline">${code}</code>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
