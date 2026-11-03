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
 *   predict     the line read at new values; outside the data, a grey zone
 */

import { svg } from '../dom.js';
import { prettyBreaks } from '../../core/builtins/ggplot.js';
import { formatScalar } from '../../core/format.js';
import { isNA } from '../../core/rvalue.js';
import { t } from '../../i18n/index.js';

const SIZE = { w: 440, h: 290, font: 11 };

const num = (x) => (isNA(x) ? 'NA' : formatScalar(Number(x.toPrecision(3)), 'double'));

/** The line of a model with one number on the right side of `~`, or null. */
export function simpleLine(info) {
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

/** A tidy step along x for the slope triangle: the spacing of the axis breaks. */
export function slopeStep(line) {
  const br = prettyBreaks(line.xmin, line.xmax);
  return br.length > 1 ? br[1] - br[0] : 1;
}

/**
 * @param {Object} line   from simpleLine()
 * @param {Object} opts   {focus, predictions: [{x, y, inside}], total, hand}
 *   total  the sum of squares, as the engine computed it, written in the corner
 *   hand   the line was typed by hand (8 - 0.1 * wiek), not chosen by lm()
 */
export function renderModelPlot(line, { focus = 'line', predictions = [], total = null, hand = false } = {}) {
  const S = SIZE;
  const f = S.font;
  const at = (x) => line.b0 + line.b1 * x;

  // What the axes must hold.
  const xsShown = [...line.xs, ...predictions.map((p) => p.x)];
  if (focus === 'intercept') xsShown.push(0);
  let xlo = Math.min(...xsShown);
  let xhi = Math.max(...xsShown);
  const lineLo = Math.min(xlo, line.xmin);
  const lineHi = Math.max(xhi, line.xmax);
  const ysShown = [...line.ys, at(lineLo), at(lineHi), ...predictions.map((p) => p.y)];
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
  const g = svg('g', { class: 'mdl-model' });
  const seg = (a, b, cls) => svg('line', { class: cls, x1: px(a), y1: py(at(a)), x2: px(b), y2: py(at(b)) });
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

  // New values read off the line.
  if (predictions.length) {
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
