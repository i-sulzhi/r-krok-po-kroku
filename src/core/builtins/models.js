/**
 * Linear models from the stats package (syllabus topic 5, lecture 5).
 *
 * A formula and an `lm` object are built the way R builds them, so a student can
 * reach into the result as in RStudio (`m$coefficients`, `coef(m)`, `residuals(m)`).
 * The `lm` value is an ordinary R list with class "lm". Beside its R elements it
 * carries `.lm`: the model matrix, the rows used and the rows dropped. The pictures
 * read only that, never a hand-made illustration of what a model should be.
 *
 * Supported: `y ~ x`, `y ~ x1 + x2`, numeric and categorical terms (treatment
 * contrasts, the first level as the base), `factor(x)` inside a formula, rows with NA
 * dropped as `na.omit` does. Interactions, transformations and polynomials exist in R
 * and are refused here with a sentence saying so.
 *
 * The fit is a Householder QR of the model matrix, as R's `lm.fit` does, with the
 * same rule for a column that adds nothing (it is skipped and its coefficient is NA).
 */

import { deparse } from '../deparse.js';
import {
  NA, isNA, mkAtomic, mkDouble, mkInteger, mkCharacter, mkList,
  isAtomic, rLength, getAttr, isFactor, isDataFrame, getNames, hasClass,
} from '../rvalue.js';
import { RError, coerceVector } from '../coerce.js';
import { factorToCharacter } from '../arith.js';
import { makeFactor } from './structures.js';
import { Env } from '../env.js';
import { t } from '../../i18n/index.js';

// ---------------------------------------------------------------------------
// values
// ---------------------------------------------------------------------------

const classed = (cls, extra) => Object.freeze({
  kind: 'list',
  values: Object.freeze([]),
  attributes: Object.freeze({ class: mkCharacter(cls) }),
  ...extra,
});

/** `y ~ x` unevaluated, with the environment it was written in. */
export const mkFormula = (node, env) => classed(['formula'], { formula: Object.freeze({ node, env }) });
export const isFormula = (v) => Boolean(v && v.formula);

/** A call kept as text, the way `m$call` prints it. */
const mkCallText = (text) => classed(['call'], { callText: text });

export const isModel = (v) => Boolean(v && v.lm && hasClass(v, 'lm'));

// ---------------------------------------------------------------------------
// formula terms
// ---------------------------------------------------------------------------

/** The right side of a formula split on `+`, left to right. */
function splitPlus(node, out = []) {
  if (node.type === 'Binary' && node.op === '+') {
    splitPlus(node.left, out);
    out.push(node.right);
  } else if (node.type === 'Paren') {
    splitPlus(node.expr, out);
  } else {
    out.push(node);
  }
  return out;
}

// Real R, not here yet: said so, never "check the spelling".
const UNSUPPORTED_CALLS = new Set(['I', 'poly', 'log', 'log10', 'log2', 'sqrt', 'exp', 'scale', 'ns', 'bs',
  'offset', 'interaction', 'cut', 'abs']);

function checkTerm(term) {
  const code = deparse(term);
  if (term.type === 'Binary' || term.type === 'Unary') throw new RError('err.lmTermUnsupported', term, { term: code });
  if (term.type === 'Ident' && term.name === '.') throw new RError('err.lmTermUnsupported', term, { term: code });
  if (term.type === 'Num' && term.value !== 1) throw new RError('err.lmTermUnsupported', term, { term: code });
  if (term.type === 'Call' && term.callee?.type === 'Ident' && UNSUPPORTED_CALLS.has(term.callee.name)) {
    throw new RError('err.lmTermUnsupported', term, { term: code });
  }
}

/** A data mask: the table's columns over the formula's own environment. */
function maskOf(data, parent) {
  if (!data) return parent;
  const mask = new Env(parent, { name: t('env.dataMask') });
  const names = (getNames(data)?.values || []).map(String);
  data.values.forEach((col, i) => mask.vars.set(names[i], col));
  return mask;
}

const nrowOf = (df) => (df.values.length ? rLength(df.values[0]) : 0);

/** A categorical term as plain strings plus its levels in R's order. */
function asCategories(v) {
  if (isFactor(v)) {
    const chr = factorToCharacter(v);
    return { values: chr.values.map((x) => (isNA(x) ? NA : String(x))), levels: getAttr(v, 'levels').values.map(String) };
  }
  if (v.type === 'logical') {
    return { values: v.values.map((x) => (isNA(x) ? NA : x ? 'TRUE' : 'FALSE')), levels: ['FALSE', 'TRUE'] };
  }
  const f = makeFactor(v);
  return asCategories(f);
}

// ---------------------------------------------------------------------------
// QR least squares
// ---------------------------------------------------------------------------

/**
 * Least squares by Householder QR, column by column. A column whose remaining
 * length falls below 1e-7 of its original length adds nothing new: it is skipped
 * and its coefficient is NA, as LINPACK's dqrdc2 does for R.
 */
export function qrFit(X, y) {
  const n = y.length;
  const p = X.length ? X[0].length : 0;
  const A = X.map((row) => row.slice());
  const qty = y.slice();
  const kept = [];
  const aliased = new Array(p).fill(false);
  const reflectors = [];
  const norm0 = Array.from({ length: p }, (_, j) => Math.hypot(...A.map((r) => r[j])));
  let k = 0;
  for (let j = 0; j < p; j++) {
    // Apply the reflectors so far to this column.
    for (const { v, at } of reflectors) applyReflector(A, v, at, j);
    let len = 0;
    for (let i = k; i < n; i++) len += A[i][j] * A[i][j];
    len = Math.sqrt(len);
    if (k >= n || len < 1e-7 * (norm0[j] || 1) || norm0[j] === 0) { aliased[j] = true; continue; }
    const alpha = A[k][j] > 0 ? -len : len;
    const v = new Array(n).fill(0);
    for (let i = k; i < n; i++) v[i] = A[i][j];
    v[k] -= alpha;
    const vnorm2 = v.reduce((s, x) => s + x * x, 0);
    const refl = { v, at: k, vnorm2 };
    if (vnorm2 > 0) {
      reflectors.push(refl);
      applyReflector(A, v, k, j, vnorm2);
      applyToVector(qty, v, k, vnorm2);
    }
    kept.push({ j, row: k });
    k++;
  }
  const rank = kept.length;
  // Back-solve R beta = (Q'y)[0..rank).
  const beta = new Array(rank).fill(0);
  for (let a = rank - 1; a >= 0; a--) {
    const { j, row } = kept[a];
    let s = qty[row];
    for (let b = a + 1; b < rank; b++) s -= A[row][kept[b].j] * beta[b];
    beta[a] = s / A[row][j];
  }
  const coef = new Array(p).fill(NA);
  kept.forEach(({ j }, a) => { coef[j] = beta[a]; });
  const fitted = X.map((row) => kept.reduce((s, { j }, a) => s + row[j] * beta[a], 0));
  const R = kept.map(({ row }) => kept.map(({ j }) => A[row][j]));
  return { coef, aliased, rank, fitted, residuals: y.map((yi, i) => yi - fitted[i]), R, keptCols: kept.map((x) => x.j), effects: qty };
}

function applyReflector(A, v, at, j, vnorm2 = null) {
  const n2 = vnorm2 ?? v.reduce((s, x) => s + x * x, 0);
  if (!n2) return;
  let dot = 0;
  for (let i = at; i < A.length; i++) dot += v[i] * A[i][j];
  const f = (2 * dot) / n2;
  for (let i = at; i < A.length; i++) A[i][j] -= f * v[i];
}

function applyToVector(y, v, at, n2) {
  let dot = 0;
  for (let i = at; i < y.length; i++) dot += v[i] * y[i];
  const f = (2 * dot) / n2;
  for (let i = at; i < y.length; i++) y[i] -= f * v[i];
}

// ---------------------------------------------------------------------------
// lm()
// ---------------------------------------------------------------------------

const LM_ARGS = ['formula', 'data'];

/**
 * lm() takes its arguments unevaluated, so it can recognise two beginner slips
 * before R would only say "object not found": a comma where the tilde belongs
 * (`lm(godziny, wiek, data = a)`) and an argument the trainer does not know.
 */
function fnLm({ args: raw, env, node, interp }) {
  const given = raw.filter((a) => !a.empty && a.value);
  for (const a of given) {
    if (a.name && !LM_ARGS.includes(a.name)) throw new RError('err.lmArgUnsupported', a.value, { name: a.name });
  }
  const unnamed = given.filter((a) => !a.name);
  const isFormulaNode = (n) => n && (n.type === 'Formula' || (n.type === 'Binary' && n.op === '~'));
  const lead = given.find((a) => a.name === 'formula') || unnamed[0];
  if (lead && !isFormulaNode(lead.value) && unnamed.length >= 2 && !given.some((a) => a.name === 'formula')) {
    const second = unnamed[1].value;
    const dataNode = given.find((a) => a.name === 'data')?.value;
    if (dataNode && lead.value.type === 'Ident' && second.type === 'Ident') {
      throw new RError('err.lmCommaNotTilde', lead.value, { left: lead.value.name, right: second.name, data: deparse(dataNode) });
    }
  }
  const args = given.map((a) => ({ name: a.name, value: interp.eval(a.value, env), node: a.value }));
  const real = args;
  const positional = real.filter((a) => !a.name);
  const pick = (name) => real.find((a) => a.name === name) || positional.shift();
  const fArg = pick('formula');
  const dArg = pick('data');
  if (positional.length) throw new RError('err.lmArgUnsupported', positional[0].node || node, { name: deparse(positional[0].node) });
  if (!fArg || !isFormula(fArg.value)) throw new RError('err.lmNotFormula', fArg?.node || node);
  const fnode = fArg.value.formula.node;
  if (fnode.type !== 'Binary') throw new RError('err.lmNoResponse', fnode);
  let data = null;
  if (dArg) {
    data = dArg.value;
    if (!isDataFrame(data)) throw new RError('err.lmDataNotFrame', dArg.node || node, { code: deparse(dArg.node) });
  }
  const callText = `lm(formula = ${deparse(fArg.node)}${dArg ? `, data = ${deparse(dArg.node)}` : ''})`;
  return fitModel({ fnode, formulaEnv: fArg.value.formula.env || env, data, dataCode: dArg ? deparse(dArg.node) : null, callText, node, interp });
}

/** Everything lm() does after its arguments are sorted out. Exported for tests. */
export function fitModel({ fnode, formulaEnv, data, dataCode, callText, node, interp }) {
  const mask = maskOf(data, formulaEnv);
  const responseCode = deparse(fnode.left);
  // Without data = the columns are not in sight. R says only "object not found".
  const evalIn = (expr) => {
    try {
      return interp.eval(expr, mask);
    } catch (e) {
      if (!data && e.key === 'err.objNotFound') {
        const table = tableWithColumn(formulaEnv, e.params?.name);
        if (table) throw new RError('err.lmNoData', expr, { name: e.params.name, table, formula: deparse(fnode) });
      }
      throw e;
    }
  };
  const response = evalIn(fnode.left);
  if (!isAtomic(response) || isFactor(response) || !['double', 'integer'].includes(response.type)) {
    throw new RError('err.lmResponseNotNumber', fnode.left, { code: responseCode });
  }
  const n = rLength(response);

  const termNodes = splitPlus(fnode.right);
  termNodes.forEach(checkTerm);
  const terms = [];
  for (const tn of termNodes) {
    if (tn.type === 'Num') continue;                 // `y ~ 1`, `y ~ x + 1`: the intercept, always there
    const code = deparse(tn);
    if (terms.some((x) => x.code === code)) continue;
    const v = evalIn(tn);
    if (!isAtomic(v)) throw new RError('err.lmTermNotColumn', tn, { term: code });
    if (rLength(v) !== n) throw new RError('err.lmLengths', tn, { term: code });
    const numeric = !isFactor(v) && (v.type === 'double' || v.type === 'integer');
    terms.push(numeric
      ? { code, node: tn, kind: 'numeric', values: v.values }
      : { code, node: tn, kind: 'factor', ...asCategories(v) });
  }

  // na.omit: a row with a gap in any variable of the model is left out.
  const rowNames = data ? rowNamesOf(data) : Array.from({ length: n }, (_, i) => String(i + 1));
  const used = [];
  const dropped = [];
  for (let i = 0; i < n; i++) {
    const gap = isNA(response.values[i]) || Number.isNaN(response.values[i]) || terms.some((tm) => isNA(tm.values[i]));
    (gap ? dropped : used).push(i);
  }
  if (!used.length) throw new RError('err.lmNoRows', node);

  // A category keeps only the levels present in the rows used (drop.unused.levels).
  for (const tm of terms) {
    if (tm.kind !== 'factor') continue;
    const present = new Set(used.map((i) => tm.values[i]));
    tm.levels = tm.levels.filter((l) => present.has(l));
  }

  const colNames = ['(Intercept)'];
  const colTerm = [-1];
  terms.forEach((tm, k) => {
    if (tm.kind === 'numeric') { colNames.push(tm.code); colTerm.push(k); }
    else tm.levels.slice(1).forEach((l) => { colNames.push(`${tm.code}${l}`); colTerm.push(k); });
  });
  const X = used.map((i) => {
    const row = [1];
    for (const tm of terms) {
      if (tm.kind === 'numeric') row.push(tm.values[i]);
      else tm.levels.slice(1).forEach((l) => row.push(tm.values[i] === l ? 1 : 0));
    }
    return row;
  });
  const y = used.map((i) => response.values[i]);
  const fit = qrFit(X, y);

  const usedNames = used.map((i) => rowNames[i]);
  const named = (vals, names) => mkDouble(vals, { names: mkCharacter(names) });
  const modelCols = [mkDouble(y), ...terms.map((tm) => (tm.kind === 'numeric'
    ? mkDouble(used.map((i) => tm.values[i]))
    : makeFactor(mkCharacter(used.map((i) => tm.values[i])), { levels: mkCharacter(tm.levels) })))];
  const model = mkList(modelCols, {
    names: mkCharacter([responseCode, ...terms.map((tm) => tm.code)]),
    class: mkCharacter(['data.frame']),
    'row.names': rowNamesValue(usedNames),
  });
  const dfResidual = used.length - fit.rank;
  const elements = [
    ['coefficients', named(fit.coef, colNames)],
    ['residuals', named(fit.residuals, usedNames)],
    ['rank', mkInteger([fit.rank])],
    ['fitted.values', named(fit.fitted, usedNames)],
    ['df.residual', mkInteger([dfResidual])],
    ['call', mkCallText(callText)],
    ['model', model],
  ];
  const value = mkList(elements.map((e) => e[1]), {
    names: mkCharacter(elements.map((e) => e[0])),
    class: mkCharacter(['lm']),
  });
  return Object.freeze({
    ...value,
    lm: Object.freeze({
      callText,
      responseCode,
      dataCode,
      formulaNode: fnode,
      formulaEnv,
      terms: terms.map(({ code, node: tn, kind, levels }) => ({ code, node: tn, kind, levels: levels || null })),
      colNames,
      colTerm,
      X,
      y,
      fit,
      used,
      dropped,
      rowNames,
      n: used.length,
      dfResidual,
    }),
  });
}

/** The first table in sight that has a column of this name. */
function tableWithColumn(env, name) {
  for (let e = env; e && e.role !== 'base'; e = e.parent) {
    for (const [key, v] of e.vars) {
      if (isDataFrame(v) && (getNames(v)?.values || []).map(String).includes(name)) return key;
    }
  }
  return null;
}

function rowNamesOf(df) {
  const rn = getAttr(df, 'row.names');
  const n = nrowOf(df);
  if (!rn || rLength(rn) !== n) return Array.from({ length: n }, (_, i) => String(i + 1));
  return rn.values.map(String);
}

function rowNamesValue(names) {
  const ints = names.every((s) => /^\d+$/.test(s));
  return ints ? mkInteger(names.map(Number)) : mkCharacter(names);
}

// ---------------------------------------------------------------------------
// what is read from a model
// ---------------------------------------------------------------------------

const element = (m, name) => {
  const names = getNames(m).values;
  return m.values[names.indexOf(name)];
};

function needModel(v, fname, node) {
  if (!isModel(v)) throw new RError('err.needModel', node, { fname });
  return v;
}

/** predict(): the line read at new values of the terms. */
function fnPredict({ args, env, node, interp }) {
  const real = args.filter((a) => !a.empty);
  const positional = real.filter((a) => !a.name);
  const objArg = real.find((a) => a.name === 'object') || positional.shift();
  const m = needModel(objArg?.value, 'predict', node);
  for (const a of real) {
    if (a.name && !['object', 'newdata'].includes(a.name)) throw new RError('err.predictArgUnsupported', a.node || node, { name: a.name });
  }
  const ndArg = real.find((a) => a.name === 'newdata') || positional.shift();
  if (!ndArg) return element(m, 'fitted.values');
  const nd = ndArg.value;
  if (!isDataFrame(nd)) throw new RError('err.predictNewdata', ndArg.node || node, { code: deparse(ndArg.node) });
  const info = m.lm;
  const mask = maskOf(nd, info.formulaEnv);
  const n = nrowOf(nd);
  const ndNames = (getNames(nd)?.values || []).map(String);
  const cols = info.terms.map((tm) => {
    if (tm.node.type === 'Ident' && !ndNames.includes(tm.node.name)) {
      throw new RError('err.predictMissingColumn', ndArg.node || node, { term: tm.node.name, code: deparse(ndArg.node) });
    }
    const v = interp.eval(tm.node, mask);
    if (!isAtomic(v)) throw new RError('err.lmTermNotColumn', tm.node, { term: tm.code });
    const full = rLength(v) === n ? v : rLength(v) === 1 ? mkAtomic(v.type, Array(n).fill(v.values[0]), v.attributes) : null;
    if (!full) throw new RError('err.lmLengths', tm.node, { term: tm.code });
    if (tm.kind === 'numeric') {
      if (isFactor(full) || full.type === 'character') throw new RError('err.predictTermType', tm.node, { term: tm.code });
      return full.values;
    }
    const chr = isFactor(full) ? factorToCharacter(full) : coerceVector(full, 'character');
    return chr.values.map((x) => {
      if (isNA(x)) return NA;
      if (!tm.levels.includes(String(x))) throw new RError('err.predictNewLevel', tm.node, { term: tm.code, level: String(x) });
      return String(x);
    });
  });
  const coef = element(m, 'coefficients').values;
  const out = [];
  for (let i = 0; i < n; i++) {
    let s = isNA(coef[0]) ? 0 : coef[0];
    let gap = false;
    let c = 1;
    info.terms.forEach((tm, k) => {
      const x = cols[k][i];
      if (isNA(x)) { gap = true; return; }
      if (tm.kind === 'numeric') { if (!isNA(coef[c])) s += coef[c] * x; c++; }
      else tm.levels.slice(1).forEach((l) => { if (!isNA(coef[c]) && x === l) s += coef[c]; c++; });
    });
    out.push(gap ? NA : s);
  }
  return mkDouble(out, { names: mkCharacter(rowNamesOf(nd)) });
}

/** cor(x, y): Pearson's correlation of two numeric vectors. */
function fnCor({ args, node }) {
  const real = args.filter((a) => !a.empty);
  const positional = real.filter((a) => !a.name);
  const xArg = real.find((a) => a.name === 'x') || positional.shift();
  const yArg = real.find((a) => a.name === 'y') || positional.shift();
  const use = real.find((a) => a.name === 'use');
  const method = real.find((a) => a.name === 'method');
  if (method) {
    const mm = isAtomic(method.value) ? String(method.value.values[0]) : '';
    if (mm !== 'pearson') throw new RError('err.corMethod', method.node || node, { method: mm });
  }
  if (!xArg) throw new RError('err.corNeedsTwo', node);
  if (isDataFrame(xArg.value) || (yArg && isDataFrame(yArg.value))) throw new RError('err.corTable', node);
  if (!yArg) throw new RError('err.corNeedsTwo', node);
  const num = (a) => {
    const v = a.value;
    if (!isAtomic(v) || isFactor(v) || v.type === 'character') throw new RError('err.corNotNumeric', a.node || node, { code: deparse(a.node) });
    return coerceVector(v, 'double').values;
  };
  const x = num(xArg);
  const y = num(yArg);
  if (x.length !== y.length) throw new RError('err.corLengths', node, { nx: x.length, ny: y.length });
  const useMode = use && isAtomic(use.value) ? String(use.value.values[0]) : 'everything';
  const USES = ['everything', 'all.obs', 'complete.obs', 'na.or.complete', 'pairwise.complete.obs'];
  if (!USES.includes(useMode)) throw new RError('err.corUse', use.node || node, { use: useMode });
  const pairs = [];
  for (let i = 0; i < x.length; i++) {
    const gap = isNA(x[i]) || isNA(y[i]);
    if (gap) {
      if (useMode === 'everything') return mkDouble([NA]);
      if (useMode === 'all.obs') throw new RError('err.corAllObs', node);
      continue;
    }
    pairs.push([x[i], y[i]]);
  }
  if (pairs.length < 2) return mkDouble([NA]);
  const mx = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
  const my = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
  let sxy = 0; let sxx = 0; let syy = 0;
  for (const [a, b] of pairs) { sxy += (a - mx) * (b - my); sxx += (a - mx) ** 2; syy += (b - my) ** 2; }
  if (!sxx || !syy) return mkDouble([NA]);
  return mkDouble([sxy / Math.sqrt(sxx * syy)]);
}

export function registerModels(reg) {
  reg('lm', fnLm, { special: true });
  reg('coef', ({ args, node }) => element(needModel(args[0]?.value, 'coef', node), 'coefficients'));
  reg('coefficients', ({ args, node }) => element(needModel(args[0]?.value, 'coefficients', node), 'coefficients'));
  for (const name of ['fitted', 'fitted.values']) reg(name, ({ args, node }) => element(needModel(args[0]?.value, name, node), 'fitted.values'));
  for (const name of ['residuals', 'resid']) reg(name, ({ args, node }) => element(needModel(args[0]?.value, name, node), 'residuals'));
  reg('nobs', ({ args, node }) => mkInteger([needModel(args[0]?.value, 'nobs', node).lm.n]));
  reg('predict', fnPredict);
  reg('cor', fnCor);
}
