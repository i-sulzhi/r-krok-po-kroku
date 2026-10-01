/**
 * The tidyverse verbs (syllabus topic 2).
 *
 * These are the functions the course actually works in, and every one of them hides
 * a base-R mechanic the student has already met here: `filter` is a logical mask,
 * `mutate` is recycling, `summarise` is a collapse. Implementing them on top of the
 * same engine lets the trainer show that continuity instead of asserting it.
 *
 * All of them use **non-standard evaluation**: in `filter(df, wiek > 30)` the name
 * `wiek` is a column, not a variable. That is why they are registered as `special`
 * builtins -- they receive unevaluated expressions and evaluate them inside a "data
 * mask", an environment whose bindings are the table's columns. When a name is not a
 * column, the mask's parent is the caller's environment, so ordinary variables still
 * work -- which is also how a student's typo silently becomes a variable lookup.
 */

import {
  NA, isNA, mkAtomic, mkInteger, mkDouble, mkCharacter, mkLogical, mkList, R_NULL,
  isNull, isAtomic, isList, rLength, getNames, getAttr, setAttr, isFactor, isDataFrame,
} from '../rvalue.js';
import { coerceVector, RError, commonType, convertCell } from '../coerce.js';
import { factorToCharacter } from '../arith.js';
import { makeDataFrame } from './structures.js';
import { Env } from '../env.js';
import { EV } from '../../trace/events.js';
import { t } from '../../i18n/index.js';

const nrowOf = (df) => (df.values.length ? rLength(df.values[0]) : 0);
const colNames = (df) => {
  const n = getNames(df);
  return n ? n.values.map(String) : df.values.map((_, i) => `V${i + 1}`);
};

/** A group label as the student reads it: a missing key is "NA", never "[object Object]". */
const labelText = (x) => (isNA(x) ? 'NA' : String(x));

function requireTable(v, fname, node) {
  if (!v || !isDataFrame(v)) throw new RError('err.verbNeedsTable', node, { fname });
  return v;
}

/**
 * Build the environment in which column names resolve to columns.
 * `extra` adds computed bindings such as `n()`'s group size.
 */
function dataMask(df, env, { extra = null, rows = null } = {}) {
  const mask = new Env(env, { name: t('env.dataMask') });
  const names = colNames(df);
  df.values.forEach((col, i) => {
    mask.vars.set(names[i], rows ? takeRows(col, rows) : col);
  });
  if (extra) for (const [k, v] of Object.entries(extra)) mask.vars.set(k, v);
  return mask;
}

/** Subset one column by row positions, preserving factor levels. */
function takeRows(col, rows) {
  const values = rows.map((r) => col.values[r]);
  const out = isList(col) ? mkList(values) : mkAtomic(col.type, values);
  return col.attributes ? setAttr(setAttr(out, 'levels', getAttr(col, 'levels')), 'class', getAttr(col, 'class')) : out;
}

/**
 * Rebuild a table from columns, carrying group metadata forward.
 *
 * Row names are renumbered from 1, which is what the real dplyr does -- and a visible
 * difference from base R, where `df[df$x > 2, ]` keeps the original row numbers.
 */
function rebuild(df, cols, names) {
  const out = mkList(cols, {
    names: mkCharacter(names),
    class: mkCharacter(['data.frame']),
    'row.names': mkInteger(Array.from({ length: cols.length ? rLength(cols[0]) : 0 }, (_, i) => i + 1)),
  });
  const groups = getAttr(df, 'groups');
  return groups ? setAttr(out, 'groups', groups) : out;
}

/** Evaluate one unevaluated argument inside the mask. */
const evalIn = (interp, node, mask) => interp.eval(node, mask);

/** Recycle a computed column up to the table's row count, as mutate() does. */
function fitColumn(value, n, { fname, name, node, interp }) {
  const len = rLength(value);
  if (len === n) return value;
  if (len === 0) throw new RError('err.mutateEmpty', node, { name });
  if (n % len !== 0) throw new RError('err.mutateLength', node, { name, length: len, rows: n });
  if (len !== 1) {
    interp.trace?.emit(EV.RECYCLE, {
      shorter: name, shortLen: len, longLen: n, times: n / len, fits: true, node, op: fname,
    });
  }
  const values = Array.from({ length: n }, (_, i) => value.values[i % len]);
  const out = isList(value) ? mkList(values) : mkAtomic(value.type, values);
  return value.attributes ? setAttr(setAttr(out, 'levels', getAttr(value, 'levels')), 'class', getAttr(value, 'class')) : out;
}

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

function verbFilter({ args, env, node, interp }) {
  const df = requireTable(interp.eval(args[0].value, env), 'filter', node);
  const n = nrowOf(df);
  const mask = dataMask(df, env);

  // Several conditions are combined with AND, exactly as dplyr does.
  let keep = new Array(n).fill(true);
  const naRows = new Set();
  const conditions = [];

  for (const a of args.slice(1)) {
    const cond = coerceVector(evalIn(interp, a.value, mask), 'logical', { trace: interp.trace, node });
    const values = cond.values;
    if (values.length !== n && values.length !== 1) {
      throw new RError('err.filterLength', node, { length: values.length, rows: n });
    }
    conditions.push(values);
    for (let i = 0; i < n; i++) {
      const v = values[values.length === 1 ? 0 : i];
      // A condition that is NA drops the row: dplyr keeps only rows that are
      // definitely TRUE. This is where survey rows silently disappear.
      if (isNA(v)) { naRows.add(i); keep[i] = false; }
      else if (!v) keep[i] = false;
    }
  }

  const rows = [];
  for (let i = 0; i < n; i++) if (keep[i]) rows.push(i);

  interp.trace?.emit(EV.DPLYR_FILTER, {
    node, rows: rows.slice(), kept: rows.length, dropped: n - rows.length,
    total: n, mask: keep.slice(), naDropped: [...naRows],
    conditions: conditions.length === 1 ? conditions[0] : null,
    // Every condition on its own, so the picture can show "i jedno, i drugie".
    parts: conditions.map((v) => v.slice()),
    preview: tablePreview(df),
  });

  return rebuild(df, df.values.map((c) => takeRows(c, rows)), colNames(df));
}

// ---------------------------------------------------------------------------
// select / rename / pull
// ---------------------------------------------------------------------------

/** Resolve a select() argument to column indices; supports -col and c(a, b). */
function selectIndices(argNode, names, env, interp, node) {
  const out = [];
  const walk = (nd, negate) => {
    if (nd.type === 'Ident' || nd.type === 'Str') {
      const nm = nd.type === 'Ident' ? nd.name : nd.value;
      const at = names.indexOf(nm);
      if (at === -1) throw new RError('err.noSuchColumn', node, { name: nm, available: names.join(', ') });
      out.push({ index: at, negate });
      return;
    }
    if (nd.type === 'Unary' && nd.op === '-') { walk(nd.operand, !negate); return; }
    if (nd.type === 'Call' && nd.callee.type === 'Ident' && nd.callee.name === 'c') {
      for (const a of nd.args) walk(a.value, negate);
      return;
    }
    if (nd.type === 'Binary' && nd.op === ':') {
      // select(a:c) -- a contiguous run of columns
      const from = names.indexOf(nd.left.name);
      const to = names.indexOf(nd.right.name);
      if (from === -1 || to === -1) throw new RError('err.noSuchColumn', node, { name: `${nd.left.name}:${nd.right.name}`, available: names.join(', ') });
      const step = to >= from ? 1 : -1;
      for (let i = from; step > 0 ? i <= to : i >= to; i += step) out.push({ index: i, negate });
      return;
    }
    throw new RError('err.selectShape', node);
  };
  walk(argNode, false);
  return out;
}

function verbSelect({ args, env, node, interp }) {
  const df = requireTable(interp.eval(args[0].value, env), 'select', node);
  const names = colNames(df);
  const picked = [];
  for (const a of args.slice(1)) picked.push(...selectIndices(a.value, names, env, interp, node));

  const negated = picked.filter((p) => p.negate).map((p) => p.index);
  const positive = picked.filter((p) => !p.negate).map((p) => p.index);
  const indices = positive.length
    ? positive.filter((i) => !negated.includes(i))
    : names.map((_, i) => i).filter((i) => !negated.includes(i));

  // A rename inside select(): select(new = old)
  const renames = args.slice(1).map((a) => a.name).filter(Boolean);
  const outNames = indices.map((i, k) => renames[k] || names[i]);

  interp.trace?.emit(EV.DPLYR_SELECT, {
    node, kept: indices.slice(), keptNames: outNames.slice(),
    droppedNames: names.filter((_, i) => !indices.includes(i)),
    allNames: names.slice(), preview: tablePreview(df),
  });

  return rebuild(df, indices.map((i) => df.values[i]), outNames);
}

function verbRename({ args, env, node, interp }) {
  const df = requireTable(interp.eval(args[0].value, env), 'rename', node);
  const names = colNames(df).slice();
  for (const a of args.slice(1)) {
    if (!a.name) throw new RError('err.renameShape', node);
    const oldName = a.value.type === 'Ident' ? a.value.name : String(a.value.value);
    const at = names.indexOf(oldName);
    if (at === -1) throw new RError('err.noSuchColumn', node, { name: oldName, available: names.join(', ') });
    names[at] = a.name;
  }
  interp.trace?.emit(EV.DPLYR_SELECT, {
    node, renamed: true, keptNames: names.slice(), allNames: colNames(df), kept: names.map((_, i) => i),
    droppedNames: [], preview: tablePreview(df),
  });
  return rebuild(df, df.values.slice(), names);
}

function verbPull({ args, env, node, interp }) {
  const df = requireTable(interp.eval(args[0].value, env), 'pull', node);
  const names = colNames(df);
  const which = args[1] ? (args[1].value.type === 'Ident' ? args[1].value.name : String(args[1].value.value)) : names[names.length - 1];
  const at = names.indexOf(which);
  if (at === -1) throw new RError('err.noSuchColumn', node, { name: which, available: names.join(', ') });
  interp.trace?.emit(EV.DPLYR_SELECT, {
    node, pulled: which, kept: [at], keptNames: [which],
    droppedNames: names.filter((n) => n !== which), allNames: names.slice(), preview: tablePreview(df),
  });
  return df.values[at];
}

// ---------------------------------------------------------------------------
// mutate
// ---------------------------------------------------------------------------

function verbMutate({ args, env, node, interp }) {
  const df = requireTable(interp.eval(args[0].value, env), 'mutate', node);
  const n = nrowOf(df);
  let names = colNames(df).slice();
  let cols = df.values.slice();

  for (const a of args.slice(1)) {
    if (!a.name) throw new RError('err.mutateNeedsName', node);
    // Each new column is visible to the next one, so the mask is rebuilt each time.
    const mask = dataMask(rebuild(df, cols, names), env, { extra: { __n__: mkInteger([n]) } });
    const value = fitColumn(evalIn(interp, a.value, mask), n, { fname: 'mutate', name: a.name, node, interp });

    const at = names.indexOf(a.name);
    const replaced = at !== -1;
    if (replaced) cols[at] = value; else { cols.push(value); names.push(a.name); }

    interp.trace?.emit(EV.DPLYR_MUTATE, {
      node, name: a.name, replaced, rows: n,
      values: value.values.slice(), type: isFactor(value) ? 'factor' : value.type,
      before: replaced ? df.values[at]?.values.slice() : null,
      preview: tablePreview(rebuild(df, cols, names)),
    });
  }
  return rebuild(df, cols, names);
}

// ---------------------------------------------------------------------------
// arrange
// ---------------------------------------------------------------------------

function verbArrange({ args, env, node, interp }) {
  const df = requireTable(interp.eval(args[0].value, env), 'arrange', node);
  const n = nrowOf(df);
  const mask = dataMask(df, env);

  const keys = args.slice(1).map((a) => {
    let nd = a.value;
    let desc = false;
    if (nd.type === 'Call' && nd.callee.type === 'Ident' && nd.callee.name === 'desc') {
      desc = true;
      nd = nd.args[0].value;
    }
    let col = evalIn(interp, nd, mask);
    if (isFactor(col)) col = mkInteger(col.values.slice());   // factors sort by level order
    return { col, desc, label: nd.type === 'Ident' ? nd.name : '' };
  });

  const order = Array.from({ length: n }, (_, i) => i);
  order.sort((a, b) => {
    for (const { col, desc } of keys) {
      const va = col.values[a];
      const vb = col.values[b];
      if (isNA(va) && isNA(vb)) continue;
      if (isNA(va)) return 1;                                 // NA always sinks to the bottom
      if (isNA(vb)) return -1;
      let r = typeof va === 'string' ? String(va).localeCompare(String(vb), 'pl') : (va < vb ? -1 : va > vb ? 1 : 0);
      if (desc) r = -r;
      if (r !== 0) return r;
    }
    return a - b;                                             // ties keep their original order
  });

  interp.trace?.emit(EV.DPLYR_ARRANGE, {
    node, order: order.slice(), rows: n,
    by: keys.map((k) => ({ name: k.label, desc: k.desc })),
    preview: tablePreview(df),
  });

  return rebuild(df, df.values.map((c) => takeRows(c, order)), colNames(df));
}

// ---------------------------------------------------------------------------
// group_by / summarise
// ---------------------------------------------------------------------------

/** Split row indices by the values of the grouping columns. */
function computeGroups(df, byNames) {
  const names = colNames(df);
  const n = nrowOf(df);
  const cols = byNames.map((nm) => {
    const at = names.indexOf(nm);
    const col = df.values[at];
    return isFactor(col) ? factorToCharacter(col) : col;
  });
  const map = new Map();
  for (let i = 0; i < n; i++) {
    const key = cols.map((c) => (isNA(c.values[i]) ? '\u0000NA' : String(c.values[i]))).join('\u0001');
    if (!map.has(key)) map.set(key, { key, labels: cols.map((c) => c.values[i]), rows: [] });
    map.get(key).rows.push(i);
  }
  // dplyr returns groups in sorted key order.
  return [...map.values()].sort((a, b) => String(a.key).localeCompare(String(b.key), 'pl'));
}

function verbGroupBy({ args, env, node, interp }) {
  const df = requireTable(interp.eval(args[0].value, env), 'group_by', node);
  const names = colNames(df);
  const by = args.slice(1).map((a) => (a.value.type === 'Ident' ? a.value.name : String(a.value.value)));
  for (const nm of by) {
    if (!names.includes(nm)) throw new RError('err.noSuchColumn', node, { name: nm, available: names.join(', ') });
  }
  const groups = computeGroups(df, by);

  interp.trace?.emit(EV.DPLYR_GROUP, {
    node, by: by.slice(), count: groups.length,
    groups: groups.map((g) => ({ labels: g.labels.map(labelText), rows: g.rows.slice(), size: g.rows.length })),
    preview: tablePreview(df),
  });

  return setAttr(df, 'groups', mkCharacter(by));
}

const verbUngroup = ({ args, env, node, interp }) => setAttr(requireTable(interp.eval(args[0].value, env), 'ungroup', node), 'groups', null);

function verbSummarise({ args, env, node, interp }) {
  const df = requireTable(interp.eval(args[0].value, env), 'summarise', node);
  const groupAttr = getAttr(df, 'groups');
  const by = groupAttr ? groupAttr.values.map(String) : [];
  const n = nrowOf(df);
  // Without group_by the whole table is one group -- which is why summarise on an
  // ungrouped table returns a single row.
  const groups = by.length ? computeGroups(df, by) : [{ labels: [], rows: Array.from({ length: n }, (_, i) => i) }];

  const outNames = [...by];
  const outCols = by.map((nm) => {
    const at = colNames(df).indexOf(nm);
    const src = df.values[at];
    const values = groups.map((g) => src.values[g.rows[0]]);
    const out = isList(src) ? mkList(values) : mkAtomic(src.type, values);
    return isFactor(src) ? setAttr(setAttr(out, 'levels', getAttr(src, 'levels')), 'class', getAttr(src, 'class')) : out;
  });

  const perGroup = [];
  for (const a of args.slice(1)) {
    if (!a.name) throw new RError('err.summariseNeedsName', node);
    const results = groups.map((g) => {
      const mask = dataMask(df, env, { rows: g.rows, extra: { '__n__': mkInteger([g.rows.length]) } });
      const value = evalIn(interp, a.value, mask);
      if (rLength(value) !== 1) throw new RError('err.summariseOneValue', node, { name: a.name, length: rLength(value) });
      return value;
    });
    const type = commonType(results.filter(isAtomic).map((r) => r.type));
    const col = mkAtomic(type, results.map((r) => convertCell(r.values[0], r.type, type)));
    outNames.push(a.name);
    outCols.push(col);
    perGroup.push({ name: a.name, values: col.values.slice() });
  }

  interp.trace?.emit(EV.DPLYR_SUMMARISE, {
    node, by: by.slice(), groupCount: groups.length, rowsBefore: n,
    groups: groups.map((g, i) => ({
      labels: g.labels.map(labelText),
      size: g.rows.length,
      rows: g.rows.slice(),
      results: perGroup.map((p) => ({ name: p.name, value: p.values[i] })),
    })),
    columns: perGroup.map((p) => p.name),
  });

  return makeDataFrame(outCols, outNames, { trace: null, node });
}

function verbCount({ args, env, node, interp }) {
  const df = requireTable(interp.eval(args[0].value, env), 'count', node);
  const by = args.slice(1).map((a) => (a.value.type === 'Ident' ? a.value.name : String(a.value.value)));
  const groups = computeGroups(df, by);
  interp.trace?.emit(EV.DPLYR_GROUP, {
    node, by: by.slice(), count: groups.length, counting: true,
    groups: groups.map((g) => ({ labels: g.labels.map(labelText), rows: g.rows.slice(), size: g.rows.length })),
    preview: tablePreview(df),
  });
  const names = colNames(df);
  const keyCols = by.map((nm, k) => {
    const src = df.values[names.indexOf(nm)];
    const values = groups.map((g) => src.values[g.rows[0]]);
    const out = mkAtomic(src.type, values);
    return isFactor(src) ? setAttr(setAttr(out, 'levels', getAttr(src, 'levels')), 'class', getAttr(src, 'class')) : out;
  });
  return makeDataFrame([...keyCols, mkInteger(groups.map((g) => g.rows.length))], [...by, 'n'], { trace: null, node });
}

function verbSlice({ args, env, node, interp }) {
  const df = requireTable(interp.eval(args[0].value, env), 'slice', node);
  const n = nrowOf(df);
  const idx = interp.eval(args[1].value, env);
  const rows = coerceVector(idx, 'double').values
    .filter((v) => !isNA(v) && v !== 0)
    .flatMap((v) => (v > 0 ? [Math.trunc(v) - 1] : []))
    .filter((i) => i >= 0 && i < n);
  interp.trace?.emit(EV.DPLYR_FILTER, {
    node, rows: rows.slice(), kept: rows.length, dropped: n - rows.length, total: n,
    mask: Array.from({ length: n }, (_, i) => rows.includes(i)), naDropped: [], bySlice: true,
    preview: tablePreview(df),
  });
  return rebuild(df, df.values.map((c) => takeRows(c, rows)), colNames(df));
}

function verbDistinct({ args, env, node, interp }) {
  const df = requireTable(interp.eval(args[0].value, env), 'distinct', node);
  const names = colNames(df);
  const named = args.slice(1).filter((a) => a.name !== '.keep_all');
  const by = named.map((a) => (a.value.type === 'Ident' ? a.value.name : String(a.value.value)));
  const keepAll = args.some((a) => a.name === '.keep_all');

  const groups = computeGroups(df, by.length ? by : names);
  const rows = groups.map((g) => g.rows[0]).sort((a, b) => a - b);

  // dplyr keeps ONLY the named columns unless .keep_all = TRUE. Returning the whole
  // table instead is a quiet way to hand back duplicated-looking data.
  const keepCols = by.length && !keepAll ? by : names;
  const indices = keepCols.map((nm) => names.indexOf(nm));

  interp.trace?.emit(EV.DPLYR_FILTER, {
    node, rows: rows.slice(), kept: rows.length, dropped: nrowOf(df) - rows.length, total: nrowOf(df),
    mask: Array.from({ length: nrowOf(df) }, (_, i) => rows.includes(i)), naDropped: [], distinct: true,
    preview: tablePreview(df),
  });

  return rebuild(df, indices.map((j) => takeRows(df.values[j], rows)), keepCols);
}

/** A compact copy of a table for the panels; big tables are truncated. */
function tablePreview(df, limit = 40) {
  const names = colNames(df);
  const n = Math.min(nrowOf(df), limit);
  return {
    names,
    truncated: nrowOf(df) > limit,
    rows: nrowOf(df),
    columns: df.values.map((col) => {
      const labels = isFactor(col) ? factorToCharacter(col) : col;
      return {
        type: isFactor(col) ? 'factor' : col.type,
        values: labels.values.slice(0, n).map((v) => (isNA(v) ? null : v)),
      };
    }),
  };
}

export function registerDplyr(reg) {
  const special = { special: true };
  reg('filter', verbFilter, special);
  reg('select', verbSelect, special);
  reg('mutate', verbMutate, special);
  reg('transmute', verbMutate, special);
  reg('arrange', verbArrange, special);
  reg('group_by', verbGroupBy, special);
  reg('ungroup', verbUngroup, special);
  reg('summarise', verbSummarise, special);
  reg('summarize', verbSummarise, special);
  reg('rename', verbRename, special);
  reg('pull', verbPull, special);
  reg('count', verbCount, special);
  reg('slice', verbSlice, special);
  reg('distinct', verbDistinct, special);

  // `n()` reads the group size that summarise/mutate put into the mask.
  reg('n', ({ env, node }) => {
    const found = env.tryLookup('__n__');
    if (!found) throw new RError('err.nOutsideVerb', node);
    return found.value;
  });
  reg('desc', ({ args, node }) => { throw new RError('err.descOutsideArrange', node); });
  reg('tibble', ({ args, env, node, interp }) => {
    throw new RError('err.useDataFrame', node);
  }, special);
}
