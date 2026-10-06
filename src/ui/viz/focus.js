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
import { EV } from '../../trace/events.js';
import { ownEvents, eventsWithin } from '../../trace/evallog.js';
import {
  isNA, isAtomic, isFactor, isDataFrame, rLength, getNames,
} from '../../core/rvalue.js';
import { formatScalar } from '../../core/format.js';
import { factorLabelsAreNumbers } from '../../core/arith.js';
import { renderValue, renderMini, renderThumb, typeLabel, renderDataFrame, sheetColumn } from './value.js';
import {
  renderElementwise, renderCombine, renderFunnel, renderMap, renderPick, renderPickRows,
  renderDollar, renderFactorMake, renderFactorOut, renderCounts, renderAssemble,
  renderMachine, renderAssign, renderPlain, renderMembership, renderErrorPic, arrow, renderRowMask,
} from './pictures.js';
import {
  renderFilter, renderSelect, renderMutate, renderArrange, renderGroup, renderSummarise,
} from './table-ops.js';
import { renderRegex } from './regex.js';
import { renderRecode } from './recode.js';
import { releaseLinks } from './links.js';
import { sheetPanel, sideBySide } from './sheet.js';
import { highlightCode } from '../codebox.js';
import { t } from '../../i18n/index.js';

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
    return { pic: renderErrorPic(message), caption: t('fx.error'), tone: 'error' };
  }
  const node = entry.node;
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
    default:
      return plain(entry);
  }
}

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

  const rc = own.filter((e) => e.type === EV.RECODE).pop();
  if (rc) return recode(entry, ctx, rc.data);

  if (fname === 'desc') return { pic: renderMap(input, v, { label: 'desc()' }), caption: t('fx.desc') };

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
      caption = t('fx.mean', { sum: fmt(sum), n: known.length, result: fmt(result) });
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
    cur = p;
  }
  return null;
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
  return el('div.ch-strip', el('div.ch-title', t('fx.chain')), el('div.ch-cards', cards));
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

  const chain = chainOf(entry);
  const picHost = el('div.st-pic', d.pic);
  const replay = d.frames > 1
    ? el('button.st-mini-btn.st-replay', { type: 'button', title: t('fx.replay'), onClick: () => play() }, '↻')
    : null;

  const stage = el('div', { class: ['st', d.tone ? `st-${d.tone}` : ''].filter(Boolean).join(' ') },
    el('div.st-head',
      crumbs,
      el('div.st-code', el('code', { html: highlightCode(oneLine(codeOf(entry, ctx.source))) })),
      counter,
      replay),
    chain ? renderChain(chain, entry, ctx) : null,
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
