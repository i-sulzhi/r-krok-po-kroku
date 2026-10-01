/**
 * "Ściąga" under a piece of live code: the lesson's and the sandbox's.
 *
 * One scrolling column (D23): the code, then the glossary. The dock element itself is
 * dissolved by CSS (display: contents), so its bar is a child of the whole column and
 * can be held at the column's bottom while the glossary is out of sight. The bar
 * brings the glossary into view; in view, it folds or opens it. Only folded/open is
 * remembered, per browser.
 */

import { el, mount } from './dom.js';
import { renderGlossary } from './glossary.js';
import { findConcepts } from './concepts.js';
import { savedFold, saveFold } from './progress.js';

export class GlossaryDock {
  /**
   * @param {Object} o
   *   scroller     the element that scrolls (the left pane)
   *   lessons      all lessons, for examples and "first met"
   *   first        Map concept -> lesson index where it is first met
   *   lessonIndex  () => index of the current lesson (lessons.length: past them all)
   *   live         () => the LiveCode whose code the glossary reads
   */
  constructor(o) {
    this.o = o;
    this.open = new Set();
    this.folded = null;
    this.build();
  }

  /** Fresh elements for a fresh page; what is open and folded carries over. */
  build() {
    this.bar = el('div.ls-gloss-bar');
    this.host = el('div.ls-gloss');
    this.node = el('div.ls-dock', { hidden: true }, this.bar, this.host);
    this.last = null;
    return this.node;
  }

  /** A new person, or a new lesson: nothing stays open. */
  forget({ fold = false } = {}) {
    this.open = new Set();
    if (fold) this.folded = null;
  }

  /**
   * Redraw for the code that just ran. Code that does not parse (half typed) keeps the
   * last panel: flicker on every keystroke would be noise. A task may start unfinished
   * on purpose (`ankieta |>`); then the panel still offers the lesson's concepts.
   */
  update(result, src, prefer = this.last?.prefer) {
    let found = findConcepts(src ?? '');
    if (!found && this.last) return;
    if (!found) found = new Map();
    this.last = { result, src, found, prefer };
    this.draw();
  }

  draw() {
    const g = this.last;
    if (!g) return;
    if (this.folded == null) this.folded = loadFolded();
    const drawn = renderGlossary({
      src: g.src,
      found: g.found,
      log: g.result?.evalLog,
      prefer: g.prefer,
      lessons: this.o.lessons,
      lessonIndex: this.o.lessonIndex(),
      first: this.o.first,
      open: this.open,
      folded: this.folded,
      onToggle: (id) => {
        if (this.open.has(id)) this.open.delete(id);
        else this.open.add(id);
        this.draw();
      },
      onPick: (span) => {
        const live = this.o.live();
        const log = live?.result?.evalLog;
        const node = log?.nodes().find((n) => n.span?.start === span.start && n.span?.end === span.end);
        const entry = node && log.entriesFor(node)[0];
        if (entry) live.select(entry);
      },
      onHover: (span) => this.o.live()?.box.mark('hov', span),
      onBar: () => this.onBar(),
    });
    this.node.hidden = !drawn;
    mount(this.bar, drawn?.bar);
    mount(this.host, drawn?.panel);
    this.node.classList.toggle('ls-dock-folded', !!this.folded);
    this.bar.firstChild?.setAttribute?.('aria-expanded', this.folded ? 'false' : 'true');
  }

  /** Is the open glossary below the visible part of the column (its bar held at the bottom)? */
  outOfSight() {
    const pane = this.o.scroller;
    if (this.folded || typeof pane.getBoundingClientRect !== 'function') return false;
    const box = pane.getBoundingClientRect();
    const top = this.host.getBoundingClientRect().top;
    const bar = this.bar.offsetHeight || 0;
    return box.height > 0 && top > box.bottom - bar - 4;
  }

  /** Out of sight: bring it into view. In view: fold it. Folded: open it, into view. */
  onBar() {
    if (this.outOfSight()) { this.scrollTo(); return; }
    this.folded = !this.folded;
    saveFold(this.folded);
    this.draw();
    if (!this.folded && this.outOfSight()) this.scrollTo();
  }

  scrollTo() {
    const pane = this.o.scroller;
    const by = this.host.getBoundingClientRect().top - pane.getBoundingClientRect().top - (this.bar.offsetHeight || 0) - 8;
    if (typeof pane.scrollBy === 'function') pane.scrollBy({ top: by, behavior: 'smooth' });
    else pane.scrollTop += by;
  }
}

/** Folded by default on a narrow screen; on a wide one, as it was last left. */
function loadFolded() {
  const saved = savedFold();
  if (saved != null) return saved;
  return typeof matchMedia === 'function' && matchMedia('(max-width: 980px)').matches;
}
