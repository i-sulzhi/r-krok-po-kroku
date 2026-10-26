/**
 * ggplot2, the part a survey report needs (syllabus topic 4, D45).
 *
 * A plot is built the way ggplot2 builds it, in two halves that stay apart:
 *
 *   1. **The object.** `ggplot()` returns a plot; `+` adds a part to it (a layer,
 *      labels, a flipped coordinate system). Nothing is drawn here.
 *   2. **The build.** `buildPlot()` turns the object into plain tables: where every
 *      bar stands, how tall it is, which colour it has, what the axes say. This is
 *      what `ggplot_build()` does in R, and it is the only thing the tests check and
 *      the only thing the renderer in `ui/viz/plot.js` reads.
 *
 * `aes()` is the reason the functions here are special builtins: `aes(x = miasto)`
 * holds the *expression* `miasto`, not a value, and it is evaluated later inside the
 * plot's data, exactly as a dplyr verb evaluates a column name.
 *
 * One deliberate difference from R: aesthetics are evaluated when a layer is added,
 * not when the plot is printed. A misspelt column therefore fails at the `+`, which
 * is where a student is looking; in R it fails at print time with the same message.
 */

import { deparse } from '../deparse.js';
import {
  NA, isNA, mkAtomic, mkInteger, mkDouble, mkCharacter,
  isNull, isAtomic, rLength, getAttr, setAttr, isFactor, isDataFrame, getNames, isFunction,
} from '../rvalue.js';
import { RError, coerceVector } from '../coerce.js';
import { factorToCharacter } from '../arith.js';
import { makeDataFrame, makeFactor } from './structures.js';
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

/** A plot: data, a mapping, and the parts added so far. */
const mkPlot = (gg) => classed(['gg', 'ggplot'], { gg: Object.freeze(gg) });
/** Something `+` can add to a plot: a layer, labels, a coordinate system, a theme. */
const mkPart = (part) => classed(['ggpart'], { part: Object.freeze(part) });
/** What `aes()` returns: expressions by aesthetic, not yet evaluated. */
const mkAes = (aes) => classed(['uneval'], { aes: Object.freeze(aes) });

export const isPlot = (v) => Boolean(v && v.gg);
export const isPlotPart = (v) => Boolean(v && v.part);
export const isAes = (v) => Boolean(v && v.aes);

const AES_NAMES = ['x', 'y', 'fill', 'colour', 'label', 'group'];
const aesName = (name) => (name === 'color' || name === 'col' ? 'colour' : name);

const nrowOf = (df) => (df.values.length ? rLength(df.values[0]) : 0);
const namesOf = (df) => (getNames(df)?.values || []).map(String);

// ---------------------------------------------------------------------------
// aes()
// ---------------------------------------------------------------------------

function fnAes({ args, node }) {
  const mapping = {};
  let k = 0;
  for (const a of args) {
    if (a.empty || !a.value) continue;
    const name = a.name ? aesName(a.name) : ['x', 'y'][k++];
    if (!name) throw new RError('err.ggAesExtra', node);
    if (!AES_NAMES.includes(name)) throw new RError('err.ggAesUnknown', node, { name: a.name, known: AES_NAMES.join(', ') });
    mapping[name] = a.value;
  }
  return mkAes({ mapping, node });
}

/** Evaluate a mapping inside the plot's data: one vector per aesthetic. */
function evalMapping(mapping, data, env, interp) {
  const mask = new Env(env, { name: t('env.dataMask') });
  const names = namesOf(data);
  data.values.forEach((col, i) => mask.vars.set(names[i], col));
  const n = nrowOf(data);
  const out = {};
  for (const [name, expr] of Object.entries(mapping)) {
    const v = interp.eval(expr, mask);
    if (!isAtomic(v)) throw new RError('err.ggAesNotColumn', expr, { aes: name, code: deparse(expr) });
    const len = rLength(v);
    if (len !== n && len !== 1) throw new RError('err.ggAesLength', expr, { aes: name, code: deparse(expr), length: len, rows: n });
    // A constant in aes() is recycled like any other single value, and remembered:
    // `aes(fill = "blue")` is a column of the word "blue", not the colour blue.
    const constant = expr.type === 'Str' || expr.type === 'Num' || expr.type === 'Bool';
    const full = len === n ? v : mkAtomic(v.type, Array.from({ length: n }, () => v.values[0]), v.attributes);
    out[name] = { value: full, code: deparse(expr), constant };
  }
  return out;
}

// ---------------------------------------------------------------------------
// ggplot()
// ---------------------------------------------------------------------------

function fnGgplot({ args, env, node, interp }) {
  const real = args.filter((a) => !a.empty && a.value);
  const pick = (name, at) => real.find((a) => a.name === name) || real.filter((a) => !a.name)[at];
  const dataArg = pick('data', 0);
  if (!dataArg) throw new RError('err.ggNoData', node);
  const data = interp.eval(dataArg.value, env);
  if (isAes(data)) throw new RError('err.ggAesFirst', node);
  if (!isDataFrame(data)) throw new RError('err.ggNoData', node);
  // `ggplot(ankieta, x = plec)`: the column stands outside aes() (D63). ggplot2 lets it
  // pass and fails later, at the layer, asking for an x the student did give.
  const stray = real.find((a) => a.name && (AES_NAMES.includes(a.name) || a.name === 'color'));
  if (stray) throw new RError('err.ggAesOutsidePlot', stray.value, { name: stray.name, code: deparse(stray.value), data: deparse(dataArg.value) });
  // `ggplot(srednie, aes(...), geom_col())`: a layer passed in after a comma. It never
  // draws there; it is added after the bracket with + (D77).
  const inside = (v) => isPlotPart(v) && ['layer', 'labels', 'coord', 'theme'].includes(v.part.kind);
  const callName = (a) => (a.value.type === 'Call' && a.value.callee?.type === 'Ident' ? a.value.callee.name : 'geom_col');
  const mapArg = pick('mapping', 1);
  let mapping = {};
  if (mapArg) {
    const m = interp.eval(mapArg.value, env);
    if (inside(m)) throw new RError('err.ggLayerInside', mapArg.value, { name: callName(mapArg) });
    if (!isAes(m)) throw new RError('err.ggMappingNotAes', node);
    mapping = m.aes.mapping;
  }
  for (const a of real.filter((x) => !x.name).slice(2)) {
    if (inside(interp.eval(a.value, env))) throw new RError('err.ggLayerInside', a.value, { name: callName(a) });
  }
  return mkPlot({
    data,
    dataCode: deparse(dataArg.value),
    mapping,
    aes: evalMapping(mapping, data, env, interp),
    layers: [],
    labels: {},
    flip: false,
    theme: 'gray',
    legend: 'right',
    node,
  });
}

// ---------------------------------------------------------------------------
// layers
// ---------------------------------------------------------------------------

/** geom -> its default stat and position, and the aesthetics it cannot draw without. */
const GEOMS = {
  geom_col:  { geom: 'col',  stat: 'identity', position: 'stack',    needs: ['x', 'y'] },
  geom_bar:  { geom: 'bar',  stat: 'count',    position: 'stack',    needs: ['x'] },
  geom_text: { geom: 'text', stat: 'identity', position: 'identity', needs: ['x', 'y', 'label'] },
  // Other kinds of plot for other questions (D81): a distribution, groups compared,
  // two numbers together, a change over time.
  geom_histogram: { geom: 'hist',  stat: 'bin',      position: 'stack',    needs: ['x'] },
  geom_boxplot:   { geom: 'box',   stat: 'boxplot',  position: 'identity', needs: ['x', 'y'] },
  geom_point:     { geom: 'point', stat: 'identity', position: 'identity', needs: ['x', 'y'] },
  geom_line:      { geom: 'line',  stat: 'identity', position: 'identity', needs: ['x', 'y'] },
};

/** Settings a layer takes outside aes(): one value for every mark. */
const PARAMS = ['fill', 'colour', 'color', 'alpha', 'width', 'size', 'vjust', 'hjust', 'na.rm', 'show.legend', 'binwidth', 'bins', 'linewidth'];
const POSITIONS = ['stack', 'dodge', 'fill', 'identity'];

function geomFn(fname) {
  return ({ args, env, node, interp }) => {
    let spec = GEOMS[fname];
    const real = args.filter((a) => !a.empty && a.value);
    let mapping = {};
    let position = { kind: spec.position };
    const params = {};
    let k = 0;
    for (const a of real) {
      if (!a.name || a.name === 'mapping') {
        const v = interp.eval(a.value, env);
        // `ggplot(...) |> geom_col()`: the plot arrives where the mapping should be.
        if (isPlot(v)) throw new RError('err.ggPipe', node, { fname });
        if (!isAes(v)) throw new RError(k === 0 ? 'err.ggLayerArg' : 'err.ggLayerData', node, { fname });
        mapping = v.aes.mapping;
        k++;
        continue;
      }
      if (a.name === 'data') throw new RError('err.ggLayerData', node, { fname });
      if (a.name === 'stat') {
        const stat = String(interp.eval(a.value, env).values?.[0]);
        // `geom_bar(stat = "identity")` is what geom_col() is short for (D62): old
        // tutorials write it everywhere, and ggplot2 draws the two alike.
        if (fname === 'geom_bar' && stat === 'identity') { spec = GEOMS.geom_col; position = { kind: spec.position }; continue; }
        if (stat !== spec.stat) throw new RError('err.ggStat', node, { fname, stat });
        continue;
      }
      if (a.name === 'position') {
        const v = interp.eval(a.value, env);
        if (isPlotPart(v) && v.part.kind === 'position') position = v.part.position;
        else {
          const name = isAtomic(v) ? String(v.values[0]) : '';
          if (!POSITIONS.includes(name)) throw new RError('err.ggPosition', node, { name, known: POSITIONS.map((p) => `"${p}"`).join(', ') });
          position = { kind: name };
        }
        continue;
      }
      // `geom_text(label = n)` is the same slip as `geom_bar(fill = plec)`: a column
      // given as a setting. It belongs in aes(), and R stops on the name it cannot find (D76).
      if (!PARAMS.includes(a.name) && AES_NAMES.includes(a.name) && a.value.type === 'Ident') {
        let found = true;
        // `n` finds dplyr's function n(), which is not a value either.
        try { found = !isFunction(interp.eval(a.value, env)); } catch { found = false; }
        if (!found) throw new RError('err.ggOutsideAes', a.value, { name: a.value.name, aes: a.name, fname });
      }
      // Bins belong to the histogram, line width to the line (D81).
      const own = { binwidth: 'geom_histogram', bins: 'geom_histogram', linewidth: 'geom_line' };
      if (!PARAMS.includes(a.name) || (own[a.name] && own[a.name] !== fname)) throw new RError('err.ggLayerParam', node, { fname, name: a.name });
      // A bare column name here is the classic slip: `geom_bar(fill = plec)`. Outside
      // aes() R looks for a variable called `plec`, finds none, and says so.
      let v;
      try {
        v = interp.eval(a.value, env);
      } catch (e) {
        if (a.value.type === 'Ident') throw new RError('err.ggOutsideAes', a.value, { name: a.value.name, aes: a.name, fname });
        throw e;
      }
      if (!isAtomic(v) || rLength(v) !== 1) throw new RError('err.ggParamOne', a.value, { name: a.name, fname });
      params[aesName(a.name)] = v.values[0];
    }
    return mkPart({ kind: 'layer', fname, ...spec, position, mapping, params, node });
  };
}

function fnPosition(kind) {
  return ({ args }) => {
    const num = (name) => {
      const hit = args.find((a) => a.name === name);
      return hit && isAtomic(hit.value) ? Number(hit.value.values[0]) : null;
    };
    const first = args.find((a) => !a.name);
    const width = num('width') ?? (kind === 'dodge' && first && isAtomic(first.value) ? Number(first.value.values[0]) : null);
    return mkPart({ kind: 'position', position: { kind, width, vjust: num('vjust') } });
  };
}

// ---------------------------------------------------------------------------
// labels, coordinates, themes
// ---------------------------------------------------------------------------

const LABELS = ['title', 'subtitle', 'caption', 'x', 'y', 'fill', 'colour'];
const text1 = (v) => (v && isAtomic(v) && rLength(v) ? (isNA(v.values[0]) ? null : String(v.values[0])) : null);

function fnLabs({ args, node }) {
  const labels = {};
  for (const a of args) {
    const name = a.name ? aesName(a.name) : null;
    if (!name) throw new RError('err.ggLabsUnnamed', node);
    if (!LABELS.includes(name)) throw new RError('err.ggLabsUnknown', node, { name: a.name, known: LABELS.join(', ') });
    labels[name] = isNull(a.value) ? '' : text1(a.value) ?? '';
  }
  return mkPart({ kind: 'labels', fname: 'labs', labels, node });
}

const oneLabel = (fname, name) => ({ args, node }) => {
  const v = args.find((a) => !a.name || a.name === 'label')?.value;
  if (!v) throw new RError('err.ggLabsUnnamed', node);
  return mkPart({ kind: 'labels', fname, labels: { [name]: text1(v) ?? '' }, node });
};

const THEMES = ['theme_gray', 'theme_grey', 'theme_bw', 'theme_minimal', 'theme_classic', 'theme_light'];

function fnTheme({ args, node }) {
  const part = { kind: 'theme', fname: 'theme', node };
  for (const a of args) {
    // The one setting a report needs most often; the rest would be a fiction here.
    if (a.name !== 'legend.position') throw new RError('err.ggThemeArg', node, { name: a.name || '' });
    const where = text1(a.value);
    if (!['none', 'right', 'bottom', 'top', 'left'].includes(where)) throw new RError('err.ggLegendPosition', node, { name: where ?? '' });
    part.legend = where;
  }
  return mkPart(part);
}

// ---------------------------------------------------------------------------
// plot + part
// ---------------------------------------------------------------------------

/**
 * `+` on a plot. Called by the evaluator before ordinary arithmetic gets a chance.
 * @returns the new plot, or undefined when neither side is a plot or a part
 */
export function addToPlot(left, right, { node, env, interp }) {
  const plotish = (v) => isPlot(v) || isPlotPart(v) || isAes(v);
  if (!plotish(left) && !plotish(right)) return undefined;
  // `geom_col() + labs()` with no plot in front: the line above ended without a `+`.
  if (!isPlot(left)) throw new RError('err.ggPlusNoPlot', node);
  if (isNull(right)) return left;
  if (isPlot(right)) throw new RError('err.ggPlusPlot', node);
  if (isAes(right)) throw new RError('err.ggPlusAes', node);
  // `+ geom_col` without brackets adds the function itself, not a layer (D77).
  if (isFunction(right)) {
    const name = node?.right?.type === 'Ident' ? node.right.name : null;
    if (name) throw new RError('err.ggPlusFunction', node, { name });
  }
  if (!isPlotPart(right)) throw new RError('err.ggPlusOther', node);

  const gg = left.gg;
  const part = right.part;
  switch (part.kind) {
    case 'layer': {
      const own = evalMapping(part.mapping, gg.data, env, interp);
      const aes = { ...gg.aes, ...own };
      // Bars and labels are placed by a number. Text on y means x and y were swapped;
      // R would lay the bars down, which is rarely what the student meant.
      if (part.geom !== 'bar' && aes.y && !isNumeric(aes.y.value)) {
        // `y = "srednia"`: a column's name in quotes is text, not the column (D77).
        const cols = gg.data && isDataFrame(gg.data) ? (getNames(gg.data)?.values || []).map(String) : [];
        const word = aes.y.constant ? String(aes.y.value.values?.[0]) : null;
        if (word != null && cols.includes(word)) throw new RError('err.ggQuotedColumn', part.node, { aes: 'y', name: word });
        throw new RError(part.geom === 'box' ? 'err.ggYNotNumberBox' : 'err.ggYNotNumber', part.node, { fname: part.fname, code: aes.y.code });
      }
      // A number as fill makes a colour gradient in R, and under geom_bar() it is
      // dropped with a warning. Neither is drawn here; a report wants groups anyway.
      if (aes.fill && isNumeric(aes.fill.value) && !aes.fill.constant) {
        throw new RError('err.ggFillNumber', part.node, { code: aes.fill.code });
      }
      const missing = part.needs.filter((a) => !aes[a]);
      // geom_bar() draws along whichever axis it was given, x or y.
      if (part.geom === 'bar' && aes.x && aes.y) throw new RError('err.ggBarY', part.node, { y: aes.y.code });
      if (part.geom === 'bar' && !aes.x && aes.y) throw new RError('err.ggBarOnlyY', part.node);
      if (missing.length) {
        // One box without x works in RStudio; the trainer compares groups (D85).
        const key = part.geom === 'box' && missing.includes('x') ? 'err.ggBoxNoX'
          : part.geom === 'col' && missing.includes('y') ? 'err.ggColNoY'
          : part.geom === 'text' && missing.includes('label') ? 'err.ggTextNoLabel' : 'err.ggMissingAes';
        throw new RError(key, part.node, { fname: part.fname, missing: missing.join(', ') });
      }
      return mkPlot({ ...gg, layers: [...gg.layers, Object.freeze({ ...part, aes })] });
    }
    case 'labels':
      return mkPlot({ ...gg, labels: { ...gg.labels, ...part.labels } });
    case 'coord':
      return mkPlot({ ...gg, flip: true });
    case 'theme':
      return mkPlot({ ...gg, theme: part.theme || gg.theme, legend: part.legend || gg.legend });
    case 'facet': {
      const ev = evalMapping({ facet: part.expr }, gg.data, env, interp).facet;
      return mkPlot({ ...gg, facet: { code: ev.code, keys: keysOf(ev.value), levels: discreteLevels(ev.value), ncol: part.ncol, nrow: part.nrow } });
    }
    case 'position':
      throw new RError('err.ggPlusPosition', node);
    default:
      throw new RError('err.ggPlusOther', node);
  }
}

// ---------------------------------------------------------------------------
// the build: a plot as tables of marks
// ---------------------------------------------------------------------------

/** ggplot2's default colours for a discrete scale: evenly spaced hues, in order. */
const HUES = {
  1: ['#F8766D'],
  2: ['#F8766D', '#00BFC4'],
  3: ['#F8766D', '#00BA38', '#619CFF'],
  4: ['#F8766D', '#7CAE00', '#00BFC4', '#C77CFF'],
  5: ['#F8766D', '#A3A500', '#00BF7D', '#00B0F6', '#E76BF3'],
  6: ['#F8766D', '#B79F00', '#00BA38', '#00BFC4', '#619CFF', '#F564E3'],
  7: ['#F8766D', '#C49A00', '#53B400', '#00C094', '#00B6EB', '#A58AFF', '#FB61D7'],
  8: ['#F8766D', '#CD9600', '#7CAE00', '#00BE67', '#00BFC4', '#00A9FF', '#C77CFF', '#FF61CC'],
};
export const NA_COLOUR = '#7F7F7F';      // grey50, what ggplot2 gives a missing key
export const BAR_COLOUR = '#595959';     // grey35, a bar nobody coloured
export const INK_COLOUR = '#000000';     // black, a point or a line nobody coloured
const hues = (n) => HUES[n] || Array.from({ length: n }, (_, i) => `hsl(${Math.round(15 + (360 * i) / n)}, 65%, 60%)`);

const cmp = (a, b) => (typeof a === 'string' ? a.localeCompare(String(b), 'pl') : Number(a) - Number(b));

/**
 * The values of a discrete variable, in the order a scale shows them: a factor by
 * its levels (unused ones dropped), text alphabetically, FALSE before TRUE, and a
 * missing value last, under the name NA.
 */
function discreteLevels(col) {
  let keys;
  if (isFactor(col)) {
    const levels = getAttr(col, 'levels').values.map(String);
    const used = new Set(col.values.filter((c) => !isNA(c)));
    keys = levels.filter((_, k) => used.has(k + 1));
  } else if (col.type === 'logical') {
    keys = [false, true].filter((b) => col.values.includes(b)).map((b) => (b ? 'TRUE' : 'FALSE'));
  } else {
    keys = [...new Set(col.values.filter((v) => !isNA(v)))].sort(cmp).map(String);
  }
  if (col.values.some(isNA)) keys.push('NA');
  return keys;
}

/** One cell of a discrete variable as the key its level goes by. */
function keysOf(col) {
  const chr = isFactor(col) ? factorToCharacter(col) : col;
  return chr.values.map((v) => (isNA(v) ? 'NA' : v === true ? 'TRUE' : v === false ? 'FALSE' : String(v)));
}

const isNumeric = (col) => !isFactor(col) && (col.type === 'double' || col.type === 'integer');

/**
 * R's pretty(): about n round numbers covering [lo, hi]. A port of R_pretty() with
 * the defaults of pretty.default (min.n = n %/% 3, shrink.sml = 0.75,
 * high.u.bias = 1.5, u5.bias = .5 + 1.5 * high.u.bias). Checked against R itself
 * in test/cases-ggplot.txt.
 */
export function prettyBreaks(lo, hi, n = 5) {
  const minN = Math.floor(n / 3);
  const h = 1.5;
  const h5 = 0.5 + 1.5 * h;
  const dx = hi - lo;
  let cell;
  let small;
  if (dx === 0 && hi === 0) { cell = 1; small = true; } else {
    cell = Math.max(Math.abs(lo), Math.abs(hi));
    const U = 1 + (h5 >= 1.5 * h + 0.5 ? 1 / (1 + h) : 1.5 / (1 + h5));
    small = dx < cell * U * Math.max(1, n) * 2.220446e-16 * 3;
  }
  if (small) {
    if (cell > 10) cell = 9 + cell / 10;
    cell *= 0.75;
    if (minN > 1) cell /= minN;
  } else {
    cell = dx;
    if (n > 1) cell /= n;
  }
  if (cell < 20 * Number.MIN_VALUE) cell = 20 * Number.MIN_VALUE;
  const base = 10 ** Math.floor(Math.log10(cell));
  let unit = base;
  if (2 * base - cell < h * (cell - unit)) {
    unit = 2 * base;
    if (5 * base - cell < h5 * (cell - unit)) {
      unit = 5 * base;
      if (10 * base - cell < h * (cell - unit)) unit = 10 * base;
    }
  }
  let ns = Math.floor(lo / unit + 1e-7);
  let nu = Math.ceil(hi / unit - 1e-7);
  while (ns * unit > lo + 1e-7 * unit) ns--;
  while (nu * unit < hi - 1e-7 * unit) nu++;
  let k = Math.floor(0.5 + nu - ns);
  if (k < minN) {
    k = minN - k;
    if (ns >= 0) { nu += Math.floor(k / 2); ns -= Math.floor(k / 2) + (k % 2); } else { ns -= Math.floor(k / 2); nu += Math.floor(k / 2) + (k % 2); }
  }
  const out = [];
  for (let i = ns; i <= nu; i++) out.push(Number((i * unit).toPrecision(12)));
  return out;
}

/**
 * Build a plot: every layer as a table of marks, plus the scales they share.
 *
 * @returns {{
 *   x: {discrete: boolean, levels?: string[], range?: number[], breaks?: number[], label: string},
 *   y: {range: number[], breaks: number[], label: string},
 *   fill: null | {title: string, keys: Array<{label: string, colour: string}>},
 *   layers: Array<{geom, fname, marks: Array, stat: null|Object}>,
 *   labels: {title, subtitle, caption}, flip: boolean, theme: string, legend: string,
 *   notes: Array<{kind: string, ...}>
 * }}
 */
/**
 * facet_wrap() (D82): the same plot once per group, on shared axes, as ggplot2 does
 * by default. The plot itself is built on all rows; each panel on its own.
 */
export function buildPlot(plot) {
  const base = buildCore(plot);
  const f = plot.gg.facet;
  if (!f) return base;
  const sets = f.levels.map((lv) => new Set(f.keys.map((k, r) => (k === lv ? r : -1)).filter((r) => r >= 0)));
  const first = sets.map((allowed) => buildCore(plot, { allowed }));
  const span = (key) => {
    const ends = first.map((p) => p[key]).filter(Boolean);
    return ends.length ? [Math.min(...ends.map((e) => e[0])), Math.max(...ends.map((e) => e[1]))] : null;
  };
  const yRaw = span('yRaw');
  const xRaw = span('xRaw');
  const panels = sets.map((allowed, i) => ({ label: f.levels[i], built: buildCore(plot, { allowed, yRaw, xRaw }) }));
  return { ...base, panels, facet: { code: f.code, levels: f.levels, ...wrapDims(f.levels.length, f.ncol, f.nrow) } };
}

/** ggplot2's wrap_dims(): grDevices::n2mfrow() turned on its side. */
function wrapDims(n, ncol, nrow) {
  if (ncol && nrow) return { ncol, nrow };
  if (ncol) return { ncol, nrow: Math.ceil(n / ncol) };
  if (nrow) return { ncol: Math.ceil(n / nrow), nrow };
  const [a, b] = n <= 3 ? [n, 1] : n <= 6 ? [Math.floor((n + 1) / 2), 2] : n <= 12 ? [Math.floor((n + 2) / 3), 3] : [Math.ceil(n / Math.ceil(Math.sqrt(n))), Math.ceil(Math.sqrt(n))];
  return { ncol: a, nrow: Math.ceil(n / a) || b };
}

function buildCore(plot, opts = {}) {
  const gg = plot.gg;
  const n = nrowOf(gg.data);
  const notes = [];
  // A panel of facet_wrap() sees only its own rows (D82).
  const allowed = opts.allowed || null;
  const skip = allowed ? (r) => !allowed.has(r) : null;
  const all = gg.layers.length ? gg.layers : [];
  // With no layer yet, the plot's own mapping still sets up the axes, as in R.
  const xAes = (all.find((l) => l.aes.x) || gg).aes.x || null;
  const yAes = (all.find((l) => l.aes.y) || gg).aes.y || null;
  // Bars and boxes are coloured by fill, points and lines by colour (D81): either one
  // splits the marks into groups with a colour and a legend.
  const fillOnly = (all.find((l) => l.aes.fill) || gg).aes.fill || null;
  const colourAes = (all.find((l) => l.aes.colour) || gg).aes.colour || null;
  const linesOnly = all.length > 0 && all.every((l) => l.geom === 'point' || l.geom === 'line');
  const fillAes = linesOnly ? (colourAes || fillOnly) : fillOnly;
  const groupName = linesOnly && colourAes ? 'colour' : 'fill';

  const xDiscrete = xAes ? !isNumeric(xAes.value) : true;
  const xLevels = xAes && xDiscrete ? discreteLevels(xAes.value) : [];
  const fillLevels = fillAes ? (isNumeric(fillAes.value) ? [...new Set(fillAes.value.values.map((v) => (isNA(v) ? 'NA' : String(v))))] : discreteLevels(fillAes.value)) : [];
  const palette = hues(fillLevels.filter((l) => l !== 'NA').length);
  const colourOf = (key) => (key === 'NA' ? NA_COLOUR : palette[fillLevels.filter((l) => l !== 'NA').indexOf(key)]);
  if (fillAes?.constant) notes.push({ kind: 'constantInAes', aes: 'fill', code: fillAes.code });
  // aes(x = "plec"): one bar named plec, made of every row (D63).
  else if (xAes?.constant && typeof xAes.value.values?.[0] === 'string') notes.push({ kind: 'constantInAes', aes: 'x', code: xAes.code });

  const layers = all.map((layer, index) => {
    const a = layer.aes;
    const xKeys = xDiscrete ? keysOf(a.x.value) : null;
    const xNum = xDiscrete ? null : a.x.value.values;
    const xPos = (r) => (xDiscrete ? xLevels.indexOf(xKeys[r]) + 1 : xNum[r]);
    const groupBy = layer.geom === 'point' || layer.geom === 'line' ? (a.colour || a.fill) : a.fill;
    const fKeys = groupBy ? keysOf(groupBy.value) : null;
    const gKeys = a.group ? keysOf(a.group.value) : null;
    const key = (r) => `${xDiscrete ? xKeys[r] : xNum[r]}\u0001${fKeys ? fKeys[r] : ''}\u0001${gKeys ? gKeys[r] : ''}`;

    // --- the stat: which rows make which mark --------------------------------
    let rows = [];   // {x, xKey, fillKey, y, label, from: [rows]}
    let stat = null;
    if (layer.stat === 'bin') {
      ({ rows, stat } = statBin(layer, xNum, fKeys, n, notes, index, skip));
    } else if (layer.stat === 'boxplot') {
      ({ rows, stat } = statBoxplot(a, xDiscrete ? xKeys : null, xPos, fKeys, n, notes, index, layer, skip));
    } else if (layer.stat === 'count') {
      const by = new Map();
      const lost = [];
      for (let r = 0; r < n; r++) {
        if (skip && skip(r)) continue;
        // A number axis has no place for NA: ggplot2 drops the row with a warning (D63).
        if (!xDiscrete && isNA(xNum[r])) { lost.push(r); continue; }
        const k = key(r);
        if (!by.has(k)) by.set(k, { x: xPos(r), xKey: xDiscrete ? xKeys[r] : String(xNum[r]), fillKey: fKeys ? fKeys[r] : null, y: 0, from: [] });
        const m = by.get(k);
        m.y++;
        m.from.push(r);
      }
      rows = [...by.values()];
      stat = { kind: 'count', rowsIn: n, groups: rows.length };
      if (lost.length) notes.push({ kind: 'removed', layer: index, fname: layer.fname, rows: lost });
    } else {
      const yv = a.y.value.values;
      const lost = [];
      for (let r = 0; r < n; r++) {
        if (skip && skip(r)) continue;
        if (isNA(yv[r]) || (!xDiscrete && isNA(xNum[r]))) { lost.push(r); continue; }
        rows.push({
          x: xPos(r), xKey: xDiscrete ? xKeys[r] : String(xNum[r]), fillKey: fKeys ? fKeys[r] : null,
          y: Number(yv[r]), label: a.label ? cellText(a.label.value, r) : null, from: [r],
        });
      }
      // ggplot2 drops such rows and says so in a warning the student rarely reads.
      if (lost.length) notes.push({ kind: 'removed', layer: index, fname: layer.fname, rows: lost });
      if (layer.geom === 'col') {
        // Several rows on one x and one colour stack into one tall bar: a sum nobody asked for.
        const seen = new Map();
        rows.forEach((m) => { const k = `${m.xKey}\u0001${m.fillKey ?? ''}`; seen.set(k, (seen.get(k) || 0) + 1); });
        const piled = [...seen.values()].filter((c) => c > 1).length;
        if (piled) notes.push({ kind: 'piled', layer: index, bars: seen.size, rows: rows.length });
      }
    }
    const fillOrder = (m) => (m.fillKey == null ? 0 : fillLevels.indexOf(m.fillKey));
    rows.sort((p, q) => p.x - q.x || fillOrder(p) - fillOrder(q));

    // --- the position: where each mark ends up -------------------------------
    let pos = layer.position.kind;
    const width = layer.geom === 'hist' ? stat.binwidth : layer.geom === 'box' ? (layer.params.width ?? 0.75) : (layer.params.width ?? 0.9);
    // Text has no width of its own, so `position = "dodge"` cannot spread it: ggplot2
    // warns "Width not defined" and leaves the labels at the middle (D80).
    if (pos === 'dodge' && layer.geom === 'text' && layer.position.width == null) {
      pos = 'identity';
      notes.push({ kind: 'dodgeNoWidth', layer: index });
    }
    const byX = new Map();
    rows.forEach((m) => { if (!byX.has(m.x)) byX.set(m.x, []); byX.get(m.x).push(m); });
    for (const group of byX.values()) {
      // Points and lines stand where their numbers are; a box was placed by its stat.
      if (layer.geom === 'point' || layer.geom === 'line') {
        group.forEach((m) => { m.ymin = m.y; m.ymax = m.y; m.xmin = m.x; m.xmax = m.x; m.at = m.y; });
        continue;
      }
      if (layer.geom === 'box') {
        group.forEach((m) => { m.xmin = m.x - width / 2; m.xmax = m.x + width / 2; m.at = m.middle; });
        continue;
      }
      const total = group.reduce((s, m) => s + m.y, 0);
      if (pos === 'stack' || pos === 'fill') {
        // The first level ends up on top, so the stack reads in the legend's order.
        let base = 0;
        for (const m of [...group].reverse()) {
          const h = pos === 'fill' ? (total ? m.y / total : 0) : m.y;
          m.ymin = base;
          m.ymax = base + h;
          base += h;
          m.xmin = m.x - width / 2;
          m.xmax = m.x + width / 2;
        }
        if (layer.geom === 'text') {
          const vj = layer.position.vjust ?? 1;
          group.forEach((m) => { m.at = m.ymin + (m.ymax - m.ymin) * vj; });
        }
      } else if (pos === 'dodge') {
        // The bars of one x share its width: fewer bars there, wider bars.
        const w = (layer.position.width ?? width) / group.length;
        group.forEach((m, i) => {
          m.ymin = 0;
          m.ymax = m.y;
          m.xmin = m.x - (w * group.length) / 2 + i * w;
          m.xmax = m.xmin + w;
          m.at = m.y;
        });
      } else {
        group.forEach((m) => { m.ymin = 0; m.ymax = m.y; m.xmin = m.x - width / 2; m.xmax = m.x + width / 2; m.at = m.y; });
      }
    }
    const fixed = layer.params.fill ?? null;
    const marks = rows.map((m) => ({
      x: m.x,
      xKey: m.xKey,
      xmid: (m.xmin + m.xmax) / 2,
      xmin: m.xmin,
      xmax: m.xmax,
      y: pos === 'fill' ? m.ymax - m.ymin : m.y,
      ymin: m.ymin,
      ymax: m.ymax,
      at: m.at ?? m.ymax,
      count: layer.stat === 'count' || layer.stat === 'bin' ? m.y : null,
      fillKey: m.fillKey,
      fill: fixed != null ? String(fixed) : layer.params.colour != null && (layer.geom === 'point' || layer.geom === 'line') ? String(layer.params.colour) : m.fillKey != null ? colourOf(m.fillKey) : (layer.geom === 'point' || layer.geom === 'line') ? INK_COLOUR : BAR_COLOUR,
      label: m.label,
      from: m.from,
      ...(layer.geom === 'box' ? { lower: m.lower, middle: m.middle, upper: m.upper, outliers: m.outliers } : {}),
    }));
    return {
      geom: layer.geom, fname: layer.fname, position: pos, stat, marks,
      params: layer.params, aes: Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v.code])),
    };
  });

  // --- scales ---------------------------------------------------------------
  const tops = layers.flatMap((l) => l.marks.map((m) => (l.geom === 'text' ? m.at : Math.max(m.ymax, ...(m.outliers || [])))));
  const bottoms = layers.flatMap((l) => l.marks.map((m) => (l.geom === 'text' ? m.at : Math.min(m.ymin, ...(m.outliers || [])))));
  let yLo = bottoms.length ? Math.min(...bottoms) : 0;
  let yHi = tops.length ? Math.max(...tops) : 1;
  if (!layers.length && yAes && isNumeric(yAes.value)) {
    const ys = yAes.value.values.filter((v) => !isNA(v)).map(Number);
    if (ys.length) { yLo = Math.min(...ys); yHi = Math.max(...ys); }
  }
  if (yLo === yHi) yHi = yLo + 1;
  // Panels share one y axis: each reports its own span, and all are drawn on their union.
  const yRaw = [yLo, yHi];
  if (opts.yRaw) [yLo, yHi] = opts.yRaw;
  // A label lifted above its bar (vjust below 0) needs room, or the tallest one is
  // cut at the panel's edge. ggplot2 does cut it; a little headroom is kinder here.
  if (layers.some((l) => l.geom === 'text' && (l.params.vjust ?? 0.5) < 0)) yHi += (yHi - yLo) * 0.07;
  const pad = (yHi - yLo) * 0.05;
  const yRange = [yLo - pad, yHi + pad];
  let yBreaks = prettyBreaks(yLo, yHi).filter((b) => b >= yRange[0] - 1e-9 && b <= yRange[1] + 1e-9);
  // Two places where ggplot2's own break rule is known to differ from pretty(): a
  // count never gets a tick at 0.5, and shares are marked in quarters.
  const whole = layers.length > 0 && layers.every((l) => l.marks.every((m) => Number.isInteger(m.ymax) && Number.isInteger(m.ymin)));
  if (whole && yBreaks.some((b) => !Number.isInteger(b))) yBreaks = yBreaks.filter(Number.isInteger);
  if (layers.some((l) => l.position === 'fill')) yBreaks = [0, 0.25, 0.5, 0.75, 1];

  let x;
  let xRaw = null;
  if (xDiscrete) {
    x = { discrete: true, levels: xLevels, range: [0.4, Math.max(xLevels.length, 1) + 0.6] };
  } else {
    const xs = layers.flatMap((l) => l.marks.flatMap((m) => [m.xmin, m.xmax]));
    const raw = xAes.value.values.filter((v) => !isNA(v)).map(Number);
    let lo = xs.length ? Math.min(...xs) : Math.min(...raw);
    let hi = xs.length ? Math.max(...xs) : Math.max(...raw);
    xRaw = [lo, hi];
    if (opts.xRaw) [lo, hi] = opts.xRaw;
    const p = (hi - lo || 1) * 0.05;
    let xBreaks = prettyBreaks(Math.min(...raw), Math.max(...raw)).filter((b) => b >= lo - p && b <= hi + p);
    // Whole numbers (ratings 1-5) get no tick at 2.5: ggplot2's breaks fall on the
    // integers here, and a half rating means nothing (D80).
    if (raw.every(Number.isInteger) && xBreaks.some((b) => !Number.isInteger(b))) xBreaks = xBreaks.filter(Number.isInteger);
    x = { discrete: false, range: [lo - p, hi + p], breaks: xBreaks };
  }

  const counted = layers.some((l) => l.stat?.kind === 'count' || l.stat?.kind === 'bin');
  const filled = layers.some((l) => l.position === 'fill');
  const lab = gg.labels;
  const pickLabel = (name, fallback) => (name in lab ? lab[name] : fallback);
  const showLegend = fillAes && layers.some((l) => l.marks.some((m) => m.fillKey != null) && l.params.fill == null && l.params['show.legend'] !== false);

  return {
    x: { ...x, label: pickLabel('x', xAes ? xAes.code : '') },
    y: {
      range: yRange, breaks: yBreaks, label: pickLabel('y', yAes ? yAes.code : counted ? 'count' : ''), share: filled,
      // Only x is mapped and nothing is drawn yet: R shows no y axis at all.
      empty: !layers.length && !yAes,
    },
    fill: showLegend && gg.legend !== 'none'
      ? { title: pickLabel(groupName, fillAes.code), keys: fillLevels.map((label) => ({ label, colour: colourOf(label) })), aes: groupName }
      : null,
    layers,
    labels: { title: lab.title || null, subtitle: lab.subtitle || null, caption: lab.caption || null },
    set: Object.keys(lab),
    flip: gg.flip,
    theme: gg.theme,
    legend: gg.legend,
    notes,
    rows: n,
    yRaw,
    xRaw,
  };
}

/**
 * stat_bin() as ggplot2 computes it (D81): bins of `binwidth` centred on its multiples
 * (boundary = binwidth / 2), closed on the right, the lowest one closed on the left too.
 * Without binwidth, 30 bins over the range and a note, as ggplot2 says in its message.
 */
function statBin(layer, xNum, fKeys, n, notes, index, skip = null) {
  // Every panel takes its bins from all the rows, so the bins line up across panels.
  const all = [];
  const lost = [];
  for (let r = 0; r < n; r++) { if (isNA(xNum[r])) { if (!skip || !skip(r)) lost.push(r); } else all.push(r); }
  if (lost.length) notes.push({ kind: 'removed', layer: index, fname: layer.fname, rows: lost });
  const xs = skip ? all.filter((r) => !skip(r)) : all;
  const vals = all.map((r) => Number(xNum[r]));
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  let width = layer.params.binwidth != null ? Number(layer.params.binwidth) : null;
  let boundary;
  if (width == null) {
    // bins = 30 by default: the first bin centred on the smallest value, as in ggplot2.
    const bins = layer.params.bins != null ? Number(layer.params.bins) : 30;
    if (layer.params.bins == null) notes.push({ kind: 'bins30', layer: index });
    width = hi > lo ? (hi - lo) / (bins - 1) : 1;
    boundary = lo - width / 2;
  } else {
    boundary = width / 2;
  }
  const fuzz = 1e-7 * width;
  const origin = boundary + Math.floor((lo - boundary) / width) * width;
  const edges = [origin];
  while (edges[edges.length - 1] < hi - fuzz) edges.push(edges[edges.length - 1] + width);
  if (edges.length < 2) edges.push(origin + width);
  // Which bin: (a, b], and the first bin takes its left edge as well.
  const binOf = (v) => {
    for (let b = 0; b < edges.length - 1; b++) {
      const left = edges[b] - (b === 0 ? fuzz : -fuzz);
      if (v > left && v <= edges[b + 1] + fuzz) return b;
    }
    return edges.length - 2;
  };
  const groups = fKeys ? [...new Set(xs.map((r) => fKeys[r]))] : [null];
  const rows = [];
  for (let b = 0; b < edges.length - 1; b++) {
    for (const g of groups) {
      const from = xs.filter((r) => binOf(Number(xNum[r])) === b && (g == null || fKeys[r] === g));
      const mid = (edges[b] + edges[b + 1]) / 2;
      rows.push({ x: mid, xKey: `${Number(edges[b].toPrecision(4))}-${Number(edges[b + 1].toPrecision(4))}`, fillKey: g, y: from.length, from });
    }
  }
  return { rows, stat: { kind: 'bin', binwidth: width, edges, rowsIn: xs.length, whole: vals.every(Number.isInteger) } };
}

/** R's quantile(type = 7). */
function quantile7(sorted, p) {
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  return sorted[lo] + (h - lo) * ((sorted[Math.min(lo + 1, sorted.length - 1)]) - sorted[lo]);
}

/**
 * stat_boxplot() as ggplot2 computes it (D81): quartiles of type 7, whiskers to the
 * furthest value within 1.5 IQR of the box, the values beyond drawn as outliers.
 */
function statBoxplot(a, xKeys, xPos, fKeys, n, notes, index, layer, skip = null) {
  const yv = a.y.value.values;
  const lost = [];
  const by = new Map();
  for (let r = 0; r < n; r++) {
    if (skip && skip(r)) continue;
    if (isNA(yv[r])) { lost.push(r); continue; }
    const k = `${xKeys ? xKeys[r] : ''}\u0001${fKeys ? fKeys[r] : ''}`;
    if (!by.has(k)) by.set(k, { x: xPos(r), xKey: xKeys ? xKeys[r] : '', fillKey: fKeys ? fKeys[r] : null, from: [] });
    by.get(k).from.push(r);
  }
  if (lost.length) notes.push({ kind: 'removed', layer: index, fname: layer.fname, rows: lost });
  const rows = [...by.values()].map((g) => {
    const ys = g.from.map((r) => Number(yv[r])).sort((p, q) => p - q);
    const q1 = quantile7(ys, 0.25);
    const med = quantile7(ys, 0.5);
    const q3 = quantile7(ys, 0.75);
    const iqr = q3 - q1;
    const inside = ys.filter((v) => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
    const outliers = ys.filter((v) => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr);
    return { ...g, y: med, ymin: Math.min(...inside), ymax: Math.max(...inside), lower: q1, middle: med, upper: q3, outliers };
  });
  return { rows, stat: { kind: 'boxplot', rowsIn: n - lost.length } };
}

function cellText(col, r) {
  const v = isFactor(col) ? factorToCharacter(col).values[r] : col.values[r];
  if (isNA(v)) return 'NA';
  if (typeof v === 'number') return String(Number(v.toPrecision(7)));
  return v === true ? 'TRUE' : v === false ? 'FALSE' : String(v);
}

/**
 * Do two plots show the same thing? Marks are compared by where they stand and how
 * tall they are, not by the code that made them: `geom_bar()` on raw answers and
 * `geom_col()` on a count table are one picture.
 *
 * Labels count only where the reference set them with labs(): a task that does not
 * ask for a title does not fail for one, and an answer may carry labels of its own.
 * The reference is the second plot, as everywhere `valuesEqual(answer, goal)` is called.
 */
export function plotsEqual(a, b, opts = {}) {
  return facetsAlike(buildPlot(a), buildPlot(b), builtEqual, opts);
}

/**
 * Two faceted plots are alike when they have the same panels and each pair of panels
 * is alike; a faceted plot and a plain one are not (D82).
 */
function facetsAlike(A, B, alike, opts) {
  if (!A.panels && !B.panels) return alike(A, B, opts);
  if (!A.panels || !B.panels) return false;
  if (A.panels.map((p) => p.label).join('\u0001') !== B.panels.map((p) => p.label).join('\u0001')) return false;
  return A.panels.every((p, i) => alike(p.built, B.panels[i].built, opts));
}

function builtEqual(A, B, { tolerance = 1e-6 } = {}) {
  const near = (p, q) => Math.abs(p - q) <= tolerance * Math.max(1, Math.abs(p), Math.abs(q));
  if (A.flip !== B.flip || A.layers.length !== B.layers.length) return false;
  if (A.x.discrete !== B.x.discrete) return false;
  if (A.x.discrete && A.x.levels.join('\u0001') !== B.x.levels.join('\u0001')) return false;
  const shape = (g) => (g === 'bar' ? 'col' : g);
  for (let i = 0; i < A.layers.length; i++) {
    const p = A.layers[i];
    const q = B.layers[i];
    if (shape(p.geom) !== shape(q.geom) || p.marks.length !== q.marks.length) return false;
    for (let k = 0; k < p.marks.length; k++) {
      const m = p.marks[k];
      const w = q.marks[k];
      if (!near(m.xmin, w.xmin) || !near(m.xmax, w.xmax) || !near(m.ymin, w.ymin) || !near(m.ymax, w.ymax)) return false;
      if ((m.fillKey ?? '') !== (w.fillKey ?? '') || m.fill !== w.fill) return false;
      if (p.geom === 'text' && (m.label !== w.label || !near(m.at, w.at))) return false;
      if (p.geom === 'box' && (!near(m.lower, w.lower) || !near(m.middle, w.middle) || !near(m.upper, w.upper))) return false;
    }
  }
  for (const name of B.set) {
    const of = (P) => (name === 'x' ? P.x.label : name === 'y' ? P.y.label : name === 'fill' ? P.fill?.title ?? '' : P.labels[name] ?? '');
    if (of(A) !== of(B)) return false;
  }
  return true;
}

/**
 * The same answer, decorated (D62). Every layer of `b`, the goal, must be drawn by a
 * layer of `a` with the same marks, in the same order of categories; the labels the
 * goal set must match. What `a` may add: a fixed colour, a colour where the goal has
 * none, a flip, a theme, more layers (n written on the bars). A goal that colours by
 * a column still needs those groups; a bar may be narrower or wider. A label may
 * wrap the goal's value in words:
 * "n = 4" for 4, as the report exercise itself teaches with paste0() (D76).
 */
export function plotsMatch(a, b, opts = {}) {
  return facetsAlike(buildPlot(a), buildPlot(b), builtMatch, opts);
}

function builtMatch(A, B, { tolerance = 1e-6 } = {}) {
  const near = (p, q) => Math.abs(p - q) <= tolerance * Math.max(1, Math.abs(p), Math.abs(q));
  if (A.x.discrete !== B.x.discrete) return false;
  if (A.x.discrete && A.x.levels.join('\u0001') !== B.x.levels.join('\u0001')) return false;
  const shape = (g) => (g === 'bar' ? 'col' : g);
  // Layers keep their order: text written before the bars lies under them.
  let last = -1;
  for (const q of B.layers) {
    const grouped = q.marks.some((w) => w.fillKey != null);
    const same = (p) => shape(p.geom) === shape(q.geom) && p.marks.length === q.marks.length && p.marks.every((m, k) => {
      const w = q.marks[k];
      // Bars meet by their centre: a width of 0.5 is a decoration, not another answer (D78).
      const mid = (k) => (k.xmin + k.xmax) / 2;
      if (!near(mid(m), mid(w)) || !near(m.ymin, w.ymin) || !near(m.ymax, w.ymax)) return false;
      if (grouped && (m.fillKey ?? '') !== (w.fillKey ?? '')) return false;
      if (q.geom === 'box' && (!near(m.lower, w.lower) || !near(m.middle, w.middle) || !near(m.upper, w.upper))) return false;
      return q.geom !== 'text' || (sameLabel(m.label, w.label) && near(m.at, w.at));
    });
    const hit = A.layers.findIndex((p, i) => i > last && same(p));
    if (hit < 0) return false;
    last = hit;
  }
  for (const name of B.set) {
    const of = (P) => (name === 'x' ? P.x.label : name === 'y' ? P.y.label : name === 'fill' ? P.fill?.title ?? '' : P.labels[name] ?? '');
    if (of(A) !== of(B)) return false;
  }
  return true;
}

/** The goal's label, alone or as a whole word in the answer's: "n = 4" has 4, "40" has not. */
function sameLabel(got, want) {
  if (got === want) return true;
  const g = String(got ?? '');
  const w = String(want ?? '');
  if (!w) return false;
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}.,])${esc}($|[^\\p{L}\\p{N}.,])`, 'u').test(g);
}

/**
 * facet_wrap(~ plec) (D82): the variable after ~, or in vars(), or as text. A bare
 * name is the classic slip: ggplot2 would look for an object called plec.
 */
function fnFacetWrap({ args, env, node, interp }) {
  const real = args.filter((a) => !a.empty && a.value);
  const first = real.find((a) => !a.name || a.name === 'facets');
  if (!first) throw new RError('err.ggFacetNone', node);
  let expr = first.value;
  if (expr.type === 'Formula' && expr.rhs) expr = expr.rhs;
  else if (expr.type === 'Call' && expr.callee?.type === 'Ident' && expr.callee.name === 'vars' && expr.args?.[0]) expr = expr.args[0].value;
  else if (expr.type === 'Str') expr = { type: 'Ident', name: expr.value, span: expr.span };
  else throw new RError('err.ggFacetTilde', first.value, { code: deparse(first.value) });
  const num = (name) => { const a = real.find((x) => x.name === name); return a ? Number(interp.eval(a.value, env).values[0]) : null; };
  return mkPart({ kind: 'facet', fname: 'facet_wrap', expr, ncol: num('ncol'), nrow: num('nrow'), node });
}

// ---------------------------------------------------------------------------
// layer_data(): the build as a table, which is how the tests look at it
// ---------------------------------------------------------------------------

function fnLayerData({ args, node }) {
  const plot = args.find((a) => !a.name || a.name === 'plot')?.value;
  if (!isPlot(plot)) throw new RError('err.ggLayerDataArg', node);
  const iArg = args.filter((a) => !a.name)[1]?.value ?? args.find((a) => a.name === 'i')?.value;
  const i = iArg ? Number(iArg.values[0]) : 1;
  const built = buildPlot(plot);
  const layer = built.layers[i - 1];
  if (!layer) throw new RError('err.ggNoLayer', node, { i, n: built.layers.length });
  // With facets, the marks of every panel in turn, and the panel's number, as in ggplot2.
  const m = built.panels ? built.panels.flatMap((p) => p.built.layers[i - 1].marks) : layer.marks;
  const panelOf = built.panels ? built.panels.flatMap((p, k) => p.built.layers[i - 1].marks.map(() => k + 1)) : null;
  const cols = [
    ['x', mkDouble(m.map((k) => k.x))],
    // As in ggplot2: for a stacked bar `y` is where its top stands, not its own height.
    ['y', mkDouble(m.map((k) => (layer.geom === 'text' ? k.at : k.ymax)))],
  ];
  if (layer.stat?.kind === 'count' || layer.stat?.kind === 'bin') cols.push(['count', mkDouble(m.map((k) => k.count))]);
  if (layer.geom === 'box') {
    cols.push(['lower', mkDouble(m.map((k) => k.lower))], ['middle', mkDouble(m.map((k) => k.middle))], ['upper', mkDouble(m.map((k) => k.upper))]);
  }
  if (layer.geom !== 'text') {
    cols.push(['ymin', mkDouble(m.map((k) => k.ymin))], ['ymax', mkDouble(m.map((k) => k.ymax))],
      ['xmin', mkDouble(m.map((k) => k.xmin))], ['xmax', mkDouble(m.map((k) => k.xmax))]);
  } else {
    cols.push(['label', mkCharacter(m.map((k) => k.label ?? NA))]);
  }
  cols.push(['fill', mkCharacter(m.map((k) => k.fill))]);
  if (panelOf) cols.push(['PANEL', mkDouble(panelOf)]);
  return makeDataFrame(cols.map((c) => c[1]), cols.map((c) => c[0]));
}

// ---------------------------------------------------------------------------
// the order of bars: forcats, and base R's reorder()
// ---------------------------------------------------------------------------

const asFactor = (x) => (isFactor(x) ? x : makeFactor(x));
const relevel = (f, order) => {
  const labels = getAttr(f, 'levels').values.map(String);
  const codes = f.values.map((c) => (isNA(c) ? NA : order.indexOf(labels[c - 1]) + 1));
  return setAttr(setAttr(mkInteger(codes), 'levels', mkCharacter(order)), 'class', mkCharacter(['factor']));
};
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Levels put in the order of a number summarised per level. Ties keep their order.
 * The two functions differ on a missing number: base R's reorder() lets it spoil the
 * level's mean, and that level goes last; forcats leaves it out of the summary.
 */
function byNumber(fname, summary, { dropNA }) {
  return ({ args, node }) => {
    const plain = args.filter((a) => !a.name);
    const fArg = plain[0]?.value;
    const xArg = plain[1]?.value;
    if (!fArg || !xArg || !isAtomic(fArg) || !isAtomic(xArg)) throw new RError('err.reorderArgs', node, { fname });
    if (rLength(fArg) !== rLength(xArg)) throw new RError('err.reorderLength', node, { fname, a: rLength(fArg), b: rLength(xArg) });
    const f = asFactor(fArg);
    const x = coerceVector(xArg, 'double', { trace: null }).values;
    const labels = getAttr(f, 'levels').values.map(String);
    const desc = args.find((a) => a.name === '.desc' || a.name === 'decreasing')?.value?.values?.[0] === true;
    const score = labels.map((_, k) => {
      const mine = f.values.map((c, i) => (c === k + 1 ? x[i] : undefined)).filter((v) => v !== undefined);
      if (!dropNA && mine.some(isNA)) return Infinity;
      const known = mine.filter((v) => !isNA(v));
      return known.length ? summary(known) : Infinity;
    });
    // A level with no usable number stands last, whichever way the rest is sorted.
    const by = (p, q) => (p.s === q.s ? 0 : p.s === Infinity ? 1 : q.s === Infinity ? -1 : desc ? q.s - p.s : p.s - q.s);
    const order = labels.map((l, k) => ({ l, s: score[k], k })).sort((p, q) => by(p, q) || p.k - q.k).map((o) => o.l);
    return relevel(f, order);
  };
}

function fnFctInfreq({ args, node }) {
  const x = args.find((a) => !a.name)?.value;
  if (!x || !isAtomic(x)) throw new RError('err.fctArg', node, { fname: 'fct_infreq' });
  const f = asFactor(x);
  const labels = getAttr(f, 'levels').values.map(String);
  const counts = labels.map((_, k) => f.values.filter((c) => c === k + 1).length);
  return relevel(f, labels.map((l, k) => ({ l, c: counts[k], k })).sort((p, q) => q.c - p.c || p.k - q.k).map((o) => o.l));
}

function fnFctRev({ args, node }) {
  const x = args.find((a) => !a.name)?.value;
  if (!x || !isAtomic(x)) throw new RError('err.fctArg', node, { fname: 'fct_rev' });
  const f = asFactor(x);
  return relevel(f, getAttr(f, 'levels').values.map(String).reverse());
}

function fnFctInorder({ args, node }) {
  const x = args.find((a) => !a.name)?.value;
  if (!x || !isAtomic(x)) throw new RError('err.fctArg', node, { fname: 'fct_inorder' });
  const f = asFactor(x);
  const labels = getAttr(f, 'levels').values.map(String);
  const seen = [...new Set(f.values.filter((c) => !isNA(c)).map((c) => labels[c - 1]))];
  return relevel(f, [...seen, ...labels.filter((l) => !seen.includes(l))]);
}

function fnFctRelevel({ args, node }) {
  const plain = args.filter((a) => !a.name);
  const x = plain[0]?.value;
  if (!x || !isAtomic(x)) throw new RError('err.fctArg', node, { fname: 'fct_relevel' });
  const f = asFactor(x);
  const labels = getAttr(f, 'levels').values.map(String);
  const front = plain.slice(1).flatMap((a) => a.value.values.map(String));
  const unknown = front.filter((l) => !labels.includes(l));
  if (unknown.length) throw new RError('err.fctUnknownLevel', node, { names: unknown.join(', '), known: labels.join(', ') });
  return relevel(f, [...front, ...labels.filter((l) => !front.includes(l))]);
}

// ---------------------------------------------------------------------------

export function registerGgplot(reg) {
  const special = { special: true };
  reg('ggplot', fnGgplot, special);
  reg('aes', fnAes, special);
  for (const fname of Object.keys(GEOMS)) reg(fname, geomFn(fname), special);
  reg('labs', fnLabs);
  reg('ggtitle', oneLabel('ggtitle', 'title'));
  reg('xlab', oneLabel('xlab', 'x'));
  reg('ylab', oneLabel('ylab', 'y'));
  reg('coord_flip', ({ node }) => mkPart({ kind: 'coord', fname: 'coord_flip', node }));
  reg('facet_wrap', fnFacetWrap, special);
  for (const fname of THEMES) reg(fname, ({ node }) => mkPart({ kind: 'theme', fname, theme: fname.replace('theme_', '').replace('grey', 'gray'), node }));
  reg('theme', fnTheme);
  reg('position_dodge', fnPosition('dodge'));
  reg('position_stack', fnPosition('stack'));
  reg('position_fill', fnPosition('fill'));
  reg('layer_data', fnLayerData);
  reg('reorder', byNumber('reorder', mean, { dropNA: false }));
  reg('fct_reorder', byNumber('fct_reorder', median, { dropNA: true }));
  // The breaks an axis shows. A real R function, and the way the tests reach them.
  reg('pretty', ({ args }) => {
    const x = coerceVector(args.find((a) => !a.name).value, 'double', { trace: null }).values.filter((v) => !isNA(v));
    const n = args.find((a) => a.name === 'n')?.value?.values?.[0] ?? 5;
    return mkDouble(prettyBreaks(Math.min(...x), Math.max(...x), Number(n)));
  });
  reg('fct_infreq', fnFctInfreq);
  reg('fct_rev', fnFctRev);
  reg('fct_inorder', fnFctInorder);
  reg('fct_relevel', fnFctRelevel);
}
