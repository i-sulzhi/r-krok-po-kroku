/**
 * The glossary panel ("Ściąga").
 *
 * The panel explains the code on screen using that code as its example, so it can
 * go wrong in ways a fixed text cannot: a concept found in the wrong place, a label
 * on the wrong token, a "Czytaj:" line with an unfilled {placeholder}, or, worst,
 * an example lifted from a task's own solution. This suite checks:
 *
 *   - detection on known snippets: which concepts, and which text carries each label
 *   - every concept has its texts, within budget, and some lesson actually uses it
 *   - every scene, sandbox and task of every lesson draws a panel without throwing,
 *     with no raw key or {placeholder} left, and the example spelling the real code
 *   - the task step never shows its own solution
 */

import { installDom } from './dom-shim.mjs';
installDom();

const { LESSONS } = await import('../src/lessons/index.js');
const { RSession } = await import('../src/core/session.js');
const { CONCEPTS, findConcepts, firstLessons, lessonCode } = await import('../src/ui/concepts.js');
const { renderGlossary } = await import('../src/ui/glossary.js');
const { t, has } = await import('../src/i18n/index.js');

let passed = 0;
const failures = [];
const check = (name, fn) => {
  try {
    const problem = fn();
    if (problem) failures.push(`${name}: ${problem}`);
    else passed++;
  } catch (e) {
    failures.push(`${name}: threw ${e.stack?.split('\n').slice(0, 2).join(' ') || e.message}`);
  }
};

// --- detection ---------------------------------------------------------------

/** "concept: labelled=text ..." for the first occurrence of each concept. */
function describe(src) {
  const found = findConcepts(src);
  if (!found) return null;
  const out = {};
  for (const [id, list] of found) {
    out[id] = list[0].parts.filter((p) => p.label).map((p) => `${p.label}=${src.slice(p.start, p.end)}`).join(' ');
  }
  return out;
}

const CASES = [
  ['oceny <- c(4, 5, 3)', { assign: 'name=oceny assign=<- value=c(4, 5, 3)', call: 'fn=c args=4, 5, 3' }],
  ['c(1, 2) -> x', { assign: 'value=c(1, 2) assign=-> name=x' }],
  ['ankieta', { name: 'name=ankieta' }],
  ['ankieta$ocena', { dollar: 'table=ankieta column=ocena' }],
  ['1:30', { colon: 'from=1 to=30' }],
  ['x[-1]  # bez pierwszej', { index: 'vector=x which=-1', comment: 'comment=# bez pierwszej' }],
  ['"a#b"', { string: 'text="a#b"' }],   // a # inside a string is not a comment
  ['mean(x, na.rm = TRUE)', { namedArg: 'argName=na.rm argValue=TRUE', bool: 'bool=TRUE' }],
  ['!is.na(x) & x > 3', { logic: 'logic=!', compare: 'compare=>' }],
  ['oceny * 20', { arith: 'op=*' }],
  ['ankieta |> filter(wiek > 30) |> count(plec)', { pipe: 'data=ankieta pipe=|> next=filter(wiek > 30)' }],
  ['n()', { call: 'fn=n' }],
];

for (const [src, want] of CASES) {
  check(`detects ${JSON.stringify(src)}`, () => {
    const got = describe(src);
    if (!got) return 'did not parse';
    for (const [id, text] of Object.entries(want)) {
      if (got[id] !== text) return `${id}: got ${JSON.stringify(got[id])}, want ${JSON.stringify(text)}`;
    }
    return null;
  });
}

check('half-typed code yields null (the panel keeps the last state)', () =>
  (findConcepts('oceny <- c(4, 5,') === null ? null : 'expected null'));

// --- texts ---------------------------------------------------------------------

const visible = (s) => String(s).replace(/\*\*|`/g, '').length;
const BUDGET = { term: 24, what: 100, read: 70, xl: 90 };

for (const id of CONCEPTS) {
  check(`${id}: texts exist and stay within budget`, () => {
    for (const f of ['term', 'what']) if (!has(`gl.${id}.${f}`)) return `missing gl.${id}.${f}`;
    for (const [f, max] of Object.entries(BUDGET)) {
      if (has(`gl.${id}.${f}`) && visible(t(`gl.${id}.${f}`)) > max) return `gl.${id}.${f} is ${visible(t(`gl.${id}.${f}`))} > ${max}`;
    }
    return null;
  });
}

const first = firstLessons(LESSONS);
check('every concept is used by some lesson (no dead cards)', () => {
  const unused = CONCEPTS.filter((id) => !first.has(id));
  return unused.length ? `unused: ${unused.join(', ')}` : null;
});
check('lesson 1 introduces the grammar a vector lesson relies on', () => {
  const missing = ['name', 'assign', 'call', 'dollar', 'colon'].filter((id) => first.get(id) !== 0);
  return missing.length ? `not first met in lesson 1: ${missing.join(', ')}` : null;
});

// --- the panel on every step ------------------------------------------------------

/** Every element under `node` with the class. */
function byClass(node, cls, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (String(node.className || '').split(' ').includes(cls)) out.push(node);
  for (const c of node.childNodes || []) byClass(c, cls, out);
  return out;
}

const RAW = /\b(gl|fx|ls)\.[a-zA-Z][\w.]*|\{[a-zA-Z|]+\}/;
let panels = 0;

function panel(lesson, index, code, { prefer, open = new Set(CONCEPTS) } = {}) {
  const session = new RSession();
  if (lesson.setup) session.run(lesson.setup, { trace: false });
  const result = session.run(code);
  const found = findConcepts(code);
  panels++;
  const drawn = renderGlossary({
    src: code, found: found || new Map(), log: result.evalLog, prefer,
    lessons: LESSONS, lessonIndex: index, first,
    open, folded: false,
    onToggle() {}, onPick() {}, onHover() {}, onBar() {},
  });
  return { found, node: drawn?.panel || null, bar: drawn?.bar || null };
}

LESSONS.forEach((lesson, index) => {
  const steps = [
    ...lesson.scenes.map((s, i) => [`scene ${i + 1}`, s.code, s.pick]),
    ['sandbox', lesson.play.code],
    ['task', lesson.task.starter],
  ];
  for (const [where, code, prefer] of steps) {
    check(`${lesson.id} ${where}: the panel draws, labelled with real code`, () => {
      const { found, node } = panel(lesson, index, code, { prefer });
      // An unfinished starter: nothing from the box, but the lesson's concepts stay.
      if (!found) return where === 'task' && node && byClass(node, 'gl-chip').length ? null : 'code does not parse, and no lesson concepts offered';
      if (!node) return found.size ? 'concepts found, but no panel' : null;
      const text = node.textContent;
      // The bar is all a short screen may show: it must name the panel and count
      // what is new, in correct Polish.
      const fresh0 = [...found.keys()].filter((id) => first.get(id) === index).length;
      const barText = panel(lesson, index, code, { prefer }).bar.textContent;
      if (!barText.includes(t('gl.title'))) return `bar without its title: ${barText}`;
      if (fresh0 && !barText.includes(t('gl.newCount', { n: fresh0 }))) return `bar does not count ${fresh0} new: ${barText}`;
      if (RAW.test(barText)) return `raw key in bar: ${barText}`;
      const raw = text.match(RAW);
      if (raw) return `raw key or placeholder on screen: ${raw[0]}`;
      // Each new concept in this code gets an open card, marked as new.
      const fresh = [...found.keys()].filter((id) => first.get(id) === index);
      const cards = byClass(node, 'gl-new').map((c) => c.dataset.concept);
      const missing = fresh.filter((id) => !cards.includes(id));
      if (missing.length) return `new here but no open card: ${missing.join(', ')}`;
      // The example spells real code: read left to right, the labelled parts and
      // the gaps between them are a piece of this code (or of the lesson's, for a
      // card opened from a chip). A part off by one character would not be.
      const pool = `${code}\n${LESSONS.slice(0, index + 1).flatMap((l) => lessonCode(l, { examples: true })).join('\n')}`;
      for (const card of byClass(node, 'gl-card')) {
        const id = card.dataset.concept;
        const anat = byClass(card, 'gl-anat')[0];
        const spelled = (anat?.childNodes || [])
          .map((c) => (String(c.className).includes('gl-gap') ? c.textContent : byClass(c, 'gl-code')[0]?.textContent ?? ''))
          .join('');
        if (!spelled.trim()) return `${id}: empty example`;
        if (!spelled.includes('…') && !pool.includes(spelled)) return `${id}: example ${JSON.stringify(spelled)} is not in the code`;
      }
      return null;
    });
  }

  check(`${lesson.id} task: the panel never shows the solution`, () => {
    const { node } = panel(lesson, index, lesson.task.starter);
    if (!node) return null;
    const text = node.textContent;
    const seen = lessonCode(lesson, { examples: true }).join('\n');
    // A solution line the student never saw elsewhere must not appear in the panel.
    const lines = lesson.task.solution.split('\n').map((l) => l.trim()).filter((l) => l.length > 6 && !seen.includes(l));
    const leaked = lines.find((l) => text.includes(l));
    return leaked ? `solution line on screen: ${leaked}` : null;
  });
});

check('a scene example follows the picked expression', () => {
  const lesson = LESSONS[0];
  const scene = lesson.scenes.find((s) => s.pick === 'length(oceny)');
  if (!scene) return 'lesson 1 has no length(oceny) scene any more';
  const { node } = panel(lesson, 0, scene.code, { prefer: scene.pick });
  const call = byClass(node, 'gl-card').find((c) => c.dataset.concept === 'call');
  const fn = call && byClass(call, 'gl-seg-key')[0]?.textContent;
  return fn && fn.startsWith('length') ? null : `call card shows ${JSON.stringify(fn)}, want length`;
});

console.log(`glossary: ${passed}/${passed + failures.length} checks passed (${panels} panels drawn)`);
for (const f of failures) console.log(`  FAIL  ${f}`);
process.exit(failures.length ? 1 : 0);
