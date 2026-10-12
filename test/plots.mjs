/**
 * Plots (D45): what the reference cases cannot see.
 *
 * `cases-ggplot.txt` compares the numbers of a plot with base R. This suite checks
 * the rest:
 *
 *   - every plot any lesson can produce (scenes, variants, solutions, anticipated
 *     wrong answers) is drawn at all three sizes with real numbers in every
 *     attribute, and nothing leaves the picture
 *   - the drawing shows what the build computed: one rectangle per bar, the legend's
 *     keys, the axes swapped by coord_flip()
 *   - the stage pictures say what the lessons promise: the table geom_bar() counted,
 *     the pile geom_col() made of raw rows, the word that is not a colour
 *   - two plots are "the same" exactly when they show the same thing
 *   - the mistakes a beginner makes each get their own sentence
 */

import { installDom } from './dom-shim.mjs';

installDom();
const { LESSONS } = await import('../src/lessons/index.js');
const { withKeep, valuesEqual } = await import('../src/lessons/schema.js');
const { RSession } = await import('../src/core/session.js');
const { buildPlot } = await import('../src/core/builtins/ggplot.js');
const { renderBuilt, renderLayerTable } = await import('../src/ui/viz/plot.js');
const { describeEntry } = await import('../src/ui/viz/focus.js');
const { renderCompare } = await import('../src/ui/viz/pictures.js');
const { renderMemory } = await import('../src/ui/viz/memory.js');

let passed = 0;
const failures = [];
const check = (name, fn) => {
  try {
    const problem = fn();
    if (problem) failures.push(`${name}: ${problem}`); else passed++;
  } catch (e) {
    failures.push(`${name}: threw ${e.stack?.split('\n').slice(0, 3).join(' | ')}`);
  }
};

const SETUP = `ankieta <- data.frame(
  id = 1:10,
  plec = c("K", "M", "K", "K", "M", "M", "K", "M", "K", "M"),
  miasto = c("Kraków", "Warszawa", "Kraków", "Gdańsk", "Warszawa",
             "Kraków", "Gdańsk", "Warszawa", "Kraków", "Gdańsk"),
  ocena = c(4, 5, 3, 4, 2, 5, 4, NA, 3, 5)
)`;

const run = (code, setup = SETUP, { trace = false } = {}) => {
  const s = new RSession(trace ? {} : { trace: false });
  s.run(setup, { trace: false });
  return s.run(code);
};
const plot = (code, setup) => {
  const r = run(code, setup);
  if (!r.ok) throw new Error(`${code} failed: ${r.error.message}`);
  return r.value;
};

const walk = (node, fn) => {
  if (!node || typeof node !== 'object') return;
  fn(node);
  for (const c of node.childNodes || []) walk(c, fn);
};
const all = (root, pred) => { const out = []; walk(root, (n) => { if (pred(n)) out.push(n); }); return out; };
const tagged = (root, tag) => all(root, (n) => n.tagName === tag.toUpperCase());
const classed = (root, cls) => all(root, (n) => String(n.className || n.attributes?.class || '').split(' ').includes(cls));

// ---------------------------------------------------------------------------
// every plot of every lesson is drawn with real numbers, inside its own frame
// ---------------------------------------------------------------------------

let drawn = 0;
function sound(label, value) {
  const built = buildPlot(value);
  for (const size of ['full', 'compact', 'thumb']) {
    const svg = renderBuilt(built, { size });
    drawn++;
    const [, , W, H] = svg.getAttribute('viewBox').split(' ').map(Number);
    let problem = null;
    walk(svg, (n) => {
      if (problem) return;
      for (const [k, v] of Object.entries(n.attributes || {})) {
        if (/NaN|undefined|Infinity|null/.test(v)) { problem = `${n.tagName} ${k}="${v}"`; return; }
      }
      if (n.tagName === 'RECT') {
        const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((k) => Number(n.getAttribute(k)));
        if (x < -0.5 || y < -0.5 || x + w > W + 0.5 || y + h > H + 0.5 || w < 0 || h < 0) problem = `a rectangle leaves the picture: ${x},${y} ${w}x${h} in ${W}x${H}`;
      }
      if (n.tagName === 'TEXT') {
        const x = Number(n.getAttribute('x'));
        const y = Number(n.getAttribute('y'));
        if (x < 0 || x > W || y < 0 || y > H + 1) problem = `text "${n.textContent}" is placed outside: ${x},${y} in ${W}x${H}`;
        if (/undefined|NaN|\[object/.test(n.textContent)) problem = `text reads "${n.textContent}"`;
      }
    });
    if (problem) return `${label} at ${size}: ${problem}`;
    // What is drawn is what was computed.
    const bars = built.layers.filter((l) => l.geom !== 'text').reduce((k, l) => k + l.marks.length, 0);
    const rects = classed(svg, 'gp-bar').length;
    if (rects !== bars) return `${label} at ${size}: ${bars} bars computed, ${rects} drawn`;
  }
  return null;
}

let lessonPlots = 0;
for (const l of LESSONS) {
  const codes = [
    ...l.scenes.filter((sc) => sc.code).map((sc, i) => [`scene ${i + 1}`, sc.code]),
    ['sandbox', withKeep(l.play, l.play.code)],
    ...l.play.chips.map((c, i) => [`chip ${i + 1}`, withKeep(l.play, c)]),
    ...[['task', l.task], ['extra', l.extra]].filter(([, tk]) => tk).flatMap(([slot, tk]) => [
      [`${slot} solution`, tk.solution],
      ...(tk.nearMisses || []).map((nm) => [`${slot} near-miss "${nm.name}"`, nm.code]),
    ]),
  ];
  for (const [where, code] of codes) {
    const r = run(code, l.setup);
    if (!r.ok || !r.value?.gg) continue;
    lessonPlots++;
    check(`${l.id} ${where}: the plot is drawn soundly`, () => sound(`${l.id} ${where}`, r.value));
  }
}
check('lecture 4 produces plots to check', () => (lessonPlots >= 60 ? null : `only ${lessonPlots} plots found in the lessons`));

// Things a student types that no lesson contains.
for (const code of [
  'ggplot(ankieta, aes(x = miasto))',
  'ggplot(ankieta, aes(x = miasto, fill = plec)) + geom_bar(position = "dodge") + coord_flip()',
  'ggplot(ankieta, aes(x = factor(ocena), fill = miasto)) + geom_bar() + theme(legend.position = "bottom")',
  'ggplot(ankieta, aes(x = ocena)) + geom_bar() + coord_flip() + labs(title = "A", subtitle = "B", caption = "C")',
  'ankieta |> count(miasto, plec) |> ggplot(aes(miasto, n, fill = plec)) + geom_col(position = "dodge") + geom_text(aes(label = n), position = position_dodge(0.9), vjust = -0.5)',
  'ggplot(ankieta, aes(x = miasto, fill = plec)) + geom_bar(position = "fill") + theme(legend.position = "none")',
  'ggplot(ankieta, aes(x = miasto)) + geom_bar(fill = "grey35", colour = "black", alpha = 0.5, width = 0.4) + theme_classic()',
  'ggplot(ankieta, aes(x = paste0("Bardzo długa nazwa miasta: ", miasto))) + geom_bar() + coord_flip()',
  'ggplot(ankieta, aes(x = miasto, y = id * 1000)) + geom_col()',
  'ggplot(ankieta, aes(x = miasto, y = ocena / 100)) + geom_col()',
]) {
  check(`free code is drawn soundly: ${code.slice(0, 60)}`, () => sound('free', plot(code)));
}

// ---------------------------------------------------------------------------
// the drawing follows the build
// ---------------------------------------------------------------------------

check('a legend has one key per group, and none without groups', () => {
  const two = renderBuilt(buildPlot(plot('ggplot(ankieta, aes(x = miasto, fill = plec)) + geom_bar()')));
  if (classed(two, 'gp-key').length !== 2) return `${classed(two, 'gp-key').length} keys for two groups`;
  const none = renderBuilt(buildPlot(plot('ggplot(ankieta, aes(x = miasto)) + geom_bar(fill = "steelblue")')));
  if (classed(none, 'gp-key').length) return 'a legend although nothing is grouped';
  const hidden = renderBuilt(buildPlot(plot('ggplot(ankieta, aes(x = miasto, fill = plec)) + geom_bar() + theme(legend.position = "none")')));
  return classed(hidden, 'gp-key').length ? 'legend.position = "none" still draws a legend' : null;
});

check('coord_flip() lays the bars down and moves the category names to the side', () => {
  const up = renderBuilt(buildPlot(plot('ggplot(ankieta, aes(x = miasto)) + geom_bar()')));
  const flat = renderBuilt(buildPlot(plot('ggplot(ankieta, aes(x = miasto)) + geom_bar() + coord_flip()')));
  const shape = (svg) => classed(svg, 'gp-bar').map((r) => Number(r.getAttribute('width')) > Number(r.getAttribute('height')));
  if (shape(up).some(Boolean)) return 'upright bars are wider than tall';
  if (!shape(flat).every(Boolean)) return 'flipped bars are not lying down';
  const side = classed(flat, 'gp-tick-side').map((n) => n.textContent).join();
  return side === 'Gdańsk,Kraków,Warszawa' ? null : `the side axis reads ${side}`;
});

check('the tallest bar is the tallest rectangle, and equal counts are equal heights', () => {
  const svg = renderBuilt(buildPlot(plot('ggplot(ankieta, aes(x = miasto)) + geom_bar()')));
  const h = classed(svg, 'gp-bar').map((r) => Number(r.getAttribute('height')));
  if (!(h[1] > h[0]) || Math.abs(h[0] - h[2]) > 0.01) return `heights ${h.join()} for counts 3, 4, 3`;
  return Math.abs(h[1] / h[0] - 4 / 3) < 0.01 ? null : `4 to 3 is drawn as ${(h[1] / h[0]).toFixed(3)}`;
});

check('bars stand on one baseline at the bottom, and a taller bar reaches higher', () => {
  const svg = renderBuilt(buildPlot(plot('ggplot(ankieta, aes(x = miasto)) + geom_bar()')));
  const rects = classed(svg, 'gp-bar').map((r) => ({ top: Number(r.getAttribute('y')), bottom: Number(r.getAttribute('y')) + Number(r.getAttribute('height')) }));
  if (rects.some((r) => Math.abs(r.bottom - rects[0].bottom) > 0.01)) return `the bars end at ${rects.map((r) => r.bottom.toFixed(1)).join()}`;
  // In SVG a smaller y is higher up: the bar of 4 starts above the bars of 3.
  return rects[1].top < rects[0].top ? null : 'the tallest bar does not reach highest';
});

check('a level nobody chose takes no place on the axis (ggplot2 drops it by default)', () => {
  const b = buildPlot(plot('ggplot(ankieta, aes(x = factor(miasto, levels = c("Gdańsk", "Kraków", "Poznań", "Warszawa")))) + geom_bar()'));
  return b.x.levels.join() === 'Gdańsk,Kraków,Warszawa' ? null : `the axis reads ${b.x.levels.join()}`;
});

check('labels add up over several labs(), and a later one replaces an earlier one', () => {
  const b = buildPlot(plot('ggplot(ankieta, aes(x = miasto)) + geom_bar() + labs(title = "A", y = "Y1") + labs(y = "Y2") + xlab("X")'));
  return b.labels.title === 'A' && b.y.label === 'Y2' && b.x.label === 'X' ? null : `title ${b.labels.title}, y ${b.y.label}, x ${b.x.label}`;
});

check('an empty plot has axes for what is mapped and no bars', () => {
  const b = buildPlot(plot('ggplot(ankieta, aes(x = miasto))'));
  const svg = renderBuilt(b);
  if (classed(svg, 'gp-bar').length) return 'bars without a layer';
  if (classed(svg, 'gp-tick-bottom').map((n) => n.textContent).join() !== 'Gdańsk,Kraków,Warszawa') return 'the x axis is not set up';
  return classed(svg, 'gp-tick-side').length ? 'a y axis although nothing is mapped to y' : null;
});

check('a fixed colour and a mapped colour are kept as written; a plain bar takes the page colour', () => {
  const fixed = classed(renderBuilt(buildPlot(plot('ggplot(ankieta, aes(x = miasto)) + geom_bar(fill = "steelblue")'))), 'gp-bar');
  if (fixed.some((r) => r.getAttribute('fill') !== 'steelblue')) return `fixed fill drawn as ${fixed[0].getAttribute('fill')}`;
  const plain = classed(renderBuilt(buildPlot(plot('ggplot(ankieta, aes(x = miasto)) + geom_bar()'))), 'gp-bar');
  if (plain.some((r) => r.getAttribute('fill') !== null || !String(r.attributes.class).includes('gp-bar-plain'))) return 'a plain bar carries a fixed colour';
  const grey = classed(renderBuilt(buildPlot(plot('ggplot(ankieta, aes(x = miasto)) + geom_bar(fill = "grey50")'))), 'gp-bar');
  return /^rgb\(/.test(grey[0].getAttribute('fill')) ? null : `R's grey50 is drawn as ${grey[0].getAttribute('fill')}`;
});

// ---------------------------------------------------------------------------
// the stage pictures
// ---------------------------------------------------------------------------

const stage = (code, text, setup = SETUP) => {
  const r = run(code, setup, { trace: true });
  if (!r.ok) throw new Error(r.error.message);
  const entry = text ? r.evalLog.findByText(code, text) : r.evalLog.roots().pop();
  if (!entry) throw new Error(`no entry for ${text}`);
  return describeEntry(entry, { trace: r.trace, log: r.evalLog, source: code, onSelect() {}, still: true });
};

check('geom_bar(): the picture shows the table it counted, one row per bar', () => {
  const d = stage('ggplot(ankieta, aes(x = miasto)) + geom_bar()', 'geom_bar()');
  const rows = tagged(d.pic, 'tr').length - 1;
  if (rows !== 3) return `${rows} table rows for 3 bars`;
  if (!d.pic.textContent.includes('count')) return 'the counted column is not named';
  return /10/.test(d.caption) && /3/.test(d.caption) ? null : `caption: ${d.caption}`;
});

check('geom_col() on raw rows: the pile is named, as a trap', () => {
  const d = stage('ggplot(ankieta, aes(x = miasto, y = ocena)) + geom_col()', 'geom_col()');
  if (d.tone !== 'trap') return `tone ${d.tone}`;
  return /dodał/.test(d.caption) && /NA/.test(d.caption) ? null : `caption: ${d.caption}`;
});

check('a word inside aes() is named as a column, not a colour', () => {
  const whole = stage('ggplot(ankieta, aes(x = miasto, fill = "blue")) + geom_bar()', null);
  if (whole.tone !== 'trap' || !/"blue"/.test(whole.caption)) return `plot: ${whole.tone} / ${whole.caption}`;
  const aes = stage('ggplot(ankieta, aes(x = miasto, fill = "blue")) + geom_bar()', 'aes(x = miasto, fill = "blue")');
  return aes.tone === 'trap' ? null : `aes(): ${aes.tone} / ${aes.caption}`;
});

check('aes(): one row per mapped column, with the column\'s values', () => {
  const d = stage('ggplot(ankieta, aes(x = miasto, fill = plec)) + geom_bar()', 'aes(x = miasto, fill = plec)');
  const rows = classed(d.pic, 'gp-map-row');
  if (rows.length !== 2) return `${rows.length} rows for two aesthetics`;
  return d.pic.textContent.includes('Kraków') && /x = miasto, fill = plec/.test(d.caption) ? null : `caption: ${d.caption}`;
});

check('a plot with no layer says so; position "fill" says what is lost', () => {
  const blank = stage('ggplot(ankieta, aes(x = miasto))', null);
  if (!/warstw/.test(blank.caption)) return `blank: ${blank.caption}`;
  const fill = stage('ggplot(ankieta, aes(x = miasto, fill = plec)) + geom_bar(position = "fill")', 'geom_bar(position = "fill")');
  return /100%/.test(fill.caption) ? null : `fill: ${fill.caption}`;
});

check('the layer table of a text layer is not drawn, and a missing layer gives nothing', () => {
  const b = buildPlot(plot('ankieta |> count(miasto) |> ggplot(aes(miasto, n)) + geom_col() + geom_text(aes(label = n))'));
  if (renderLayerTable(b, 1) !== null) return 'a table for geom_text()';
  return renderLayerTable(b, 5) === null ? null : 'a table for a layer that does not exist';
});

check('goal and answer are drawn as two plots; memory shows a plot as a plot', () => {
  const goal = plot('ggplot(ankieta, aes(x = miasto)) + geom_bar()');
  const mine = plot('ggplot(ankieta, aes(x = plec)) + geom_bar()');
  const pic = renderCompare(goal, mine, { goalLabel: 'Cel', mineLabel: 'Twój wynik' });
  if (tagged(pic, 'svg').length !== 2) return `${tagged(pic, 'svg').length} plots in the comparison`;
  const empty = renderCompare(goal, undefined, { goalLabel: 'Cel', mineLabel: 'Twój wynik' });
  if (tagged(empty, 'svg').length !== 1) return 'the goal is not drawn before the student has an answer';
  const r = run('p <- ggplot(ankieta, aes(x = miasto)) + geom_bar()');
  const mem = renderMemory(r.env);
  return /wykres/.test(mem.textContent) && tagged(mem, 'svg').length >= 1 ? null : `memory reads "${mem.textContent}"`;
});

// ---------------------------------------------------------------------------
// when are two plots the same?
// ---------------------------------------------------------------------------

const same = (a, b) => valuesEqual(plot(a), plot(b));
const BAR = 'ggplot(ankieta, aes(x = miasto)) + geom_bar()';

check('geom_bar() on answers and geom_col() on their count are one plot', () =>
  (same('ankieta |> count(miasto) |> ggplot(aes(x = miasto, y = n)) + geom_col()', BAR) ? null : 'told apart'));

check('other heights, another order, another colour, a flip: each is another plot', () => {
  const others = {
    'another column': 'ggplot(ankieta, aes(x = plec)) + geom_bar()',
    'another order': 'ggplot(ankieta, aes(x = fct_infreq(miasto))) + geom_bar()',
    'a fixed colour': 'ggplot(ankieta, aes(x = miasto)) + geom_bar(fill = "steelblue")',
    'a flip': `${BAR} + coord_flip()`,
    'groups': 'ggplot(ankieta, aes(x = miasto, fill = plec)) + geom_bar()',
    'a second layer': 'ankieta |> count(miasto) |> ggplot(aes(miasto, n)) + geom_col() + geom_text(aes(label = n))',
    'narrower bars': 'ggplot(ankieta, aes(x = miasto)) + geom_bar(width = 0.5)',
  };
  const equal = Object.entries(others).filter(([, code]) => same(code, BAR)).map(([name]) => name);
  return equal.length ? `taken for the same plot: ${equal.join(', ')}` : null;
});

check('the same bars in another order are another plot, even when the heights happen to match', () => {
  // Counts are 3, 4, 3: reversed, the heights read the same from left to right.
  const reversed = 'ggplot(ankieta, aes(x = fct_rev(factor(miasto)))) + geom_bar()';
  return same(reversed, BAR) ? 'Warszawa-Kraków-Gdańsk is taken for Gdańsk-Kraków-Warszawa' : null;
});

check('stack, dodge and fill are three plots', () => {
  const base = 'ggplot(ankieta, aes(x = miasto, fill = plec)) + ';
  const kinds = ['geom_bar()', 'geom_bar(position = "dodge")', 'geom_bar(position = "fill")'];
  for (const a of kinds) for (const b of kinds) if (a !== b && same(base + a, base + b)) return `${a} equals ${b}`;
  return null;
});

check('labels count only where the goal set them', () => {
  const titled = `${BAR} + labs(title = "Miasta")`;
  // The goal asks for a title: an answer without it, or with another, is not it.
  if (valuesEqual(plot(BAR), plot(titled))) return 'an answer without the title passes';
  if (valuesEqual(plot(`${BAR} + labs(title = "Inny")`), plot(titled))) return 'an answer with another title passes';
  if (!valuesEqual(plot(`${BAR} + ggtitle("Miasta")`), plot(titled))) return 'ggtitle() is not the same title';
  // The goal sets none: an answer may add its own.
  if (!valuesEqual(plot(titled), plot(BAR))) return 'an answer fails for a title nobody asked about';
  return valuesEqual(plot(`${BAR} + labs(x = "Miasto") + theme_minimal()`), plot(BAR)) ? null : 'a theme or an axis label changes the answer';
});

check('a plot is never equal to a table or a number', () => {
  const p = plot(BAR);
  const tab = run('ankieta |> count(miasto)').value;
  return !valuesEqual(p, tab) && !valuesEqual(tab, p) && !valuesEqual(p, run('3').value) ? null : 'a plot equals something that is not a plot';
});

// ---------------------------------------------------------------------------
// the mistakes, each with its own sentence
// ---------------------------------------------------------------------------

const MISTAKES = [
  ['the pipe between layers', 'ggplot(ankieta, aes(x = miasto)) |> geom_bar()', 'err.ggPipe'],
  ['the plus on the next line', 'ggplot(ankieta, aes(x = miasto))\n  + geom_bar()', 'err.ggPlusLineStart'],
  ['a layer with no plot before it', 'geom_bar() + labs(title = "x")', 'err.ggPlusNoPlot'],
  ['geom_bar() given a y', 'ggplot(ankieta, aes(x = miasto, y = ocena)) + geom_bar()', 'err.ggBarY'],
  ['geom_col() without a y', 'ggplot(ankieta, aes(x = miasto)) + geom_col()', 'err.ggColNoY'],
  ['a column outside aes()', 'ggplot(ankieta, aes(x = miasto)) + geom_bar(fill = plec)', 'err.ggOutsideAes'],
  ['aes() before the data', 'ggplot(aes(x = miasto))', 'err.ggAesFirst'],
  ['no data at all', 'ggplot()', 'err.ggNoData'],
  ['a mapping not made by aes()', 'ggplot(ankieta, "miasto")', 'err.ggMappingNotAes'],
  ['geom_text() without a label', 'ggplot(ankieta, aes(x = miasto, y = ocena)) + geom_text()', 'err.ggTextNoLabel'],
  ['text on the y axis', 'ggplot(ankieta, aes(x = ocena, y = miasto)) + geom_col()', 'err.ggYNotNumber'],
  ['a number as fill', 'ggplot(ankieta, aes(x = miasto, fill = ocena)) + geom_bar()', 'err.ggFillNumber'],
  ['an unknown position', 'ggplot(ankieta, aes(x = miasto)) + geom_bar(position = "side")', 'err.ggPosition'],
  ['an unnamed label', 'ggplot(ankieta, aes(x = miasto)) + geom_bar() + labs("Tytuł")', 'err.ggLabsUnnamed'],
  ['two plots added', 'ggplot(ankieta, aes(x = miasto)) + ggplot(ankieta, aes(x = plec))', 'err.ggPlusPlot'],
  ['a number added to a plot', 'ggplot(ankieta, aes(x = miasto)) + 1', 'err.ggPlusOther'],
  ['aes() added as a layer', 'ggplot(ankieta) + aes(x = miasto)', 'err.ggPlusAes'],
  ['an aesthetic the trainer does not draw', 'ggplot(ankieta, aes(x = miasto, shape = plec))', 'err.ggAesUnknown'],
  ['a setting the layer does not have', 'ggplot(ankieta, aes(x = miasto)) + geom_bar(bins = 5)', 'err.ggLayerParam'],
  ['theme() beyond the legend', 'ggplot(ankieta, aes(x = miasto)) + geom_bar() + theme(text = 1)', 'err.ggThemeArg'],
];
for (const [name, code, key] of MISTAKES) {
  check(`mistake: ${name}`, () => {
    const r = run(code);
    if (r.ok) return 'it ran';
    if (r.error.key !== key) return `got ${r.error.key}: ${r.error.message}`;
    return /\{|\}|undefined/.test(r.error.message) ? `the sentence has a hole: ${r.error.message}` : null;
  });
}

check('a misspelt column fails where the layer is added, in the usual words', () => {
  const r = run('ggplot(ankieta, aes(x = miaso)) + geom_bar()');
  return !r.ok && /miaso/.test(r.error.message) ? null : `got ${r.ok ? 'a plot' : r.error.message}`;
});

check('a plot prints nothing in the console, as in R', () => {
  const r = run(BAR);
  return r.lines.length === 0 ? null : `printed: ${r.lines.join(' / ')}`;
});

check('arithmetic is untouched: + on numbers is still addition', () => {
  const r = run('c(1, 2) + 3');
  return r.ok && r.value.values.join() === '4,5' ? null : 'broken';
});

console.log(`plots: ${passed}/${passed + failures.length} checks passed (${drawn} drawings, ${lessonPlots} plots from the lessons)`);
for (const f of failures.slice(0, 40)) console.log(`  FAIL  ${f}`);
process.exit(failures.length ? 1 : 0);
