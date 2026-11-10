/**
 * A linear model, drawn (lecture 5, D91).
 *
 * The picture is the point plot of exercise 29 with the model on it: the line R
 * chose, and on request the one thing a scene is about. Everything here is read from
 * the fitted `lm` object (`value.lm`): the rows R used, the coefficients, the fitted
 * values. Nothing is computed here that the engine did not compute first, except
 * reading the line at a point (b0 + b1 * x), which is what the line is.
 *
 * It uses the plot's own classes (grey panel, white grid), so a model looks like the
 * ggplot2 plots the student already knows.
 *
 * Focus, one per picture:
 *   line        the points and the line
 *   slope       a step along x and the change in y it brings
 *   intercept   the line carried to x = 0, dashed where there are no data
 *   residuals   a segment from each point to the line, the longest one named
 *   fitted      the line read at every person of the data
 *   predict     the line read at new values; outside the data, a grey zone. When the
 *               new people come with their real answers (a test set, lecture 6),
 *               each is a hollow point with its miss drawn down to the line
 */

import { svg } from '../dom.js';
import { prettyBreaks, HUES } from '../../core/builtins/ggplot.js';
import { formatScalar } from '../../core/format.js';
import { isNA } from '../../core/rvalue.js';
import { polyCurve } from '../../core/builtins/models.js';
import { t } from '../../i18n/index.js';

const SIZE = { w: 440, h: 290, font: 11 };

const num = (x) => (isNA(x) ? 'NA' : formatScalar(Number(x.toPrecision(3)), 'double'));

/** The line of a model with one number on the right side of `~`, or null. */
export function simpleLine(info) {
  // poly(x, k): a curve, drawn from the model's own forecasts (lecture 6).
  const curve = polyCurve(info);
  if (curve) {
    const tm = info.terms[0];
    const xs = tm.values.map(Number);
    return {
      curve: true, at: curve, degree: tm.degree, b0: NaN, b1: NaN, xs, ys: info.y,
      xCode: tm.xCode, yCode: info.responseCode,
      rows: info.used.map((i) => info.rowNames[i]),
      fitted: info.fit.fitted,
      residuals: info.fit.residuals,
      xmin: Math.min(...xs), xmax: Math.max(...xs),
    };
  }
  if (!info || info.terms.length !== 1 || info.terms[0].kind !== 'numeric') return null;
  const [b0, b1] = info.fit.coef;
  if (isNA(b0) || isNA(b1)) return null;
  const xs = info.X.map((row) => row[1]);
  return {
    b0, b1, xs, ys: info.y,
    xCode: info.terms[0].code, yCode: info.responseCode,
    rows: info.used.map((i) => info.rowNames[i]),
    fitted: info.fit.fitted,
    residuals: info.fit.residuals,
    xmin: Math.min(...xs), xmax: Math.max(...xs),
  };
}

/**
 * The points of two numeric vectors as a "line" renderModelPlot() can draw, for cor():
 * complete pairs only, with the least-squares line kept for the axes but not drawn.
 */
export function pointsLine(xs0, ys0, xCode, yCode) {
  const xs = [];
  const ys = [];
  const rows = [];
  xs0.forEach((x, i) => {
    const y = ys0[i];
    if (x == null || y == null || isNA(x) || isNA(y) || !Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) return;
    xs.push(Number(x)); ys.push(Number(y)); rows.push(String(i + 1));
  });
  if (xs.length < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const b1 = sxx ? xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx : 0;
  const b0 = my - b1 * mx;
  const fitted = xs.map((x) => b0 + b1 * x);
  return { b0, b1, xs, ys, xCode, yCode, rows, fitted, residuals: ys.map((y, i) => y - fitted[i]), xmin: Math.min(...xs), xmax: Math.max(...xs) };
}

/** A tidy step along x for the slope triangle: the spacing of the axis breaks. */
export function slopeStep(line) {
  const br = prettyBreaks(line.xmin, line.xmax);
  return br.length > 1 ? br[1] - br[0] : 1;
}

/**
 * @param {Object} line   from simpleLine()
 * @param {Object} opts   {focus, predictions: [{x, y, inside}], total, hand, corValue}
 *   corValue  with focus 'cor': the correlation, written in the corner; no line drawn
 *   total  the sum of squares, as the engine computed it, written in the corner
 *   hand   the line was typed by hand (8 - 0.1 * wiek), not chosen by lm()
 */
export function renderModelPlot(line, { focus = 'line', predictions = [], total = null, hand = false, corValue = null, misses = true } = {}) {
  const S = SIZE;
  const f = S.font;
  const at = line.at || ((x) => line.b0 + line.b1 * x);
  // A curve is drawn from many points; its bends set the axis too.
  const sampleXs = (a, b, k = 80) => Array.from({ length: k + 1 }, (_, i) => a + ((b - a) * i) / k);

  // What the axes must hold.
  const xsShown = [...line.xs, ...predictions.map((p) => p.x)];
  if (focus === 'intercept') xsShown.push(0);
  let xlo = Math.min(...xsShown);
  let xhi = Math.max(...xsShown);
  const lineLo = Math.min(xlo, line.xmin);
  const lineHi = Math.max(xhi, line.xmax);
  const ysShown = [...line.ys, at(lineLo), at(lineHi), ...predictions.map((p) => p.y),
    ...(line.curve ? sampleXs(line.xmin, line.xmax).map(at) : []),
    ...predictions.filter((p) => p.actual != null).map((p) => p.actual)];
  let ylo = Math.min(...ysShown);
  let yhi = Math.max(...ysShown);
  // ggplot2's default: 5% of the range added on each side.
  const padX = (xhi - xlo || 1) * 0.05;
  const padY = (yhi - ylo || 1) * 0.05;
  xlo -= padX; xhi += padX; ylo -= padY; yhi += padY;
  const xBreaks = prettyBreaks(xlo, xhi).filter((b) => b >= xlo && b <= xhi);
  const yBreaks = prettyBreaks(ylo, yhi).filter((b) => b >= ylo && b <= yhi);
  const label = (b) => String(Number(b.toPrecision(10)));

  const m = { top: 8, right: 10, bottom: 2 * f + 16, left: Math.max(...yBreaks.map((b) => label(b).length)) * f * 0.56 + f + 18 };
  const pw = S.w - m.left - m.right;
  const ph = S.h - m.top - m.bottom;
  const X0 = m.left;
  const Y0 = m.top;
  const px = (x) => X0 + ((x - xlo) / (xhi - xlo)) * pw;
  const py = (y) => Y0 + ph - ((y - ylo) / (yhi - ylo)) * ph;

  const root = svg('svg', {
    class: `gp gp-full gp-theme-gray mdl mdl-focus-${focus}${hand ? ' mdl-handmade' : ''}`,
    viewBox: `0 0 ${S.w} ${S.h}`,
    role: 'img',
    'aria-label': t('mdl.aria', { y: line.yCode, x: line.xCode }),
  });
  root.append(svg('rect', { class: 'gp-panel', x: X0, y: Y0, width: pw, height: ph }));

  // A zone with no data: predictions there are guesses (exercise 35).
  if (predictions.some((p) => !p.inside)) {
    const zone = (a, b) => svg('rect', { class: 'mdl-nodata', x: px(a), y: Y0, width: Math.max(0, px(b) - px(a)), height: ph });
    if (xlo < line.xmin) root.append(zone(xlo, line.xmin));
    if (xhi > line.xmax) root.append(zone(line.xmax, xhi));
    const outRight = predictions.some((p) => !p.inside && p.x > line.xmax);
    const zx = outRight ? (px(line.xmax) + px(xhi)) / 2 : (px(xlo) + px(line.xmin)) / 2;
    root.append(svg('text', { class: 'mdl-nodata-label', x: zx, y: Y0 + f + 4, 'text-anchor': 'middle', 'font-size': f * 0.9 }, t('mdl.noData')));
  }

  const grid = svg('g', { class: 'gp-grid' });
  for (const b of yBreaks) grid.append(svg('line', { x1: X0, x2: X0 + pw, y1: py(b), y2: py(b) }));
  for (const b of xBreaks) grid.append(svg('line', { x1: px(b), x2: px(b), y1: Y0, y2: Y0 + ph }));
  root.append(grid);

  // The line: solid over the data, dashed where it is carried beyond them.
  const g = svg('g', { class: focus === 'cor' ? 'mdl-model mdl-hidden' : 'mdl-model' });
  const seg = (a, b, cls) => (line.curve
    ? svg('polyline', { class: cls, fill: 'none', points: sampleXs(a, b).map((x) => `${px(x)},${py(at(x))}`).join(' ') })
    : svg('line', { class: cls, x1: px(a), y1: py(at(a)), x2: px(b), y2: py(at(b)) }));
  const lineCls = hand ? 'mdl-line mdl-hand' : 'mdl-line';
  g.append(seg(line.xmin, line.xmax, lineCls));
  if (lineLo < line.xmin) g.append(seg(lineLo, line.xmin, `${lineCls} mdl-extend`));
  if (lineHi > line.xmax) g.append(seg(line.xmax, lineHi, `${lineCls} mdl-extend`));
  root.append(g);

  // Squares on the residuals (exercise 34): each square's side is the residual in
  // pixels of the vertical axis, so every square is on one scale and its area is the
  // residual squared. The sum of them is what lm() makes smallest.
  if (focus === 'squares') {
    const q = svg('g', { class: 'mdl-squares' });
    line.xs.forEach((x, i) => {
      const y0 = py(line.ys[i]);
      const y1 = py(line.fitted[i]);
      const side = Math.abs(y1 - y0);
      if (side < 0.5) return;
      // At the right edge the square turns left, so it stays on the panel.
      const left = px(x) + side > X0 + pw ? px(x) - side : px(x);
      q.append(svg('rect', { class: 'mdl-square', x: left, y: Math.min(y0, y1), width: side, height: side }));
      q.append(svg('line', { class: 'mdl-resid', x1: px(x), y1: y0, x2: px(x), y2: y1 }));
    });
    root.append(q);
    if (total != null) {
      root.append(svg('text', { class: 'mdl-note mdl-total', x: X0 + pw - 6, y: Y0 + f + 4, 'text-anchor': 'end', 'font-size': f },
        t('mdl.total', { total: num(total) })));
    }
  }

  // Residuals: real value to the line, the longest one named.
  if (focus === 'residuals') {
    const r = svg('g', { class: 'mdl-resids' });
    let far = 0;
    line.residuals.forEach((e, i) => { if (Math.abs(e) > Math.abs(line.residuals[far])) far = i; });
    line.xs.forEach((x, i) => {
      r.append(svg('line', { class: i === far ? 'mdl-resid mdl-resid-max' : 'mdl-resid', x1: px(x), y1: py(line.ys[i]), x2: px(x), y2: py(line.fitted[i]) }));
    });
    const fx = px(line.xs[far]);
    const fy = (py(line.ys[far]) + py(line.fitted[far])) / 2;
    r.append(svg('text', { class: 'mdl-note', x: fx + 6, y: fy, 'font-size': f }, t('mdl.residMax', { row: line.rows[far], res: num(line.residuals[far]) })));
    root.append(r);
  }

  // cor() (step zero): no line yet, only the points and the one number.
  if (focus === 'cor' && corValue != null) {
    root.append(svg('text', { class: 'mdl-note mdl-total', x: X0 + pw - 6, y: Y0 + f + 4, 'text-anchor': 'end', 'font-size': f },
      t('mdl.cor', { r: Number.isFinite(corValue) ? num(corValue) : 'NA' })));
  }

  // The people of the data.
  const pts = svg('g', { class: 'mdl-points' });
  line.xs.forEach((x, i) => {
    const c = svg('circle', { class: 'gp-point gp-plain-ink', cx: px(x), cy: py(line.ys[i]), r: 2.8 });
    c.append(svg('title', {}, t('mdl.pointTitle', { row: line.rows[i], x: line.xCode, xv: num(x), y: line.yCode, yv: num(line.ys[i]) })));
    pts.append(c);
  });
  root.append(pts);

  if (focus === 'fitted') {
    const fit = svg('g', { class: 'mdl-fitted' });
    line.xs.forEach((x, i) => fit.append(svg('circle', { class: 'mdl-on-line', cx: px(x), cy: py(line.fitted[i]), r: 2.6 })));
    root.append(fit);
  }

  // The slope: a step along x, and the change in y it brings.
  if (focus === 'slope') {
    // The step stands near the middle of the data, away from the crowd at one end.
    const step = slopeStep(line);
    const mid = (line.xmin + line.xmax) / 2;
    const fits = xBreaks.filter((b) => b >= line.xmin && b + step <= line.xmax);
    const x0 = fits.length ? fits.reduce((a, b) => (Math.abs(b + step / 2 - mid) < Math.abs(a + step / 2 - mid) ? b : a)) : line.xmin;
    const x1 = x0 + step;
    const tri = svg('g', { class: 'mdl-tri' });
    tri.append(svg('line', { class: 'mdl-tri-run', x1: px(x0), y1: py(at(x0)), x2: px(x1), y2: py(at(x0)) }));
    tri.append(svg('line', { class: 'mdl-tri-rise', x1: px(x1), y1: py(at(x0)), x2: px(x1), y2: py(at(x1)) }));
    const up = line.b1 > 0;
    tri.append(svg('text', { class: 'mdl-note', x: (px(x0) + px(x1)) / 2, y: py(at(x0)) + (up ? f + 4 : -6), 'text-anchor': 'middle', 'font-size': f },
      t('mdl.run', { x: line.xCode, step: label(step) })));
    tri.append(svg('text', { class: 'mdl-note mdl-note-rise', x: px(x1) + 6, y: (py(at(x0)) + py(at(x1))) / 2 + f * 0.35, 'font-size': f },
      t('mdl.rise', { y: line.yCode, delta: num(line.b1 * step) })));
    root.append(tri);
  }

  // The intercept: where the line meets x = 0.
  if (focus === 'intercept') {
    const icpt = svg('g', { class: 'mdl-icpt' });
    icpt.append(svg('line', { class: 'mdl-zero', x1: px(0), x2: px(0), y1: Y0, y2: Y0 + ph }));
    icpt.append(svg('circle', { class: 'mdl-icpt-dot', cx: px(0), cy: py(line.b0), r: 4 }));
    icpt.append(svg('text', { class: 'mdl-note', x: px(0) + 8, y: py(line.b0) - 6, 'font-size': f }, t('mdl.intercept', { b0: num(line.b0) })));
    root.append(icpt);
  }

  // People the line never saw (lecture 6): the real answer hollow, the miss down to the line.
  const tested = predictions.filter((p) => p.actual != null);
  if (tested.length) {
    const tg = svg('g', { class: 'mdl-tests' });
    let far = tested[0];
    for (const p of tested) if (Math.abs(p.actual - p.y) > Math.abs(far.actual - far.y)) far = p;
    for (const p of tested) {
      // misses: false (the split, before any forecast): only who is hidden, no misses yet.
      if (misses) {
        tg.append(svg('line', { class: p === far ? 'mdl-miss mdl-miss-max' : 'mdl-miss', x1: px(p.x), y1: py(p.actual), x2: px(p.x), y2: py(p.y) }));
        tg.append(svg('circle', { class: 'mdl-on-line', cx: px(p.x), cy: py(p.y), r: 2.4 }));
      }
      const c = svg('circle', { class: 'mdl-test', cx: px(p.x), cy: py(p.actual), r: 3.6 });
      c.append(svg('title', {}, t('mdl.testTitle', { x: line.xCode, xv: num(p.x), y: line.yCode, yv: num(p.actual), pred: num(p.y) })));
      tg.append(c);
    }
    const mx = px(far.x);
    const right = mx < X0 + pw * 0.7;
    if (misses) tg.append(svg('text', { class: 'mdl-note', x: right ? mx + 6 : mx - 6, y: (py(far.actual) + py(far.y)) / 2, 'text-anchor': right ? 'start' : 'end', 'font-size': f },
      t('mdl.missMax', { miss: num(far.actual - far.y) })));
    root.append(tg);
  }

  // New values read off the line.
  if (predictions.length && !tested.length) {
    const pr = svg('g', { class: 'mdl-preds' });
    for (const p of predictions) {
      pr.append(svg('circle', { class: p.inside ? 'mdl-pred' : 'mdl-pred mdl-pred-out', cx: px(p.x), cy: py(p.y), r: 4.2 }));
      pr.append(svg('text', { class: 'mdl-note', x: px(p.x), y: py(p.y) - 8, 'text-anchor': 'middle', 'font-size': f }, num(p.y)));
    }
    root.append(pr);
  }

  // Axes, as on the plots of lecture 4.
  const axes = svg('g', { class: 'gp-axes', 'font-size': f });
  for (const b of xBreaks) axes.append(svg('text', { class: 'gp-tick gp-tick-bottom', x: px(b), y: Y0 + ph + f + 3, 'text-anchor': 'middle' }, label(b)));
  for (const b of yBreaks) axes.append(svg('text', { class: 'gp-tick gp-tick-side', x: X0 - 5, y: py(b) + f * 0.36, 'text-anchor': 'end' }, label(b)));
  axes.append(svg('text', { class: ['gp-axis-title', 'gp-axis-title-bottom', focus === 'slope' ? 'mdl-axis-lit' : ''].filter(Boolean).join(' '), x: X0 + pw / 2, y: Y0 + ph + 2 * f + 9, 'text-anchor': 'middle' }, line.xCode));
  const cx = f + 2;
  const cy = Y0 + ph / 2;
  axes.append(svg('text', { class: ['gp-axis-title', 'gp-axis-title-side', focus === 'response' ? 'mdl-axis-lit' : ''].filter(Boolean).join(' '), x: cx, y: cy, 'text-anchor': 'middle', transform: `rotate(-90 ${cx} ${cy})` }, line.yCode));
  root.append(axes);
  return root;
}

// ---------------------------------------------------------------------------
// a category on the right side of ~ (exercise 36, D95)
// ---------------------------------------------------------------------------

/**
 * The model of a number by one category, or null: the groups in level order, each
 * person's value, the fitted group means and the coefficients as differences from the
 * base group. Everything is read from the fitted model.
 */
export function groupModel(info) {
  if (!info || info.terms.length !== 1 || info.terms[0].kind !== 'factor') return null;
  const term = info.terms[0];
  const coef = info.fit.coef;
  if (coef.some(isNA)) return null;
  const levels = term.levels;
  const means = levels.map((l) => {
    const i = term.values.indexOf(l);
    return i < 0 ? null : info.fit.fitted[i];
  });
  return {
    levels, base: levels[0], cats: term.values, ys: info.y, means,
    b0: coef[0], diffs: coef.slice(1),
    names: info.colNames.slice(1),
    xCode: term.code, yCode: info.responseCode,
    rows: info.used.map((i) => info.rowNames[i]),
  };
}

/**
 * People as points over their group, each group's mean as a bar, the base group's
 * mean carried across as a dashed line, and an arrow from it to every other mean,
 * labelled with its coefficient. Focus 'intercept' lights the base group.
 */
export function renderGroupPlot(g, { focus = 'line' } = {}) {
  const S = SIZE;
  const f = S.font;
  const L = g.levels.length;
  const ys = [...g.ys, ...g.means.filter((v) => v != null)];
  let ylo = Math.min(...ys);
  let yhi = Math.max(...ys);
  const padY = (yhi - ylo || 1) * 0.08;
  ylo -= padY; yhi += padY;
  const yBreaks = prettyBreaks(ylo, yhi).filter((b) => b >= ylo && b <= yhi);
  const label = (b) => String(Number(b.toPrecision(10)));
  const m = { top: 8, right: 10, bottom: 2 * f + 16, left: Math.max(...yBreaks.map((b) => label(b).length)) * f * 0.56 + f + 18 };
  const pw = S.w - m.left - m.right;
  const ph = S.h - m.top - m.bottom;
  const X0 = m.left;
  const Y0 = m.top;
  const slot = pw / L;
  const px = (k, off = 0) => X0 + slot * (k + 0.5) + off * slot;
  const py = (y) => Y0 + ph - ((y - ylo) / (yhi - ylo)) * ph;

  const root = svg('svg', {
    class: `gp gp-full gp-theme-gray mdl mdl-groups mdl-focus-${focus}`,
    viewBox: `0 0 ${S.w} ${S.h}`,
    role: 'img',
    'aria-label': t('mdl.aria', { y: g.yCode, x: g.xCode }),
  });
  root.append(svg('rect', { class: 'gp-panel', x: X0, y: Y0, width: pw, height: ph }));
  const grid = svg('g', { class: 'gp-grid' });
  for (const b of yBreaks) grid.append(svg('line', { x1: X0, x2: X0 + pw, y1: py(b), y2: py(b) }));
  g.levels.forEach((_, k) => grid.append(svg('line', { x1: px(k), x2: px(k), y1: Y0, y2: Y0 + ph })));
  root.append(grid);

  if (focus === 'intercept') {
    root.append(svg('rect', { class: 'mdl-base-zone', x: X0 + slot * 0.08, y: Y0, width: slot * 0.84, height: ph }));
  }
  // The base group's mean, carried across: every coefficient is measured from it.
  root.append(svg('line', { class: 'mdl-base-line', x1: X0, x2: X0 + pw, y1: py(g.b0), y2: py(g.b0) }));

  // People: spread a little inside their group so equal values stay visible.
  const pts = svg('g', { class: 'mdl-points' });
  g.levels.forEach((lvl, k) => {
    const members = g.cats.map((c, i) => (c === lvl ? i : -1)).filter((i) => i >= 0);
    members.forEach((i, j) => {
      const off = members.length > 1 ? (j / (members.length - 1) - 0.5) * 0.36 : 0;
      const c = svg('circle', { class: 'gp-point gp-plain-ink', cx: px(k, off), cy: py(g.ys[i]), r: 2.8 });
      c.append(svg('title', {}, t('mdl.pointTitle', { row: g.rows[i], x: g.xCode, xv: lvl, y: g.yCode, yv: num(g.ys[i]) })));
      pts.append(c);
    });
  });
  root.append(pts);

  // Means and the differences from the base.
  const marks = svg('g', { class: 'mdl-means' });
  g.levels.forEach((lvl, k) => {
    const mean = g.means[k];
    if (mean == null) return;
    marks.append(svg('line', { class: k === 0 ? 'mdl-mean mdl-mean-base' : 'mdl-mean', x1: px(k, -0.28), x2: px(k, 0.28), y1: py(mean), y2: py(mean) }));
    if (k === 0) {
      marks.append(svg('text', { class: 'mdl-note', x: px(k, 0.3), y: py(mean) - 6, 'font-size': f }, t('mdl.base', { level: lvl, b0: num(g.b0) })));
      return;
    }
    // Every group's line says what it is: the mean of that group.
    marks.append(svg('text', { class: 'mdl-note', x: px(k, -0.28), y: py(mean) - 6, 'font-size': f }, t('mdl.mean', { level: lvl, mean: num(mean) })));
    const d = g.diffs[k - 1];
    const ax = px(k, 0.34);
    marks.append(svg('line', { class: 'mdl-diff', x1: ax, x2: ax, y1: py(g.b0), y2: py(mean) }));
    const head = py(mean) + (d > 0 ? 5 : -5);
    marks.append(svg('path', { class: 'mdl-diff-head', d: `M ${ax - 4} ${head} L ${ax} ${py(mean)} L ${ax + 4} ${head}` }));
    marks.append(svg('text', { class: 'mdl-note mdl-note-rise', x: ax + 6, y: (py(g.b0) + py(mean)) / 2 + f * 0.35, 'font-size': f },
      `${d > 0 ? '+' : ''}${num(d)}`));
  });
  root.append(marks);

  const axes = svg('g', { class: 'gp-axes', 'font-size': f });
  g.levels.forEach((lvl, k) => axes.append(svg('text', { class: ['gp-tick', 'gp-tick-bottom', k === 0 && focus === 'intercept' ? 'mdl-axis-lit' : ''].filter(Boolean).join(' '), x: px(k), y: Y0 + ph + f + 3, 'text-anchor': 'middle' }, lvl)));
  for (const b of yBreaks) axes.append(svg('text', { class: 'gp-tick gp-tick-side', x: X0 - 5, y: py(b) + f * 0.36, 'text-anchor': 'end' }, label(b)));
  axes.append(svg('text', { class: 'gp-axis-title gp-axis-title-bottom', x: X0 + pw / 2, y: Y0 + ph + 2 * f + 9, 'text-anchor': 'middle' }, g.xCode));
  const cx = f + 2;
  const cy = Y0 + ph / 2;
  axes.append(svg('text', { class: ['gp-axis-title', 'gp-axis-title-side', focus === 'response' ? 'mdl-axis-lit' : ''].filter(Boolean).join(' '), x: cx, y: cy, 'text-anchor': 'middle', transform: `rotate(-90 ${cx} ${cy})` }, g.yCode));
  root.append(axes);
  return root;
}

// ---------------------------------------------------------------------------
// a category and a number on the right side of ~ (exercise 38, D97)
// ---------------------------------------------------------------------------

/**
 * The model of a number by one category and one number, or null: one line per group,
 * all with the same slope, set apart by the category's coefficients.
 */
export function parallelModel(info) {
  if (!info || info.terms.length !== 2) return null;
  const cat = info.terms.find((tm) => tm.kind === 'factor');
  const numTerm = info.terms.find((tm) => tm.kind === 'numeric');
  if (!cat || !numTerm || info.fit.coef.some(isNA)) return null;
  const coef = info.fit.coef;
  const slopeAt = info.colNames.indexOf(numTerm.code);
  const b1 = coef[slopeAt];
  const groups = cat.levels.map((lvl, k) => {
    const at = k === 0 ? -1 : info.colNames.indexOf(`${cat.code}${lvl}`);
    return { level: lvl, b0: coef[0] + (at >= 0 ? coef[at] : 0), diff: at >= 0 ? coef[at] : 0 };
  });
  const xs = numTerm.values;
  return {
    groups, b1, xs, ys: info.y, cats: cat.values, colours: (HUES[groups.length] || HUES[8]).slice(0, groups.length),
    xCode: numTerm.code, yCode: info.responseCode, catCode: cat.code,
    rows: info.used.map((i) => info.rowNames[i]),
    xmin: Math.min(...xs), xmax: Math.max(...xs),
  };
}

/** Points coloured by group and one line per group, with the gap between the lines named. */
export function renderParallelPlot(pm) {
  const S = SIZE;
  const f = S.font;
  const at = (g, x) => g.b0 + pm.b1 * x;
  const ys = [...pm.ys, ...pm.groups.flatMap((g) => [at(g, pm.xmin), at(g, pm.xmax)])];
  let xlo = pm.xmin; let xhi = pm.xmax;
  let ylo = Math.min(...ys); let yhi = Math.max(...ys);
  const padX = (xhi - xlo || 1) * 0.05; const padY = (yhi - ylo || 1) * 0.05;
  xlo -= padX; xhi += padX; ylo -= padY; yhi += padY;
  const xBreaks = prettyBreaks(xlo, xhi).filter((b) => b >= xlo && b <= xhi);
  const yBreaks = prettyBreaks(ylo, yhi).filter((b) => b >= ylo && b <= yhi);
  const label = (b) => String(Number(b.toPrecision(10)));
  const legendW = Math.max(widthOf(pm.catCode, f), ...pm.groups.map((g) => widthOf(g.level, f) + f + 6)) + 14;
  const m = { top: 8, right: 10 + legendW, bottom: 2 * f + 16, left: Math.max(...yBreaks.map((b) => label(b).length)) * f * 0.56 + f + 18 };
  const pw = S.w - m.left - m.right;
  const ph = S.h - m.top - m.bottom;
  const X0 = m.left; const Y0 = m.top;
  const px = (x) => X0 + ((x - xlo) / (xhi - xlo)) * pw;
  const py = (y) => Y0 + ph - ((y - ylo) / (yhi - ylo)) * ph;
  const root = svg('svg', { class: 'gp gp-full gp-theme-gray mdl mdl-parallel', viewBox: `0 0 ${S.w} ${S.h}`, role: 'img', 'aria-label': t('mdl.aria', { y: pm.yCode, x: `${pm.catCode} + ${pm.xCode}` }) });
  root.append(svg('rect', { class: 'gp-panel', x: X0, y: Y0, width: pw, height: ph }));
  const grid = svg('g', { class: 'gp-grid' });
  for (const b of yBreaks) grid.append(svg('line', { x1: X0, x2: X0 + pw, y1: py(b), y2: py(b) }));
  for (const b of xBreaks) grid.append(svg('line', { x1: px(b), x2: px(b), y1: Y0, y2: Y0 + ph }));
  root.append(grid);
  pm.groups.forEach((g, k) => root.append(svg('line', { class: 'mdl-group-line', stroke: pm.colours[k], x1: px(pm.xmin), y1: py(at(g, pm.xmin)), x2: px(pm.xmax), y2: py(at(g, pm.xmax)) })));
  pm.xs.forEach((x, i) => {
    const k = pm.groups.findIndex((g) => g.level === pm.cats[i]);
    const c = svg('circle', { class: 'mdl-group-point', fill: pm.colours[k], cx: px(x), cy: py(pm.ys[i]), r: 3 });
    c.append(svg('title', {}, t('mdl.pointTitle', { row: pm.rows[i], x: pm.xCode, xv: num(x), y: pm.yCode, yv: num(pm.ys[i]) })));
    root.append(c);
  });
  // The gap between the first two lines, measured at the middle of the data.
  if (pm.groups.length >= 2) {
    const mid = (pm.xmin + pm.xmax) / 2;
    const [a, b] = pm.groups;
    root.append(svg('line', { class: 'mdl-diff', x1: px(mid), x2: px(mid), y1: py(at(a, mid)), y2: py(at(b, mid)) }));
    root.append(svg('text', { class: 'mdl-note mdl-note-rise', x: px(mid) + 6, y: Math.min(py(at(a, mid)), py(at(b, mid))) - 6, 'font-size': f },
      t('mdl.gap', { level: b.level, d: `${b.diff > 0 ? '+' : ''}${num(b.diff)}` })));
  }
  const axes = svg('g', { class: 'gp-axes', 'font-size': f });
  for (const b of xBreaks) axes.append(svg('text', { class: 'gp-tick gp-tick-bottom', x: px(b), y: Y0 + ph + f + 3, 'text-anchor': 'middle' }, label(b)));
  for (const b of yBreaks) axes.append(svg('text', { class: 'gp-tick gp-tick-side', x: X0 - 5, y: py(b) + f * 0.36, 'text-anchor': 'end' }, label(b)));
  axes.append(svg('text', { class: 'gp-axis-title', x: X0 + pw / 2, y: Y0 + ph + 2 * f + 9, 'text-anchor': 'middle' }, pm.xCode));
  const cx = f + 2; const cy = Y0 + ph / 2;
  axes.append(svg('text', { class: 'gp-axis-title', x: cx, y: cy, 'text-anchor': 'middle', transform: `rotate(-90 ${cx} ${cy})` }, pm.yCode));
  const lx = X0 + pw + 12;
  axes.append(svg('text', { class: 'gp-legend-title', x: lx, y: Y0 + f + 2 }, pm.catCode));
  pm.groups.forEach((g, k) => {
    const ly = Y0 + (k + 2) * (f + 7);
    axes.append(svg('circle', { cx: lx + 4, cy: ly - f * 0.35, r: 3.5, fill: pm.colours[k] }));
    axes.append(svg('text', { class: 'gp-key-label', x: lx + 12, y: ly }, g.level));
  });
  root.append(axes);
  return root;
}

const widthOf = (text, font) => String(text).length * font * 0.56;
