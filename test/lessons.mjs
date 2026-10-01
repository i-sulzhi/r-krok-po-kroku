/**
 * Lesson validation.
 *
 * Lessons are content, and content rots quietly: a renamed column, a chip that no
 * longer runs, a task whose own solution stopped working after an engine change.
 * This suite runs every piece of code every lesson contains, so that failure is loud.
 *
 * For each lesson it checks that:
 *   - the shape is complete (scenes, sandbox, task)
 *   - the text stays short: one sentence per scene, budgets per field (decision D12)
 *   - every scene runs, its pre-selected expression exists, its "click me" is in the code
 *   - the sandbox and every one-click variant run
 *   - the lesson's own solution passes its own check, and the starter does not
 *   - anticipated wrong answers are diagnosed into the intended message
 *   - `**bold**` and `code` markup is balanced everywhere
 */

import { LESSONS } from '../src/lessons/index.js';
import { RSession } from '../src/core/session.js';

let passed = 0;
const failures = [];
const check = (name, fn) => {
  try {
    const problem = fn();
    if (problem) failures.push(`${name}: ${problem}`);
    else passed++;
  } catch (e) {
    failures.push(`${name}: threw ${e.stack?.split('\n')[0] || e.message}`);
  }
};

/** Run code in a quiet session that already has the lesson's data. */
function attempt(lesson, code) {
  const session = new RSession({ trace: false, persist: true });
  const setup = session.run(lesson.setup);
  if (!setup.ok) throw new Error(`setup failed: ${setup.error.message}`);
  const run = session.run(code);
  return { run, session };
}

/** Run code the way the live code box does: traced, with an evaluation log. */
function live(lesson, code) {
  const session = new RSession();
  if (lesson.setup) session.run(lesson.setup, { trace: false });
  return session.run(code);
}

/** Length a student reads: markup characters do not count. */
const visible = (s) => String(s).replace(/\*\*|`/g, '').length;

/**
 * "Less text" as a rule rather than a wish. A scene says where to look, in one
 * sentence; the picture explains. Budgets are characters of visible text.
 */
const BUDGET = { title: 32, say: 90, prompt: 130, hint: 110, message: 130, success: 60, note: 120 };

for (const lesson of LESSONS) {
  const id = lesson.id;
  const { task } = lesson;

  check(`${id}: shape is complete`, () => {
    for (const field of ['id', 'module', 'title', 'scenes', 'play', 'task']) {
      if (!lesson[field]) return `missing ${field}`;
    }
    if (typeof lesson.setup !== 'string') return 'setup must be a string (may be empty)';
    if (lesson.scenes.length < 2 || lesson.scenes.length > 5) return `${lesson.scenes.length} scenes; keep 2-5`;
    if (!lesson.play.code || (lesson.play.chips || []).length < 2) return 'sandbox needs code and at least two chips';
    // `starter` may legitimately be an empty string, so test for absence, not falsiness.
    for (const f of ['prompt', 'solution', 'success', 'check', 'diagnose']) if (!task[f]) return `task.${f} missing`;
    if (task.starter === undefined) return 'task.starter missing';
    if ((task.hints || []).length < 2) return 'needs at least two hints';
    if (!task.messages?.general) return 'no general fallback message';
    return null;
  });

  // The student should see where every name comes from. A data table stands for a
  // file read from disk (lesson 1 introduces it); a small vector is something they
  // can write themselves, so the scene that first uses it also creates it.
  check(`${id}: every vector the scenes use is created on screen first`, () => {
    for (const [, name, rhs] of (lesson.setup || '').matchAll(/^([A-Za-z.][\w.]*)\s*<-\s*(\S+)/gm)) {
      if (rhs.startsWith('data.frame(')) continue;
      const uses = new RegExp(`(^|[^\\w.])${name.replace(/\./g, '\\.')}([^\\w.]|$)`);
      const first = lesson.scenes.findIndex((sc) => uses.test(sc.code));
      if (first < 0) continue;
      if (!new RegExp(`^${name.replace(/\./g, '\\.')}\\s*<-`, 'm').test(lesson.scenes[first].code)) {
        return `${name} is first used in scene ${first + 1}, which does not create it`;
      }
    }
    return null;
  });

  // At 1366x768 the code box shows about 56 characters; a longer line is cut at the
  // edge (a 58-character comment once was). Keep a margin.
  check(`${id}: code lines fit the code box`, () => {
    const codes = [...lesson.scenes.map((sc) => sc.code), lesson.play.code];
    const long = codes.flatMap((c) => c.split('\n')).filter((line) => line.length > 54);
    return long.length ? `too wide (>54): ${long.map((l) => JSON.stringify(l)).join(', ')}` : null;
  });

  check(`${id}: text stays within its budget`, () => {
    const over = [];
    const test = (kind, s) => { if (s != null && visible(s) > BUDGET[kind]) over.push(`${kind} (${visible(s)}>${BUDGET[kind]}): "${String(s).slice(0, 50)}…"`); };
    test('title', lesson.title);
    lesson.scenes.forEach((s) => test('say', s.say));
    test('prompt', task.prompt);
    task.hints.forEach((h) => test('hint', h));
    Object.values(task.messages).forEach((m) => test('message', m));
    test('success', task.success);
    test('note', task.note);
    return over.length ? over.join('; ') : null;
  });

  check(`${id}: every scene runs, and what it points at exists`, () => {
    for (const [i, scene] of lesson.scenes.entries()) {
      if (!scene.say || !scene.code) return `scene ${i + 1}: say and code are required`;
      const r = live(lesson, scene.code);
      if (!r.ok) return `scene ${i + 1} failed: ${r.error.message}`;
      if (scene.pick) {
        const entry = r.evalLog.findByText(scene.code, scene.pick);
        if (!entry) return `scene ${i + 1}: pick ${JSON.stringify(scene.pick)} is not an evaluated expression`;
      }
      if (scene.tap && !scene.code.includes(scene.tap)) return `scene ${i + 1}: tap ${JSON.stringify(scene.tap)} is not in the code`;
      // A pointer the picture cannot honour would point at nothing.
      if (scene.show) {
        const v = scene.pick ? r.evalLog.findByText(scene.code, scene.pick)?.value : r.value;
        const unknown = Object.keys(scene.show).filter((k) => !['absent', 'lit', 'sheet', 'excel', 'rows'].includes(k));
        if (unknown.length) return `scene ${i + 1}: unknown show keys ${unknown.join(', ')}`;
        if (scene.show.absent) {
          const names = (v?.attributes?.names?.values || []).map(String);
          if (!v?.attributes?.class?.values.includes('table')) return `scene ${i + 1}: show.absent needs a table`;
          const present = scene.show.absent.filter((x) => names.includes(String(x)));
          if (present.length) return `scene ${i + 1}: show.absent names values that ARE in the table: ${present}`;
        }
        if (scene.show.excel && !['mixed', 'fill', 'blank'].includes(scene.show.excel.kind)) {
          return `scene ${i + 1}: show.excel.kind must be mixed, fill or blank`;
        }
        if (scene.show.lit != null && !(v?.values || []).includes(scene.show.lit)) {
          return `scene ${i + 1}: show.lit ${scene.show.lit} is not a code of the picked factor`;
        }
      }
    }
    return null;
  });

  check(`${id}: the sandbox and every chip run`, () => {
    for (const code of [lesson.play.code, ...lesson.play.chips]) {
      const r = live(lesson, code);
      if (!r.ok) return `${JSON.stringify(code)} failed: ${r.error.message}`;
    }
    return null;
  });

  check(`${id}: its own solution passes its own check`, () => {
    const { run, session } = attempt(lesson, task.solution);
    if (!run.ok) return `solution failed: ${run.error.message}`;
    const verdict = task.check({ value: run.value, code: task.solution, session });
    if (!verdict.ok) return `check rejected the solution: ${verdict.reason}`;
    return null;
  });

  check(`${id}: the starter does NOT pass`, () => {
    const { run, session } = attempt(lesson, task.starter);
    if (run.ok) {
      const verdict = task.check({ value: run.value, code: task.starter, session });
      if (verdict.ok) return 'the starter already solves the task';
    }
    return null;
  });

  check(`${id}: markup is balanced`, () => {
    const strings = [
      lesson.title, ...lesson.scenes.map((s) => s.say), task.prompt, ...task.hints,
      ...Object.values(task.messages), task.success, task.note || '', lesson.play.say || '',
    ];
    const broken = strings.find((s) => (String(s).match(/\*\*/g) || []).length % 2 || (String(s).match(/`/g) || []).length % 2);
    return broken ? `unbalanced ** or \` in: ${JSON.stringify(broken).slice(0, 80)}` : null;
  });

  // The course's plain style (the teacher's own): short sentences joined by
  // "więc", "a", "bo", never an em dash. The en dash stays for ranges (1–5).
  check(`${id}: no em dashes in student-facing text`, () => {
    const strings = [
      lesson.title, ...lesson.scenes.map((s) => s.say), task.prompt, ...task.hints,
      ...Object.values(task.messages), task.success, task.note || '', lesson.play.say || '',
    ];
    const dashed = strings.find((s) => String(s).includes('—'));
    return dashed ? `em dash in: ${JSON.stringify(dashed).slice(0, 80)}` : null;
  });
}

// ---------------------------------------------------------------------------
// Near-misses: each lesson's own regression suite
// ---------------------------------------------------------------------------

for (const lesson of LESSONS) {
  for (const nm of lesson.task.nearMisses || []) {
    check(`${lesson.id}: "${nm.name}" is diagnosed as ${nm.expect}`, () => {
      const { run, session } = attempt(lesson, nm.code);
      if (!run.ok) {
        // Some near-misses are meant to fail outright; those declare expect: 'error'.
        return nm.expect === 'error' ? null : `code failed to run: ${run.error.message}`;
      }
      if (nm.expect === 'error') return 'expected this to fail, but it ran';

      const result = lesson.task.check({ value: run.value, code: nm.code, session });
      if (result.ok) return 'this near-miss was accepted as correct';
      const key = lesson.task.diagnose?.({ value: run.value, code: nm.code, result });
      if (key !== nm.expect) return `diagnosed as "${key}", expected "${nm.expect}"`;
      if (!lesson.task.messages[key]) return `no message for "${key}"`;
      return null;
    });
  }

  check(`${lesson.id}: has near-misses of its own`, () =>
    (lesson.task.nearMisses || []).length >= 2 ? null : 'declare at least two near-misses');
}

// ---------------------------------------------------------------------------
// Lesson-specific extras
// ---------------------------------------------------------------------------

check('lesson ids are unique and prerequisites exist', () => {
  const ids = LESSONS.map((l) => l.id);
  if (new Set(ids).size !== ids.length) return 'duplicate lesson id';
  for (const l of LESSONS) for (const r of l.requires || []) if (!ids.includes(r)) return `${l.id} requires unknown ${r}`;
  return null;
});

const grouping = LESSONS.find((l) => l.id === 'grouping');
if (grouping) {
  check('grouping: column order and integer/double do not matter', () => {
    const code = 'ankieta |> group_by(miasto) |> summarise(srednia_ocena = mean(ocena, na.rm = TRUE), liczba = n() * 1.0)';
    const { run, session } = attempt(grouping, code);
    if (!run.ok) return `failed: ${run.error.message}`;
    const verdict = grouping.task.check({ value: run.value, code, session });
    return verdict.ok ? null : `rejected a correct variant: ${verdict.reason}`;
  });

  check('grouping: the data really contains the missing answer the task depends on', () => {
    const { run } = attempt(grouping, 'sum(is.na(ankieta$ocena))');
    return run.value?.values[0] === 1 ? null : `expected exactly one NA, got ${run.value?.values[0]}`;
  });

  check('grouping: the key scene evaluates mean(wiek) once per group', () => {
    const scene = grouping.scenes[grouping.scenes.length - 1];
    const r = live(grouping, scene.code);
    const node = r.evalLog.findByText(scene.code, 'mean(wiek)')?.node;
    const n = node ? r.evalLog.entriesFor(node).length : 0;
    return n === 3 ? null : `mean(wiek) evaluated ${n} times, the scene promises 3`;
  });
}

const factorsLesson = LESSONS.find((l) => l.id === 'factors');
if (factorsLesson) {
  check('factors: nobody chose 1 -- the empty level the lesson is built on', () => {
    const { run } = attempt(factorsLesson, 'c(sum(odpowiedzi == 1), min(odpowiedzi), max(odpowiedzi))');
    const [ones, lo, hi] = run.value?.values || [];
    return ones === 0 && lo === 2 && hi === 5 ? null : `expected no 1s and answers 2..5, got ${ones} / ${lo}..${hi}`;
  });

  for (const code of [
    'ocena <- factor(odpowiedzi, levels = 1:5, labels = skala)\ntable(ocena)',
    'table(factor(skala[odpowiedzi], levels = skala))',
  ]) {
    check(`factors: a correct variant is accepted: ${JSON.stringify(code)}`, () => {
      const { run, session } = attempt(factorsLesson, code);
      if (!run.ok) return `failed: ${run.error.message}`;
      const verdict = factorsLesson.task.check({ value: run.value, code, session });
      return verdict.ok ? null : `rejected a correct variant: ${verdict.reason}`;
    });
  }

  check('factors: scene 3 really puts code 3 under the answer 4', () => {
    const { run } = attempt(factorsLesson, 'as.integer(factor(odpowiedzi))[odpowiedzi == 4]');
    const codes = run.value?.values || [];
    return codes.length && codes.every((c) => c === 3) ? null : `codes under 4: ${codes.join(', ')}`;
  });
}

console.log(`lessons: ${passed}/${passed + failures.length} checks passed (${LESSONS.length} lesson(s))`);
for (const f of failures) console.log(`  FAIL  ${f}`);
process.exit(failures.length ? 1 : 0);
