/**
 * Panels for the tidyverse verbs.
 *
 * Each verb is drawn as what it does to the table's *shape*:
 *
 *   filter    rows dim out, with the TRUE/FALSE that decided each one
 *   select    columns dim out
 *   mutate    a column appears, its values traced back to the row they came from
 *   arrange   rows move, with a line from old position to new
 *   group_by  the table splits into coloured blocks
 *   summarise each block collapses into a single row
 *
 * The last two are the point of the file. Grouping is invisible in RStudio -- the
 * printed tibble looks almost unchanged -- so students carry a vague idea of what
 * `group_by |> summarise` does until they see the split and the collapse.
 *
 * All panels are built from the `preview` payload the verbs put on their events.
 */

import { el, svg } from '../dom.js';
import { t } from '../../i18n/index.js';
import { formatScalar } from '../../core/format.js';
import { NA, isNA } from '../../core/rvalue.js';

/** Distinct hues for group blocks; deliberately few, and reused with a pattern. */
const GROUP_COLOURS = 6;

const tableCell = (v, type) => formatScalar(v, type);

/**
 * Render a preview table.
 * @param {Object} preview  {names, columns:[{type, values}], rows, truncated}
 * @param {Object} opts
 *   rowState  -- (i) => 'keep' | 'drop' | null
 *   colState  -- (j) => 'keep' | 'drop' | 'new' | null
 *   rowGroup  -- (i) => group index, for colouring
 *   rowLabel  -- (i) => extra text in the row-number cell
 */
export function previewTable(preview, opts = {}) {
  const { rowState = null, colState = null, rowGroup = null, rowLabel = null, caption = null, extra = [] } = opts;
  if (!preview) return el('div.pl-note', '');
  const n = preview.columns.length ? preview.columns[0].values.length : 0;

  const header = el('tr',
    el('th.rv-rownum', ''),
    preview.names.map((nm, j) => el('th', {
      class: ['tv-col', colState ? `tv-${colState(j)}` : ''].filter(Boolean).join(' '),
      dataset: { type: preview.columns[j]?.type || '' },
    }, el('div.rv-col-name', nm), el('div.rv-col-type', preview.columns[j]?.type ? t(`badge.${preview.columns[j].type}`) : ''))),
    extra.map((x) => el('th.tv-cond-head', el('div.rv-col-name', x.head), el('div.rv-col-type', x.sub || ''))));

  const rows = [];
  for (let i = 0; i < n; i++) {
    const state = rowState ? rowState(i) : null;
    const g = rowGroup ? rowGroup(i) : null;
    rows.push(el('tr', {
      class: ['tv-row', state ? `tv-${state}` : '', g != null ? `tv-g${g % GROUP_COLOURS}` : ''].filter(Boolean).join(' '),
      dataset: { row: i },
      style: { '--r': i },
    },
    el('td.rv-rownum', rowLabel ? rowLabel(i) : String(i + 1)),
    preview.columns.map((col, j) => el('td', {
      class: [colState ? `tv-${colState(j)}` : '', col.values[i] === null ? 'rv-na' : ''].filter(Boolean).join(' '),
      dataset: { type: col.type },
    }, tableCell(col.values[i], col.type))),
    // Extra cells sit in the same row as the data, so they cannot drift from it.
    extra.map((x) => {
      const c = x.cell(i);
      return el('td', { class: `tv-cond ${c.cls}` }, c.text);
    })));
  }
  if (preview.truncated) {
    rows.push(el('tr', el('td.rv-rownum', '…'), preview.columns.map(() => el('td', '…')), extra.map(() => el('td', '…'))));
  }

  return el('div.tv-table-wrap',
    caption && el('div.tv-caption', caption),
    el('table.rv-table.tv-table', el('thead', header), el('tbody', rows)));
}

const logicalCell = (v) => (isNA(v) ? { text: 'NA', cls: 'tv-c-na' } : v ? { text: 'TRUE', cls: 'tv-c-true' } : { text: 'FALSE', cls: 'tv-c-false' });

/**
 * filter(): which rows survived, and what decided each one. Each condition is a
 * column at the end of the table, in the same rows as the data, headed by its own
 * code; with several, a last column shows "both", the rows that stay.
 * @param {Object} ev      the DPLYR_FILTER event
 * @param {string[]} labels  the code of each condition, in order
 */
export function renderFilter(ev, labels = []) {
  const d = ev.data;
  const mask = d.mask || [];
  const naSet = new Set(d.naDropped || []);
  const parts = d.parts || (d.conditions ? [d.conditions] : []);
  const at = (values, i) => values[values.length === 1 ? 0 : i];

  const extra = parts.map((values, k) => ({
    head: labels[k] || t('tv.decision'),
    sub: t('badge.logical'),
    cell: (i) => logicalCell(at(values, i)),
  }));
  if (parts.length > 1) {
    extra.push({
      head: t('tv.both'),
      sub: t('tv.bothSub'),
      cell: (i) => (mask[i] ? logicalCell(true) : naSet.has(i) && !parts.some((v) => at(v, i) === false) ? logicalCell(NA) : logicalCell(false)),
    });
  }
  // Slicing and distinct() carry no condition: then the old single column, from the mask.
  if (!extra.length) extra.push({ head: t('tv.decision'), sub: '', cell: (i) => logicalCell(mask[i]) });

  return el('div.tv-panel', previewTable(d.preview, {
    rowState: (i) => (mask[i] ? 'keep' : 'drop'),
    rowLabel: (i) => String(i + 1),
    extra,
  }));
}

/** select(): columns kept and dropped. */
export function renderSelect(ev) {
  const d = ev.data;
  const kept = new Set(d.kept || []);
  return el('div.tv-panel', previewTable(d.preview, { colState: (j) => (kept.has(j) ? 'keep' : 'drop') }));
}

/** mutate(): the new column, and whether it replaced an old one. */
export function renderMutate(ev) {
  const d = ev.data;
  const newIndex = (d.preview?.names || []).indexOf(d.name);
  // After group_by() the rows wear their group's colour: the new column was worked
  // out inside each colour, which is why its percentages add up to 100 per colour.
  const rowToGroup = new Map();
  (d.groups || []).forEach((g, gi) => g.rows.forEach((r) => rowToGroup.set(r, gi)));
  return el('div.tv-panel',
    d.groups ? el('div.tv-group-legend', d.groups.map((g, gi) => el('div', { class: `tv-chip tv-g${gi % GROUP_COLOURS}` },
      el('span.tv-chip-label', g.labels.join(' · '))))) : null,
    previewTable(d.preview, {
      colState: (j) => (j === newIndex ? 'new' : null),
      rowGroup: d.groups ? (i) => rowToGroup.get(i) : null,
    }));
}

/**
 * pivot_wider() (D38): the long table above, the wide one below, and one colour per
 * value of the `names_from` column. A row of the long table wears the colour of the
 * column it goes to, and that column wears it too, so the eye can follow "all the M
 * rows became the M column" without reading a single number. A cell no row went to
 * stays hatched: that is the gap the caption talks about.
 */
export function renderPivotWider(ev) {
  const d = ev.data;
  const fromAt = d.input.names.indexOf(d.from);
  const valAt = d.input.names.indexOf(d.val);
  const firstNew = d.ids.length;
  return el('div.tv-panel.tv-pivot',
    el('div.tv-group-legend',
      el('span.tv-pivot-key', `${d.from}:`),
      d.labels.map((label, k) => el('div', { class: `tv-chip tv-g${k % GROUP_COLOURS}` }, el('span.tv-chip-label', label)))),
    previewTable(d.input, {
      caption: t('tv.long'),
      rowGroup: (i) => d.rowLabel[i],
      colState: (j) => (j === fromAt || j === valAt ? 'pvsrc' : null),
    }),
    el('div.tv-pivot-arrow', el('span.tv-pivot-line'), el('code', 'pivot_wider()')),
    previewTable(d.output, {
      caption: t('tv.wide'),
      colState: (j) => (j >= firstNew ? `g${(j - firstNew) % GROUP_COLOURS} tv-pv` : null),
    }));
}

/**
 * pivot_longer() (D39): the wide table above with one colour per folded column, the
 * long one below with every row wearing the colour of the column it came from. Only
 * the rows of the first two people are drawn: the pattern is complete after two, and
 * the caption says how many rows there are in all.
 */
export function renderPivotLonger(ev) {
  const d = ev.data;
  const foldAt = d.cols.map((nm) => d.input.names.indexOf(nm));
  const shown = Math.min(d.output.columns[0]?.values.length || 0, d.rowSource.length, 2 * d.cols.length);
  const head = {
    ...d.output,
    truncated: shown < d.rowsOut,
    columns: d.output.columns.map((c) => ({ ...c, values: c.values.slice(0, shown) })),
  };
  const firstNew = d.ids.length;
  return el('div.tv-panel.tv-pivot',
    el('div.tv-group-legend',
      el('span.tv-pivot-key', `${d.namesTo}:`),
      d.cols.map((label, k) => el('div', { class: `tv-chip tv-g${k % GROUP_COLOURS}` }, el('span.tv-chip-label', label)))),
    previewTable(d.input, {
      caption: t('tv.wideIn'),
      colState: (j) => (foldAt.includes(j) ? `g${foldAt.indexOf(j) % GROUP_COLOURS} tv-pv` : null),
    }),
    el('div.tv-pivot-arrow', el('span.tv-pivot-line'), el('code', 'pivot_longer()')),
    previewTable(head, {
      caption: t('tv.longOut'),
      rowGroup: (i) => d.rowSource[i],
      colState: (j) => (j >= firstNew ? 'pvsrc' : null),
    }));
}

/**
 * left_join() and its family (D40): the two tables above, the joined one below, and
 * one colour per key value. A row on the left, its partner on the right and the row
 * they make together wear the same colour, so "this person got that city's region"
 * is read without reading the key. What has no partner has no colour: a left row
 * that stays with NA is flagged, a row that does not come along is struck out.
 */
export function renderJoin(ev) {
  const d = ev.data;
  // The third hue is close to the warning colour that flags a row with no partner.
  const hue = (k) => (k == null ? null : [0, 1, 3, 4, 5, 2][k % GROUP_COLOURS]);
  const noPartner = new Set(d.unmatchedX);
  const unusedY = new Set(d.unmatchedY);
  const keyX = d.by.map((p) => d.x.names.indexOf(p.x));
  const keyY = d.by.map((p) => d.y.names.indexOf(p.y));
  const left = previewTable(d.x, {
    caption: t('tv.joinLeft'),
    rowGroup: (i) => (noPartner.has(i) ? null : hue(d.xGroup[i])),
    rowState: (i) => (d.filter ? ((d.filter === 'unmatched') === noPartner.has(i) ? 'keep' : 'drop')
      : noPartner.has(i) ? (d.keptX ? 'miss' : 'drop') : null),
    colState: (j) => (keyX.includes(j) ? 'pvsrc' : null),
  });
  const right = previewTable(d.y, {
    caption: t('tv.joinRight'),
    rowGroup: (j) => hue(d.yGroup[j]),
    rowState: (j) => (unusedY.has(j) ? (d.keptY ? 'miss' : 'drop') : null),
    colState: (j) => (keyY.includes(j) ? 'pvsrc' : null),
  });
  const firstNew = d.output.names.length - d.added.length;
  return el('div.tv-panel.tv-pivot',
    el('div.tv-join-in', left, right),
    el('div.tv-pivot-arrow', el('span.tv-pivot-line'), el('code', `${d.fname}()`),
      el('span.tv-join-key', `${t('tv.joinKey')}: ${d.by.map((p) => (p.x === p.y ? p.x : `${p.x} = ${p.y}`)).join(', ')}`)),
    d.filter ? null : previewTable(d.output, {
      caption: t('tv.joinOut'),
      rowGroup: (i) => (d.from[i] && d.from[i][0] != null && d.from[i][1] != null ? hue(d.xGroup[d.from[i][0]]) : null),
      rowState: (i) => (d.from[i] && (d.from[i][0] == null || d.from[i][1] == null) ? 'miss' : null),
      colState: (j) => (j >= firstNew ? 'jn' : null),
    }));
}

/** arrange(): rows move, with a line from each old position to its new one. */
export function renderArrange(ev) {
  const d = ev.data;
  const order = d.order || [];
  const before = previewTable(d.preview, { rowLabel: (i) => String(i + 1), caption: t('tv.before') });

  // Reorder the preview to show the result.
  const after = d.preview ? {
    ...d.preview,
    columns: d.preview.columns.map((c) => ({ ...c, values: order.map((r) => c.values[r]) })),
  } : null;
  const sortedBy = new Set((d.by || []).map((k) => k.name));
  const afterTable = previewTable(after, {
    rowLabel: (i) => String(order[i] + 1),   // where this row came from
    caption: t('tv.after'),
    // The column the rows were put in order by: the one the eye should run down.
    colState: (j) => (sortedBy.has(d.preview?.names[j]) ? 'new' : null),
  });

  return el('div.tv-panel', el('div.tv-side-by-side', before, el('div.tv-arrow', '→'), afterTable));
}

/** group_by(): the table splits into blocks. */
export function renderGroup(ev) {
  const d = ev.data;
  const groups = d.groups || [];
  const rowToGroup = new Map();
  groups.forEach((g, gi) => g.rows.forEach((r) => rowToGroup.set(r, gi)));

  // Rows are shown grouped together, which is the whole point of the picture.
  const ordered = groups.flatMap((g) => g.rows);
  const reordered = d.preview ? {
    ...d.preview,
    columns: d.preview.columns.map((c) => ({ ...c, values: ordered.map((r) => c.values[r]) })),
  } : null;

  return el('div.tv-panel',
    el('div.tv-group-legend', groups.map((g, gi) => el('div', { class: `tv-chip tv-g${gi % GROUP_COLOURS}` },
      el('span.tv-chip-label', g.labels.join(' · ')),
      el('span.tv-chip-size', String(g.size))))),
    previewTable(reordered, {
      rowGroup: (i) => rowToGroup.get(ordered[i]),
      rowLabel: (i) => String(ordered[i] + 1),
    }));
}

/** summarise(): each block collapses to one row. */
export function renderSummarise(ev) {
  const d = ev.data;
  const groups = d.groups || [];

  const blocks = el('div.tv-collapse', groups.map((g, gi) => el('div.tv-collapse-row',
    el('div', { class: `tv-block tv-g${gi % GROUP_COLOURS}` },
      el('div.tv-block-label', g.labels.join(' · ') || t('tv.wholeTable')),
      el('div.tv-block-rows', Array.from({ length: Math.min(g.size, 12) }, () => el('span.tv-block-row')),
        g.size > 12 ? el('span.tv-block-more', `+${g.size - 12}`) : null),
      el('div.tv-block-size', t('tv.rowsCount', { n: g.size }))),
    el('div.tv-collapse-arrow', '⟶'),
    el('div', { class: `tv-result tv-g${gi % GROUP_COLOURS}` },
      g.labels.map((l) => el('span.tv-result-key', l)),
      g.results.map((r) => el('span.tv-result-value',
        el('span.tv-result-name', r.name),
        el('span.tv-result-num', tableCell(r.value))))))));

  return el('div.tv-panel', blocks);
}
