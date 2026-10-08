/**
 * Behaviour tests: the claims that make this a *trainer* rather than an interpreter.
 *
 * The differential suites prove we compute what R computes. These prove the things
 * R itself cannot check for us:
 *
 *   - the events a lesson needs are actually emitted, with usable payloads
 *   - every sub-expression's value is recorded, so any piece of code can be clicked
 *   - errors are diagnosed into the right advice
 *   - Polish renders, including plurals
 *   - deliberate divergences (stringr's NA handling) really behave that way
 *   - hostile input is survived rather than hanging the tab
 */

import { RSession } from '../src/core/session.js';
import { t } from '../src/i18n/index.js';
import { diagnose } from '../src/ui/diagnose.js';
import { EV } from '../src/trace/events.js';
import { eventsWithin, ownEvents } from '../src/trace/evallog.js';

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    const problem = fn();
    if (problem) failures.push(`${name}: ${problem}`);
    else passed++;
  } catch (e) {
    failures.push(`${name}: threw ${e.stack?.split('\n')[0] || e.message}`);
  }
}

const run = (code) => new RSession().run(code);

const eventsOf = (r, type) => r.trace.events.filter((e) => e.type === type);
const firstEvent = (r, type) => eventsOf(r, type)[0];

// ---------------------------------------------------------------------------
// 1. The events lessons are built on
// ---------------------------------------------------------------------------

check('coercion event carries before/after', () => {
  const r = run('x <- c(1, "a")');
  const ev = firstEvent(r, EV.COERCE);
  if (!ev) return 'no COERCE event';
  if (ev.data.from !== 'double' || ev.data.to !== 'character') return `wrong types ${ev.data.from}->${ev.data.to}`;
  // The payload carries the whole vector on both sides, so the panel can show the
  // row before and after -- not only the cell that changed.
  if (JSON.stringify(ev.data.before) !== '[1,"a"]') return `before=${JSON.stringify(ev.data.before)}`;
  if (JSON.stringify(ev.data.after) !== '["1","a"]') return `after=${JSON.stringify(ev.data.after)}`;
  return null;
});

check('mixing three types reports every type it promoted from', () => {
  const r = run('c(TRUE, 1L, 2.5)');
  const ev = firstEvent(r, EV.COERCE);
  if (!ev) return 'no COERCE event';
  if (ev.data.from !== 'logical/integer' || ev.data.to !== 'double') return `from=${ev.data.from} to=${ev.data.to}`;
  // Each part keeps its own type, so the picture can colour the "before" row per part.
  if (!ev.data.parts || ev.data.parts.map((p) => p.type).join() !== 'logical,integer,double') return 'parts lost their types';
  return null;
});

check('recycling event reports the repeat count', () => {
  const r = run('1:6 + c(10, 20)');
  const ev = firstEvent(r, EV.RECYCLE);
  if (!ev) return 'no RECYCLE event';
  if (ev.data.times !== 3 || ev.data.shortLen !== 2 || ev.data.longLen !== 6) return JSON.stringify(ev.data);
  if (!ev.data.fits) return 'should report a clean fit';
  return null;
});

check('partial recycling is flagged, not hidden', () => {
  const r = run('1:5 + c(10, 20)');
  const ev = firstEvent(r, EV.RECYCLE);
  if (!ev || ev.data.fits !== false) return 'partial recycling not marked';
  if (!eventsOf(r, EV.WARNING).some((w) => w.data.kind === 'recycle-partial')) return 'no warning emitted';
  return null;
});

check('elementwise steps mark reused cells', () => {
  const r = run('1:4 + c(10, 20)');
  const steps = eventsOf(r, EV.ELEMENTWISE);
  if (steps.length !== 4) return `expected 4 steps, got ${steps.length}`;
  if (steps[0].data.reusedB || steps[1].data.reusedB) return 'first pass should not be marked reused';
  if (!steps[2].data.reusedB || !steps[3].data.reusedB) return 'second pass should be marked reused';
  return null;
});

check('lookup records the scope chain it walked', () => {
  const r = run('f <- function() mean(c(1,2))\nf()');
  const lookups = eventsOf(r, EV.LOOKUP).filter((e) => e.data.name === 'mean');
  if (!lookups.length) return 'no lookup for mean';
  if (lookups[0].data.chain.length < 2) return 'chain should cross at least one frame';
  if (!lookups[0].data.foundIn) return 'mean should be found';
  return null;
});

check('copy-on-modify reports the type promotion', () => {
  const r = run('x <- 1:3\nx[1] <- "a"');
  const ev = eventsOf(r, EV.COPY).find((e) => e.data.promotedTo);
  if (!ev) return 'no COPY event carrying a promotion';
  if (ev.data.promotedTo !== 'character') return `promoted to ${ev.data.promotedTo}`;
  return null;
});

check('growing a vector is reported with old and new length', () => {
  const r = run('x <- c(1,2)\nx[5] <- 9');
  const ev = eventsOf(r, EV.COPY).find((e) => e.data.reason === 'grow');
  if (!ev) return 'no grow event';
  if (ev.data.from !== 2 || ev.data.to !== 5) return `${ev.data.from}->${ev.data.to}`;
  return null;
});

check('NA event names the rescue and the data', () => {
  const r = run('mean(c(1, 2, NA))');
  const ev = firstEvent(r, EV.NA_PROPAGATE);
  if (!ev) return 'no NA event';
  if (ev.data.rescueHint !== 'na.rm = TRUE') return `hint=${ev.data.rescueHint}`;
  if (!ev.data.values || ev.data.values.length !== 3) return 'values missing from payload';
  if (JSON.stringify(ev.data.naPositions) !== '[2]') return `naPositions=${JSON.stringify(ev.data.naPositions)}`;
  return null;
});

check('factor construction shows codes and levels', () => {
  const r = run('f <- factor(c("b","a","b"))');
  const ev = eventsOf(r, EV.COERCE).find((e) => e.data.to === 'factor');
  if (!ev) return 'no factor event';
  if (JSON.stringify(ev.data.levels) !== '["a","b"]') return `levels=${JSON.stringify(ev.data.levels)}`;
  if (JSON.stringify(ev.data.after) !== '[2,1,2]') return `codes=${JSON.stringify(ev.data.after)}`;
  return null;
});

check('a labelled survey scale keeps the empty level and says so in the event', () => {
  const r = run('f <- factor(c(4, 5, 2), levels = 1:5, labels = c("bz", "z", "s", "d", "bd"))');
  const ev = eventsOf(r, EV.COERCE).find((e) => e.data.to === 'factor');
  if (!ev) return 'no factor event';
  if (JSON.stringify(ev.data.levelValues) !== '["1","2","3","4","5"]') return `levelValues=${JSON.stringify(ev.data.levelValues)}`;
  if (JSON.stringify(ev.data.levels) !== '["bz","z","s","d","bd"]') return `labels=${JSON.stringify(ev.data.levels)}`;
  if (JSON.stringify(ev.data.after) !== '[4,5,2]') return `codes=${JSON.stringify(ev.data.after)}`;
  if (!ev.data.levelsGiven || !ev.data.labelled) return 'levelsGiven/labelled flags missing';
  return null;
});

check('averaging a factor points to the right exit: words by level number, numbers by text', () => {
  const words = run('mean(factor(c(4, 5), levels = 1:5, labels = c("a", "b", "c", "d", "e")))');
  const digits = run('mean(factor(c("3", "5")))');
  const fw = diagnose(words.error, '')?.fix;
  const fd = diagnose(digits.error, '')?.fix;
  if (fw !== 'as.numeric(f)') return `word scale: fix=${fw}`;
  if (fd !== 'as.numeric(as.character(f))') return `number labels: fix=${fd}`;
  return null;
});

check('subsetting reports which kind of index was used', () => {
  const cases = [
    ['x <- 1:5; x[c(1,2)]', 'positive'],
    ['x <- 1:5; x[-1]', 'negative'],
    ['x <- 1:5; x[x > 2]', 'logical'],
    ['x <- c(a=1,b=2); x["a"]', 'name'],
  ];
  for (const [code, kind] of cases) {
    const r = run(code);
    const ev = eventsOf(r, EV.INDEX).find((e) => e.data.bracket === '[');
    if (!ev) return `${code}: no INDEX event`;
    if (ev.data.kind !== kind) return `${code}: kind=${ev.data.kind}, expected ${kind}`;
  }
  return null;
});

// ---------------------------------------------------------------------------
// 2. The tidyverse verbs
// ---------------------------------------------------------------------------

const TABLE = 'd <- data.frame(a = c(1,2,3,4), g = c("x","y","x","y"), s = c(10,NA,30,40))\n';

check('filter separates "false" from "missing"', () => {
  const r = run(`${TABLE}d |> filter(s > 15)`);
  const ev = firstEvent(r, EV.DPLYR_FILTER);
  if (!ev) return 'no filter event';
  if (ev.data.kept !== 2) return `kept=${ev.data.kept}`;
  if (JSON.stringify(ev.data.naDropped) !== '[1]') return `naDropped=${JSON.stringify(ev.data.naDropped)}`;
  return null;
});

check('group_by reports every group and its rows', () => {
  const r = run(`${TABLE}d |> group_by(g) |> summarise(m = mean(a))`);
  const ev = firstEvent(r, EV.DPLYR_GROUP);
  if (!ev) return 'no group event';
  if (ev.data.count !== 2) return `count=${ev.data.count}`;
  const x = ev.data.groups.find((g) => g.labels[0] === 'x');
  if (!x || JSON.stringify(x.rows) !== '[0,2]') return `group x rows=${JSON.stringify(x && x.rows)}`;
  return null;
});

check('summarise reports the collapse per group', () => {
  const r = run(`${TABLE}d |> group_by(g) |> summarise(m = mean(a))`);
  const ev = firstEvent(r, EV.DPLYR_SUMMARISE);
  if (!ev) return 'no summarise event';
  if (ev.data.rowsBefore !== 4 || ev.data.groupCount !== 2) return JSON.stringify(ev.data);
  const x = ev.data.groups.find((g) => g.labels[0] === 'x');
  if (x.results[0].value !== 2) return `mean for x = ${x.results[0].value}`;
  return null;
});

check('mutate reports recycling of a short column', () => {
  const r = run(`${TABLE}d |> mutate(flaga = c(TRUE, FALSE))`);
  const ev = eventsOf(r, EV.RECYCLE).find((e) => e.data.op === 'mutate');
  if (!ev) return 'no recycle event inside mutate';
  if (ev.data.times !== 2) return `times=${ev.data.times}`;
  return null;
});

check('both pipes reach the same result', () => {
  const a = run(`${TABLE}d |> filter(a > 2) |> pull(a)`).lines.join('');
  const b = run(`${TABLE}d %>% filter(a > 2) %>% pull(a)`).lines.join('');
  return a === b ? null : `|> gave ${a}, %>% gave ${b}`;
});

check('a column name shadows nothing outside the verb', () => {
  // `a` is a column inside filter(), but must still be the variable outside it.
  const r = run(`${TABLE}a <- 999\nd |> filter(a > 2) |> nrow()\na`);
  const last = r.lines[r.lines.length - 1];
  return last.includes('999') ? null : `outer variable clobbered: ${last}`;
});

// ---------------------------------------------------------------------------
// 3. Deliberate divergences from base R
// ---------------------------------------------------------------------------

check('stringr propagates NA where grepl would say FALSE', () => {
  const a = run('str_detect(c("a", NA), "a")').lines.join(' ');
  const b = run('grepl("a", c("a", NA))').lines.join(' ');
  if (!a.includes('NA')) return `str_detect gave ${a}, expected NA`;
  if (b.includes('NA')) return `grepl gave ${b}, expected FALSE`;
  return null;
});

check('str_c propagates NA where paste0 writes "NA"', () => {
  const a = run('str_c("x", NA)').lines.join(' ');
  const b = run('paste0("x", NA)').lines.join(' ');
  if (!a.includes('NA') || a.includes('"xNA"')) return `str_c gave ${a}`;
  if (!b.includes('"xNA"')) return `paste0 gave ${b}`;
  return null;
});

check('dplyr renumbers rows, base R keeps them', () => {
  const base = run(`${TABLE}d[d$a > 2, ]`).lines;
  const tidy = run(`${TABLE}d |> filter(a > 2)`).lines;
  if (!base.some((l) => l.trim().startsWith('3'))) return `base R lost original row numbers: ${JSON.stringify(base)}`;
  if (!tidy.some((l) => l.trim().startsWith('1'))) return `dplyr did not renumber: ${JSON.stringify(tidy)}`;
  return null;
});

// ---------------------------------------------------------------------------
// 3b. The evaluation log -- what makes every piece of code clickable
// ---------------------------------------------------------------------------

const textOf = (src, e) => src.slice(e.node.span.start, e.node.span.end);

check('every level of a nest of calls is recorded, inside out', () => {
  const src = 'mean(as.numeric(as.character(factor(c("3", "5")))))';
  const r = run(src);
  const order = r.evalLog.entries.map((e) => textOf(src, e));
  const want = ['c("3", "5")', 'factor(c("3", "5"))', 'as.character(factor(c("3", "5")))', 'as.numeric(as.character(factor(c("3", "5"))))', src];
  for (const w of want) if (!order.includes(w)) return `not recorded: ${w}`;
  // R evaluates inside out: each call finishes after its argument.
  const at = want.map((w) => order.indexOf(w));
  if (at.some((x, i) => i > 0 && x < at[i - 1])) return `wrong order: ${at.join(',')}`;
  const top = r.evalLog.entries.find((e) => textOf(src, e) === src);
  if (top.value.values[0] !== 4) return `mean = ${top.value.values[0]}`;
  return null;
});

check('an expression inside a grouped summarise() is recorded once per group', () => {
  const src = `${TABLE}d |> group_by(g) |> summarise(m = mean(a))`;
  const r = run(src);
  const means = r.evalLog.entries.filter((e) => textOf(src, e) === 'mean(a)');
  if (means.length !== 2) return `mean(a) recorded ${means.length} times, expected 2 (one per group)`;
  const cols = r.evalLog.entries.filter((e) => textOf(src, e) === 'a' && e.parent && textOf(src, e.parent) === 'mean(a)');
  if (cols.length !== 2) return `column a recorded ${cols.length} times`;
  // Each evaluation saw only its own group's rows.
  if (cols.map((c) => c.value.values.length).join() === String(cols[0].value.values.length * 2)) return 'groups not split';
  return null;
});

check('a failing sub-expression is recorded with its error', () => {
  const src = 'mean(nie_ma_takiej)';
  const r = run(src);
  if (r.ok) return 'should fail';
  const failed = r.evalLog.entries.filter((e) => e.error);
  if (!failed.length) return 'no entry carries the error';
  if (textOf(src, failed[0]) !== 'nie_ma_takiej') return `innermost failure is "${textOf(src, failed[0])}"`;
  return null;
});

check('events are attributed to the evaluation that emitted them', () => {
  const src = 'x <- c(1, 2, 3, 4)\nx * c(10, 20)';
  const r = run(src);
  const mult = r.evalLog.entries.find((e) => textOf(src, e) === 'x * c(10, 20)');
  const own = ownEvents(r.trace, mult).map((e) => e.type);
  if (!own.includes(EV.RECYCLE)) return 'recycling not attributed to the multiplication';
  if (own.filter((ty) => ty === EV.ELEMENTWISE).length !== 4) return 'expected 4 elementwise steps';
  const combine = r.evalLog.entries.find((e) => textOf(src, e) === 'c(10, 20)');
  if (eventsWithin(r.trace, combine).some((e) => e.type === EV.ELEMENTWISE)) return 'c() window swallowed the arithmetic';
  return null;
});

check('pointing at a character finds the smallest expression under it', () => {
  const src = 'mean(oceny * 20)';
  const r = run(`oceny <- c(1, 2)\n${src}`);
  const base = 'oceny <- c(1, 2)\n'.length;
  const at = (text) => base + src.indexOf(text);
  const found = (offset) => { const n = r.evalLog.nodeAt(offset); return n ? `oceny <- c(1, 2)\n${src}`.slice(n.span.start, n.span.end) : null; };
  if (found(at('20')) !== '20') return `on 20: ${found(at('20'))}`;
  if (found(at('*')) !== 'oceny * 20') return `on *: ${found(at('*'))}`;
  if (found(at('mean')) !== src) return `on mean: ${found(at('mean'))}`;
  return null;
});

check('a runaway loop fills the log up to its cap and stops recording', () => {
  const r = run('s <- 0\nfor (i in 1:3000) s <- s + i\ns');
  if (!r.ok) return `failed: ${r.error.message}`;
  if (!r.evalLog.truncated) return 'log was not capped';
  if (r.evalLog.entries.length > r.evalLog.limit) return 'cap exceeded';
  return null;
});

check('answer checking records nothing (no trace, no log)', () => {
  const r = new RSession({ trace: false }).run('mean(c(1, 2, 3))');
  return r.evalLog === null ? null : 'a quiet run built an evaluation log';
});

// ---------------------------------------------------------------------------
// 4. Diagnosis
// ---------------------------------------------------------------------------

check('diagnosis picks the right advice for each mistake', () => {
  const cases = [
    ['srednia <- mean(c(1,2))\nSrednia', 'diag.caseMismatch'],
    ['mean(x = 5)\nx', 'diag.assignInCall'],
    ['if (c(1,2) > 0) 1', 'diag.ifVector'],
    ['f <- factor("a")\nf + 1', 'diag.factorMath'],
    ['x <- c(1,2)\nx$a', 'diag.dollarVector'],
    ['nowa[1] <- 5', 'diag.createFirst'],
    ['library(dplyr)', 'diag.unsupported'],
    ['x <- "abc"\nmean(x)', 'diag.textMath'],
    ['factor(c(4, 5, 2), labels = c("a", "b", "c", "d"))', 'diag.factorLabels'],
    ['factor(c(4, 5, 2), levels = 1:4, labels = c("a", "b", "c"))', 'diag.factorLabelsCount'],
  ];
  for (const [code, expectTitleKey] of cases) {
    const r = new RSession().run(code);
    if (r.ok) return `${code.replace(/\n/g, ' / ')}: expected an error`;
    const help = diagnose(r.error, code);
    if (!help) return `${code.replace(/\n/g, ' / ')}: no diagnosis`;
    if (help.title !== t(`${expectTitleKey}.title`)) {
      return `${code.replace(/\n/g, ' / ')}: got "${help.title}", expected "${t(`${expectTitleKey}.title`)}"`;
    }
  }
  return null;
});

check('an unclosed bracket is diagnosed as a bracket, not as a comma', () => {
  const code = 'ankieta <- data.frame(a = 1)\nankieta |> group_by(a |> summarise(n = 1)';
  const r = run(code);
  if (r.ok) return 'should not parse';
  const help = diagnose(r.error, code);
  if (!help) return 'no diagnosis';
  if (help.title !== t('diag.unclosed.title')) return `got "${help.title}"`;
  return null;
});

check('several values without c() are diagnosed as such, with the line fixed', () => {
  const cases = [
    ['x <- 1\nwiek <- 23, 34, 45', 'wiek <- c(23, 34, 45)'],
    ['plec = "K", "M"', 'plec <- c("K", "M")'],
    ['23, 34', 'c(23, 34)'],
  ];
  for (const [code, fix] of cases) {
    const r = run(code);
    const help = r.ok ? null : diagnose(r.error, code);
    if (help?.title !== t('diag.manyValues.title')) return `${JSON.stringify(code)}: got "${help?.title}"`;
    if (help.fix !== fix) return `${JSON.stringify(code)}: fix ${JSON.stringify(help.fix)}`;
  }
  // A real missing comma is still the general advice.
  const other = 'mean(1 2)';
  const h = diagnose(run(other).error, other);
  return h?.title === t('diag.manyValues.title') ? 'a missing comma is called "several values"' : null;
});

// Mistakes found by trying a beginner's answers on every task (D24). Each must be
// named for what it is, with the student's own line corrected where possible.
check('beginner mistakes get their own diagnosis, with the line fixed', () => {
  const setup = 'ankieta <- data.frame(plec = c("K", "M"), wiek = c(20, 30), ocena = c(4, NA))\noceny <- c(4, 5)';
  const cases = [
    ['oceny - mean', 'diag.fnWithoutCall', 'mean(...)'],
    ['ankieta$wiek[plec == "K"]', 'diag.columnOutside', 'ankieta$plec'],
    ['ankieta$plec == K', 'diag.valueNeedsQuotes', '"K"'],
    ['ankieta |>\n  mutate(ankieta$x = wiek * 2)', 'diag.dollarName', 'mutate(x = wiek * 2)'],
    ['ankieta |>\n  group_by(plec)\n  summarise(liczba = n())', 'diag.missingPipe', '  group_by(plec) |>'],
    ['ankieta |>\n  filter(wiek > 1)\n  select(wiek)', 'diag.missingPipe', '  filter(wiek > 1) |>'],
  ];
  for (const [code, key, fix] of cases) {
    const s = new RSession();
    s.run(setup);
    const r = s.run(code);
    if (r.ok) return `${JSON.stringify(code)}: expected an error`;
    const help = diagnose(r.error, code);
    if (help?.title !== t(`${key}.title`, { line: 2 })) return `${JSON.stringify(code)}: got "${help?.title}"`;
    if (help.fix !== fix) return `${JSON.stringify(code)}: fix ${JSON.stringify(help.fix)}`;
  }
  return null;
});

check('valid R the trainer used to reject: T and F, na.omit(), an unnamed summarise()', () => {
  const s = new RSession();
  s.run('d <- data.frame(w = c(1, 2, 3))');
  const want = [['mean(c(4, NA, 5), na.rm = T)', '[1] 4.5'], ['mean(na.omit(c(4, NA, 5)))', '[1] 4.5'], ['names(d |> summarise(mean(w)))', '[1] "mean(w)"']];
  for (const [code, line] of want) {
    const r = s.run(code);
    if (!r.ok) return `${code}: ${r.error.message}`;
    if (r.lines[0] !== line) return `${code}: printed ${JSON.stringify(r.lines)}`;
  }
  return null;
});

check('a failure inside the trainer becomes an error on screen, never a crash', () => {
  const s = new RSession();
  s.run('d <- data.frame(g = c("a", "b"), w = c(1, 2))');
  // Verbs with no table at all once threw a JavaScript TypeError out of run().
  for (const code of ['count()', 'filter()', 'select()', 'mutate()', 'arrange()', 'summarise()', 'group_by()', 'pull()',
    'd |> group_by(g) |> summarise(n = count())']) {
    let r;
    try { r = s.run(code); } catch (e) { return `${code}: threw ${e.message}`; }
    if (r.ok || r.error.key !== 'err.verbNeedsTable') return `${code}: ${r.ok ? 'ran' : r.error.key}`;
  }
  return null;
});

check('a table of two variables is refused, not counted by the first one alone', () => {
  const code = 'a <- c("K", "M", "K")\nb <- c(1, 2, 1)\ntable(a, b)';
  const r = run(code);
  if (r.ok) return `ran and printed ${JSON.stringify(r.lines)}`;
  if (r.error.key !== 'err.tableTwoWay') return r.error.key;
  const help = diagnose(r.error, code);
  return help && /zakres/.test(help.title) ? null : `diagnosis: ${help && help.title}`;
});

check('a typo one letter away is offered as the fix', () => {
  const code = 'wartosc <- 5\nwartosd';
  const r = run(code);
  const help = diagnose(r.error, code);
  if (!help || !help.fix || !help.fix.includes('wartosc')) return `fix=${help && help.fix}`;
  return null;
});

// ---------------------------------------------------------------------------
// 5. Polish
// ---------------------------------------------------------------------------

check('errors render in Polish', () => {
  const r = run('nieistnieje');
  if (!r.error.message.includes('Nie znaleziono')) return `got "${r.error.message}"`;
  return null;
});

check('plurals agree with the number (1 / 2-4 / 5+, and 12-14, 22-24)', () => {
  const cases = [
    ['if (c(1,2) > 0) 1', '2 wartości'],
    ['if (c(1,2,3,4,5) > 0) 1', '5 wartości'],
  ];
  for (const [code, expect] of cases) {
    const r = run(code);
    if (!r.error.message.includes(expect)) return `${code}: expected "${expect}" in "${r.error.message}"`;
  }
  const forms = (n) => t('fx.nrow', { n });
  const expected = { 1: '1 wiersz', 2: '2 wiersze', 5: '5 wierszy', 12: '12 wierszy', 22: '22 wiersze', 25: '25 wierszy', 21: '21 wierszy' };
  for (const [n, phrase] of Object.entries(expected)) {
    if (!forms(Number(n)).includes(phrase)) return `n=${n}: "${forms(Number(n))}" lacks "${phrase}"`;
  }
  return null;
});

// ---------------------------------------------------------------------------
// 6. Robustness -- hostile input must not hang or crash the page
// ---------------------------------------------------------------------------

check('every evaluation has a value, and windows nest inside their parents', () => {
  const code = `${TABLE}x <- c(TRUE, 1L, 2.5)\ny <- 1:6 + c(10, 20)\nf <- factor(c("b","a"))\n`
    + `mean(c(1,NA))\nd |> group_by(g) |> summarise(m = mean(a))\nd |> filter(s > 15)\n`
    + `d |> arrange(desc(a))\nd |> mutate(p = a * 2)\nstr_detect("ab", "a")\nz <- 1:3\nz[5] <- 9\nz[1] <- "t"`;
  const r = run(code);
  if (!r.ok) return `failed: ${r.error.message}`;
  for (const e of r.evalLog.entries) {
    if (e.value === undefined && !e.error) return `entry without value at ${JSON.stringify(e.node.span)}`;
    if (e.parent && (e.seqFrom < e.parent.seqFrom || e.seqTo > e.parent.seqTo)) return 'a child window leaks out of its parent';
    for (const c of e.children) if (c.parent !== e) return 'child/parent links disagree';
  }
  return null;
});

check('an endless loop is stopped instead of hanging', () => {
  const started = Date.now();
  const r = run('while (TRUE) { x <- 1 }');
  const took = Date.now() - started;
  if (r.ok) return 'endless loop reported success';
  if (took > 10000) return `took ${took}ms`;
  if (r.error.key !== 'err.stepBudget') return `key=${r.error.key}`;
  return null;
});

check('deep recursion fails cleanly, not with a stack crash', () => {
  const r = run('f <- function(n) f(n + 1)\nf(1)');
  if (r.ok) return 'infinite recursion reported success';
  if (!r.error && !r.lines.length) return 'no error surfaced';
  return null;
});

check('empty and edge-case inputs do not throw', () => {
  const snippets = [
    '', '   ', '\n\n', '# only a comment',
    'c()', 'NULL', 'character(0)', 'integer(0) + 1',
    'x <- c(); length(x)', 'mean(numeric(0))', 'sum()',
    'data.frame()', 'list()', 'factor(character(0))',
    'd <- data.frame(a=1); d |> filter(a > 99)',
    'd <- data.frame(a=1); d |> filter(a > 99) |> summarise(m = mean(a))',
    'str_detect(character(0), "a")', 'str_split("", "")',
    '1:0', 'seq_len(0)', 'rep(1, 0)',
    'x <- 1:3; x[0]', 'x <- 1:3; x[NA]', 'x <- 1:3; x[100]',
    'if (TRUE) NULL', 'for (i in c()) print(i)',
  ];
  for (const code of snippets) {
    try {
      const r = run(code);
      if (r.ok === undefined) return `${JSON.stringify(code)}: no result`;
    } catch (e) {
      return `${JSON.stringify(code)}: threw ${e.message}`;
    }
  }
  return null;
});

check('malformed code reports a position, not a crash', () => {
  const snippets = ['x <-', 'c(1,', '"unclosed', 'if (', 'function(', 'x[[1]', '1 +', ')', '}', 'x %>%'];
  for (const code of snippets) {
    const r = run(code);
    if (r.ok) return `${JSON.stringify(code)}: should not parse`;
    if (!r.error.message || /^[a-z]+\.[a-zA-Z]+$/.test(r.error.message)) {
      return `${JSON.stringify(code)}: untranslated message "${r.error.message}"`;
    }
  }
  return null;
});

check('a large vector stays responsive and truncates its trace', () => {
  const started = Date.now();
  const r = run('x <- 1:20000\ny <- x * 2\nlength(y)');
  const took = Date.now() - started;
  if (!r.ok) return `failed: ${r.error.message}`;
  if (took > 8000) return `took ${took}ms`;
  if (!r.lines.join(' ').includes('20000')) return `wrong result: ${r.lines.join(' ')}`;
  return null;
});

// ---------------------------------------------------------------------------
// Found by walking the live site as a student (2026-10-06)
// ---------------------------------------------------------------------------

const SURVEY = 'd <- data.frame(id = 1:5, wiek = c(23, 40, 51, NA, 40), plec = c("K", "M", "K", "M", "M"))\n';

check('filter() with one = stops and asks, instead of handing back every row', () => {
  for (const [code, hint] of [['d |> filter(wiek = 40)', 'wiek == 40'], ['filter(d, plec = "K")', 'plec == "K"']]) {
    const r = run(SURVEY + code);
    if (r.ok) return `${code} ran and gave ${r.lines.length - 1} rows`;
    if (r.error.key !== 'err.filterNamed' || !r.error.message.includes(hint)) return `${code}: ${r.error.key} "${r.error.message}"`;
  }
  return null;
});

check('a misspelt or unusual argument of count() and group_by() never ends in an internal error', () => {
  const internal = t('err.internal');
  for (const code of ['d |> count(nic)', 'd |> count(plec, sort = TRUE)', 'd |> count(plec, name = "ile")', 'd |> count(wiek > 30)',
    'd |> group_by(wiek > 30) |> summarise(n = n())', 'd |> group_by(nic)', 'd |> count()']) {
    const r = run(SURVEY + code);
    if (!r.ok && (r.error.key === 'err.internal' || r.error.message === internal)) return `${code}: internal error`;
  }
  const typo = run(`${SURVEY}d |> count(nic)`);
  return typo.error?.key === 'err.noSuchColumn' ? null : `count(nic): ${typo.error?.key}`;
});

check('reading a file points to the RStudio page, not to an exercise that does not exist', () => {
  const r = run('read.csv2("ankieta.csv")');
  return !r.ok && r.error.message.includes('Dalej w RStudio') && !/ćwiczeniu o danych/.test(r.error.message) ? null : r.error?.message;
});

check('pivot_wider() refuses what it cannot shape, in words a student can act on', () => {
  const cases = [
    // Two rows for one cell: tidyr would build list-columns; here it says what to do first.
    ['d |> select(plec, wiek) |> pivot_wider(names_from = plec, values_from = wiek)', 'err.pivotDuplicates'],
    ['d |> count(plec) |> pivot_wider(names_from = plec)', 'err.pivotNeeds'],
    ['d |> count(plec) |> pivot_wider(plec, n)', 'err.pivotArg'],
    ['d |> count(plec) |> pivot_wider(names_from = plc, values_from = n)', 'err.noSuchColumn'],
    ['d |> count(plec) |> pivot_wider(names_from = n, values_from = n)', 'err.pivotSame'],
  ];
  for (const [code, key] of cases) {
    const r = run(SURVEY + code);
    if (r.ok) return `${code} ran`;
    if (r.error.key !== key) return `${code}: ${r.error.key} "${r.error.message}"`;
  }
  return null;
});

check('a join refuses a key it cannot use, in words a student can act on (D40)', () => {
  const tables = `${SURVEY}m <- data.frame(plec = c("K", "M"), nazwa = c("kobieta", "mężczyzna"))\n`;
  const cases = [
    // The habit of a whole chapter: column names are written bare. Here they are text.
    ['d |> left_join(m, by = plec)', 'err.joinByQuote'],
    ['d |> left_join(m, by = c(plec))', 'err.joinByQuote'],
    ['d |> left_join(by = "plec")', 'err.joinNeedsTwo'],
    ['d |> left_join(5, by = "plec")', 'err.joinNeedsTwo'],
    ['d |> left_join(m, by = "nazwa")', 'err.joinKeyLeft'],
    ['d |> left_join(m, by = "wiek")', 'err.joinKeyRight'],
    ['d |> left_join(m, by = c("wiek" = "plec"))', 'err.joinTypes'],
    ['d |> left_join(m, by = "plec", keep = TRUE)', 'err.joinArg'],
    ['d |> select(wiek) |> left_join(m)', 'err.joinNoCommon'],
    ['d |> left_join(m, by = 3)', 'err.joinBy'],
  ];
  for (const [code, key] of cases) {
    const r = run(tables + code);
    if (r.ok) return `${code} ran`;
    if (r.error.key !== key) return `${code}: ${r.error.key} "${r.error.message}"`;
  }
  const quoted = run(`${tables}d |> left_join(m, by = plec)`);
  return quoted.error.message.includes('by = "plec"') ? null : quoted.error.message;
});

check('a join says which key it guessed, and warns only when keys repeat on both sides (D40)', () => {
  const tables = `${SURVEY}m <- data.frame(plec = c("K", "M"), nazwa = c("kobieta", "mężczyzna"))
twice <- data.frame(plec = c("K", "K", "M"), kod = c(1, 2, 3))\n`;
  const warning = t('warn.joinMany');
  const rows = (r) => r.value.values[0].values.length;
  const n = rows(run(`${tables}d`));
  const women = run(`${tables}sum(d$plec == "K")`).value.values[0];
  const guessed = run(`${tables}d |> left_join(m)`);
  if (!guessed.ok || !guessed.lines[0].includes('join_by(plec)')) return `no key announced: ${guessed.lines?.[0]}`;
  const named = run(`${tables}d |> left_join(m, by = "plec")`);
  if (named.lines.some((l) => l.includes('join_by') || l.includes(warning))) return `a named key was announced: ${named.lines[0]}`;
  if (rows(named) !== n) return `one partner each changed the rows: ${rows(named)}`;
  const many = run(`${tables}d |> left_join(twice, by = "plec")`);
  if (!many.lines.some((l) => l.includes(warning))) return 'keys repeating on both sides gave no warning';
  if (rows(many) !== n + women) return `rows after a repeated key: ${rows(many)}, expected ${n + women}`;
  // One woman on the left: her row doubles, and dplyr says nothing.
  const quiet = run(`${tables}d |> filter(id == 1) |> left_join(twice, by = "plec")`);
  if (quiet.lines.some((l) => l.includes(warning))) return 'a key repeated on one side only gave a warning';
  return rows(quiet) === 2 ? null : `one row against two partners gave ${rows(quiet)}`;
});

// ---------------------------------------------------------------------------

console.log(`behaviour: ${passed}/${passed + failures.length} checks passed`);
for (const f of failures) console.log(`  FAIL  ${f}`);
process.exit(failures.length ? 1 : 0);
