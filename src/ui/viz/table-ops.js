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
  const { rowState = null, colState = null, rowGroup = null, rowLabel = null, caption = null } = opts;
  if (!preview) return el('div.pl-note', '');
  const n = preview.columns.length ? preview.columns[0].values.length : 0;

  const header = el('tr',
    el('th.rv-rownum', ''),
    preview.names.map((nm, j) => el('th', {
      class: ['tv-col', colState ? `tv-${colState(j)}` : ''].filter(Boolean).join(' '),
      dataset: { type: preview.columns[j]?.type || '' },
    }, el('div.rv-col-name', nm), el('div.rv-col-type', preview.columns[j]?.type ? t(`badge.${preview.columns[j].type}`) : ''))));

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
    }, tableCell(col.values[i], col.type)))));
  }
  if (preview.truncated) {
    rows.push(el('tr', el('td.rv-rownum', '…'), preview.columns.map(() => el('td', '…'))));
  }

  return el('div.tv-table-wrap',
    caption && el('div.tv-caption', caption),
    el('table.rv-table.tv-table', el('thead', header), el('tbody', rows)));
}

/** filter(): which rows survived, and what decided each one. */
export function renderFilter(ev) {
  const d = ev.data;
  const mask = d.mask || [];
  const naSet = new Set(d.naDropped || []);
  const cond = d.conditions;

  const table = previewTable(d.preview, {
    rowState: (i) => (mask[i] ? 'keep' : 'drop'),
    rowLabel: (i) => String(i + 1),
  });

  // The decision column: the TRUE/FALSE (or NA) behind each row.
  const decisions = el('div.tv-decisions',
    el('div.tv-decisions-head', t('tv.decision')),
    mask.map((keep, i) => {
      const value = cond ? cond[i] : keep;
      const isNAv = naSet.has(i);
      return el('div', {
        class: ['tv-decision', keep ? 'tv-keep' : 'tv-drop', isNAv ? 'tv-na' : ''].filter(Boolean).join(' '),
      }, isNAv ? 'NA' : (value ? 'TRUE' : 'FALSE'));
    }));

  return el('div.tv-panel', el('div.tv-side-by-side', table, decisions));
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
  return el('div.tv-panel', previewTable(d.preview, { colState: (j) => (j === newIndex ? 'new' : null) }));
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
  const afterTable = previewTable(after, {
    rowLabel: (i) => String(order[i] + 1),   // where this row came from
    caption: t('tv.after'),
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
