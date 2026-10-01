/**
 * Live code: a code box wired to the engine, the stage and the memory panel.
 *
 * Every lesson screen is one of these -- a scene, the sandbox, the task. The loop is
 * always the same: the code runs (fresh memory + the lesson's data, so a run never
 * depends on the one before), every sub-expression's value lands in the evaluation
 * log, and whatever the student points at is drawn on the stage.
 *
 * Runs are deterministic on purpose. A console that remembers means the same code
 * can print different things depending on what was typed ten minutes ago; for a
 * student alone at home that is a trap, not a feature. What a run leaves behind is
 * still visible, in the memory panel.
 */

import { el, mount } from './dom.js';
import { CodeBox } from './codebox.js';
import { RSession, renderOutput } from '../core/session.js';
import { renderMini } from './viz/value.js';
import { diagnose } from './diagnose.js';
import { t } from '../i18n/index.js';

export class LiveCode {
  /**
   * @param {HTMLElement} host
   * @param {Object} opts
   *   code, setup, readOnly, minRows
   *   pick      code text to select after the first run (else: the last statement)
   *   tap       code text to pulse as "click here" until the student clicks
   *   show      what the stage should point out on the picked expression (see
   *             Scene.show in lessons/schema.js); dropped once the code is edited
   *   stage     {show(entry, ctx), showValue(value, label)} -- the app's stage
   *   memory    {show(env, fresh)} -- the app's memory panel
   *   after     element placed right under the code (the task's buttons)
   *   quietStart  an unfinished starter (`ankieta |>`) is not an error yet:
   *               syntax errors stay hidden until the student has typed
   *   onRun(result, src)  after every run, with the code that ran
   */
  constructor(host, opts = {}) {
    this.opts = opts;
    this.setup = opts.setup || '';
    this.selected = null;
    this.result = null;
    this.tapText = opts.tap || null;
    this.pickText = opts.pick || null;
    this.playing = null;

    this.boxHost = el('div.lv-box');
    this.tools = el('div.lv-tools');
    // On a narrow screen the app moves the stage in here, right under the code:
    // clicking code and then scrolling to find the picture breaks the connection.
    this.slot = el('div.lv-slot');
    this.console = el('div.lv-console');
    this.tip = el('div.lv-tip', { hidden: true });
    this.edited = false;
    mount(host, el('div.lv', this.boxHost, opts.after || null, this.tools, this.slot, this.console, this.tip));

    this.box = new CodeBox(this.boxHost, {
      value: opts.code || '',
      readOnly: !!opts.readOnly,
      minRows: opts.minRows || 1,
      onEdit: () => { this.edited = true; this.run({ keep: true }); },
      onRun: () => { this.edited = true; this.run({ keep: true }); },
      onPoint: (offset, { repeat }) => this.pointAt(offset, repeat),
      onHover: (offset, e) => this.hoverAt(offset, e),
    });
    this.run();
    this.fitConsole();
  }

  get code() { return this.box.value; }

  /**
   * R wraps printed vectors to options("width"), and RStudio keeps that equal to
   * the console pane. At a fixed 80 a factor of long labels ("bardzo dobrze") ran
   * off the edge of the panel mid-word. The first run happens before the panel is
   * on the page, so the console is re-printed once it has a width, and again
   * whenever the width changes.
   */
  fitConsole() {
    const refit = () => {
      const cols = this.consoleColumns();
      if (cols && cols !== this.consoleCols && this.result) this.renderConsole(this.result);
    };
    requestAnimationFrame(refit);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObs = new ResizeObserver(refit);
      this.resizeObs.observe(this.console);
    }
  }

  /** Characters per console line, between 30 and R's default 80; null when detached. */
  consoleColumns() {
    const w = this.console.clientWidth;
    if (!w || !this.console.isConnected) return null;
    if (!this.charWidth) {
      const probe = el('pre.lv-out', { style: { position: 'absolute', visibility: 'hidden' } }, '0'.repeat(40));
      this.console.append(probe);
      this.charWidth = probe.getBoundingClientRect().width / 40 || 8;
      probe.remove();
    }
    return Math.max(30, Math.min(80, Math.floor(w / this.charWidth) - 1));
  }

  set code(v) {
    this.box.value = v;
    this.selected = null;
    this.edited = true;
    this.run();
  }

  // --- running ---------------------------------------------------------------

  /** Run setup + code in a fresh session. `keep` tries to keep the selection. */
  run({ keep = false } = {}) {
    this.stopPlaying();
    const session = new RSession();
    if (this.setup) session.run(this.setup, { trace: false });
    const src = this.box.value;
    const result = session.run(src);
    this.result = result;
    this.source = src;

    this.renderConsole(result);
    this.renderChips();
    this.opts.memory?.show(result.env, this.freshNames(result));

    const log = result.evalLog;
    let target = null;
    if (keep && this.selected) target = this.sameEntry(this.selected);
    if (!target && this.pickText && log) target = log.findByText(src, this.pickText);
    this.pickEntry = this.pickText && log ? log.findByText(src, this.pickText) : null;
    if (!target && log) target = this.lastRoot();
    if (!result.ok && log) target = this.errorEntry() || target;

    if (!result.ok && result.error?.span && !this.hideError(result)) this.box.mark('err', result.error.span);
    this.markTap();
    // After typing, redraw quietly: re-animating on every keystroke is noise.
    this.select(target, { animate: !keep });
    this.opts.onRun?.(result, src);
    return result;
  }

  /** The same sub-expression in a new run: same text at the same place. */
  sameEntry(old) {
    const log = this.result?.evalLog;
    if (!log || !old?.node?.span) return null;
    const { start, end } = old.node.span;
    const text = this.oldSource ? this.oldSource.slice(start, end) : null;
    for (const node of log.nodes()) {
      const s = node.span;
      if (s && s.start === start && s.end === end && (!text || this.source.slice(s.start, s.end) === text)) {
        const list = log.entriesFor(node);
        return list[Math.min(old.runIndex || 0, list.length - 1)] || null;
      }
    }
    return null;
  }

  lastRoot() {
    const roots = this.result?.evalLog?.roots() || [];
    return roots[roots.length - 1] || null;
  }

  /** The innermost entry that failed -- where the error actually happened. */
  errorEntry() {
    const failed = (this.result?.evalLog?.entries || []).filter((e) => e.error);
    return failed[0] || null;
  }

  freshNames(result) {
    const names = new Set();
    for (const ev of result.trace?.events || []) if (ev.type === 'assign' && ev.data.name) names.add(ev.data.name);
    return names;
  }

  // --- pointing ---------------------------------------------------------------

  pointAt(offset, repeat) {
    const log = this.result?.evalLog;
    if (!log) return;
    this.tapText = null;
    this.box.mark('tap', null);
    const node = log.nodeAt(offset);
    if (!node) return;
    // Clicking the same place again climbs out to the enclosing expression.
    if (repeat && this.selected && this.selected.node === node && this.selected.parent) {
      this.select(this.selected.parent);
      return;
    }
    if (repeat && this.selected && this.selected.node !== node && this.isAncestorOf(this.selected, node)) {
      const up = this.selected.parent;
      this.select(up || log.entriesFor(node)[0]);
      return;
    }
    this.select(log.entriesFor(node)[0]);
  }

  isAncestorOf(entry, node) {
    for (let e = entry; e; e = e.parent) if (e.node === node) return true;
    return false;
  }

  hoverAt(offset, e) {
    const log = this.result?.evalLog;
    const node = offset == null || !log ? null : log.nodeAt(offset);
    if (!node) {
      this.hoverNode = null;
      this.box.mark('hov', null);
      this.tip.hidden = true;
      return;
    }
    if (node === this.hoverNode) { this.placeTip(e); return; }
    this.hoverNode = node;
    this.box.mark('hov', node.span);
    const entry = log.entriesFor(node)[0];
    if (!entry) return;
    mount(this.tip, entry.error ? el('span.lv-tip-err', t('fx.error')) : renderMini(entry.value, { max: 6 }));
    this.tip.hidden = false;
    this.placeTip(e);
  }

  placeTip(e) {
    if (!e || this.tip.hidden) return;
    const host = this.tip.parentElement.getBoundingClientRect();
    this.tip.style.left = `${Math.max(0, e.clientX - host.left + 12)}px`;
    this.tip.style.top = `${e.clientY - host.top + 18}px`;
  }

  /** Select an evaluation: paint it in the code, draw it on the stage. */
  select(entry, { animate = true } = {}) {
    this.selected = entry || null;
    this.oldSource = this.source;
    if (entry) {
      const list = this.result.evalLog.entriesFor(entry.node);
      entry.runIndex = list.indexOf(entry);
    }
    this.box.mark('sel', entry ? entry.node.span : null);
    this.renderTools();
    this.opts.stage?.show(entry, {
      trace: this.result?.trace,
      log: this.result?.evalLog,
      source: this.source,
      onSelect: (e) => { this.stopPlaying(); this.select(e); },
      still: !animate,
      // The scene's pointer belongs to the scene's code: once edited, it may not fit.
      show: entry && entry === this.pickEntry && !this.edited ? this.opts.show || null : null,
    });
  }

  selectText(text) {
    const entry = this.result?.evalLog?.findByText(this.source, text);
    if (entry) this.select(entry);
  }

  markTap() {
    if (!this.tapText) { this.box.mark('tap', null); return; }
    // Inside the picked expression first: a scene may open with the lines that
    // create its data, and "click odpowiedzi" means the use, not the assignment.
    const from = this.pickText ? Math.max(0, this.source.indexOf(this.pickText)) : 0;
    let at = this.source.indexOf(this.tapText, from);
    if (at < 0) at = this.source.indexOf(this.tapText);
    this.box.mark('tap', at >= 0 ? { start: at, end: at + this.tapText.length } : null);
  }

  // --- evaluation order -------------------------------------------------------

  /** Entries worth stepping through, in the order R finished them. */
  order() {
    return (this.result?.evalLog?.entries || []).filter((e) => e.node.type !== 'Paren');
  }

  step(delta) {
    const list = this.order();
    if (!list.length) return;
    const at = list.indexOf(this.selected);
    const next = at === -1 ? (delta > 0 ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, at + delta));
    this.select(list[next]);
  }

  togglePlay() {
    if (this.playing) { this.stopPlaying(); this.renderTools(); return; }
    const list = this.order();
    if (!list.length) return;
    let k = 0;
    this.select(list[0]);
    this.playing = setInterval(() => {
      k++;
      if (k >= list.length) { this.stopPlaying(); this.renderTools(); return; }
      this.select(list[k]);
    }, 1400);
    this.renderTools();
  }

  stopPlaying() {
    if (this.playing) { clearInterval(this.playing); this.playing = null; }
  }

  renderTools() {
    const list = this.order();
    const at = list.indexOf(this.selected);
    if (!list.length) { mount(this.tools); return; }
    mount(this.tools,
      el('div.lv-order',
        el('span.lv-order-label', t('lv.order')),
        el('button.lv-btn', { type: 'button', title: t('lv.prev'), onClick: () => { this.stopPlaying(); this.step(-1); } }, '‹'),
        el('span.lv-order-pos', at >= 0 ? `${at + 1} / ${list.length}` : `– / ${list.length}`),
        el('button.lv-btn', { type: 'button', title: t('lv.next'), onClick: () => { this.stopPlaying(); this.step(1); } }, '›'),
        el('button.lv-btn.lv-play', { type: 'button', title: t('lv.play'), onClick: () => this.togglePlay() }, this.playing ? '❚❚' : '▶')),
      this.tapText ? el('div.lv-tap', el('span.lv-tap-hand', '👆'), t('lv.tap', { code: this.tapText })) : el('div.lv-hint', t('lv.hint')));
  }

  // --- output ------------------------------------------------------------------

  renderChips() {
    const log = this.result?.evalLog;
    if (!log) { this.box.setChips([]); return; }
    const chips = log.roots().map((root) => ({
      offset: root.node.span.end,
      title: t('lv.chipTitle'),
      node: root.error ? el('span.cb-chip-err', '✗') : el('span.cb-chip-val', el('span.cb-chip-arrow', '→'), renderMini(root.value, { max: 4 })),
      onClick: () => this.select(root),
    }));
    // A statement that failed has no entry of its own when parsing failed.
    this.box.setChips(chips);
  }

  /** The untouched starter of a task may be unfinished on purpose. */
  hideError(result) {
    return !!this.opts.quietStart && !this.edited && result.error?.kind === 'syntax';
  }

  renderConsole(result) {
    const cols = this.consoleColumns();
    this.consoleCols = cols;
    const printed = cols && result.output ? renderOutput(result.output, { width: cols }) : result.lines;
    const lines = printed.filter((l) => !l.startsWith(`${t('ui.errorPrefix')}:`));
    const nodes = [];
    if (lines.length) nodes.push(el('pre.lv-out', lines.join('\n')));
    // The two warnings R itself prints after the output. (The trace also flags
    // teaching moments R stays silent about -- as.numeric() on a factor -- and those
    // belong on the stage, not in a console that is meant to look like R's.)
    for (const ev of result.trace?.events || []) {
      if (ev.type !== 'warning') continue;
      const d = ev.data;
      let text = null;
      if (d.kind === 'coercion-NA') text = t('warn.coercionNA', { positions: (d.positions || []).map((p) => p + 1).join(', ') });
      if (d.kind === 'recycle-partial') text = t('warn.recyclePartial', { longLen: d.longLen, shortLen: d.shortLen });
      if (text) nodes.push(el('div.lv-warn', el('b', `${t('ui.warningPrefix')}: `), text));
    }
    if (!result.ok && !this.hideError(result)) {
      const help = diagnose(result.error, this.box.value);
      const message = result.error.key ? t(result.error.key, result.error.params) : result.error.message;
      nodes.push(el('div.lv-err',
        el('div.lv-err-msg', el('b', `${t('ui.errorPrefix')}: `), message),
        help && el('div.lv-err-help',
          el('div.lv-err-title', help.title),
          el('div.lv-err-text', help.text),
          help.fix ? el('pre.lv-err-fix', help.fix) : null)));
    }
    mount(this.console, nodes.length ? el('div.lv-console-in', el('div.lv-console-label', t('ui.paneConsole')), nodes) : null);
  }

  destroy() {
    this.stopPlaying();
    this.resizeObs?.disconnect();
  }
}
