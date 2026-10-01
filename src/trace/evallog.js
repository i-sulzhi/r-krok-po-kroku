/**
 * The evaluation log: what every piece of the code was worth.
 *
 * The trace bus (events.js) records what the machine *did* -- a coercion, a recycled
 * vector, a lookup. This log records what each sub-expression *evaluated to*: for
 * every AST node the evaluator passed through, the value it produced, in the order
 * it was produced, and the window of trace events its evaluation covered.
 *
 * That is what makes the code clickable (decision D11). A click on `mean(ocena)`
 * finds that node's entries here; the stage draws the value, the values of its
 * arguments, and the events that happened inside that window. Nothing in the UI
 * re-evaluates anything, so the picture is always of what actually ran.
 *
 * One node can be evaluated many times -- `mean(wiek)` inside a grouped
 * `summarise()` runs once per group, a loop body once per pass -- so a node maps to
 * a list of entries. The log is capped: a runaway loop must not hold the tab hostage.
 */

export class EvalLog {
  /**
   * @param {Object} opts
   *   trace  the Trace whose sequence numbers delimit each evaluation's events
   *   limit  maximum entries kept; later evaluations still run, unrecorded
   */
  constructor({ trace = null, limit = 5000 } = {}) {
    this.trace = trace;
    this.limit = limit;
    this.entries = [];        // finished evaluations, in completion order
    this.byNode = new Map();  // AST node -> [entries], in completion order
    this.stack = [];          // evaluations still running
    this.truncated = false;
  }

  seq() { return this.trace ? this.trace.seq : 0; }

  /** An evaluation of `node` begins. The returned entry is passed back to exit/fail. */
  enter(node) {
    const parent = this.stack.length ? this.stack[this.stack.length - 1] : null;
    const entry = {
      node, parent, children: [],
      seqFrom: this.seq(), seqTo: null,
      value: undefined, error: null, order: -1,
    };
    this.stack.push(entry);
    return entry;
  }

  exit(entry, value) {
    this.pop(entry);
    entry.value = value;
    this.record(entry);
  }

  /**
   * The evaluation threw. Only real R errors are recorded: `break`, `next` and
   * `return` travel as exceptions too, and they are control flow, not failure.
   */
  fail(entry, error, { isError = false } = {}) {
    this.pop(entry);
    if (!isError) return;
    entry.error = error;
    this.record(entry);
  }

  pop(entry) {
    // Unwind to this entry: anything above it was abandoned by the same throw.
    const at = this.stack.lastIndexOf(entry);
    if (at !== -1) this.stack.length = at;
  }

  record(entry) {
    entry.seqTo = this.seq();
    if (this.entries.length >= this.limit) { this.truncated = true; return; }
    entry.order = this.entries.length;
    this.entries.push(entry);
    const list = this.byNode.get(entry.node);
    if (list) list.push(entry); else this.byNode.set(entry.node, [entry]);
    if (entry.parent) entry.parent.children.push(entry);
  }

  // --- reading -------------------------------------------------------------

  /** Every evaluation of one node, in order. */
  entriesFor(node) { return this.byNode.get(node) || []; }

  /** Top-level statements, in order. */
  roots() { return this.entries.filter((e) => !e.parent); }

  /** Nodes that were evaluated at least once. */
  nodes() { return [...this.byNode.keys()]; }

  /**
   * The innermost evaluated node covering the source range [start, end).
   * Innermost = shortest span, which is exactly "the smallest piece of code
   * under the pointer that has a value of its own".
   */
  nodeAt(start, end = start + 1) {
    let best = null;
    let bestLen = Infinity;
    for (const node of this.byNode.keys()) {
      const s = node.span;
      if (!s || s.start > start || s.end < end) continue;
      const len = s.end - s.start;
      if (len < bestLen) { best = node; bestLen = len; }
    }
    return best;
  }

  /** The nearest evaluated ancestor of an entry's node -- for "select the parent". */
  parentOf(entry) { return entry?.parent || null; }

  /** The first entry whose node's source text equals `text` (after trimming). */
  findByText(source, text, nth = 0) {
    const wanted = String(text).trim();
    let seen = 0;
    const exact = [];
    for (const entry of this.entries) {
      const s = entry.node.span;
      if (!s) continue;
      if (source.slice(s.start, s.end).trim() === wanted && !exact.some((e) => e.node === entry.node)) exact.push(entry);
    }
    exact.sort((a, b) => a.node.span.start - b.node.span.start || (b.node.span.end - a.node.span.end));
    for (const entry of exact) {
      if (seen === nth) return entry;
      seen++;
    }
    return null;
  }
}

/**
 * Trace events emitted while an entry was being evaluated -- its own and those of
 * everything nested inside it. Events are in sequence order, so this is a slice.
 */
export function eventsWithin(trace, entry) {
  if (!trace || !entry) return [];
  const { events } = trace;
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].seq <= entry.seqFrom) lo = mid + 1; else hi = mid;
  }
  const out = [];
  for (let i = lo; i < events.length && events[i].seq <= entry.seqTo; i++) out.push(events[i]);
  return out;
}

/** Events emitted by the entry's own node, not by anything nested inside it. */
export function ownEvents(trace, entry) {
  return eventsWithin(trace, entry).filter((ev) => ev.data?.node === entry.node);
}
