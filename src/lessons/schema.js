/**
 * What a lesson is, and how an answer is judged.
 *
 * A lesson is data, not code (decision D12): a few scenes, a sandbox and a task,
 * with every student-facing string in Polish. Keeping it declarative means new
 * lessons are content work rather than programming, and lets test/lessons.mjs run
 * every piece of code a lesson contains -- scenes, sandbox chips, the solution and
 * each anticipated wrong answer.
 *
 * @typedef {Object} Lesson
 * @property {string} id            stable slug, used as the progress key
 * @property {number} module        curriculum module (see docs/curriculum.md)
 * @property {string[]} [requires]  ids that should come first
 * @property {string} title
 * @property {string} setup         R code run silently before everything: the data
 * @property {Scene[]} scenes       2-4 short scenes; the first one carries the idea
 * @property {Object} play          {say?, code, chips: string[]} -- the sandbox
 * @property {Task} task
 *
 * @typedef {Object} Scene
 * @property {string} say    ONE sentence (**bold** and `code` allowed) -- where to look
 * @property {string} code   runs live; the student may edit it
 * @property {string} [pick] code text of the expression selected on arrival
 * @property {string} [tap]  code text that pulses "click here"
 * @property {Object} [show] what the picture points out on arrival, so the sentence
 *                           need not describe it (dropped once the code is edited):
 *   absent: string[]  count table -- values the data could hold but does not,
 *                     drawn as hollow rows marked as missing from the result
 *   lit: number       factor -- a code whose elements and level start lit up
 *   sheet: true       table -- drawn as a spreadsheet (letters, row 1 = names);
 *   excel: {kind, col?, name?}  the same step as a spreadsheet does it, beside the
 *                     R picture: 'mixed' (c() of mixed types), 'fill' (x op k,
 *                     a dragged-down formula), 'blank' (an aggregate over gaps)
 *   rows: true        condition on a table column (df$x == v) -- drawn along the
 *                     table's rows, the answer as a column beside them
 *                     a column taken with $ lies down with its sheet addresses
 *
 * @typedef {Object} Task
 * @property {string} prompt        one or two sentences; the goal value is shown beside it
 * @property {string} starter       initial editor content
 * @property {string} solution      reference answer -- also produces the goal picture
 * @property {Function} check       ({value, code, session}) => {ok, reason?, detail?}
 * @property {string[]} hints       progressive; never the answer at step one
 * @property {Object} messages      diagnosis key -> one sentence
 * @property {string} success       shown when solved
 * @property {string} [note]        what to notice once it works
 * @property {Array} nearMisses     [{name, code, expect}] -- regression cases for diagnose()
 * @property {Function} diagnose    ({value, code, result}) => key into messages
 */

import { rLength, getNames, isNull, isAtomic, isList, isNA, getAttr, isDataFrame, isFactor } from '../core/rvalue.js';

/**
 * Compare two R values for teaching purposes.
 *
 * Deliberately forgiving about things that do not indicate misunderstanding
 * (integer vs double, tiny floating-point error, column order) and strict about the
 * things that do (which columns exist, how many rows, what the values are).
 */
export function valuesEqual(a, b, { tolerance = 1e-8, ignoreColumnOrder = true, names = false } = {}) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (isNull(a) || isNull(b)) return isNull(a) && isNull(b);

  if (isDataFrame(a) || isDataFrame(b)) {
    if (!isDataFrame(a) || !isDataFrame(b)) return false;
    const nameA = (getNames(a)?.values || []).map(String);
    const nameB = (getNames(b)?.values || []).map(String);
    if (nameA.length !== nameB.length) return false;
    if (!ignoreColumnOrder && nameA.join() !== nameB.join()) return false;
    if ([...nameA].sort().join() !== [...nameB].sort().join()) return false;
    return nameA.every((nm) => {
      const colA = a.values[nameA.indexOf(nm)];
      const colB = b.values[nameB.indexOf(nm)];
      return valuesEqual(colA, colB, { tolerance });
    });
  }

  if (isList(a) || isList(b)) {
    if (!isList(a) || !isList(b)) return false;
    if (rLength(a) !== rLength(b)) return false;
    return a.values.every((v, i) => valuesEqual(v, b.values[i], { tolerance }));
  }

  if (!isAtomic(a) || !isAtomic(b)) return false;
  if (rLength(a) !== rLength(b)) return false;

  // Opt-in: a count table's names ARE its answer -- 0 2 1 3 2 under the digits
  // "1".."5" is not the table of "bardzo zle".."bardzo dobrze".
  if (names) {
    const na = (getNames(a)?.values || []).map(String).join('\u0001');
    const nb = (getNames(b)?.values || []).map(String).join('\u0001');
    if (na !== nb) return false;
  }

  // A factor and a character vector of the same labels count as different: the
  // difference between them is exactly what several lessons are about.
  if (isFactor(a) !== isFactor(b)) return false;
  if (isFactor(a)) {
    const la = (getAttr(a, 'levels')?.values || []).map(String);
    const lb = (getAttr(b, 'levels')?.values || []).map(String);
    if (la.join() !== lb.join()) return false;
  }

  const numeric = (v) => v.type === 'double' || v.type === 'integer';
  if (numeric(a) !== numeric(b)) return false;

  return a.values.every((x, i) => {
    const y = b.values[i];
    if (isNA(x) || isNA(y)) return isNA(x) && isNA(y);
    if (typeof x === 'number' && typeof y === 'number') {
      if (Number.isNaN(x) || Number.isNaN(y)) return Number.isNaN(x) && Number.isNaN(y);
      return Math.abs(x - y) <= tolerance * Math.max(1, Math.abs(x), Math.abs(y));
    }
    return String(x) === String(y);
  });
}

/**
 * Build a check function that compares the student's result to a reference answer
 * computed from `expected` R code, and additionally requires (or forbids) certain
 * function calls.
 *
 * `requireCalls` matters pedagogically: a task about `group_by` is not solved by
 * hand-filtering each city, even when the numbers come out right.
 *
 * @returns {(ctx) => {ok: boolean, reason?: string, detail?: Object}}
 */
export function resultCheck({ expected, requireCalls = [], forbidCalls = [], compare = {} }) {
  const check = ({ value, code, session }) => {
    for (const name of requireCalls) {
      if (!callsFunction(code, name)) return { ok: false, reason: 'missing-call', detail: { name } };
    }
    for (const name of forbidCalls) {
      if (callsFunction(code, name)) return { ok: false, reason: 'forbidden-call', detail: { name } };
    }
    let reference;
    try {
      reference = session.evaluate(expected);
    } catch (e) {
      return { ok: false, reason: 'reference-failed', detail: { message: e.message } };
    }
    if (!value) return { ok: false, reason: 'no-value' };
    if (!valuesEqual(value, reference, compare)) {
      return { ok: false, reason: 'wrong-value', detail: { reference } };
    }
    return { ok: true };
  };
  // The live goal-vs-result picture must judge "equal" the same way the check does.
  check.compare = compare;
  return check;
}

/** Does the code call `name(...)` anywhere? Text-level, but good enough for a task. */
export function callsFunction(code, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\s*\\(`).test(String(code || ''));
}
