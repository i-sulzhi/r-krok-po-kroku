/**
 * The stage: what one clicked piece of code did.
 *
 * Given an entry from the evaluation log -- one evaluation of one sub-expression --
 * this decides which picture shows it best, writes the one-line caption, and adds
 * the context around it: the code itself, how many times it ran (once per group,
 * once per loop pass), the path of enclosing expressions, and, for a pipe or a nest
 * of calls, the whole chain of intermediate values.
 *
 * Captions are one sentence with the numbers in it. The picture carries the rest.
 */

import { el } from '../dom.js';
import { packageOf } from '../../core/packages.js';
import { makeBaseEnv } from '../../core/builtins/index.js';
import { EV } from '../../trace/events.js';
import { ownEvents, eventsWithin } from '../../trace/evallog.js';
import {
  isNA, isAtomic, isFactor, isDataFrame, rLength, getNames,
} from '../../core/rvalue.js';
import { formatScalar, formatValue } from '../../core/format.js';
import { factorLabelsAreNumbers } from '../../core/arith.js';
import { renderValue, renderMini, renderThumb, typeLabel, renderDataFrame, sheetColumn } from './value.js';
import {
  renderElementwise, renderCombine, renderFunnel, renderMap, renderPick, renderPickRows,
  renderDollar, renderFactorMake, renderFactorOut, renderCounts, renderAssemble,
  renderMachine, renderAssign, renderPlain, renderMembership, renderErrorPic, arrow, renderRowMask,
} from './pictures.js';
import {
  renderFilter, renderSelect, renderMutate, renderArrange, renderGroup, renderSummarise, renderPivotWider, renderPivotLonger, renderJoin,
} from './table-ops.js';
import { renderRegex } from './regex.js';
import { renderRecode } from './recode.js';
import { renderBuilt, renderPlotThumb, renderMapping, renderLayerTable } from './plot.js';
import { buildPlot } from '../../core/builtins/ggplot.js';
import { releaseLinks } from './links.js';
import { sheetPanel, sideBySide } from './sheet.js';
import { highlightCode } from '../codebox.js';
import { t, has } from '../../i18n/index.js';

const AGGREGATES = new Set(['mean', 'sum', 'length', 'max', 'min', 'median', 'prod', 'sd', 'var']);
const CONVERSIONS = new Set(['as.numeric', 'as.double', 'as.integer', 'as.character', 'as.logical']);
const VERBS = new Set(['filter', 'select', 'pull', 'rename', 'mutate', 'transmute', 'arrange',
  'group_by', 'summarise', 'summarize', 'count', 'slice', 'distinct', 'ungroup']);
/** Calls whose first argument is one part among equals, not "the thing being transformed". */
const NOT_A_CHAIN = new Set(['c', 'data.frame', 'list', 'paste', 'paste0', 'ifelse', 'tibble', 'cbind', 'rbind']);

export const calleeName = (node) => (node?.type === 'Call' && node.callee.type === 'Ident' ? node.callee.name : null);

/** The evaluation of one argument node inside a call entry. */
export const childFor = (entry, argNode) => (argNode ? entry.children.find((c) => c.node === argNode) || null : null);

const positional = (entry, k) => childFor(entry, (entry.node.args || []).filter((a) => !a.name)[k]?.value);
const named = (entry, name) => childFor(entry, (entry.node.args || []).find((a) => a.name === name)?.value);

export const codeOf = (entry, source) => {
  const s = entry?.node?.span;
  return s ? source.slice(s.start, s.end) : '';
};

const isTrue = (v) => v && isAtomic(v) && v.values[0] === true;
const fmt = (x) => (isNA(x) ? 'NA' : formatScalar(x, 'double'));

// ---------------------------------------------------------------------------
// the picture for one entry
// ---------------------------------------------------------------------------

/**
 * @returns {{pic: Element, caption: string, tone?: string, frames?: number, frame?: (k) => Element}}
 *   `frames`/`frame` describe an animation the stage can play (elementwise steps).
 */
export function describeEntry(entry, ctx) {
  // A setting of a plot (vjust = -0.5, binwidth = 5, ncol = 1) says what it does (D83).
  const setting = plotSetting(entry);
  if (setting) return setting;
  const d = describeStep(entry, ctx);
  // A scene may ask for the spreadsheet version of the same step beside it
  // (`show.excel`, see sheet.js); the panel is built from this step's own values.
  const spec = ctx.show?.excel;
  if (!spec || entry.error || !d.pic) return d;
  const node = entry.node;
  const val = (n) => (n ? childFor(entry, n)?.value : undefined);
  const panel = sheetPanel(spec, {
    parts: node.type === 'Call' ? (node.args || []).map((a) => val(a.value)) : null,
    left: val(node.left),
    right: val(node.right),
    op: node.op,
    result: entry.value,
    input: node.type === 'Call' ? positional(entry, 0)?.value : undefined,
    fname: node.type === 'Call' ? calleeName(node) : null,
  });
  if (!panel) return d;
  // An animated step redraws its picture frame by frame; each frame keeps the sheet.
  return {
    ...d,
    pic: sideBySide(panel, d.pic),
    frame: d.frame ? (k) => sideBySide(panel, d.frame(k)) : d.frame,
  };
}

function describeStep(entry, ctx) {
  if (entry.error) {
    const e = entry.error;
    const message = e.key ? t(e.key, e.params) : e.message;
    // `if` given a whole column (D51): the comparison did its job for every person,
    // and the picture shows those answers, so the error reads as "too many answers
    // for one if", not as "the rest of the column was dropped".
    const cond = e.key === 'err.condLength' && entry.node.type === 'If' ? childFor(entry, entry.node.cond)?.value : null;
    if (cond && isAtomic(cond) && rLength(cond) > 1) {
      return {
        pic: el('div.pic-if-many', renderPlain(cond), renderErrorPic(message)),
        caption: t('fx.if.many', { n: rLength(cond) }),
        tone: 'error',
      };
    }
    return { pic: renderErrorPic(message), caption: t('fx.error'), tone: 'error' };
  }
  const node = entry.node;
  // A plot, or a part of one, is shown as a plot whatever code produced it (D45).
  if (entry.value?.gg) return plotStep(entry, ctx);
  if (entry.value?.part || entry.value?.aes) return plotPartStep(entry, ctx);
  switch (node.type) {
    case 'Paren': {
      const inner = childFor(entry, node.expr);
      return inner ? describeStep(inner, ctx) : plain(entry);
    }
    case 'Num': case 'Str': case 'Bool': case 'NAConst': case 'Null':
      return literal(entry);
    case 'Ident':
      return ident(entry, ctx);
    case 'Assign':
      return assign(entry, ctx);
    case 'Binary':
      return binary(entry, ctx);
    case 'Unary': {
      const operand = childFor(entry, node.operand);
      return {
        pic: renderMap(operand?.value, entry.value, { label: node.op }),
        caption: t(node.op === '!' ? 'fx.not' : 'fx.neg'),
      };
    }
    case 'Index':
      return index(entry, ctx);
    case 'Extract':
      return dollar(entry, ctx);
    case 'Call':
      return call(entry, ctx);
    case 'If':
      return ifChain(entry, ctx);
    default:
      return plain(entry);
  }
}

/**
 * Plain `if` / `else if` / `else` for one value (D50), drawn as the recode picture
 * with a single row: the conditions in reading order, the first TRUE lit, the ones
 * after it blank. case_when() draws the same table with a row per person, which is
 * what "vectorised" means here.
 */
function ifChain(entry, ctx) {
  const conditions = [];
  const labels = [];
  let took = 'none';
  let hasElse = false;
  for (let cur = entry; cur; ) {
    const cond = childFor(cur, cur.node.cond)?.value;
    if (!cond || !isAtomic(cond) || cond.type !== 'logical' || rLength(cond) !== 1) return plain(entry);
    conditions.push(cond.values);
    labels.push(short(codeOf({ node: cur.node.cond }, ctx.source), 14));
    if (cond.values[0] === true) { took = conditions.length - 1; break; }
    const alt = cur.node.alt;
    if (alt?.type === 'If') { cur = childFor(cur, alt); continue; }
    if (alt) { hasElse = true; took = 'rest'; }
    break;
  }
  const v = entry.value;
  if (!v || !isAtomic(v) || rLength(v) !== 1) return plain(entry);
  // An `else` written after the branch that was taken still belongs in the picture.
  let last = entry.node;
  while (last.alt?.type === 'If') last = last.alt;
  hasElse = hasElse || !!last.alt;
  const data = { fname: 'if', conditions, took: [took], values: v.values, type: v.type, hasDefault: hasElse };
  return { pic: renderRecode(data, labels, { rest: 'else' }), caption: t('fx.if.chain') };
}

/**
 * The package of the function this step calls (D53), shown beside its code. Only for
 * functions the trainer provides: a student's own function belongs to no package.
 */
function stagePackage(entry, ctx) {
  const fname = calleeName(entry.node);
  // A call after `|>` leaves no call event of its own, so the name is looked up among
  // the functions the trainer provides instead.
  if (!fname || !providedNames().has(fname)) return null;
  const pkg = packageOf(fname);
  return el('span', { class: `pkg st-pkg pkg-${pkg === 'base' ? 'base' : 'lib'}`, title: pkg === 'base' ? t('pkg.baseTitle') : t('pkg.libTitle', { pkg }) },
    pkg === 'base' ? t('pkg.base') : pkg);
}

let PROVIDED = null;
const providedNames = () => (PROVIDED ||= new Set([...makeBaseEnv().vars.entries()].filter(([, v]) => v?.kind === 'builtin').map(([k]) => k)));

function plain(entry, caption = '') {
  return { pic: renderPlain(entry.value), caption };
}

function literal(entry) {
  const v = entry.value;
  let key = 'fx.literal.num';
  if (entry.node.type === 'Str') key = 'fx.literal.str';
  else if (entry.node.type === 'Bool') key = 'fx.literal.lgl';
  else if (entry.node.type === 'NAConst') key = 'fx.literal.na';
  else if (entry.node.type === 'Null') key = 'fx.literal.null';
  return { pic: renderPlain(v), caption: t(key) };
}

function ident(entry, ctx) {
  const name = entry.node.name;
  const lookup = ownEvents(ctx.trace, entry).find((e) => e.type === EV.LOOKUP);
  const inMask = lookup && lookup.data.foundInName === t('env.dataMask');
  if (inMask) {
    const group = groupOf(entry, ctx);
    return {
      pic: renderPlain(entry.value, name),
      caption: group ? t('fx.ident.columnGroup', { name, group: group.label }) : t('fx.ident.column', { name }),
    };
  }
  // A scene may ask for a table drawn as the spreadsheet the learner knows.
  if (ctx.show?.sheet && isDataFrame(entry.value)) {
    const v = entry.value;
    return {
      pic: el('div.pic-plain', renderDataFrame(v, { sheet: true, label: name, showBadge: false })),
      caption: t('fx.sheet', { rows: v.values.length ? rLength(v.values[0]) : 0, cols: v.values.length }),
    };
  }
  return { pic: renderPlain(entry.value, name), caption: t('fx.ident', { name }) };
}

function assign(entry, ctx) {
  const target = entry.node.target;
  const name = target?.type === 'Ident' ? target.name : codeOf({ node: target }, ctx.source);
  const ev = ownEvents(ctx.trace, entry).find((e) => e.type === EV.ASSIGN && !e.data.attribute);
  const replaced = ev?.data.replaced;
  if (target?.type !== 'Ident') {
    return { pic: renderAssign(name, entry.value), caption: t('fx.assign.part', { name }) };
  }
  // The same value again (a table the scene rebuilds on screen) is not a loss (D77).
  const printed = (v) => { try { return String(formatValue(v)); } catch { return null; } };
  if (replaced && ev.data.previous && printed(ev.data.previous) !== null && printed(ev.data.previous) === printed(entry.value)) {
    return { pic: renderAssign(name, entry.value), caption: t('fx.assign.same', { name }) };
  }
  return {
    pic: renderAssign(name, entry.value, replaced ? ev.data.previous : null),
    caption: t(replaced ? 'fx.assign.replace' : 'fx.assign', { name }),
    tone: replaced ? 'trap' : null,
  };
}

function binary(entry, ctx) {
  const { node } = entry;
  const op = node.op;
  const left = childFor(entry, node.left);
  const right = childFor(entry, node.right);

  if (op === ':') {
    const v = entry.value;
    return { pic: renderPlain(v), caption: t('fx.seq', { from: fmt(v.values[0]), to: fmt(v.values[v.values.length - 1]) }) };
  }
  if (op === '%in%') {
    return { pic: renderMembership(left?.value, right?.value, entry.value), caption: t('fx.in') };
  }
  if (op === '&&' || op === '||') return plain(entry, t('fx.shortCircuit', { op }));

  // A condition on a table's column, where the scene is about rows (show.rows): the
  // answer read along the table's rows. The recycling of the short side, which the
  // default picture draws, is lesson 3's subject and only noise here.
  const compareOp = ['==', '!=', '<', '>', '<=', '>='].includes(op);
  if (ctx.show?.rows && compareOp && left?.node?.type === 'Extract' && isAtomic(entry.value)) {
    const table = childFor(left, left.node.object);
    if (table && isDataFrame(table.value) && rLength(table.value.values[0]) === rLength(entry.value)) {
      const label = short(`${left.node.name} ${op} ${codeOf(right, ctx.source)}`, 18);
      return { pic: renderRowMask(table.value, left.node.name, entry.value, label), caption: t('fx.compare.rows') };
    }
  }

  const own = ownEvents(ctx.trace, entry);
  const steps = own.filter((e) => e.type === EV.ELEMENTWISE);
  const recycle = own.find((e) => e.type === EV.RECYCLE) || null;
  const na = own.find((e) => e.type === EV.NA_PROPAGATE);
  const compare = ['==', '!=', '<', '>', '<=', '>='].includes(op);
  const logic = op === '&' || op === '|';

  let caption;
  let tone = null;
  const n = steps.length || rLength(entry.value);
  if (recycle && !recycle.data.fits) {
    caption = t('fx.op.recyclePartial', { short: recycle.data.shortLen, long: recycle.data.longLen });
    tone = 'warn';
  } else if (recycle && recycle.data.shortLen === 1) {
    caption = t('fx.op.recycleOne', { long: recycle.data.longLen });
  } else if (recycle) {
    caption = t('fx.op.recycle', { short: recycle.data.shortLen, long: recycle.data.longLen, times: recycle.data.times });
  } else if (n === 1 && isAtomic(entry.value) && rLength(entry.value) === 1) {
    // One value on each side: one comparison, not "each cell" (D68).
    caption = t(compare ? 'fx.compare.one' : logic ? 'fx.logic.one' : 'fx.op.one', { result: formatScalar(entry.value.values[0], entry.value.type) });
  } else if (compare) {
    caption = t('fx.compare', { n });
  } else if (logic) {
    caption = t('fx.logic', { n });
  } else {
    caption = t('fx.op', { n });
  }
  if (na) caption += ` ${t('fx.op.na')}`;

  if (!steps.length) {
    return { pic: renderMachine(op, [{ value: left?.value }, { value: right?.value }], entry.value), caption, tone };
  }
  const labels = {
    recycle,
    leftLabel: short(codeOf(left, ctx.source)),
    rightLabel: short(codeOf(right, ctx.source)),
    resultType: entry.value?.type,
  };
  const shownFrames = Math.min(steps.length, 12);
  return {
    pic: renderElementwise(steps, { ...labels, upTo: shownFrames }),
    caption,
    tone,
    frames: shownFrames,
    frame: (k) => renderElementwise(steps, { ...labels, upTo: k }),
  };
}

const short = (s, max = 22) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

function index(entry, ctx) {
  const { node } = entry;
  const source = childFor(entry, node.object);
  const own = ownEvents(ctx.trace, entry);

  if (node.bracket === '[[') {
    return { pic: renderMachine('[[ ]]', [{ value: source?.value }], entry.value), caption: t('fx.index.double') };
  }
  const args = (node.args || []).filter((a) => a.name !== 'drop');
  if (args.length === 2) {
    const rows = args[0].empty ? null : childFor(entry, args[0].value);
    const cols = args[1].empty ? null : childFor(entry, args[1].value);
    const indexEvs = own.filter((e) => e.type === EV.INDEX);
    const drop = indexEvs.find((e) => e.data.kind === 'df-drop');
    // The row probe is the INDEX event over 1..nrow; the column pick (if any) comes first.
    const rowEv = rows ? indexEvs.filter((e) => e.data.kind !== 'df-drop').pop() : null;
    const keptRows = rowEv ? (rowEv.data.positions || []).filter((p) => typeof p === 'number') : null;
    const colNames = cols && cols.value && isAtomic(cols.value) && cols.value.type === 'character' ? cols.value.values.map(String) : null;
    const total = source?.value && isDataFrame(source.value) && source.value.values.length ? rLength(source.value.values[0]) : 0;
    return {
      pic: renderPickRows(source.value, entry.value, {
        keptRows,
        rowMask: rows && rows.value && isAtomic(rows.value) && rows.value.type === 'logical' ? rows.value.values : null,
        cols: colNames,
      }),
      caption: drop ? t('fx.index.drop')
        : keptRows ? t(rows?.value?.type === 'logical' ? 'fx.index.rows' : 'fx.index.rowsAt', { kept: keptRows.length, total })
          : t('fx.index.cols'),
      tone: drop ? 'trap' : null,
    };
  }
  if (!args.length || args[0].empty) return plain(entry, t('fx.index.empty'));

  const idx = childFor(entry, args[0].value);
  const ev = own.find((e) => e.type === EV.INDEX);
  if (!source || !ev || !isAtomic(source.value)) return plain(entry);
  const d = ev.data;
  const positions = (d.positions || []).filter((p) => typeof p === 'number');
  const pic = renderPick(source.value, idx?.value, entry.value, { positions, kind: d.kind });
  switch (d.kind) {
    case 'negative':
      return { pic, caption: t('fx.index.neg', { positions: (d.detail?.dropped || []).map((p) => p + 1).join(', ') }), tone: 'trap' };
    case 'logical':
      return { pic, caption: t('fx.index.mask', { kept: entry.value ? rLength(entry.value) : 0, total: rLength(source.value) }) };
    case 'name':
      return { pic, caption: t('fx.index.name') };
    default: {
      const out = d.detail?.outOfRange || [];
      return {
        pic,
        caption: out.length
          ? t('fx.index.out', { positions: out.join(', ') })
          : t('fx.index.pos', { positions: positions.map((p) => p + 1).join(', ') }),
        tone: out.length ? 'trap' : null,
      };
    }
  }
}

function dollar(entry, ctx) {
  const source = childFor(entry, entry.node.object);
  const ev = ownEvents(ctx.trace, entry).find((e) => e.type === EV.INDEX);
  const name = entry.node.name;
  if (ev?.data.missing) {
    return { pic: renderPlain(source?.value), caption: t('fx.dollar.missing', { name }), tone: 'trap' };
  }
  const full = ev?.data.partial ? String((getNames(source.value)?.values || [])[ev.data.positions[0]]) : name;
  const sheet = Boolean(ctx.show?.sheet) && isDataFrame(source?.value);
  if (sheet && !ev?.data.partial) {
    const letter = sheetColumn((getNames(source.value)?.values || []).map(String).indexOf(full));
    return { pic: renderDollar(source.value, entry.value, full, { sheet }), caption: t('fx.dollar.sheet', { letter }) };
  }
  return {
    pic: renderDollar(source?.value, entry.value, full),
    caption: ev?.data.partial ? t('fx.dollar.partial', { name, full }) : t('fx.dollar', { name }),
    tone: ev?.data.partial ? 'trap' : null,
  };
}

function call(entry, ctx) {
  const fname = calleeName(entry.node) || '';
  const own = ownEvents(ctx.trace, entry);
  const first = positional(entry, 0);
  const input = first?.value;
  const v = entry.value;

  if (fname === 'c') {
    const parts = (entry.node.args || []).map((a) => ({ name: a.name, value: childFor(entry, a.value)?.value })).filter((p) => p.value);
    const co = own.find((e) => e.type === EV.COERCE && e.data.reason === 'c-mixed');
    return {
      pic: renderCombine(parts, v, co),
      caption: co ? t('fx.c.coerce', { to: t(`badge.${co.data.to}`) }) : t('fx.c', { n: rLength(v) }),
      tone: co ? 'trap' : null,
    };
  }

  if (AGGREGATES.has(fname)) return aggregate(entry, ctx, fname, input, own);

  if (fname === 'nrow' || fname === 'ncol') {
    return { pic: renderFunnel(input, v, { fname }), caption: t(`fx.${fname}`, { n: v?.values[0] }) };
  }

  if (fname === 'n') {
    const group = groupOf(entry, ctx);
    return {
      pic: renderPlain(v),
      caption: group ? t('fx.n.group', { n: v.values[0], group: group.label }) : t('fx.n', { n: v?.values[0] }),
    };
  }

  if (CONVERSIONS.has(fname)) {
    if (input && isFactor(input)) {
      const labels = fname === 'as.character';
      // The codes are a trap only when the labels are numbers the student meant
      // (levels "2".."5", codes 1..4). On a word scale in scale order, the codes ARE
      // the scale points, and saying "trap" there would teach the wrong thing.
      const trap = !labels && codesBetrayLabels(input);
      return {
        pic: renderFactorOut(input, v, { fname, layer: labels ? 'labels' : 'codes', trap }),
        caption: t(labels ? 'fx.convert.labels' : trap ? 'fx.convert.codes' : 'fx.convert.codesScale'),
        tone: trap ? 'trap' : null,
      };
    }
    const co = own.find((e) => e.type === EV.COERCE);
    const lost = co?.data.lostPositions || [];
    return {
      pic: renderMap(input, v, { label: `${fname}()`, lost }),
      caption: lost.length
        ? t('fx.convert.lost', { n: lost.length })
        : t('fx.convert', { from: typeLabel(input), to: typeLabel(v) }),
      tone: lost.length ? 'trap' : null,
    };
  }

  if (fname === 'factor' || fname === 'as.factor') {
    const k = v && isFactor(v) ? (v.attributes?.levels?.values.length || 0) : 0;
    const d = own.find((e) => e.type === EV.COERCE && e.data.to === 'factor')?.data || {};
    const key = d.labelled ? 'fx.factor.labels'
      : d.levelsGiven ? 'fx.factor.levels'
        : d.from === 'factor' ? 'fx.factor.kept'
          : d.from === 'character' ? 'fx.factor' : 'fx.factor.sorted';
    const empty = d.levelsGiven && v && isFactor(v) ? emptyLevels(v) : [];
    let caption = t(key, { n: rLength(v), k });
    let guessed = false;
    // No levels given, numbers in: R takes the values present, sorted, and numbers them
    // from 1. When they are not 1..k already, every code differs from its value.
    if (key === 'fx.factor.sorted' && v && isFactor(v)) {
      const lv = v.attributes.levels.values.map(String);
      if (lv.some((l, i) => l !== String(i + 1))) {
        guessed = true;
        caption = t('fx.factor.guessed', { list: lv.join(', '), first: lv[0] });
      }
    }
    // A value that is not among the declared levels is dropped to NA without a word:
    // a typo in the data, or in the levels. That outranks the list of empty levels.
    const lost = d.levelsGiven && v && isFactor(v) && isAtomic(input)
      ? v.values.filter((code, i) => isNA(code) && !isNA(input.values[i])).length : 0;
    if (lost) {
      return {
        pic: renderFactorMake(input, v, { lit: ctx.show?.lit }),
        caption: t('fx.factor.lost', { n: lost }),
        tone: 'trap',
      };
    }
    return {
      pic: renderFactorMake(input, v, { lit: ctx.show?.lit }),
      caption: empty.length ? `${caption} ${t('fx.factor.empty', { names: empty.join(', ') })}` : caption,
      tone: guessed ? 'trap' : null,
    };
  }

  if (fname === 'levels' || fname === 'nlevels') {
    return { pic: renderFactorOut(input, v, { fname, layer: 'levels' }), caption: t('fx.levels') };
  }

  if (fname === 'is.na') {
    return { pic: renderMap(input, v, { label: 'is.na()' }), caption: t('fx.isna') };
  }

  if (fname === 'table') {
    const dropped = own.find((e) => e.type === EV.WARNING && e.data.kind === 'table-drops-na');
    // A factor is counted by its levels, so a level nobody chose shows up as 0 --
    // the reason to declare a survey scale's levels at all.
    const zero = input && isFactor(input) ? emptyLevels(input) : [];
    // A scene may name values the data could hold but does not (a scale point
    // nobody chose): R's table has no row for them, so the picture says so.
    const names = (getNames(v)?.values || []).map(String);
    const absent = (ctx.show?.absent || []).map(String).filter((x) => !names.includes(x));
    const base = zero.length ? t('fx.table.zero', { names: zero.join(', ') })
      : absent.length ? t('fx.table.absent', { names: absent.join(', ') }) : t('fx.table');
    return {
      pic: renderCounts(input, v, { absent }),
      caption: dropped ? `${base} ${t('fx.table.na', { n: dropped.data.dropped })}` : base,
      tone: dropped ? 'trap' : null,
    };
  }

  if (fname === 'typeof' || fname === 'class' || fname === 'mode') {
    return { pic: el('div.pic-inspect', renderValue(input), arrow(`${fname}()`), renderValue(v)), caption: t('fx.typeof', { result: v?.values?.[0] ?? '' }) };
  }

  if (fname === 'data.frame' || fname === 'tibble') {
    const parts = (entry.node.args || []).map((a) => ({ name: a.name, value: childFor(entry, a.value)?.value })).filter((p) => p.value);
    return { pic: renderAssemble(parts, v), caption: t('fx.df', { rows: v && isDataFrame(v) && v.values.length ? rLength(v.values[0]) : 0 }) };
  }

  if (VERBS.has(fname)) return verb(entry, ctx, fname, own);

  const rx = own.find((e) => e.type === EV.REGEX);
  if (rx) return { pic: renderRegex(rx), caption: t('fx.regex', { matched: rx.data.matched, total: rx.data.total }) };

  const pv = own.filter((e) => e.type === EV.PIVOT).pop();
  if (pv && pv.data.direction === 'longer') {
    const d = pv.data;
    return {
      pic: renderPivotLonger(pv),
      caption: t(d.dropped ? 'fx.pivot.longerDropped' : 'fx.pivot.longer', { k: d.cols.length, rows: d.rowsIn, out: d.rowsOut, dropped: d.dropped }),
      tone: 'trap',
    };
  }
  if (pv) {
    const d = pv.data;
    const rowIs = d.ids.join(', ');
    return {
      pic: renderPivotWider(pv),
      caption: d.gaps && !d.filled ? t('fx.pivot.gap', { n: d.gaps })
        : d.gaps ? t('fx.pivot.filled', { n: d.gaps })
          : rowIs ? t('fx.pivot.wider', { from: d.from, ids: rowIs }) : t('fx.pivot.widerOne', { from: d.from }),
      tone: d.gaps && !d.filled ? 'trap' : null,
    };
  }

  const jn = own.filter((e) => e.type === EV.JOIN).pop();
  if (jn) return { pic: renderJoin(jn), ...joinCaption(jn.data) };

  const rc = own.filter((e) => e.type === EV.RECODE).pop();
  if (rc) return recode(entry, ctx, rc.data);

  // Missing data, said in numbers (D66): what each function removed, wrote or turned to NA.
  const rows = (df) => (df && isDataFrame(df) && df.values.length ? rLength(df.values[0]) : 0);
  const argCode = (k) => { const a = (entry.node.args || [])[k]; return a ? codeOf({ node: a.value }, ctx.source) : ''; };
  if (fname === 'drop_na' && input && isDataFrame(input) && v && isDataFrame(v)) {
    const cols = (entry.node.args || []).slice(1).map((a) => codeOf({ node: a.value }, ctx.source)).join(', ');
    const gone = rows(input) - rows(v);
    const many = (entry.node.args || []).length > 2;
    return { pic: renderPlain(v), caption: cols ? t(many ? 'fx.dropNa.colsMany' : 'fx.dropNa.cols', { n: gone, cols, left: rows(v) }) : t('fx.dropNa.all', { n: gone, left: rows(v) }), tone: cols ? null : 'trap' };
  }
  if (fname === 'complete' && input && isDataFrame(input) && v && isDataFrame(v)) {
    return { pic: renderPlain(v), caption: t('fx.complete', { n: rows(v) - rows(input) }) };
  }
  if (fname === 'na_if' && input && v && isAtomic(input) && isAtomic(v)) {
    const k = v.values.filter((x, i) => isNA(x) && !isNA(input.values[i])).length;
    return { pic: renderMap(input, v, { label: 'na_if()' }), caption: t('fx.naIf', { n: k, code: argCode(1) }) };
  }
  if (fname === 'replace_na' && input && v && isAtomic(input) && isAtomic(v)) {
    const k = input.values.filter((x, i) => isNA(x) && !isNA(v.values[i])).length;
    return { pic: renderMap(input, v, { label: 'replace_na()' }), caption: t('fx.replaceNa', { n: k, value: argCode(1) }) };
  }

  if (fname === 'list' && (entry.node.args || []).length) {
    const items = entry.node.args.map((a) => (a.name ? `${a.name} = ` : '') + codeOf({ node: a.value }, ctx.source)).join(', ');
    return { pic: renderValue(v), caption: t('fx.list', { items }) };
  }

  if (fname === 'desc') return { pic: renderMap(input, v, { label: 'desc()' }), caption: t('fx.desc') };

  // Functions that reorder a factor's levels (D80). They change no value, only the
  // order of levels, so "works on each cell" said the opposite of what they do.
  const FCT = { fct_infreq: 'fx.fct.infreq', fct_reorder: 'fx.fct.reorder', reorder: 'fx.fct.reorder', fct_rev: 'fx.fct.rev', fct_relevel: 'fx.fct.relevel', fct_inorder: 'fx.fct.inorder' };
  if (FCT[fname] && v && isFactor(v)) {
    const levels = (v.attributes?.levels?.values || []).map(String);
    const counts = levels.map((_, i) => v.values.filter((c) => c === i + 1).length);
    const list = fname === 'fct_infreq' ? levels.map((l, i) => `${l} (${counts[i]})`).join(', ') : levels.join(', ');
    const pic = input && isAtomic(input) && rLength(input) === rLength(v) ? renderMap(input, v, { label: `${fname}()` }) : renderValue(v);
    return { pic, caption: t(FCT[fname], { list, by: argCode(1) }) };
  }
  // paste0() and paste() glue pieces into one text per row (D80).
  if ((fname === 'paste0' || fname === 'paste') && v && isAtomic(v) && v.type === 'character' && rLength(v)) {
    const ex = v.values.slice(0, 2).map((x) => `„${x}”`).join(', ');
    return { pic: renderValue(v), caption: t('fx.paste', { fname, ex }) };
  }

  if (input && v && isAtomic(input) && isAtomic(v) && rLength(input) === rLength(v) && rLength(v) > 1 && (entry.node.args || []).length <= 2) {
    return { pic: renderMap(input, v, { label: `${fname}()` }), caption: t('fx.map', { fname }) };
  }

  const args = (entry.node.args || []).map((a) => ({ name: a.name, value: childFor(entry, a.value)?.value }));
  const isClosure = eventsWithin(ctx.trace, entry).some((e) => e.type === EV.CALL_ENTER && e.data.fnName === fname && !e.data.builtin);
  return { pic: renderMachine(fname, args, v), caption: t(isClosure ? 'fx.closure' : 'fx.call', { fname }) };
}

function aggregate(entry, ctx, fname, input, own) {
  const v = entry.value;
  const naEv = own.find((e) => e.type === EV.NA_PROPAGATE);
  const naRm = isTrue(named(entry, 'na.rm')?.value);
  const result = v && isAtomic(v) ? v.values[0] : null;
  const known = input && isAtomic(input) ? input.values.filter((x) => !isNA(x)) : [];
  const logical = input && isAtomic(input) && input.type === 'logical';

  let pick = null;
  if ((fname === 'max' || fname === 'min') && input && isAtomic(input)) {
    pick = input.values.map((x, i) => (x === result ? i : -1)).filter((i) => i >= 0);
  }
  const pic = renderFunnel(input, v, { fname, naRemoved: naRm && !!naEv, pick, logicalCount: fname === 'sum' && logical });

  if (naEv && !naRm) {
    return { pic, caption: t('fx.agg.na', { fname }), tone: 'trap' };
  }
  const dropped = naEv && naRm ? naEv.data.naPositions.length : 0;
  let caption;
  switch (fname) {
    case 'mean': {
      const sum = known.reduce((a, b) => a + Number(b), 0);
      // The mean of a comparison is a share (D61): TRUE counts 1, FALSE 0.
      caption = logical
        ? t('fx.mean.logical', { k: sum, n: known.length, result: fmt(result) })
        : t('fx.mean', { sum: fmt(sum), n: known.length, result: fmt(result) });
      break;
    }
    case 'sum':
      caption = logical ? t('fx.sum.logical', { result: fmt(result) }) : t('fx.sum', { result: fmt(result) });
      break;
    case 'length':
      caption = input && isDataFrame(input) ? t('fx.length.df', { n: result }) : t('fx.length', { n: result });
      break;
    case 'max': caption = t('fx.max', { result: fmt(result) }); break;
    case 'min': caption = t('fx.min', { result: fmt(result) }); break;
    case 'median': caption = t('fx.median', { result: fmt(result) }); break;
    default: caption = t('fx.agg', { fname, result: fmt(result) });
  }
  if (dropped) caption += ` ${t('fx.agg.dropped', { n: dropped })}`;
  const group = groupOf(entry, ctx);
  if (group) caption = `${t('fx.inGroup', { group: group.label })} ${caption}`;
  return { pic, caption };
}

/**
 * if_else() and case_when(): the conditions in reading order and who took each row.
 * The caption names the one thing that went unnoticed: rows nobody took, or rows
 * with no answer that `.default` took anyway.
 */
function recode(entry, ctx, data) {
  const args = entry.node.args || [];
  const labels = data.fname === 'case_when'
    ? args.filter((a) => a.name !== '.default').map((a) => short(codeOf({ node: a.value.left }, ctx.source), 14))
    : [short(codeOf({ node: (args.find((a) => a.name === 'condition') || args.filter((a) => !a.name)[0]).value }, ctx.source), 14)];
  const { none, swept, shadowed } = recodeTraps(data);
  const caption = shadowed >= 0 ? t('fx.recode.shadowed', { code: labels[shadowed] })
    : none ? t(data.fname === 'case_when' ? 'fx.recode.none' : 'fx.recode.ifNA', { n: none })
      : swept ? t('fx.recode.swept', { n: swept })
        : t(data.fname === 'case_when' ? 'fx.recode.first' : 'fx.recode.two');
  return { pic: renderRecode(data, labels), caption, tone: shadowed >= 0 || none || swept ? 'trap' : null };
}

/**
 * What a join did to the number of rows, in the order a student should worry about
 * it: rows that multiplied, rows of the left table with no partner, and only then
 * what the right table held that nobody asked for.
 * @returns {{caption: string, tone: string|null}}
 */
export function joinCaption(d) {
  if (d.filter) {
    return { caption: t(d.filter === 'unmatched' ? 'fx.join.anti' : 'fx.join.semi', { out: d.rowsOut, rows: d.rowsX }), tone: null };
  }
  const parts = [];
  // Name the keys without a partner, three at most (D73).
  const named = (keys) => (keys.length > 3 ? `${keys.slice(0, 3).join(', ')}…` : keys.join(', ')).replace(/\u0000NA/g, 'NA');
  if (d.multiplied) parts.push(t('fx.join.multiplied', { rows: d.rowsX, out: d.rowsOut }));
  if (d.unmatchedX.length) {
    parts.push(d.keptX ? t('fx.join.na', { keys: named(d.keysX || []) })
      : t('fx.join.lost', { keys: named(d.keysX || []), fname: d.fname, rows: d.rowsX, out: d.rowsOut }));
  }
  const trap = parts.length > 0;
  if (d.unmatchedY.length && parts.length < 2) {
    parts.push(t(d.keptY ? 'fx.join.extraY' : 'fx.join.unusedY', { keys: named(d.keysY || []) }));
  }
  if (!parts.length) parts.push(t('fx.join.clean', { rows: d.rowsX, added: d.added.join(', ') }));
  return { caption: parts.join(' '), tone: trap ? 'trap' : null };
}

/**
 * What went unnoticed in a recoding, from the RECODE event alone:
 * `none` rows no condition took, `swept` rows with no answer that `.default` took,
 * `shadowed` the first condition that is TRUE somewhere yet never got a row, because
 * a wider one stands above it (-1 when there is none).
 */
export function recodeTraps(data) {
  const at = (k, r) => data.conditions[k][data.conditions[k].length === 1 ? 0 : r];
  const rows = data.took.map((_, r) => r);
  const allNA = (r) => data.conditions.every((_, k) => isNA(at(k, r)));
  return {
    none: data.took.filter((x) => x === 'none').length,
    swept: data.hasDefault ? rows.filter((r) => data.took[r] === 'rest' && allNA(r)).length : 0,
    shadowed: data.conditions.findIndex((_, k) => rows.some((r) => at(k, r) === true) && !data.took.includes(k)),
  };
}

/** The code of each condition in filter(...): every argument but the data, which
 *  comes first whether it was written there or piped in (the parser puts it there). */
function conditionLabels(entry, ctx) {
  const args = (entry.node.args || []).filter((x) => !x.name);
  return args.slice(1).map((x) => short(codeOf({ node: x.value }, ctx.source), 16));
}

function verb(entry, ctx, fname, own) {
  const v = entry.value;
  const find = (type) => own.filter((e) => e.type === type).pop();
  switch (fname) {
    case 'filter': {
      const ev = find(EV.DPLYR_FILTER);
      if (!ev) break;
      const na = (ev.data.naDropped || []).length;
      return {
        pic: renderFilter(ev, conditionLabels(entry, ctx)),
        caption: na ? t('fx.filter.na', { kept: ev.data.kept, total: ev.data.total, na }) : t('fx.filter', { kept: ev.data.kept, total: ev.data.total }),
        tone: na ? 'trap' : null,
      };
    }
    case 'select': case 'pull': case 'rename': {
      const ev = find(EV.DPLYR_SELECT);
      if (!ev) break;
      if (ev.data.pulled) return { pic: el('div.pic-stack', renderSelect(ev), arrow('pull()'), renderValue(v)), caption: t('fx.pull', { name: ev.data.pulled }) };
      if (ev.data.renamed) return { pic: renderSelect(ev), caption: t('fx.rename') };
      // The result under the table: its column order, and that one column is still a table.
      return {
        pic: el('div.pic-stack', renderSelect(ev), arrow('select()'), renderValue(v)),
        caption: t('fx.select', { n: (ev.data.keptNames || []).length, total: (ev.data.allNames || []).length }),
      };
    }
    case 'mutate': case 'transmute': {
      const evs = own.filter((e) => e.type === EV.DPLYR_MUTATE);
      const ev = evs[evs.length - 1];
      if (!ev) break;
      const replaced = evs.find((e) => e.data.replaced);
      return {
        pic: renderMutate(ev),
        caption: replaced ? t('fx.mutate.replaced', { name: replaced.data.name })
          : ev.data.groups ? t('fx.mutate.grouped', { name: evs.map((e) => e.data.name).join(', '), by: ev.data.by.join(', '), n: ev.data.groups.length })
            : t('fx.mutate', { name: evs.map((e) => e.data.name).join(', ') }),
        tone: replaced ? 'trap' : null,
      };
    }
    case 'arrange': {
      const ev = find(EV.DPLYR_ARRANGE);
      if (!ev) break;
      const by = (ev.data.by || []).map((k) => (k.desc ? `desc(${k.name})` : k.name)).join(', ');
      const names = ev.data.preview?.names || [];
      const hasNA = (ev.data.by || []).some((k) => {
        const col = ev.data.preview?.columns[names.indexOf(k.name)];
        return col && col.values.some((x) => x === null);
      });
      return { pic: renderArrange(ev), caption: t(hasNA ? 'fx.arrange.na' : 'fx.arrange', { by }), tone: hasNA ? 'trap' : null };
    }
    case 'group_by': {
      const ev = find(EV.DPLYR_GROUP);
      if (!ev) break;
      return { pic: renderGroup(ev), caption: t('fx.group', { by: (ev.data.by || []).join(', '), n: ev.data.count }) };
    }
    case 'count': {
      const ev = find(EV.DPLYR_GROUP);
      if (!ev) break;
      return { pic: el('div.pic-stack', renderGroup(ev), arrow('count()'), renderValue(v)), caption: t('fx.count', { n: ev.data.count }) };
    }
    case 'summarise': case 'summarize': {
      const ev = find(EV.DPLYR_SUMMARISE);
      if (!ev) break;
      return {
        pic: renderSummarise(ev),
        caption: ev.data.by?.length ? t('fx.summarise', { n: ev.data.groupCount }) : t('fx.summarise.whole', { rows: ev.data.rowsBefore }),
      };
    }
    default:
      break;
  }
  const first = positional(entry, 0);
  return { pic: el('div.pic-stack', renderValue(first?.value), arrow(`${fname}()`), renderValue(v)), caption: t('fx.call', { fname }) };
}

/**
 * Which group an evaluation belongs to, when it ran inside a grouped summarise():
 * the k-th evaluation of an argument is the k-th group.
 */
export function groupOf(entry, ctx) {
  let cur = entry;
  while (cur && cur.parent) {
    const p = cur.parent;
    const fname = calleeName(p.node);
    if (fname === 'summarise' || fname === 'summarize') {
      const same = p.children.filter((c) => c.node === cur.node);
      const k = same.indexOf(cur);
      const ev = ownEvents(ctx.trace, p).find((e) => e.type === EV.DPLYR_SUMMARISE);
      const g = ev?.data.groups?.[k];
      return g && g.labels.length ? { index: k, label: g.labels.join(' · '), size: g.size, count: ev.data.groups.length } : null;
    }
    // A grouped mutate() works its expression out once per group, in group order (D55).
    if (fname === 'mutate') {
      const same = p.children.filter((c) => c.node === cur.node);
      const k = same.indexOf(cur);
      const ev = ownEvents(ctx.trace, p).find((e) => e.type === EV.DPLYR_MUTATE && e.data.groups);
      const g = ev?.data.groups?.[k];
      return g && g.labels.length ? { index: k, label: g.labels.join(' · '), size: g.rows.length, count: ev.data.groups.length } : null;
    }
    cur = p;
  }
  return null;
}

// ---------------------------------------------------------------------------
// plots (D45)
// ---------------------------------------------------------------------------

/**
 * The value of a named setting of a ggplot2 function, explained with its own value
 * (D83). Students meet vjust = -0.5 or ncol = 1 in a scene and could not ask what the
 * number does; clicking it now says. `-0.5` is reached from its 0.5 as well.
 */
const PLOT_FNS = /^(geom_\w+|labs|xlab|ylab|ggtitle|theme|facet_wrap|position_(dodge|stack|fill))$/;
const SETTINGS = ['vjust', 'hjust', 'width', 'binwidth', 'bins', 'alpha', 'fill', 'colour', 'color', 'size', 'linewidth', 'position', 'ncol', 'nrow',
  'title', 'subtitle', 'caption', 'x', 'y', 'legend.position'];
function plotSetting(entry) {
  let e = entry;
  if (e.parent?.node.type === 'Unary' && e.parent.node.op === '-') e = e.parent;
  const call = e.parent;
  if (!call || call.node.type !== 'Call' || call.node.callee?.type !== 'Ident' || !PLOT_FNS.test(call.node.callee.name)) return null;
  const fname = call.node.callee.name;
  const args = call.node.args || [];
  const at = args.findIndex((a) => a.value === e.node);
  if (at < 0) return null;
  let name = args[at].name;
  // position_dodge(0.9): its first argument is the width.
  if (!name && fname === 'position_dodge' && at === 0) name = 'dodgeWidth';
  if (!name || (!SETTINGS.includes(name) && name !== 'dodgeWidth')) return null;
  const v = e.value;
  const isNull = v?.kind === 'null' || v == null || (v.values && v.values.length === 0);
  const raw = isNull ? 'NULL' : v.values?.[0];
  const num = typeof raw === 'number' ? raw : Number(raw);
  const pct = Number.isFinite(num) ? Math.round(num * 100) : null;
  const isLabs = /^(labs|xlab|ylab|ggtitle)$/.test(fname);
  let key;
  if (isLabs) key = isNull ? `fx.arg.labs.none` : `fx.arg.labs.${name === 'color' ? 'colour' : name}`;
  else if (name === 'position') key = `fx.arg.position.${raw}`;
  else if (name === 'legend.position') key = `fx.arg.legend.${raw}`;
  else if (name === 'width' && fname === 'geom_boxplot') key = 'fx.arg.boxWidth';
  else if ((name === 'colour' || name === 'color') && /^geom_(col|bar|histogram)$/.test(fname)) key = 'fx.arg.colourBars';
  else key = `fx.arg.${name === 'color' ? 'colour' : name}`;
  if (!has(key)) return null;
  const shown = isNull ? 'NULL' : typeof raw === 'string' ? `"${raw}"` : String(raw);
  return { pic: renderValue(v ?? null), caption: t(key, { name, v: shown, n: num, pct, axis: name }) };
}

/** The part a `+` just added to a plot, or null when the entry is not such a step. */
const addedPart = (entry) => (entry.node.type === 'Binary' && entry.node.op === '+'
  ? childFor(entry, entry.node.right)?.value?.part || null : null);

/**
 * One step of a plot. A layer is shown with the table it draws from on the left:
 * for geom_bar() that is the count it made itself, which is the whole difference
 * between it and geom_col().
 */
function plotStep(entry, ctx) {
  let built;
  try {
    built = buildPlot(entry.value);
  } catch (e) {
    return { pic: renderErrorPic(e.message), caption: t('fx.error'), tone: 'error' };
  }
  const part = addedPart(entry);
  const size = 'full';
  const last = built.layers.length - 1;
  const plain = () => renderBuilt(built, { size });
  const note = (kind) => built.notes.find((x) => x.kind === kind);

  if (!built.layers.length) return { pic: plain(), caption: t('fx.gg.blank') };

  if (part?.kind === 'layer') {
    const layer = built.layers[last];
    const table = renderLayerTable(built, last);
    const pic = table
      ? el('div.pic-plot', el('div.pic-plot-from', el('div.pic-plot-table', el('div.pic-plot-head', t(layer.stat ? 'gp.counted' : 'gp.given', { fname: part.fname })), table), arrow(`${part.fname}()`)), el('div.gp-box.gp-box-full', renderBuilt(built, { size, lit: last })))
      : renderBuilt(built, { size, lit: last });
    const removed = built.notes.find((x) => x.kind === 'removed' && x.layer === last);
    const piled = built.notes.find((x) => x.kind === 'piled' && x.layer === last);
    const constant = note('constantInAes');
    let caption;
    let tone = null;
    if (constant) { caption = t(constant.aes === 'x' ? 'fx.gg.constantX' : 'fx.gg.constant', { code: constant.code }); tone = 'trap'; }
    else if (piled) { caption = t('fx.gg.piled', { rows: piled.rows, bars: piled.bars }); tone = 'trap'; }
    else if (layer.geom === 'hist') {
      // The four kinds of plot of D81, said in their own numbers.
      const top = layer.marks.reduce((p, q) => (q.ymax > p.ymax ? q : p), layer.marks[0]);
      // Whole numbers in a bin like 17.5–22.5 are 18 to 22 (D85): the half is only the edge.
      const whole = layer.stat.whole && !Number.isInteger(top.xmin) ? t('fx.gg.histWhole', { a: Math.floor(top.xmin) + 1, b: Math.floor(top.xmax) }) : '';
      caption = t('fx.gg.hist', { n: layer.stat.rowsIn, w: Number(layer.stat.binwidth.toPrecision(4)), top: top.xKey.replace('-', '–'), k: top.ymax, whole });
      if (built.notes.some((x) => x.kind === 'bins30' && x.layer === last)) caption += ` ${t('fx.gg.bins30')}`;
    } else if (layer.geom === 'box') {
      const r = (v) => Number(v.toPrecision(4));
      caption = t('fx.gg.box', { list: layer.marks.map((m) => `${m.xKey}: ${r(m.middle)} (${r(m.lower)}–${r(m.upper)})`).join(', ') });
      caption += ` ${t('fx.gg.boxWhiskers')}`;
      const out = layer.marks.flatMap((m) => m.outliers.map((o) => `${r(o)} (${m.xKey})`));
      if (out.length) caption += ` ${t('fx.gg.boxOut', { n: out.length, list: out.join(', ') })}`;
    } else if (layer.geom === 'point') caption = t('fx.gg.point', { n: layer.marks.length, x: layer.aes.x, y: layer.aes.y });
    else if (layer.geom === 'line') {
      const groups = new Set(layer.marks.map((m) => m.fillKey ?? '')).size;
      caption = t('fx.gg.line', { x: layer.aes.x, n: groups });
    } else if (layer.geom === 'text') {
      caption = t(/^[\p{L}._][\p{L}\p{N}._]*$/u.test(layer.aes.label || '') ? 'fx.gg.text' : 'fx.gg.textExpr', { label: layer.aes.label });
      // Where vjust put the text, said beside it so nobody has to guess the number (D83).
      const vj = layer.params.vjust;
      if (vj != null && vj < 0) caption += ` ${t('fx.gg.textAbove', { v: vj })}`;
      else if (vj != null && vj > 1) caption += ` ${t('fx.gg.textInside', { v: vj })}`;
    }
    else if (layer.position === 'fill') caption = t('fx.gg.fill');
    else if (layer.position === 'dodge') caption = t('fx.gg.dodge', { n: layer.marks.length });
    else {
      // Groups stacked in one bar (D80): say how many bars and parts there are, and that
      // ready numbers are added up, since stacking percentages gives a sum that means nothing.
      const bars = new Set(layer.marks.map((mk) => mk.xKey)).size;
      const grouped = layer.marks.some((mk) => mk.fillKey != null) && bars < layer.marks.length;
      if (grouped && layer.stat) caption = t('fx.gg.barGroups', { rows: built.rows, bars, parts: layer.marks.length, by: layer.aes.fill });
      else if (grouped) caption = t('fx.gg.colGroups', { bars, parts: layer.marks.length, top: Number(Math.max(...layer.marks.map((mk) => mk.ymax)).toPrecision(6)) });
      else if (layer.stat) caption = t('fx.gg.bar', { rows: built.rows, n: layer.marks.length });
      else caption = t('fx.gg.col', { n: layer.marks.length });
    }
    if (layer.geom !== 'text' && layer.params.fill != null && !constant) caption += ` ${t('fx.gg.fixedFill', { colour: layer.params.fill })}`;
    // An order that is not the alphabet's was chosen by someone: say which it is.
    if (built.x.discrete && layer.geom !== 'text' && !constant && !piled) {
      const abc = [...built.x.levels].sort((p, q) => (p === 'NA') - (q === 'NA') || p.localeCompare(q, 'pl')).join();
      if (abc !== built.x.levels.join()) caption += ` ${t('fx.gg.order', { list: built.x.levels.join(', ') })}`;
    }
    if (removed) { caption += ` ${t('fx.gg.removed', { n: removed.rows.length })}`; tone = 'trap'; }
    const noWidth = built.notes.find((x) => x.kind === 'dodgeNoWidth' && x.layer === last);
    if (noWidth) { caption += ` ${t('fx.gg.dodgeNoWidth')}`; tone = 'trap'; }
    // A category axis keeps a missing answer as a bar of its own, where a number axis
    // drops it (D78): say so, or the two chips side by side look alike.
    else if (built.x.discrete && layer.geom !== 'text' && built.x.levels.includes('NA')) caption += ` ${t('fx.gg.naBar')}`;
    return { pic, caption, tone };
  }
  if (part?.kind === 'labels') return { pic: plain(), caption: t('fx.gg.labs', { list: Object.keys(part.labels).join(', ') }) };
  if (part?.kind === 'coord') return { pic: plain(), caption: t('fx.gg.flip') };
  // facet_wrap() (D82): the same plot per group, with what each panel holds.
  if (part?.kind === 'facet' && built.panels) {
    const list = built.panels.map((p) => `${p.label} (${p.built.layers[0]?.stat ? p.built.layers[0].marks.reduce((k, m) => k + (m.count ?? 0), 0) : p.built.layers[0]?.marks.length ?? 0})`).join(', ');
    return { pic: plain(), caption: t('fx.gg.facet', { n: built.panels.length, by: built.facet.code, list }) };
  }
  if (part?.kind === 'theme') {
    const where = built.legend && built.legend !== 'right' && part.fname === 'theme' ? t(`fx.gg.legend.${built.legend}`) : null;
    return { pic: plain(), caption: where ? t('fx.gg.legend', { where }) : t('fx.gg.theme') };
  }
  const constant = note('constantInAes');
  if (constant) return { pic: plain(), caption: t('fx.gg.constant', { code: constant.code }), tone: 'trap' };
  return { pic: plain(), caption: t('fx.gg.plot', { n: built.layers.length }) };
}

/** A clicked part: `aes(...)` shows what it maps, a layer shows the step that added it. */
function plotPartStep(entry, ctx) {
  const v = entry.value;
  // The nearest plot this part went into.
  let host = entry.parent;
  while (host && !host.value?.gg) host = host.parent;
  if (v.aes) {
    const names = Object.keys(v.aes.mapping);
    if (!host || !names.length) return { pic: renderPlain(v), caption: t('fx.gg.aesEmpty') };
    // aes() inside a layer belongs to that layer; inside ggplot() to the whole plot.
    const layers = host.value.gg.layers;
    const inLayer = entry.parent?.value?.part?.kind === 'layer';
    const all = inLayer && layers.length ? layers[layers.length - 1].aes : host.value.gg.aes;
    const mine = Object.fromEntries(names.filter((k) => all[k]).map((k) => [k, all[k]]));
    const constant = Object.values(mine).find((a) => a.constant);
    return {
      pic: renderMapping(mine, renderValue),
      caption: constant ? t('fx.gg.constant', { code: constant.code }) : t('fx.gg.aes', { list: names.map((k) => `${mine[k]?.code ?? ''} → ${k}`).join(', ') }),
      tone: constant ? 'trap' : null,
    };
  }
  if (host && host.node.type === 'Binary' && childFor(host, host.node.right) === entry) return plotStep(host, ctx);
  // position_dodge(0.9) is an argument of a layer, not a part added with + (D80).
  if (v.part?.kind === 'position') {
    const { kind, width } = v.part.position;
    if (kind === 'dodge') return { pic: renderPlain(v), caption: t('fx.gg.posDodge', { w: width ?? 0.9 }) };
    return { pic: renderPlain(v), caption: t('fx.gg.position', { fname: `position_${kind}` }) };
  }
  return { pic: renderPlain(v), caption: t('fx.gg.part') };
}

/**
 * The steps of a plot built with `+`: the bare plot first, then one card per part.
 * Climbs from any entry inside the chain, so a clicked layer shows where it stands.
 */
export function plotChainOf(entry) {
  let top = entry;
  while (top && !top.value?.gg) top = top.parent;
  if (!top) return null;
  const isPlus = (e) => e?.node.type === 'Binary' && e.node.op === '+' && Boolean(e.value?.gg);
  while (isPlus(top.parent) && childFor(top.parent, top.parent.node.left) === top) top = top.parent;
  const steps = [];
  let cur = top;
  while (isPlus(cur)) { steps.unshift(cur); cur = childFor(cur, cur.node.left); }
  if (cur?.value?.gg) steps.unshift(cur);
  return steps.length >= 2 ? steps : null;
}

/**
 * What one step of a plot added, in words under its card (D79): the strip then reads
 * as the plot being built, not as a list of function names.
 */
function stepAdds(step, k, part) {
  if (k === 0) return t('fx.gg.step.axes');
  if (!part) return '';
  if (part.kind === 'layer') {
    if (part.geom === 'text') {
      let built = null;
      try { built = buildPlot(step.value); } catch { built = null; }
      const label = built?.layers.at(-1)?.aes?.label;
      return label ? t('fx.gg.step.text', { label }) : t('fx.gg.step.textAny');
    }
    if (part.geom === 'hist') return t('fx.gg.step.hist');
    if (part.geom === 'box') return t('fx.gg.step.box');
    if (part.geom === 'point') return t('fx.gg.step.point');
    if (part.geom === 'line') return t('fx.gg.step.line');
    const pos = part.position?.kind;
    if (pos === 'dodge') return t('fx.gg.step.dodge');
    if (pos === 'fill') return t('fx.gg.step.fill');
    return t(part.geom === 'bar' ? 'fx.gg.step.bar' : 'fx.gg.step.col');
  }
  if (part.kind === 'labels') return t('fx.gg.step.labs', { list: Object.keys(part.labels).join(', ') });
  if (part.kind === 'coord') return t('fx.gg.step.flip');
  if (part.kind === 'facet') return t('fx.gg.step.facet', { by: step.value?.gg?.facet?.code ?? '' });
  if (part.kind === 'theme') return t(part.fname === 'theme' ? 'fx.gg.step.themeSet' : 'fx.gg.step.theme');
  return '';
}

function renderPlotChain(steps, entry, ctx) {
  // The step the clicked entry belongs to: itself, or the `+` whose right side it is.
  let on = entry;
  while (on && !steps.includes(on)) on = on.parent;
  const cards = [];
  steps.forEach((step, k) => {
    const part = addedPart(step);
    const label = k === 0 ? 'ggplot()' : `${part?.fname || '+'}()`;
    if (k > 0) cards.push(el('div.ch-arrow', el('code', '+'), el('span.ch-arrow-line')));
    cards.push(el('button', {
      type: 'button',
      class: ['ch-card', 'ch-card-plot', step === on ? 'ch-on' : ''].filter(Boolean).join(' '),
      title: codeOf(step, ctx.source),
      onClick: () => ctx.onSelect?.(step),
    },
    el('div.ch-pic', renderPlotThumb(step.value)),
    el('div.ch-label', el('code', label)),
    el('div.ch-what', stepAdds(step, k, part))));
  });
  return el('div.ch-strip', el('div.ch-title', t('fx.gg.chain')), el('div.ch-cards', pairArrows(cards)));
}

// ---------------------------------------------------------------------------
// chains: pipes and nests of calls
// ---------------------------------------------------------------------------

const isLink = (entry) => entry?.node.type === 'Call' && !NOT_A_CHAIN.has(calleeName(entry.node))
  && (entry.node.args || []).length > 0 && !entry.node.args[0].name;

const firstChild = (entry) => childFor(entry, entry.node.args?.[0]?.value);

/**
 * The chain an entry belongs to, source first: `ankieta`, `filter(...)`, `select(...)`.
 * Only chains of two or more calls are worth a strip; one call is its own picture.
 */
export function chainOf(entry) {
  if (!entry) return null;
  let top = entry;
  while (top.parent && isLink(top.parent) && firstChild(top.parent) === top) top = top.parent;
  const steps = [];
  let cur = top;
  while (cur) {
    steps.unshift(cur);
    if (!isLink(cur)) break;
    cur = firstChild(cur);
  }
  return steps.length >= 3 && steps.includes(entry) ? steps : null;
}

/**
 * An arrow and the card it points to wrap as one (D80): on a phone the strip breaks
 * into rows, and an arrow left at the end of a row pointed at nothing.
 */
function pairArrows(cards) {
  const out = [];
  for (let i = 0; i < cards.length; i++) {
    const isArrow = String(cards[i].className || '').split(' ').includes('ch-arrow');
    if (isArrow && cards[i + 1]) { out.push(el('div.ch-step', cards[i], cards[i + 1])); i++; } else out.push(cards[i]);
  }
  return out;
}

function renderChain(steps, current, ctx) {
  const cards = [];
  steps.forEach((step, k) => {
    if (k > 0) {
      const fname = calleeName(step.node) || '';
      cards.push(el('div.ch-arrow', el('code', `${fname}()`), el('span.ch-arrow-line')));
    }
    const v = step.value;
    const label = k === 0 ? short(codeOf(step, ctx.source), 16) : `${calleeName(step.node)}()`;
    cards.push(el('button', {
      type: 'button',
      class: ['ch-card', step === current ? 'ch-on' : ''].filter(Boolean).join(' '),
      title: codeOf(step, ctx.source),
      onClick: () => ctx.onSelect?.(step),
    },
    el('div.ch-pic', v && isDataFrame(v) ? renderThumb(v) : renderMini(v, { max: 4 })),
    el('div.ch-label', k === 0 ? el('code', label) : dims(v))));
  });
  return el('div.ch-strip', el('div.ch-title', t('fx.chain')), el('div.ch-cards', pairArrows(cards)));
}

const dims = (v) => {
  if (!v) return '';
  if (isDataFrame(v)) return t('val.dims', { rows: v.values.length ? rLength(v.values[0]) : 0, cols: v.values.length });
  return `${typeLabel(v)} · ${rLength(v)}`;
};

// ---------------------------------------------------------------------------
// the whole stage
// ---------------------------------------------------------------------------

let animation = null;
let stageSeq = 0;

/** Stop any running animation -- the stage is about to show something else. */
export function stopStage() {
  if (animation) { clearInterval(animation); animation = null; }
  releaseLinks();
}

/**
 * Build the stage for an entry.
 * @param {Object} entry
 * @param {Object} ctx  {trace, log, source, onSelect(entry)}
 */
export function renderStage(entry, ctx) {
  stopStage();
  const mine = ++stageSeq;
  if (!entry) return el('div.st-idle', el('div.st-idle-hand', '👆'), el('div', t('fx.idle')));

  const d = describeEntry(entry, ctx);
  const siblings = ctx.log.entriesFor(entry.node);
  const at = siblings.indexOf(entry);
  const group = groupOf(entry, ctx);

  const counter = siblings.length > 1
    ? el('div.st-times',
      el('button.st-mini-btn', { type: 'button', title: t('fx.prevRun'), disabled: at <= 0, onClick: () => ctx.onSelect?.(siblings[at - 1]) }, '‹'),
      el('span', group ? t('fx.runGroup', { k: at + 1, n: siblings.length, group: group.label }) : t('fx.run', { k: at + 1, n: siblings.length })),
      el('button.st-mini-btn', { type: 'button', title: t('fx.nextRun'), disabled: at >= siblings.length - 1, onClick: () => ctx.onSelect?.(siblings[at + 1]) }, '›'))
    : null;

  // The path of enclosing expressions: click to climb out.
  const path = [];
  for (let e = entry.parent; e && path.length < 3; e = e.parent) path.unshift(e);
  const crumbs = path.length
    ? el('div.st-path', path.map((p) => el('button.st-crumb', {
      type: 'button', title: codeOf(p, ctx.source), onClick: () => ctx.onSelect?.(p),
    }, el('code', short(oneLine(codeOf(p, ctx.source)), 26)))), el('span.st-crumb-sep', '›'))
    : null;

  // A plot's own chain is its layers; the pipe that fed it stands behind the first card.
  const plotChain = plotChainOf(entry);
  const chain = plotChain ? null : chainOf(entry);
  const picHost = el('div.st-pic', d.pic);
  const replay = d.frames > 1
    ? el('button.st-mini-btn.st-replay', { type: 'button', title: t('fx.replay'), onClick: () => play() }, '↻')
    : null;

  const stage = el('div', { class: ['st', d.tone ? `st-${d.tone}` : ''].filter(Boolean).join(' ') },
    el('div.st-head',
      crumbs,
      el('div.st-code', el('code', { html: highlightCode(oneLine(codeOf(entry, ctx.source))) })),
      stagePackage(entry, ctx),
      counter,
      replay),
    plotChain ? renderPlotChain(plotChain, entry, ctx) : chain ? renderChain(chain, entry, ctx) : null,
    picHost,
    d.caption ? el('div.st-caption', d.caption) : null);

  // Frames are redrawn from scratch; a stale timer from a stage that has since been
  // replaced must never draw into it, hence the sequence check.
  function play() {
    if (!(d.frames > 1) || mine !== stageSeq) return;
    stopStage();
    let k = 1;
    picHost.replaceChildren(d.frame(k));
    animation = setInterval(() => {
      k++;
      if (k > d.frames || mine !== stageSeq) { clearInterval(animation); animation = null; return; }
      releaseLinks();
      picHost.replaceChildren(d.frame(k));
    }, 260);
  }
  if (d.frames > 1 && !ctx.still) requestAnimationFrame(play);
  return stage;
}

const oneLine = (s) => s.replace(/\s*\n\s*/g, ' ');

/** Labels of the levels no element uses: an answer nobody chose. */
function emptyLevels(f) {
  const labels = (f.attributes?.levels?.values || []).map(String);
  const used = new Set(f.values.filter((c) => !isNA(c)));
  return labels.filter((_, k) => !used.has(k + 1));
}

/** Number labels whose codes differ from them: as.numeric() would silently mislead. */
function codesBetrayLabels(f) {
  if (!factorLabelsAreNumbers(f)) return false;
  const labels = (f.attributes?.levels?.values || []).map(Number);
  return labels.some((x, k) => x !== k + 1);
}
