/**
 * The picture sweep: every sub-expression of every lesson, drawn headlessly.
 *
 * The code is the interface (decision D10), so any piece of any lesson can end up on
 * the stage -- including pieces nobody thought to click while writing the lesson.
 * This walks all of them: every scene, the sandbox, every chip, the solution and
 * every anticipated wrong answer; for each, every entry of the evaluation log goes
 * through describeEntry() and renderStage(). It fails when a picture throws, or when a
 * caption would show the student a raw key or an unfilled {placeholder}.
 */

import { installDom } from './dom-shim.mjs';
installDom();

const { LESSONS } = await import('../src/lessons/index.js');
const { RSession } = await import('../src/core/session.js');
const { describeEntry, renderStage, stopStage } = await import('../src/ui/viz/focus.js');
const { renderMemory } = await import('../src/ui/viz/memory.js');
const { renderValue, renderMini, renderThumb } = await import('../src/ui/viz/value.js');
const { highlightCode } = await import('../src/ui/codebox.js');
const { isDataFrame } = await import('../src/core/rvalue.js');

let pictures = 0;
const failures = [];
const RAW_KEY = /\b(fx|ls|lv|ui|val|tv|rx|op|co|mem|badge|module|type|err|diag|warn|env|tok)\.[a-zA-Z][\w.]*/;

function sweep(label, setup, code, { pick = null, show = null } = {}) {
  const session = new RSession();
  if (setup) session.run(setup, { trace: false });
  const r = session.run(code);
  const base = { trace: r.trace, log: r.evalLog, source: code, onSelect() {}, still: true };
  const picked = pick && show ? r.evalLog?.findByText(code, pick) : null;
  for (const entry of r.evalLog?.entries || []) {
    const where = `${label} :: ${JSON.stringify(code.slice(entry.node.span.start, entry.node.span.end)).slice(0, 60)}`;
    // A scene's pointer is drawn on its picked expression, as LiveCode does.
    const ctx = entry === picked ? { ...base, show } : base;
    try {
      const d = describeEntry(entry, ctx);
      const stage = renderStage(entry, ctx);
      pictures++;
      const text = `${d.caption} ${stage.textContent}`;
      if (!d.pic) failures.push(`${where}: no picture`);
      const raw = text.match(RAW_KEY);
      if (raw) failures.push(`${where}: raw key "${raw[0]}" in "${text.slice(0, 120)}"`);
      const hole = text.match(/\{[a-zA-Z]+(\|[^}]*)?\}/);
      if (hole) failures.push(`${where}: unfilled placeholder "${hole[0]}"`);
      if (/undefined|NaN|\[object Object\]/.test(d.caption)) failures.push(`${where}: caption "${d.caption}"`);
    } catch (e) {
      failures.push(`${where}: threw ${e.stack?.split('\n').slice(0, 2).join(' | ')}`);
    }
  }
  try {
    renderMemory(r.env, {});
    for (const root of r.evalLog?.roots() || []) {
      if (root.error) continue;
      renderValue(root.value);
      renderMini(root.value);
      if (root.value && isDataFrame(root.value)) renderThumb(root.value);
    }
    highlightCode(code);
  } catch (e) {
    failures.push(`${label}: memory/values threw ${e.message}`);
  }
  stopStage();
}

for (const l of LESSONS) {
  l.scenes.forEach((s, i) => sweep(`${l.id} scene ${i + 1}`, l.setup, s.code, { pick: s.pick, show: s.show }));
  sweep(`${l.id} sandbox`, l.setup, l.play.code);
  l.play.chips.forEach((c, i) => sweep(`${l.id} chip ${i + 1}`, l.setup, c));
  sweep(`${l.id} solution`, l.setup, l.task.solution);
  (l.task.nearMisses || []).forEach((nm) => sweep(`${l.id} near-miss "${nm.name}"`, l.setup, nm.code));
}

// Things students type that no lesson contains: the pictures must hold up there too.
const EXTRA = [
  'x <- 1:6\ny <- x + c(10, 20)', 'c(TRUE, 1L, 2.5)', 'x <- c(1, 2)\nx[5] <- 9\nx', 'rev(1:4)',
  'sort(c(3, 1, NA, 2))', 'round(c(1.234, 5.678), 1)', 'nchar(c("ala", "kot"))', '"a" %in% c("a", "b")',
  'f <- function(x) x * 2\nf(1:3)', 'l <- list(a = 1, b = "x")\nl$b\nl[["a"]]', 'ifelse(c(1, 5) > 3, "duzo", "malo")',
  'd <- data.frame(a = 1:3, b = c("x", "y", "x"))\nd[d$a > 1, "b"]', 'median(c(5, 1, 3))', 'max(c(2, 9, 4))',
  'paste("a", 1:3)', 'unique(c(1, 1, 2))', 'toupper("abc")', 'str_detect(c("Kraków", "Gdańsk"), "ń")',
  'typeof(1L)', 'class(factor("a"))', 'nlevels(factor(c("a", "b")))', 'table(c("a", "b", "a", NA))',
  'x <- c(a = 1, b = 2)\nx["b"]', 'seq(1, 10, by = 3)', 'NA > 1', 'TRUE && FALSE', '-c(1, 2)', '!c(TRUE, FALSE)',
  'mean(nie_ma)', 'sum(1:4) / length(1:4)', 'sqrt(16)',
];
EXTRA.forEach((code, i) => sweep(`extra ${i + 1}`, '', code));

// A scene pointer must actually reach its picture: the factors lesson's first scene
// promises a hollow row for the answer nobody chose.
{
  const l = LESSONS.find((x) => x.id === 'factors');
  const scene = l?.scenes.find((x) => x.show?.absent);
  if (scene) {
    const s = new RSession();
    s.run(l.setup, { trace: false });
    const r = s.run(scene.code);
    const entry = r.evalLog.findByText(scene.code, scene.pick);
    const d = describeEntry(entry, { trace: r.trace, log: r.evalLog, source: scene.code, still: true, show: scene.show });
    if (!d.caption.includes(scene.show.absent.join(', ')) || !/brak/.test(d.pic.textContent)) {
      failures.push(`factors scene with show.absent: caption "${d.caption}", picture "${d.pic.textContent.slice(0, 60)}"`);
    }
    stopStage();
  }
}

// Every "W arkuszu" panel a scene asks for must be drawn: a null panel would leave
// the sentence talking about a spreadsheet nobody sees.
for (const l of LESSONS) {
  l.scenes.forEach((scene, i) => {
    if (!scene.show?.excel) return;
    const s = new RSession();
    s.run(l.setup, { trace: false });
    const r = s.run(scene.code);
    const entry = r.evalLog.findByText(scene.code, scene.pick);
    const d = describeEntry(entry, { trace: r.trace, log: r.evalLog, source: scene.code, still: true, show: scene.show });
    if (!/pic-vs/.test(d.pic?.className || '')) failures.push(`${l.id} scene ${i + 1}: show.excel drew no spreadsheet panel`);
    // Animated pictures replace themselves frame by frame: every frame must keep it.
    for (let k = 1; d.frame && k <= (d.frames || 0); k++) {
      if (!/pic-vs/.test(d.frame(k)?.className || '')) { failures.push(`${l.id} scene ${i + 1}: frame ${k} lost the spreadsheet panel`); break; }
    }
    stopStage();
  });
}

// The task's goal-vs-answer picture, for the solution and every anticipated wrong
// answer: the student sees this one on every keystroke of the task.
const { renderCompare } = await import('../src/ui/viz/pictures.js');
let compares = 0;
for (const l of LESSONS) {
  const goalRun = new RSession({ trace: false });
  goalRun.run(l.setup);
  const goal = goalRun.run(l.task.solution).value;
  for (const code of [l.task.solution, ...(l.task.nearMisses || []).map((nm) => nm.code)]) {
    const s = new RSession({ trace: false });
    s.run(l.setup);
    const run = s.run(code);
    try {
      const pic = renderCompare(goal, run.ok ? run.value : undefined, { goalLabel: 'Cel', mineLabel: 'Twój wynik' });
      compares++;
      if (/undefined|NaN|\[object Object\]/.test(pic.textContent)) failures.push(`${l.id} compare ${JSON.stringify(code).slice(0, 50)}: "${pic.textContent.slice(0, 80)}"`);
    } catch (e) {
      failures.push(`${l.id} compare ${JSON.stringify(code).slice(0, 50)}: threw ${e.message}`);
    }
  }
}

console.log(`pictures: ${pictures} sub-expressions drawn, ${compares} goal comparisons, ${failures.length} problem(s)`);
for (const f of failures.slice(0, 40)) console.log(`  FAIL  ${f}`);
process.exit(failures.length ? 1 : 0);
