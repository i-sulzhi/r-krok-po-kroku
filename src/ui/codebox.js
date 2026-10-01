/**
 * The code box: an editor whose every character can be pointed at.
 *
 * This is the trainer's main surface (decision D10). The student reads code, points
 * at a piece of it, and the stage shows what that piece evaluated to and how. So
 * the box does three things a plain textarea does not:
 *
 * - it paints *ranges* -- the selected sub-expression, the one under the pointer,
 *   the one pulsing "click me", an error -- on a highlighted layer behind the text;
 * - it turns a pointer position or a caret position into a source offset;
 * - it pins small value chips at the end of lines ("→ 3.875"), so results sit next
 *   to the code that produced them instead of in a console below.
 *
 * It knows nothing about R values or AST nodes: the owner maps offsets to nodes.
 * Offsets from pointer positions rely on a monospace font and no line wrapping,
 * both enforced here -- which is also how code should look to a beginner.
 */

import { el } from './dom.js';
import { tokenize, T } from '../core/lexer.js';
import { t } from '../i18n/index.js';

const TOKEN_CLASS = {
  [T.NUM]: 'tk-num',
  [T.STR]: 'tk-str',
  [T.KEYWORD]: 'tk-key',
  [T.OP]: 'tk-op',
  [T.IDENT]: 'tk-id',
};

/** Paint order: later kinds sit on top of earlier ones. */
const MARK_KINDS = ['sel', 'hov', 'tap', 'err'];

export class CodeBox {
  /**
   * @param {HTMLElement} host
   * @param {Object} opts
   *   value      initial code
   *   readOnly   no typing (pointing still works)
   *   minRows    height floor
   *   onEdit(v)  called after typing settles (debounced)
   *   onRun()    Ctrl/Cmd+Enter
   *   onPoint(offset, {repeat})  the caret landed on a character (click or keys)
   *   onHover(offset|null, event) the pointer moved over a character / left the code
   */
  constructor(host, opts = {}) {
    this.opts = opts;
    this.marks = {};
    this.lastPoint = null;

    this.layer = el('pre.cb-layer', { 'aria-hidden': 'true' });
    this.input = el('textarea.cb-input', {
      spellcheck: 'false',
      autocomplete: 'off',
      autocapitalize: 'off',
      wrap: 'off',
      'aria-label': t('ui.codeLabel'),
      placeholder: opts.placeholder || t('ui.editorPlaceholder'),
    });
    this.input.value = opts.value || '';
    this.input.readOnly = !!opts.readOnly;
    this.input.rows = 1;
    this.chips = [];
    this.chipLayer = el('div.cb-chips');
    this.wrap = el('div.cb-wrap', this.layer, this.input, this.chipLayer);
    host.append(this.wrap);

    this.input.addEventListener('input', () => {
      this.clearMark('err');
      this.render();
      clearTimeout(this.editTimer);
      this.editTimer = setTimeout(() => this.opts.onEdit?.(this.value), 380);
    });
    this.input.addEventListener('scroll', () => this.syncScroll());
    this.input.addEventListener('keydown', (e) => this.onKey(e));
    this.input.addEventListener('keyup', (e) => {
      if (/^Arrow|^Home$|^End$/.test(e.key)) this.caretMoved();
    });
    this.input.addEventListener('mouseup', () => requestAnimationFrame(() => this.caretMoved()));
    this.input.addEventListener('mousemove', (e) => this.opts.onHover?.(this.offsetAt(e.clientX, e.clientY), e));
    this.input.addEventListener('mouseleave', (e) => this.opts.onHover?.(null, e));

    this.render();
    // Built detached, then mounted by the owner: geometry (line height, character
    // width) only exists once the box is in the page, so lay out again then.
    requestAnimationFrame(() => this.relayout());
  }

  /** Recompute geometry-dependent layout: height and chip positions. */
  relayout() {
    this.m = null;
    this.render();
    this.placeChips();
  }

  get value() { return this.input.value; }

  set value(v) {
    this.input.value = v;
    this.marks = {};
    this.lastPoint = null;
    this.render();
  }

  set readOnly(on) { this.input.readOnly = !!on; }

  focus() { this.input.focus(); }

  onKey(e) {
    // Ctrl/Cmd+Enter runs -- the habit every R user already has from RStudio.
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      clearTimeout(this.editTimer);
      this.opts.onRun?.(this.value);
      return;
    }
    if (e.key === 'Tab' && !this.input.readOnly) {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: end } = this.input;
      this.input.setRangeText('  ', s, end, 'end');
      this.input.dispatchEvent(new Event('input'));
    }
  }

  /**
   * The caret moved without selecting text: report the character it sits on.
   * A caret sits *between* characters; the one after it is meant, unless that is
   * blank, in which case the one before it (clicking just past `x)` means `)`).
   */
  caretMoved() {
    const { selectionStart: s, selectionEnd: e } = this.input;
    if (s !== e) return;
    const src = this.value;
    let at = s;
    if (at >= src.length || /\s/.test(src[at])) at = s - 1;
    if (at < 0 || /\s/.test(src[at] || ' ')) return;
    const repeat = this.lastPoint === at;
    this.lastPoint = at;
    this.opts.onPoint?.(at, { repeat });
  }

  // --- geometry -------------------------------------------------------------

  metrics() {
    if (this.m && this.m.font === getComputedStyle(this.input).font) return this.m;
    const cs = getComputedStyle(this.input);
    if (!this.input.isConnected || !cs.font) {
      // Detached: no real geometry yet. Answer with a guess, and do not cache it.
      return { font: '', charW: 9, lineH: 24.75, padL: 14, padT: 12 };
    }
    const probe = el('span', { style: { font: cs.font, position: 'absolute', visibility: 'hidden', whiteSpace: 'pre' } }, '0'.repeat(40));
    document.body.append(probe);
    const charW = probe.getBoundingClientRect().width / 40;
    probe.remove();
    const lineH = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
    this.m = {
      font: cs.font, charW, lineH,
      padL: parseFloat(cs.paddingLeft) || 0,
      padT: parseFloat(cs.paddingTop) || 0,
    };
    return this.m;
  }

  /** Source offset of the character under a viewport point, or null. */
  offsetAt(clientX, clientY) {
    const { charW, lineH, padL, padT } = this.metrics();
    const r = this.input.getBoundingClientRect();
    const x = clientX - r.left - padL + this.input.scrollLeft;
    const y = clientY - r.top - padT + this.input.scrollTop;
    if (x < 0 || y < 0 || !charW) return null;
    const row = Math.floor(y / lineH);
    const col = Math.floor(x / charW);
    const lines = this.value.split('\n');
    if (row >= lines.length || col >= lines[row].length) return null;
    let offset = 0;
    for (let i = 0; i < row; i++) offset += lines[i].length + 1;
    const at = offset + col;
    return /\s/.test(this.value[at]) ? null : at;
  }

  /** Viewport rectangle of a source offset -- for anchoring tooltips. */
  rectOf(offset) {
    const { charW, lineH, padL, padT } = this.metrics();
    const before = this.value.slice(0, offset).split('\n');
    const row = before.length - 1;
    const col = before[row].length;
    const r = this.input.getBoundingClientRect();
    return {
      left: r.left + padL + col * charW - this.input.scrollLeft,
      top: r.top + padT + row * lineH - this.input.scrollTop,
      height: lineH,
    };
  }

  syncScroll() {
    this.layer.scrollTop = this.input.scrollTop;
    this.layer.scrollLeft = this.input.scrollLeft;
    this.chipLayer.style.transform = `translate(${-this.input.scrollLeft}px, ${-this.input.scrollTop}px)`;
  }

  // --- painting -------------------------------------------------------------

  /** Paint a range of a given kind ('sel' | 'hov' | 'tap' | 'err'); null clears it. */
  mark(kind, span) {
    if (span && span.start != null) this.marks[kind] = { start: span.start, end: Math.max(span.end, span.start + 1) };
    else delete this.marks[kind];
    this.render();
  }

  clearMark(kind) { delete this.marks[kind]; }

  render() {
    const src = this.value;
    let html;
    try {
      html = paint(src, this.marks);
    } catch {
      html = escapeHtml(src);
    }
    // A trailing newline needs a spacer, or the layers drift apart by one line.
    this.layer.innerHTML = `${html}\n`;
    this.autoGrow();
  }

  autoGrow() {
    const lines = Math.max(this.opts.minRows || 1, this.value.split('\n').length);
    const { lineH, padT } = this.metrics();
    this.input.style.height = `${Math.ceil(lines * lineH + padT * 2 + 2)}px`;
  }

  /**
   * Pin value chips to the ends of lines.
   * @param {Array<{offset:number, node:Node, onClick?:Function, title?:string}>} chips
   *   `offset` is the source offset the chip follows (usually a statement's end).
   */
  setChips(chips) {
    this.chips = chips;
    this.placeChips();
  }

  placeChips() {
    const chips = this.chips || [];
    this.chipLayer.replaceChildren();
    const { charW, lineH, padL, padT } = this.metrics();
    const lines = this.value.split('\n');
    for (const chip of chips) {
      const before = this.value.slice(0, chip.offset).split('\n');
      const row = before.length - 1;
      const col = lines[row]?.length ?? before[row].length;
      const node = el('button.cb-chip', {
        type: 'button',
        title: chip.title || '',
        style: { left: `${padL + (col + 2) * charW}px`, top: `${padT + row * lineH}px`, height: `${lineH}px` },
        onClick: (e) => { e.preventDefault(); chip.onClick?.(); },
        onMousedown: (e) => e.preventDefault(),   // keep the caret where it was
      }, chip.node);
      this.chipLayer.append(node);
    }
    this.syncScroll();
  }
}

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Highlight R source and overlay marked ranges.
 *
 * The source is cut at every token edge and every mark edge; each piece gets its
 * token class plus the classes of the marks covering it. Comments live in the gaps
 * between tokens (the lexer discards them), so gaps are scanned for `#`.
 */
function paint(src, marks) {
  if (!src) return '';
  let tokens = [];
  try { tokens = tokenize(src).filter((tk) => tk.type !== T.EOF && tk.type !== T.NEWLINE); } catch { tokens = []; }

  const kindOf = new Array(src.length).fill(null);
  for (const tk of tokens) {
    let cls = TOKEN_CLASS[tk.type] || null;
    if (tk.type === T.IDENT && /^\s*\(/.test(src.slice(tk.end))) cls = 'tk-fn';
    for (let i = tk.start; i < tk.end; i++) kindOf[i] = cls;
  }
  // comments: a `#` outside any token runs to the end of its line
  let inToken = new Array(src.length).fill(false);
  for (const tk of tokens) for (let i = tk.start; i < tk.end; i++) inToken[i] = true;
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '#' && !inToken[i]) {
      while (i < src.length && src[i] !== '\n') { kindOf[i] = 'tk-com'; i++; }
    }
  }

  const markAt = (i) => MARK_KINDS
    .filter((k) => marks[k] && i >= marks[k].start && i < marks[k].end)
    .map((k) => `cb-${k}`);

  let out = '';
  let i = 0;
  while (i < src.length) {
    const cls = kindOf[i];
    const mk = markAt(i).join(' ');
    let j = i + 1;
    while (j < src.length && kindOf[j] === cls && markAt(j).join(' ') === mk) j++;
    const text = escapeHtml(src.slice(i, j));
    const classes = [cls, mk].filter(Boolean).join(' ');
    out += classes ? `<span class="${classes}">${text}</span>` : text;
    i = j;
  }
  return out;
}

/** Plain highlighted HTML for read-only snippets (hints, solutions, chips). */
export function highlightCode(src) {
  return paint(src, {});
}
