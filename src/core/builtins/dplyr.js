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

import { deparse } from '../deparse.js';
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
const labelText = (x) => (isNA(x) ? 'NA' : typeof x === 'boolean' ? (x ? 'TRUE' : 'FALSE') : String(x));

function requireTable(v, fname, node) {
  if (!v || !isDataFrame(v)) throw new RError('err.verbNeedsTable', node, { fname });
  return v;
}

/** The table a verb works on: its first argument, or the one piped in. Called with
 *  nothing at all (`count()` inside summarise, a pipe missing at a line's end), the
 *  verb says so in R's terms instead of failing inside the trainer. */
function tableArg(args, env, interp, fname, node) {
  if (!args.length || !args[0]?.value || args[0].name) throw new RError('err.verbNeedsTable', node, { fname });
  return requireTable(interp.eval(args[0].value, env), fname, node);
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

/** The groups a table was split into by group_by(), or null for a plain table. */
function groupsOf(df) {
  const attr = getAttr(df, 'groups');
  const by = attr ? attr.values.map(String) : [];
  return by.length ? { by, groups: computeGroups(df, by) } : null;
}

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

function verbFilter({ args, env, node, interp }) {
  const df = tableArg(args, env, interp, 'filter', node);
  const n = nrowOf(df);
  const mask = dataMask(df, env);
  const grouped = groupsOf(df);

  // Several conditions are combined with AND, exactly as dplyr does.
  let keep = new Array(n).fill(true);
  const naRows = new Set();
  const conditions = [];

  for (const a of args.slice(1)) {
    // `filter(wiek = 40)`: one `=` names an argument, it compares nothing. dplyr stops
    // here and asks; passing it on would hand back every row as if the filter held.
    if (a.name) throw new RError('err.filterNamed', a.value, { name: a.name, value: deparse(a.value) });
    let values;
    if (grouped) {
      // After group_by() the condition is judged inside each group: `wiek > mean(wiek)`
      // compares a person with their own city, not with everyone.
      values = new Array(n);
      for (const g of grouped.groups) {
        const part = coerceVector(evalIn(interp, a.value, dataMask(df, env, { rows: g.rows })), 'logical', { trace: interp.trace, node }).values;
        if (part.length !== g.rows.length && part.length !== 1) throw new RError('err.filterLength', node, { length: part.length, rows: g.rows.length });
        g.rows.forEach((row, i) => { values[row] = part[part.length === 1 ? 0 : i]; });
      }
    } else {
      values = coerceVector(evalIn(interp, a.value, mask), 'logical', { trace: interp.trace, node }).values;
    }
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

const NAME_HELPERS = {
  starts_with: (nm, text) => nm.startsWith(text),
  ends_with: (nm, text) => nm.endsWith(text),
  contains: (nm, text) => nm.includes(text),
  everything: () => true,
};

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
    // starts_with("p") and its kin: every column whose name fits, in table order.
    const helper = nd.type === 'Call' && nd.callee.type === 'Ident' ? NAME_HELPERS[nd.callee.name] : null;
    if (helper) {
      const text = nd.args[0]?.value?.type === 'Str' ? String(nd.args[0].value.value) : null;
      if (text == null && nd.callee.name !== 'everything') throw new RError('err.selectHelper', nd, { fname: nd.callee.name });
      names.forEach((nm, at) => { if (helper(nm, text)) out.push({ index: at, negate }); });
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
  const df = tableArg(args, env, interp, 'select', node);
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
  const df = tableArg(args, env, interp, 'rename', node);
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
  const df = tableArg(args, env, interp, 'pull', node);
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
  const df = tableArg(args, env, interp, 'mutate', node);
  const n = nrowOf(df);
  let names = colNames(df).slice();
  let cols = df.values.slice();

  // After group_by() every expression is worked out inside each group: `sum(n)` is
  // the group's sum, `n()` the group's size. That is what turns a share of everyone
  // into a share within a city.
  const grouped = groupsOf(df);
  const by = grouped ? grouped.by : [];
  const groups = grouped ? grouped.groups : null;

  for (const a of args.slice(1)) {
    if (!a.name) throw new RError('err.mutateNeedsName', node);
    // Each new column is visible to the next one, so the mask is rebuilt each time.
    const table = rebuild(df, cols, names);
    let value;
    if (groups) {
      const parts = groups.map((g) => {
        const mask = dataMask(table, env, { rows: g.rows, extra: { __n__: mkInteger([g.rows.length]) } });
        return fitColumn(evalIn(interp, a.value, mask), g.rows.length, { fname: 'mutate', name: a.name, node, interp });
      });
      const type = commonType(parts.map((v) => v.type));
      const values = new Array(n);
      groups.forEach((g, k) => {
        const part = coerceVector(parts[k], type);
        g.rows.forEach((row, i) => { values[row] = part.values[i]; });
      });
      value = mkAtomic(type, values);
      // A factor made per group keeps its levels when every group agrees on them.
      const first = parts[0];
      if (first && isFactor(first)) value = setAttr(setAttr(mkAtomic(first.type, values), 'levels', getAttr(first, 'levels')), 'class', getAttr(first, 'class'));
    } else {
      const mask = dataMask(table, env, { extra: { __n__: mkInteger([n]) } });
      value = fitColumn(evalIn(interp, a.value, mask), n, { fname: 'mutate', name: a.name, node, interp });
    }

    const at = names.indexOf(a.name);
    const replaced = at !== -1;
    const input = tablePreview(rebuild(df, cols, names));   // the table this column joins
    if (replaced) cols[at] = value; else { cols.push(value); names.push(a.name); }

    interp.trace?.emit(EV.DPLYR_MUTATE, {
      node, name: a.name, replaced, rows: n,
      values: value.values.slice(), type: isFactor(value) ? 'factor' : value.type,
      before: replaced ? df.values[at]?.values.slice() : null,
      preview: tablePreview(rebuild(df, cols, names)),
      input,
      // Which rows were worked out together, when the table is grouped.
      by: by.slice(),
      groups: groups ? groups.map((g) => ({ labels: g.labels.map(labelText), rows: g.rows.slice() })) : null,
    });
  }
  return rebuild(df, cols, names);
}

// ---------------------------------------------------------------------------
// arrange
// ---------------------------------------------------------------------------

function verbArrange({ args, env, node, interp }) {
  const df = tableArg(args, env, interp, 'arrange', node);
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
  const source = byNames.map((nm) => df.values[names.indexOf(nm)]);
  const cols = source.map((col) => (isFactor(col) ? factorToCharacter(col) : col));
  const map = new Map();
  for (let i = 0; i < n; i++) {
    const key = cols.map((c) => (isNA(c.values[i]) ? '\u0000NA' : String(c.values[i]))).join('\u0001');
    // A factor sorts by its level, not by its label: that is what a level order is for.
    if (!map.has(key)) map.set(key, { key, labels: cols.map((c) => c.values[i]), order: source.map((c) => c.values[i]), rows: [] });
    map.get(key).rows.push(i);
  }
  // dplyr returns groups in sorted key order: numbers as numbers, FALSE before TRUE,
  // factor levels in their own order, and a missing key last.
  return [...map.values()].sort((a, b) => {
    for (let k = 0; k < a.order.length; k++) {
      const d = compareKeys(a.order[k], b.order[k]);
      if (d) return d;
    }
    return 0;
  });
}

function compareKeys(x, y) {
  if (isNA(x) || isNA(y)) return isNA(x) - isNA(y);
  if (typeof x === 'string') return x.localeCompare(String(y), 'pl');
  return Number(x) - Number(y);
}

/**
 * The grouping keys of group_by() and count(). A bare column name groups by that
 * column. Anything else, `wiek > 40` or `grupa = plec`, is computed first and joins
 * the table as a column, named by its code or by the name given: dplyr does the same.
 * @returns {{df, by: string[]}}
 */
function groupingKeys(df, keyArgs, env, interp, fname, node) {
  let table = df;
  const by = [];
  for (const a of keyArgs) {
    const bare = !a.name && (a.value.type === 'Ident' || a.value.type === 'Str');
    const label = a.name || (bare ? String(a.value.type === 'Ident' ? a.value.name : a.value.value) : deparse(a.value));
    const names = colNames(table);
    if (bare) {
      if (!names.includes(label)) throw new RError('err.noSuchColumn', a.value, { name: label, available: names.join(', ') });
    } else {
      const value = fitColumn(evalIn(interp, a.value, dataMask(table, env)), nrowOf(table), { fname, name: label, node, interp });
      const at = names.indexOf(label);
      const cols = table.values.slice();
      if (at >= 0) cols[at] = value; else cols.push(value);
      table = rebuild(table, cols, at >= 0 ? names : [...names, label]);
    }
    by.push(label);
  }
  return { df: table, by };
}

function verbGroupBy({ args, env, node, interp }) {
  const { df, by } = groupingKeys(tableArg(args, env, interp, 'group_by', node), args.slice(1), env, interp, 'group_by', node);
  const groups = computeGroups(df, by);

  interp.trace?.emit(EV.DPLYR_GROUP, {
    node, by: by.slice(), count: groups.length,
    groups: groups.map((g) => ({ labels: g.labels.map(labelText), rows: g.rows.slice(), size: g.rows.length })),
    preview: tablePreview(df),
  });

  return setAttr(df, 'groups', mkCharacter(by));
}

const verbUngroup = ({ args, env, node, interp }) => setAttr(tableArg(args, env, interp, 'ungroup', node), 'groups', null);

function verbSummarise({ args, env, node, interp }) {
  const df = tableArg(args, env, interp, 'summarise', node);
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
    // Unnamed, the column is named by its code, as dplyr does: summarise(mean(wiek)) -> `mean(wiek)`.
    const name = a.name || deparse(a.value);
    const results = groups.map((g) => {
      const mask = dataMask(df, env, { rows: g.rows, extra: { '__n__': mkInteger([g.rows.length]) } });
      const value = evalIn(interp, a.value, mask);
      if (rLength(value) !== 1) throw new RError('err.summariseOneValue', node, { name, length: rLength(value) });
      return value;
    });
    const type = commonType(results.filter(isAtomic).map((r) => r.type));
    const col = mkAtomic(type, results.map((r) => convertCell(r.values[0], r.type, type)));
    outNames.push(name);
    outCols.push(col);
    perGroup.push({ name, values: col.values.slice() });
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
    preview: tablePreview(df),
  });

  const out = makeDataFrame(outCols, outNames, { trace: null, node });
  // summarise() peels off the last grouping level and keeps the rest, as dplyr does:
  // after group_by(miasto, plec) the result is still grouped by miasto, so a
  // mutate(n / sum(n)) that follows gives shares within each city.
  return by.length > 1 ? setAttr(out, 'groups', mkCharacter(by.slice(0, -1))) : out;
}

function verbCount({ args, env, node, interp }) {
  // `sort` and `name` are count()'s own settings; every other argument is a key.
  const setting = (name) => args.slice(1).find((a) => a.name === name);
  const sorted = setting('sort') ? coerceVector(interp.eval(setting('sort').value, env), 'logical').values[0] === true : false;
  const nName = setting('name') ? String(interp.eval(setting('name').value, env).values[0]) : 'n';
  const keyArgs = args.slice(1).filter((a) => a.name !== 'sort' && a.name !== 'name');
  const input = tableArg(args, env, interp, 'count', node);
  const keyed = groupingKeys(input, keyArgs, env, interp, 'count', node);
  // A grouped table is counted inside its groups: their keys come first.
  const df = keyed.df;
  const by = [...new Set([...(groupsOf(input)?.by || []), ...keyed.by])];
  const groups = computeGroups(df, by);
  // sort = TRUE: the largest group first; equal groups keep their key order.
  if (sorted) groups.sort((a, b) => b.rows.length - a.rows.length);
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
  return makeDataFrame([...keyCols, mkInteger(groups.map((g) => g.rows.length))], [...by, nName], { trace: null, node });
}

function verbSlice({ args, env, node, interp }) {
  const df = tableArg(args, env, interp, 'slice', node);
  const n = nrowOf(df);
  const idx = interp.eval(args[1].value, env);
  const wanted = coerceVector(idx, 'double').values
    .filter((v) => !isNA(v) && v !== 0)
    .flatMap((v) => (v > 0 ? [Math.trunc(v) - 1] : []));
  // After group_by(), slice(1) is the first row of each group, groups in key order.
  const grouped = groupsOf(df);
  const rows = grouped
    ? grouped.groups.flatMap((g) => wanted.filter((i) => i < g.rows.length).map((i) => g.rows[i]))
    : wanted.filter((i) => i >= 0 && i < n);
  interp.trace?.emit(EV.DPLYR_FILTER, {
    node, rows: rows.slice(), kept: rows.length, dropped: n - rows.length, total: n,
    mask: Array.from({ length: n }, (_, i) => rows.includes(i)), naDropped: [], bySlice: true,
    preview: tablePreview(df),
  });
  return rebuild(df, df.values.map((c) => takeRows(c, rows)), colNames(df));
}

function verbDistinct({ args, env, node, interp }) {
  const df = tableArg(args, env, interp, 'distinct', node);
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

// ---------------------------------------------------------------------------
// if_else and case_when: recoding inside mutate()
// ---------------------------------------------------------------------------

const isText = (v) => v.type === 'character';
const isNumber = (v) => v.type === 'double' || v.type === 'integer';

/**
 * dplyr refuses to put text and numbers in one column, where base `ifelse()` would
 * quietly turn the numbers into text. A bare NA is logical and fits anything.
 */
function recodeType(values, fname, node) {
  if (values.some(isText) && values.some(isNumber)) throw new RError('err.recodeTypes', node, { fname });
  return commonType(values.map((v) => v.type));
}

/** One output cell: the value at row `i`, the vector recycled when it has length 1. */
function cellAt(value, i, n, { fname, node }) {
  const len = rLength(value);
  if (len !== 1 && len !== n) throw new RError('err.recodeLength', node, { fname, length: len, rows: n });
  return value.values[len === 1 ? 0 : i];
}

function fnIfElse({ args, node, interp }) {
  const where = { fname: 'if_else', node };
  const given = (i, name) => args.find((a) => a.name === name)?.value ?? args.filter((a) => !a.name)[i]?.value;
  const condition = given(0, 'condition');
  const yes = given(1, 'true');
  const no = given(2, 'false');
  const missing = given(3, 'missing');
  if (!condition || !yes || !no) throw new RError('err.ifElseArgs', node);
  if (condition.type !== 'logical') throw new RError('err.recodeCondition', node, { fname: 'if_else' });
  const sources = [yes, no, ...(missing ? [missing] : [])];
  const type = recodeType(sources, 'if_else', node);
  const n = rLength(condition);
  const cast = sources.map((v) => coerceVector(v, type));
  const out = condition.values.map((c, i) => {
    if (isNA(c)) return missing ? cellAt(cast[2], i, n, where) : NA;
    return cellAt(c ? cast[0] : cast[1], i, n, where);
  });
  interp.trace?.emit(EV.RECODE, {
    node, fname: 'if_else', type, values: out, hasDefault: false,
    conditions: [condition.values],
    took: condition.values.map((c) => (isNA(c) ? (missing ? 'rest' : 'none') : c ? 0 : 'rest')),
  });
  return mkAtomic(type, out);
}

/**
 * `case_when(condition ~ value, ...)`: for each row, the value of the FIRST condition
 * that is TRUE. A row no condition claims is NA, or `.default`. An NA condition
 * claims nothing, so a missing age falls through to the end.
 */
function fnCaseWhen({ args, env, node, interp }) {
  const where = { fname: 'case_when', node };
  const cases = [];
  let fallback = null;
  for (const a of args) {
    if (a.name === '.default') { fallback = interp.eval(a.value, env); continue; }
    if (a.name || a.value?.type !== 'Binary' || a.value.op !== '~') throw new RError('err.caseWhenFormula', a.value || node);
    const condition = interp.eval(a.value.left, env);
    if (condition.type !== 'logical') throw new RError('err.recodeCondition', a.value.left, { fname: 'case_when' });
    cases.push({ condition, value: interp.eval(a.value.right, env) });
  }
  if (!cases.length) throw new RError('err.caseWhenFormula', node);
  const sources = [...cases.map((c) => c.value), ...(fallback ? [fallback] : [])];
  const type = recodeType(sources, 'case_when', node);
  const n = Math.max(...cases.map((c) => rLength(c.condition)));
  for (const c of cases) c.value = coerceVector(c.value, type);
  if (fallback) fallback = coerceVector(fallback, type);
  const took = [];
  const out = Array.from({ length: n }, (_, i) => {
    for (const [k, c] of cases.entries()) {
      const hit = cellAt(c.condition, i, n, where);
      if (!isNA(hit) && hit) { took.push(k); return cellAt(c.value, i, n, where); }
    }
    took.push(fallback ? 'rest' : 'none');
    return fallback ? cellAt(fallback, i, n, where) : NA;
  });
  interp.trace?.emit(EV.RECODE, {
    node, fname: 'case_when', type, values: out, took, hasDefault: !!fallback,
    conditions: cases.map((c) => c.condition.values),
  });
  return mkAtomic(type, out);
}

// ---------------------------------------------------------------------------
// tidyr: the shape of a table
// ---------------------------------------------------------------------------

/**
 * `pivot_wider(names_from = a, values_from = b)`: the values of one column become
 * column names, and the table gets one row per combination of what is left.
 *
 * A pair that had no row in the long table has no value to put in its cell: it is
 * NA unless `values_fill` says otherwise. Two rows for one cell are refused with a
 * plain message. tidyr would build list-columns there, which answers no question a
 * first-year student has asked.
 */
function verbPivotWider({ args, env, node, interp }) {
  const df = tableArg(args, env, interp, 'pivot_wider', node);
  const names = colNames(df);
  const known = ['names_from', 'values_from', 'values_fill'];
  const stray = args.slice(1).find((a) => !known.includes(a.name));
  if (stray) throw new RError('err.pivotArg', stray.value, { name: stray.name || deparse(stray.value) });
  const setting = (name) => args.slice(1).find((a) => a.name === name);
  const column = (name) => {
    const a = setting(name);
    if (!a) throw new RError('err.pivotNeeds', node, { arg: name });
    const label = a.value.type === 'Ident' ? a.value.name : a.value.type === 'Str' ? String(a.value.value) : null;
    if (label == null) throw new RError('err.pivotNeeds', a.value, { arg: name });
    if (!names.includes(label)) throw new RError('err.noSuchColumn', a.value, { name: label, available: names.join(', ') });
    return label;
  };
  const from = column('names_from');
  const val = column('values_from');
  if (from === val) throw new RError('err.pivotSame', node, { name: from });
  const fill = setting('values_fill') ? interp.eval(setting('values_fill').value, env) : null;

  const text = (col) => (isFactor(col) ? factorToCharacter(col) : col);
  const fromCol = text(df.values[names.indexOf(from)]);
  const valCol = text(df.values[names.indexOf(val)]);
  const idNames = names.filter((nm) => nm !== from && nm !== val);
  const idCols = idNames.map((nm) => df.values[names.indexOf(nm)]);
  const n = nrowOf(df);

  // New columns and new rows both come in order of first appearance.
  const labels = [];
  const rows = new Map();
  for (let i = 0; i < n; i++) {
    const label = labelText(fromCol.values[i]);
    if (!labels.includes(label)) labels.push(label);
    const key = idCols.map((c) => labelText(text(c).values[i])).join('\u0001');
    if (!rows.has(key)) rows.set(key, { first: i, cells: new Map() });
    const row = rows.get(key);
    if (row.cells.has(label)) {
      throw new RError('err.pivotDuplicates', node, { from, value: label, ids: idNames.join(', ') || '-' });
    }
    row.cells.set(label, i);
  }

  const out = [...rows.values()];
  if (fill && isText(fill) !== isText(valCol) && !valCol.values.every(isNA)) throw new RError('err.recodeTypes', node, { fname: 'pivot_wider' });
  const type = fill ? commonType([valCol.type, fill.type]) : valCol.type;
  const cast = coerceVector(valCol, type);
  const empty = fill ? coerceVector(fill, type).values[0] : NA;
  const cols = [
    ...idCols.map((c) => takeRows(c, out.map((r) => r.first))),
    ...labels.map((label) => mkAtomic(type, out.map((r) => (r.cells.has(label) ? cast.values[r.cells.get(label)] : empty)))),
  ];
  const result = rebuild(setAttr(df, 'groups', null), cols, [...idNames, ...labels]);

  interp.trace?.emit(EV.PIVOT, {
    node, direction: 'wider', from, val, ids: idNames.slice(), labels: labels.slice(), filled: !!fill,
    // For each source row: which new column it went to. For each cell: which source row fed it.
    rowLabel: Array.from({ length: n }, (_, i) => labels.indexOf(labelText(fromCol.values[i]))),
    cells: out.map((r) => labels.map((label) => (r.cells.has(label) ? r.cells.get(label) : null))),
    gaps: out.reduce((k, r) => k + labels.filter((label) => !r.cells.has(label)).length, 0),
    input: tablePreview(df),
    output: tablePreview(result),
  });
  return result;
}

/**
 * `pivot_longer(cols, names_to = "a", values_to = "b")`: several columns that hold
 * the same kind of answer fold into two, which column it was and what it held.
 * Every row becomes one row per folded column, so a row stops being a person.
 *
 * `names_to` and `values_to` are new names, so they are text in quotes; the columns
 * to fold exist already, so they are written bare. That difference is the first
 * thing a student gets wrong, and a bare new name gets its own message.
 */
function verbPivotLonger({ args, env, node, interp }) {
  const df = tableArg(args, env, interp, 'pivot_longer', node);
  const names = colNames(df);
  const known = ['cols', 'names_to', 'values_to', 'values_drop_na'];
  const rest = args.slice(1);
  const stray = rest.find((a) => a.name && !known.includes(a.name));
  if (stray) throw new RError('err.pivotLongerArg', stray.value, { name: stray.name });
  const colsArgs = rest.filter((a) => !a.name || a.name === 'cols');
  if (!colsArgs.length) throw new RError('err.pivotLongerCols', node);
  const newName = (key, fallback) => {
    const a = rest.find((x) => x.name === key);
    if (!a) return fallback;
    if (a.value.type !== 'Str') throw new RError('err.pivotLongerQuote', a.value, { arg: key, name: deparse(a.value) });
    return String(a.value.value);
  };
  const namesTo = newName('names_to', 'name');
  const valuesTo = newName('values_to', 'value');
  const dropArg = rest.find((a) => a.name === 'values_drop_na');
  const dropNA = dropArg ? coerceVector(interp.eval(dropArg.value, env), 'logical').values[0] === true : false;

  const picked = colsArgs.flatMap((a) => selectIndices(a.value, names, env, interp, node));
  const minus = new Set(picked.filter((p) => p.negate).map((p) => p.index));
  const plus = picked.filter((p) => !p.negate).map((p) => p.index);
  const fold = [...new Set(plus.length ? plus.filter((i) => !minus.has(i)) : names.map((_, i) => i).filter((i) => !minus.has(i)))];
  if (!fold.length) throw new RError('err.pivotLongerCols', node);

  const text = (col) => (isFactor(col) ? factorToCharacter(col) : col);
  const sources = fold.map((i) => text(df.values[i]));
  if (sources.some(isText) && sources.some(isNumber)) throw new RError('err.pivotLongerTypes', node, { cols: fold.map((i) => names[i]).join(', ') });
  const type = commonType(sources.map((c) => c.type));
  const cast = sources.map((c) => coerceVector(c, type));
  const idAt = names.map((_, i) => i).filter((i) => !fold.includes(i));
  for (const fresh of [namesTo, valuesTo]) {
    if (idAt.some((i) => names[i] === fresh)) throw new RError('err.pivotLongerTaken', node, { name: fresh });
  }

  const n = nrowOf(df);
  const from = [];          // for each output row: [input row, folded column]
  let dropped = 0;
  for (let r = 0; r < n; r++) {
    for (let k = 0; k < fold.length; k++) {
      if (dropNA && isNA(cast[k].values[r])) { dropped++; continue; }
      from.push([r, k]);
    }
  }
  const cols = [
    ...idAt.map((i) => takeRows(df.values[i], from.map(([r]) => r))),
    mkCharacter(from.map(([, k]) => names[fold[k]])),
    mkAtomic(type, from.map(([r, k]) => cast[k].values[r])),
  ];
  const result = rebuild(setAttr(df, 'groups', null), cols, [...idAt.map((i) => names[i]), namesTo, valuesTo]);

  interp.trace?.emit(EV.PIVOT, {
    node, direction: 'longer', cols: fold.map((i) => names[i]), namesTo, valuesTo,
    ids: idAt.map((i) => names[i]), rowsIn: n, rowsOut: from.length, dropped,
    rowSource: from.map(([, k]) => k),
    input: tablePreview(df),
    output: tablePreview(result),
  });
  return result;
}

// ---------------------------------------------------------------------------
// joins: two tables and a key
// ---------------------------------------------------------------------------

/** What each join keeps: unmatched rows of the left table, of the right one, and
 *  whether the right table's columns come along at all. */
const JOINS = {
  left_join: { keepX: true, keepY: false, columns: true },
  inner_join: { keepX: false, keepY: false, columns: true },
  right_join: { keepX: false, keepY: true, columns: true },
  full_join: { keepX: true, keepY: true, columns: true },
  semi_join: { filter: 'matched' },
  anti_join: { filter: 'unmatched' },
};

/**
 * Read `by`: which column of the left table meets which column of the right one.
 * The argument arrives unevaluated, so `by = miasto`, the first thing a student
 * writes after a chapter of bare column names, gets its own message instead of
 * "object not found".
 * @returns {{pairs: {x: string, y: string}[], natural: boolean}}
 */
function joinKeys(byArg, xNames, yNames, env, interp, fname) {
  const same = (name) => ({ x: name, y: name });
  if (!byArg) {
    const common = xNames.filter((nm) => yNames.includes(nm));
    if (!common.length) throw new RError('err.joinNoCommon', null, { fname });
    return { pairs: common.map(same), natural: true };
  }
  const nd = byArg.value;
  const fromVector = (v) => {
    if (!v || !isAtomic(v) || v.type !== 'character' || !rLength(v)) throw new RError('err.joinBy', nd, { fname });
    const left = getNames(v)?.values || [];
    return v.values.map((y, i) => ({ x: left[i] ? String(left[i]) : String(y), y: String(y) }));
  };
  const callee = nd.type === 'Call' && nd.callee.type === 'Ident' ? nd.callee.name : null;
  if (nd.type === 'Ident') {
    if (env.tryLookup(nd.name) && !xNames.includes(nd.name)) return { pairs: fromVector(interp.eval(nd, env)), natural: false };
    throw new RError('err.joinByQuote', nd, { name: nd.name });
  }
  if (callee === 'c') {
    const bare = nd.args.find((a) => a.value.type === 'Ident');
    if (bare) throw new RError('err.joinByQuote', bare.value, { name: bare.value.name });
  }
  if (callee === 'join_by') {
    const pairs = nd.args.map((a) => {
      const v = a.value;
      const name = (x) => (x.type === 'Ident' ? x.name : x.type === 'Str' ? String(x.value) : null);
      if (name(v) != null) return same(name(v));
      if (v.type === 'Binary' && v.op === '==' && name(v.left) != null && name(v.right) != null) return { x: name(v.left), y: name(v.right) };
      throw new RError('err.joinBy', v, { fname });
    });
    if (!pairs.length) throw new RError('err.joinBy', nd, { fname });
    return { pairs, natural: false };
  }
  return { pairs: fromVector(interp.eval(nd, env)), natural: false };
}

/** Rows of a column by position; a position of null is a row with no partner: NA. */
function pickRows(col, rows) {
  const out = mkAtomic(col.type, rows.map((r) => (r == null ? NA : col.values[r])));
  return col.attributes ? setAttr(setAttr(out, 'levels', getAttr(col, 'levels')), 'class', getAttr(col, 'class')) : out;
}

/**
 * `left_join(x, y, by = "key")` and its family. Every row of `x` looks for the rows
 * of `y` with the same key and takes their columns.
 *
 * Two things happen without a message, and both change the number of rows a later
 * count() or mean() stands on. A key with no partner stays, with NA in the new
 * columns (or leaves, in inner_join). A key that repeats in `y` gives the row of
 * `x` once per partner: six people become eight. dplyr warns only when keys repeat
 * on both sides, and so does this.
 */
function verbJoin(fname) {
  const kind = JOINS[fname];
  return ({ args, env, node, interp }) => {
    const x = tableArg(args, env, interp, fname, node);
    const rest = args.slice(1);
    const stray = rest.find((a) => a.name && a.name !== 'by' && a.name !== 'y');
    if (stray) throw new RError('err.joinArg', stray.value, { fname, name: stray.name });
    // By position the second table comes first, then the key: left_join(x, y, "miasto").
    const yArgs = rest.filter((a) => a.name !== 'by');
    const byArg = rest.find((a) => a.name === 'by') || (yArgs.length === 2 && !yArgs[1].name ? yArgs.pop() : null);
    if (yArgs.length !== 1) throw new RError(yArgs.length ? 'err.joinArg' : 'err.joinNeedsTwo', yArgs[1]?.value || node, { fname, name: yArgs[1] ? deparse(yArgs[1].value) : '' });
    const yValue = interp.eval(yArgs[0].value, env);
    if (!yValue || !isDataFrame(yValue)) throw new RError('err.joinNeedsTwo', yArgs[0].value, { fname });
    const y = yValue;
    const xNames = colNames(x);
    const yNames = colNames(y);

    let keys;
    try {
      keys = joinKeys(byArg, xNames, yNames, env, interp, fname);
    } catch (e) {
      if (e instanceof RError && !e.node) e.node = node;
      throw e;
    }
    const { pairs, natural } = keys;
    const text = (col) => (isFactor(col) ? factorToCharacter(col) : col);
    for (const p of pairs) {
      if (!xNames.includes(p.x)) throw new RError('err.joinKeyLeft', node, { name: p.x, available: xNames.join(', ') });
      if (!yNames.includes(p.y)) throw new RError('err.joinKeyRight', node, { name: p.y, x: p.x, available: yNames.join(', ') });
    }
    const xKey = pairs.map((p) => text(x.values[xNames.indexOf(p.x)]));
    const yKey = pairs.map((p) => text(y.values[yNames.indexOf(p.y)]));
    pairs.forEach((p, k) => {
      if (isText(xKey[k]) !== isText(yKey[k])) throw new RError('err.joinTypes', node, { x: p.x, y: p.y });
    });
    if (natural) interp.printText(`Joining with \`by = join_by(${pairs.map((p) => p.x).join(', ')})\``);

    // One label per row, the same on both sides when the keys are equal. NA meets NA,
    // as in dplyr.
    const nx = nrowOf(x);
    const ny = nrowOf(y);
    const label = (cols, i) => cols.map((c) => (isNA(c.values[i]) ? '\u0000NA' : String(c.values[i]))).join('\u0001');
    const inY = new Map();
    for (let j = 0; j < ny; j++) {
      const key = label(yKey, j);
      if (!inY.has(key)) inY.set(key, []);
      inY.get(key).push(j);
    }
    const partners = Array.from({ length: nx }, (_, i) => inY.get(label(xKey, i)) || []);
    const usedY = new Array(ny).fill(0);
    partners.forEach((list) => list.forEach((j) => { usedY[j]++; }));
    const unmatchedX = partners.map((list, i) => (list.length ? -1 : i)).filter((i) => i >= 0);
    const unmatchedY = usedY.map((k, j) => (k ? -1 : j)).filter((j) => j >= 0);

    // Each output row: [row of x or null, row of y or null].
    let from = [];
    if (kind.filter) {
      for (let i = 0; i < nx; i++) if ((partners[i].length > 0) === (kind.filter === 'matched')) from.push([i, null]);
    } else {
      for (let i = 0; i < nx; i++) {
        if (partners[i].length) for (const j of partners[i]) from.push([i, j]);
        else if (kind.keepX) from.push([i, null]);
      }
      if (kind.keepY) for (const j of unmatchedY) from.push([null, j]);
    }
    const xRows = from.map(([i]) => i);
    const yRows = from.map(([, j]) => j);

    let cols;
    let names;
    if (kind.filter) {
      cols = x.values.map((c) => takeRows(c, xRows));
      names = xNames;
    } else {
      const yRest = yNames.map((_, j) => j).filter((j) => !pairs.some((p) => p.y === yNames[j]));
      const clash = new Set(yRest.map((j) => yNames[j]).filter((nm) => xNames.includes(nm)));
      const fromY = kind.keepY && unmatchedY.length > 0;
      cols = x.values.map((c, at) => {
        const k = pairs.findIndex((p) => p.x === xNames[at]);
        // A row that came from the right table alone has its key there, nowhere else.
        if (k === -1 || !fromY) return pickRows(c, xRows);
        const type = commonType([xKey[k].type, yKey[k].type]);
        const left = coerceVector(xKey[k], type);
        const right = coerceVector(yKey[k], type);
        return mkAtomic(type, from.map(([i, j]) => (i == null ? right.values[j] : left.values[i])));
      });
      cols.push(...yRest.map((j) => pickRows(y.values[j], yRows)));
      names = [...xNames.map((nm) => (clash.has(nm) ? `${nm}.x` : nm)), ...yRest.map((j) => (clash.has(yNames[j]) ? `${yNames[j]}.y` : yNames[j]))];
    }
    const result = rebuild(x, cols, names);

    const many = !kind.filter && partners.some((list) => list.length > 1) && usedY.some((k) => k > 1);
    if (many) interp.warn(t('warn.joinMany'), node);

    // One colour per key value, in the order the left table meets them.
    const seen = new Map();
    const xGroup = Array.from({ length: nx }, (_, i) => {
      const key = label(xKey, i);
      if (!seen.has(key)) seen.set(key, seen.size);
      return seen.get(key);
    });
    interp.trace?.emit(EV.JOIN, {
      node, fname, by: pairs.map((p) => ({ ...p })), natural, filter: kind.filter || null,
      rowsX: nx, rowsY: ny, rowsOut: from.length,
      unmatchedX, unmatchedY, keptX: !!kind.keepX, keptY: !!kind.keepY,
      multiplied: partners.filter((list) => list.length > 1).length,
      many,
      xGroup,
      yGroup: Array.from({ length: ny }, (_, j) => (seen.has(label(yKey, j)) ? seen.get(label(yKey, j)) : null)),
      from: from.map(([i, j]) => [i, j]),
      added: kind.filter ? [] : names.slice(xNames.length),
      x: tablePreview(x),
      y: tablePreview(y),
      output: tablePreview(result),
    });
    return result;
  };
}

export function registerDplyr(reg) {
  const special = { special: true };
  for (const fname of Object.keys(JOINS)) reg(fname, verbJoin(fname), special);
  reg('pivot_wider', verbPivotWider, special);
  reg('pivot_longer', verbPivotLonger, special);
  reg('if_else', fnIfElse);
  reg('case_when', fnCaseWhen, special);
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
