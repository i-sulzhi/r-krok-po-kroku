/**
 * A ggplot, drawn (D45).
 *
 * This file knows nothing about R. It reads what `buildPlot()` made (marks with
 * positions, scales with breaks, a legend) and turns it into SVG. Whatever is on
 * screen was computed in `core/builtins/ggplot.js`, where the tests look at it.
 *
 * The look follows ggplot2's default theme, the grey panel with white grid lines,
 * in the trainer's own colours so that it sits in both the light and the dark page.
 * Colours a student chose (`fill = "steelblue"`, a fill scale) are kept as they are.
 */

import { el, svg } from '../dom.js';
import { BAR_COLOUR, buildPlot } from '../../core/builtins/ggplot.js';
import { t } from '../../i18n/index.js';

const SIZES = {
  full:    { w: 440, h: 290, font: 11, title: 13 },
  compact: { w: 300, h: 200, font: 10, title: 11.5 },
  thumb:   { w: 96,  h: 64,  font: 0,  title: 0 },
};

/** R's grey35 and friends are not CSS colours; everything else a lesson uses is. */
const cssColour = (c) => {
  const m = /^gr[ae]y(\d{1,3})$/.exec(String(c));
  if (m) { const v = Math.round((Number(m[1]) / 100) * 255); return `rgb(${v}, ${v}, ${v})`; }
  return String(c);
};

/** A number as an axis writes it: as few decimals as the breaks need. */
function tickLabels(breaks) {
  const decimals = Math.max(0, ...breaks.map((b) => (String(b).split('.')[1] || '').length));
  return breaks.map((b) => b.toFixed(Math.min(decimals, 2)));
}

const widthOf = (text, font) => String(text).length * font * 0.56;

/**
 * @param {Object} built   the result of buildPlot()
 * @param {Object} opts    {size: 'full'|'compact'|'thumb', lit: number|null (layer to emphasise)}
 * @returns {SVGElement}
 */
export function renderBuilt(built, { size = 'full', lit = null } = {}) {
  const S = SIZES[size];
  const thumb = size === 'thumb';
  const f = S.font;
  const flip = built.flip;
  const legend = !thumb && built.fill ? built.fill : null;
  const legendSide = legend && (built.legend === 'bottom' || built.legend === 'top') ? built.legend : legend ? 'right' : null;

  // What runs along the bottom and what runs up the side depends on coord_flip().
  const cat = built.x;      // the plot's x: categories, or numbers under the bars
  const val = built.y;      // the plot's y: heights
  const bottom = flip ? val : cat;
  const side = flip ? cat : val;
  const catLabels = cat.discrete ? cat.levels : tickLabels(cat.breaks || []);
  const valLabels = built.y.empty ? [] : tickLabels(val.breaks);
  const sideLabels = flip ? catLabels : valLabels;
  const bottomLabels = flip ? valLabels : catLabels;

  const m = { top: 6, right: 8, bottom: 6, left: 6 };
  if (!thumb) {
    m.top += (built.labels.title ? S.title + 6 : 0) + (built.labels.subtitle ? f + 4 : 0);
    m.bottom += f + 6 + (bottom.label ? f + 6 : 0) + (built.labels.caption ? f + 4 : 0);
    m.left += Math.max(0, ...sideLabels.map((s) => widthOf(s, f))) + 6 + (side.label ? f + 6 : 0);
    if (legendSide === 'right') m.right += Math.max(widthOf(legend.title, f), ...legend.keys.map((k) => widthOf(k.label, f) + f + 6)) + 12;
    if (legendSide === 'bottom' || legendSide === 'top') m[legendSide] += f + 12;
  }
  const pw = S.w - m.left - m.right;
  const ph = S.h - m.top - m.bottom;
  const X0 = m.left;
  const Y0 = m.top;

  // Data to pixels. `along` is the category axis, `up` the value axis.
  const frac = (v, range) => (v - range[0]) / (range[1] - range[0]);
  const along = (v) => (flip ? Y0 + ph - frac(v, cat.range) * ph : X0 + frac(v, cat.range) * pw);
  const up = (v) => (flip ? X0 + frac(v, val.range) * pw : Y0 + ph - frac(v, val.range) * ph);

  const root = svg('svg', {
    class: `gp gp-${size} gp-theme-${built.theme}`,
    viewBox: `0 0 ${S.w} ${S.h}`,
    role: 'img',
    'aria-label': built.labels.title || t('gp.aria'),
  });
  root.append(svg('rect', { class: 'gp-panel', x: X0, y: Y0, width: pw, height: ph }));

  // --- grid ----------------------------------------------------------------
  const grid = svg('g', { class: 'gp-grid' });
  if (!built.y.empty) {
    for (const b of val.breaks) {
      const p = up(b);
      grid.append(flip ? svg('line', { x1: p, x2: p, y1: Y0, y2: Y0 + ph }) : svg('line', { x1: X0, x2: X0 + pw, y1: p, y2: p }));
    }
  }
  const catTicks = cat.discrete ? cat.levels.map((_, i) => i + 1) : cat.breaks || [];
  for (const c of catTicks) {
    const p = along(c);
    grid.append(flip ? svg('line', { x1: X0, x2: X0 + pw, y1: p, y2: p }) : svg('line', { x1: p, x2: p, y1: Y0, y2: Y0 + ph }));
  }
  root.append(grid);

  // --- marks ---------------------------------------------------------------
  built.layers.forEach((layer, index) => {
    const dim = lit != null && lit !== index;
    const g = svg('g', { class: ['gp-layer', `gp-geom-${layer.geom}`, dim ? 'gp-dim' : ''].filter(Boolean).join(' ') });
    for (const mark of layer.marks) {
      if (layer.geom === 'text') {
        if (thumb) continue;
        const vjust = layer.params.vjust ?? 0.5;
        const hjust = layer.params.hjust ?? 0.5;
        const px = flip ? up(mark.at) : along(mark.xmid);
        const py = flip ? along(mark.xmid) : up(mark.at);
        g.append(svg('text', {
          class: 'gp-label',
          x: px + (flip ? (0.5 - hjust) * 2 * f * 0.6 : 0),
          y: py + (flip ? f * 0.36 : vjust * f * 0.74),
          'text-anchor': flip ? (hjust <= 0 ? 'start' : hjust >= 1 ? 'end' : 'middle') : 'middle',
          'font-size': f,
          fill: layer.params.colour ? cssColour(layer.params.colour) : null,
        }, mark.label));
        continue;
      }
      const a1 = along(mark.xmin);
      const a2 = along(mark.xmax);
      const u1 = up(mark.ymin);
      const u2 = up(mark.ymax);
      const own = mark.fill !== BAR_COLOUR;
      const rect = svg('rect', {
        class: own ? 'gp-bar' : 'gp-bar gp-bar-plain',
        x: flip ? Math.min(u1, u2) : Math.min(a1, a2),
        y: flip ? Math.min(a1, a2) : Math.min(u1, u2),
        width: Math.max(0.5, flip ? Math.abs(u2 - u1) : Math.abs(a2 - a1)),
        height: Math.max(0.5, flip ? Math.abs(a2 - a1) : Math.abs(u2 - u1)),
        fill: own ? cssColour(mark.fill) : null,
        'fill-opacity': layer.params.alpha ?? null,
        stroke: layer.params.colour ? cssColour(layer.params.colour) : null,
      });
      if (!thumb) {
        const shown = built.y.share ? `${Math.round((mark.ymax - mark.ymin) * 100)}%` : String(Number((mark.ymax - mark.ymin).toPrecision(6)));
        rect.append(svg('title', {}, `${mark.xKey}${mark.fillKey != null ? ` · ${mark.fillKey}` : ''}: ${shown}`));
      }
      g.append(rect);
    }
    root.append(g);
  });
  if (thumb) return root;

  // --- axes ----------------------------------------------------------------
  const axes = svg('g', { class: 'gp-axes', 'font-size': f });
  bottomLabels.forEach((label, i) => {
    const at = flip ? up(val.breaks[i]) : along(cat.discrete ? i + 1 : cat.breaks[i]);
    axes.append(svg('text', { class: 'gp-tick gp-tick-bottom', x: at, y: Y0 + ph + f + 3, 'text-anchor': 'middle' }, label));
  });
  sideLabels.forEach((label, i) => {
    const at = flip ? along(cat.discrete ? i + 1 : cat.breaks[i]) : up(val.breaks[i]);
    axes.append(svg('text', { class: 'gp-tick gp-tick-side', x: X0 - 5, y: at + f * 0.36, 'text-anchor': 'end' }, label));
  });
  if (bottom.label) {
    axes.append(svg('text', { class: 'gp-axis-title gp-axis-title-bottom', x: X0 + pw / 2, y: Y0 + ph + 2 * f + 9, 'text-anchor': 'middle' }, bottom.label));
  }
  if (side.label) {
    const cx = f + 2;
    const cy = Y0 + ph / 2;
    axes.append(svg('text', { class: 'gp-axis-title gp-axis-title-side', x: cx, y: cy, 'text-anchor': 'middle', transform: `rotate(-90 ${cx} ${cy})` }, side.label));
  }
  root.append(axes);

  // --- titles --------------------------------------------------------------
  if (built.labels.title) root.append(svg('text', { class: 'gp-title', x: X0, y: S.title + 3, 'font-size': S.title }, built.labels.title));
  if (built.labels.subtitle) root.append(svg('text', { class: 'gp-subtitle', x: X0, y: m.top - 5, 'font-size': f }, built.labels.subtitle));
  if (built.labels.caption) root.append(svg('text', { class: 'gp-caption', x: X0 + pw, y: S.h - 5, 'font-size': f * 0.9, 'text-anchor': 'end' }, built.labels.caption));

  // --- legend --------------------------------------------------------------
  if (legend) {
    const g = svg('g', { class: 'gp-legend', 'font-size': f });
    if (legendSide === 'right') {
      const lx = X0 + pw + 10;
      let ly = Y0 + Math.max(0, ph / 2 - ((legend.keys.length + 1) * (f + 5)) / 2) + f;
      g.append(svg('text', { class: 'gp-legend-title', x: lx, y: ly }, legend.title));
      for (const k of legend.keys) {
        ly += f + 5;
        g.append(svg('rect', { class: 'gp-key', x: lx, y: ly - f + 1, width: f, height: f, fill: cssColour(k.colour) }));
        g.append(svg('text', { class: 'gp-key-label', x: lx + f + 5, y: ly }, k.label));
      }
    } else {
      const ly = legendSide === 'bottom' ? S.h - 6 - (built.labels.caption ? f + 4 : 0) : m.top - f - 4;
      let lx = X0;
      g.append(svg('text', { class: 'gp-legend-title', x: lx, y: ly }, legend.title));
      lx += widthOf(legend.title, f) + 10;
      for (const k of legend.keys) {
        g.append(svg('rect', { class: 'gp-key', x: lx, y: ly - f + 1, width: f, height: f, fill: cssColour(k.colour) }));
        g.append(svg('text', { class: 'gp-key-label', x: lx + f + 4, y: ly }, k.label));
        lx += f + 4 + widthOf(k.label, f) + 10;
      }
    }
    root.append(g);
  }
  return root;
}

/** A plot value as a picture. A plot that cannot be built is shown as its error. */
export function renderPlot(plot, opts = {}) {
  let built;
  try {
    built = buildPlot(plot);
  } catch (e) {
    return el('div.gp-broken', e.message || String(e));
  }
  return el('div', { class: `gp-box gp-box-${opts.size || 'full'}` }, renderBuilt(built, opts));
}

/** The plot as a card for a chain of steps: small, no text. */
export const renderPlotThumb = (plot) => renderPlot(plot, { size: 'thumb' });

// ---------------------------------------------------------------------------
// pictures of the parts
// ---------------------------------------------------------------------------

const AES_PLACE = { x: 'gp.aes.x', y: 'gp.aes.y', fill: 'gp.aes.fill', colour: 'gp.aes.colour', label: 'gp.aes.label', group: 'gp.aes.group' };

/**
 * What aes() says: which column goes where on the plot. One row per aesthetic, the
 * column's own values beside it, so "x = miasto" is seen as cities along an axis.
 * @param {Object} aes  evaluated aesthetics of a plot or a layer: {x: {value, code, constant}}
 * @param {Function} drawColumn  how a column is drawn (value.js; passed in, because
 *   value.js draws plots with this file and the single-file build allows no cycle)
 */
export function renderMapping(aes, drawColumn) {
  const rows = Object.entries(aes).map(([name, a]) => el('div', { class: ['gp-map-row', a.constant ? 'gp-map-const' : ''].filter(Boolean).join(' ') },
    el('code.gp-map-code', a.code),
    el('span.gp-map-arrow', '→'),
    el('span.gp-map-aes', el('b', name), ' ', t(AES_PLACE[name] || 'gp.aes.other')),
    el('div.gp-map-values', drawColumn(a.value, { compact: true }))));
  return el('div.gp-map', rows);
}

/**
 * The table a layer draws from. For geom_bar() that is the count it made itself;
 * for geom_col() it is the rows it was handed. One row of it is one bar.
 * @returns {Element|null}
 */
export function renderLayerTable(built, index) {
  const layer = built.layers[index];
  if (!layer || layer.geom === 'text') return null;
  const counted = layer.stat?.kind === 'count';
  const hasFill = layer.marks.some((m) => m.fillKey != null);
  const head = [layer.aes.x, hasFill ? layer.aes.fill : null, counted ? 'count' : layer.aes.y].filter((h) => h != null);
  const body = layer.marks.map((m) => el('tr',
    el('td', m.xKey),
    hasFill ? el('td', el('span.gp-swatch', { style: { background: cssColour(m.fill) } }), m.fillKey) : null,
    el('td.gp-num', String(Number((counted ? m.count : m.ymax - m.ymin).toPrecision(6))))));
  return el('table', { class: ['gp-table', counted ? 'gp-table-counted' : ''].filter(Boolean).join(' ') },
    el('thead', el('tr', head.map((h) => el('th', h)))),
    el('tbody', body));
}
