/**
 * The trace bus.
 *
 * The evaluator narrates itself into this bus; the UI is a pure subscriber. That
 * separation is the whole architecture: nothing in `core/` knows a screen exists,
 * and nothing in `ui/` re-implements R semantics to draw a picture. If a panel can
 * show it, an event carried it.
 *
 * Events carry structured data only -- never prose. Turning an event into a sentence
 * is `trace/explain.js`'s job, which keeps wording (and language) out of the engine.
 */

/**
 * Event vocabulary. Kept small on purpose: each entry must earn its place by being
 * something a student needs to *see*, not merely something the machine does.
 */
export const EV = Object.freeze({
  // --- control flow -------------------------------------------------------
  EVAL_ENTER:  'eval:enter',   // begin evaluating an AST node
  EVAL_EXIT:   'eval:exit',    // finished, with the resulting value
  CALL_ENTER:  'call:enter',   // a function call opened a new frame
  CALL_EXIT:   'call:exit',    // the frame returned

  // --- environments -------------------------------------------------------
  LOOKUP:      'lookup',       // name resolved -- includes the scope chain walked
  ASSIGN:      'assign',       // a binding was created or replaced
  FRAME_PUSH:  'frame:push',
  FRAME_POP:   'frame:pop',

  // --- the parts students actually trip over ------------------------------
  COERCE:      'coerce',       // type promotion, per the coercion hierarchy
  RECYCLE:     'recycle',      // short vector reused against a longer one
  ELEMENTWISE: 'elementwise',  // one cell-by-cell step of a vectorised op
  INDEX:       'index',        // subsetting: which positions, chosen how
  COPY:        'copy',         // copy-on-modify actually copying
  NA_PROPAGATE:'na:propagate', // a missing value swallowed a computation

  // --- tidyverse verbs: the shapes students actually work in ---------------
  DPLYR_FILTER:    'dplyr:filter',     // rows kept or dropped, with the mask that decided
  DPLYR_SELECT:    'dplyr:select',     // columns kept or dropped
  DPLYR_MUTATE:    'dplyr:mutate',     // a column computed, possibly by recycling
  DPLYR_ARRANGE:   'dplyr:arrange',    // rows permuted
  DPLYR_GROUP:     'dplyr:group',      // the table split into groups
  DPLYR_SUMMARISE: 'dplyr:summarise',  // each group collapsed to one row
  PIVOT:           'pivot',            // pivot_wider / pivot_longer: which cell came from which row
  RECODE:          'recode',           // if_else / case_when: which condition took each row

  // --- text --------------------------------------------------------------
  REGEX:       'regex',               // what a pattern matched, and where

  // --- output -------------------------------------------------------------
  PRINT:       'print',
  WARNING:     'warning',
  ERROR:       'error',
});

/** Events the timeline treats as a meaningful stopping point for "step forward". */
export const STEPPABLE = Object.freeze(new Set([
  EV.LOOKUP, EV.ASSIGN, EV.COERCE, EV.RECYCLE, EV.ELEMENTWISE,
  EV.INDEX, EV.COPY, EV.NA_PROPAGATE, EV.CALL_ENTER, EV.CALL_EXIT,
  EV.PRINT, EV.WARNING, EV.ERROR,
  EV.DPLYR_FILTER, EV.DPLYR_SELECT, EV.DPLYR_MUTATE,
  EV.DPLYR_ARRANGE, EV.DPLYR_GROUP, EV.DPLYR_SUMMARISE,
  EV.REGEX,
]));

export class Trace {
  /**
   * `limit` caps recorded events. It is a UI budget as much as a memory one: every
   * event is a step the student can scrub to, and a runaway loop should not turn the
   * timeline into something unusable.
   */
  constructor({ enabled = true, limit = 30000 } = {}) {
    this.enabled = enabled;
    this.limit = limit;
    this.events = [];
    this.depth = 0;
    this.seq = 0;
    this.listeners = new Set();
    this.truncated = false;
  }

  /**
   * Record one event.
   * @param {string} type  a value from EV
   * @param {Object} data  structured payload; `node` (source position) when available
   * @returns {Object|null} the stored event
   */
  emit(type, data = {}) {
    if (!this.enabled) return null;
    if (this.events.length >= this.limit) {
      // A runaway loop must not take the browser tab with it.
      if (!this.truncated) {
        this.truncated = true;
        this.events.push({ seq: ++this.seq, type: EV.WARNING, depth: this.depth, data: { reason: 'trace-limit', limit: this.limit } });
      }
      return null;
    }
    const ev = { seq: ++this.seq, type, depth: this.depth, data };
    this.events.push(ev);
    for (const fn of this.listeners) fn(ev);
    return ev;
  }

  /** Emit an event and descend a level -- pair with `exit`. */
  enter(type, data = {}) {
    const ev = this.emit(type, data);
    this.depth++;
    return ev;
  }

  exit(type, data = {}) {
    this.depth = Math.max(0, this.depth - 1);
    return this.emit(type, data);
  }

  /** Run `fn` without tracing -- for internal machinery the student shouldn't see. */
  quiet(fn) {
    const was = this.enabled;
    this.enabled = false;
    try { return fn(); } finally { this.enabled = was; }
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  clear() {
    this.events = [];
    this.depth = 0;
    this.seq = 0;
    this.truncated = false;
  }

  /** Only the events worth pausing on, in order -- the timeline's spine. */
  steps() {
    return this.events.filter((e) => STEPPABLE.has(e.type));
  }
}

/** A trace that records nothing, for running code at full speed (tests, checking answers). */
export const NULL_TRACE = new Trace({ enabled: false });
