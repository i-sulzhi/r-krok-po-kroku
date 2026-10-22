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

import { LESSONS, lessonsByLecture } from '../src/lessons/index.js';
import { withKeep, valuesEqual } from '../src/lessons/schema.js';
import { RSession } from '../src/core/session.js';
import { surveyData, PICTURE_KINDS } from '../src/ui/viz/survey.js';
import { verbStages } from '../src/ui/viz/before-after.js';

/** Code compared without its layout: a pipeline may be typed on one line or several. */
const squash = (code) => String(code).replace(/\s+/g, '');

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

/** A lesson's tasks: the one that counts and, where there is one, the extra one (D41). */
const tasksOf = (lesson) => [['task', lesson.task], ['extra', lesson.extra]].filter(([, tk]) => tk);

/** Length a student reads: markup characters do not count. */
const visible = (s) => String(s).replace(/\*\*|`/g, '').length;

/**
 * "Less text" as a rule rather than a wish. A scene says where to look, in one
 * sentence; the picture explains. Budgets are characters of visible text.
 */
const BUDGET = { title: 32, say: 90, prompt: 130, hint: 110, message: 130, success: 60, note: 120 };

// Numbers the texts state, each with the code that proves it on the lesson's data.
// A success message once said "Cztery osoby" where the data gives five: text and
// data are written apart, so nothing else would notice them drifting apart.
const FACTS = {
  recoding: [['**3 osoby** mają 40+', 'sum(ankieta$wiek >= 40, na.rm = TRUE)', 3], ['osoba 6', 'which(is.na(ankieta$wiek))', 6], ['Osoba 6', 'sum(is.na(ankieta$wiek)) + 5', 6]],
  'missing-data': [['wychodzi **25**', 'mean(ankieta$ocena, na.rm = TRUE)', 25],
    ['ma sens: 3.86', 'round(mean(ankieta$ocena[ankieta$ocena != 99], na.rm = TRUE), 2)', 3.86],
    ['6 zamiast 7', 'sum(!is.na(ankieta$wiek) & !is.na(ankieta$ocena) & ankieta$ocena != 99)', 6],
    ['zamiast 7', 'sum(!is.na(ankieta$ocena) & ankieta$ocena != 99)', 7],
    ['Gdańsk 75% z czterech', 'sum(ankieta$miasto == "Gdańsk" & !is.na(ankieta$ocena) & ankieta$ocena != 99)', 4]],
  percentages: [['„dobra” to 50%', 'sum(ankieta$opinia == "dobra", na.rm = TRUE) / nrow(ankieta) * 100', 50],
    ['8 odpowiedzi', 'sum(!is.na(ankieta$opinia))', 8], ['nie 10 osób', 'nrow(ankieta)', 10],
    ['62.5%', 'sum(ankieta$opinia == "dobra", na.rm = TRUE) / sum(!is.na(ankieta$opinia)) * 100', 62.5],
    ['40% to nie', 'sum(ankieta$opinia == "dobra" & ankieta$miasto == "Kraków", na.rm = TRUE) / nrow(ankieta) * 100', 40],
    ['Kraków: 4 z 6', 'sum(ankieta$miasto == "Kraków")', 6],
    ['jedna osoba z trzech', 'sum(ankieta$miasto == "Gdańsk" & !is.na(ankieta$opinia))', 3]],
  crosstab: [['Pary Warszawa i M', 'sum(ankieta$miasto == "Warszawa" & ankieta$plec == "M")', 0],
    ['trzy miasta', 'length(unique(ankieta$miasto))', 3], ['to 10', 'nrow(ankieta)', 10]],
  battery: [['Cztery instytucje', 'ncol(ankieta) - 2', 4], ['Cztery średnie', 'ncol(ankieta) - 2', 4],
    ['Kobiety ufają najmniej sejmowi', 'which.min(c(mean(ankieta$sad[ankieta$plec == "K"]), mean(ankieta$policja[ankieta$plec == "K"]), mean(ankieta$sejm[ankieta$plec == "K"]), mean(ankieta$media[ankieta$plec == "K"])))', 3],
    ['mężczyźni mediom', 'which.min(c(mean(ankieta$sad[ankieta$plec == "M"]), mean(ankieta$policja[ankieta$plec == "M"]), mean(ankieta$sejm[ankieta$plec == "M"]), mean(ankieta$media[ankieta$plec == "M"])))', 4],
    ['na dole są media', 'which.min(c(mean(ankieta$sad), mean(ankieta$policja), mean(ankieta$sejm), mean(ankieta$media)))', 4],
    ['tylko 4 osoby', 'sum(ankieta$plec == "K")', 4], ['tylko 4 osoby', 'sum(ankieta$plec == "M")', 4],
    ['Policji ufa 75%', 'mean(ankieta$policja >= 4) * 100', 75], ['mediom nikt', 'sum(ankieta$media >= 4)', 0]],
  'plot-count': [['Słupek 15', 'sum(ankieta$ocena[ankieta$miasto == "Kraków"])', 15],
    ['Pięć kobiet', 'sum(ankieta$plec == "K")', 5], ['pięciu mężczyzn', 'sum(ankieta$plec == "M")', 5]],
  'plot-fill': [['To trzy osoby', 'sum(ankieta$miasto == "Warszawa")', 3]],
  'plot-types': [['Kobieta z 10 h odstaje', 'max(ankieta$godziny[ankieta$plec == "K"])', 10],
    ['kobiety 25', 'median(ankieta$wiek[ankieta$plec == "K"])', 25], ['mężczyźni 26.5', 'median(ankieta$wiek[ankieta$plec == "M"])', 26.5],
    ['Kobieta z 61 latami', 'max(ankieta$wiek[ankieta$plec == "K"])', 61]],
  'plot-build': [['100% w Warszawie to dwie osoby', 'wyniki$n[wyniki$miasto == "Warszawa" & wyniki$procent == 100]', 2],
    ['100% w grupie 30+ to dwie osoby', 'wedlug_wieku$n[wedlug_wieku$grupa == "30+" & wedlug_wieku$procent == 100]', 2]],
  'plot-report': [['62.5%', 'sum(ankieta$opinia == "dobra", na.rm = TRUE) / sum(!is.na(ankieta$opinia)) * 100', 62.5],
    ['n = 5', 'sum(ankieta$opinia == "dobra", na.rm = TRUE)', 5],
    ['100% z czterech osób', 'wedlug_plci$n[wedlug_plci$plec == "K"]', 4], ['40% z pięciu', 'wedlug_plci$n[wedlug_plci$plec == "M"]', 5]],
  reporting: [['75% i 50%', 'mean(ankieta$ocena[!is.na(ankieta$wiek) & ankieta$wiek < 30] >= 4) * 100', 75],
    ['po cztery osoby', 'sum(!is.na(ankieta$wiek) & !is.na(ankieta$ocena) & ankieta$wiek >= 30)', 4],
    ['to dwie osoby', 'sum(!is.na(ankieta$wiek) & !is.na(ankieta$ocena) & ankieta$wiek >= 50)', 2],
    ['u kobiet 30+ to jedna osoba', 'sum(!is.na(ankieta$wiek) & !is.na(ankieta$ocena) & ankieta$wiek >= 30 & ankieta$plec == "K")', 1],
    ['60% z pięciu osób', 'sum(!is.na(ankieta$wiek) & !is.na(ankieta$ocena) & ankieta$wiek < 40)', 5],
    ['67% z trzech', 'round(mean(ankieta$ocena[!is.na(ankieta$wiek) & ankieta$wiek >= 40] >= 4) * 100)', 67],
    ['przy ośmiu osobach', 'sum(!is.na(ankieta$wiek) & !is.na(ankieta$ocena))', 8]],
  joining: [['Osoba 6', 'which(is.na(left_join(ankieta, miasta, by = "miasto")$region))', 6],
    ['Jest 5 wierszy', 'nrow(inner_join(ankieta, miasta, by = "miasto"))', 5],
    ['dwa razy: 8', 'nrow(left_join(ankieta, uczelnie, by = "miasto"))', 8],
    ['dwie** uczelnie', 'sum(uczelnie$miasto == "Kraków")', 2],
    ['Cztery wiersze', 'nrow(count(left_join(ankieta, miasta, by = "miasto"), region))', 4],
    ['razem sześć osób', 'nrow(ankieta)', 6]],
  types: [['36.4', 'mean(as.numeric(wiek_tekst))', 36.4]],
  vectorised: [['Osiem odchyleń', 'length(oceny)', 8]],
  missing: [['3.875', 'mean(oceny, na.rm = TRUE)', 3.875], ['z ośmiu odpowiedzi', 'sum(!is.na(oceny))', 8],
    ['n = 8 z 10', 'length(oceny)', 10]],
  subsetting: [['Pięć osób starszych', 'length(wiek[wiek > mean(wiek)])', 5]],
  tables: [['31 lat', 'mean(ankieta$wiek[ankieta$plec == "K"])', 31], ['cztery kobiety', 'sum(ankieta$plec == "K")', 4]],
  filtering: [['Zostały dwie osoby', 'nrow(filter(ankieta, plec == "M", wiek > 35, !is.na(ocena)))', 2],
    ['byłyby trzy wiersze', 'nrow(filter(ankieta, plec == "M", wiek > 35))', 3],
    ['Pięć osób', 'nrow(filter(ankieta, ocena > 3))', 5], ['daje dwa wiersze', 'nrow(filter(ankieta, ocena <= 3))', 2],
    ['5 + 2 = 7', 'nrow(filter(ankieta, ocena > 3)) + nrow(filter(ankieta, ocena <= 3))', 7], ['osób było 8', 'nrow(ankieta)', 8]],
  selecting: [['sześć wierszy', 'nrow(ankieta)', 6], ['Cztery osoby', 'sum(ankieta$ocena >= 4)', 4]],
  mutating: [['Siedem kolumn', 'ncol(ankieta) + 1', 7], ['Trzy osoby', 'sum(ankieta$wiek > mean(ankieta$wiek))', 3],
    ['36.67', 'round(mean(ankieta$wiek), 2)', 36.67]],
  arranging: [['Pięć osób', 'sum(!is.na(ankieta$ocena))', 5]],
  grouping: [['średnio 42 lata', 'round(mean(ankieta$wiek[ankieta$miasto == "Warszawa"]))', 42],
    ['Trzy miasta', 'length(unique(ankieta$miasto))', 3],
    ['z dwóch odpowiedzi', 'sum(ankieta$miasto == "Warszawa" & !is.na(ankieta$ocena))', 2],
    ['respondentów było trzech', 'sum(ankieta$miasto == "Warszawa")', 3]],
  factors: [['2, 3, 4, 5', 'paste(levels(factor(odpowiedzi)), collapse = ", ")', '2, 3, 4, 5']],
  'factor-table': [['Pięć kobiet', 'sum(ankieta$plec == "K")', 5], ['trzech mężczyzn', 'sum(ankieta$plec == "M")', 3]],
  pipeline: [['Warszawa to jedna osoba', 'sum(ankieta$miasto == "Warszawa" & !is.na(ankieta$ocena))', 1],
    ['średnio 45 lat', 'mean(ankieta$wiek[ankieta$wiek > 25 & ankieta$plec == "M"])', 45],
    ['niecałe 34', 'floor(mean(ankieta$wiek[ankieta$wiek > 25 & ankieta$plec == "K"]))', 33]],
  'factor-numbers': [['kod 4', 'as.numeric(dzieci)[4]', 4], ['Zamiast 5 jest 4', 'as.numeric(as.character(dzieci))[4]', 5],
    ['1.375', 'mean(as.numeric(as.character(dzieci)))', 1.375], ['2.125', 'mean(as.numeric(dzieci))', 2.125]],
  counting: [['Kraków 4', 'sum(ankieta$miasto == "Kraków" & !is.na(ankieta$ocena))', 4],
    ['Gdańsk 3', 'sum(ankieta$miasto == "Gdańsk" & !is.na(ankieta$ocena))', 3],
    ['Warszawa 1', 'sum(ankieta$miasto == "Warszawa" & !is.na(ankieta$ocena))', 1],
    ['Warszawa miałaby 3', 'sum(ankieta$miasto == "Warszawa")', 3],
    ['10 respondentów', 'nrow(ankieta)', 10], ['8 odpowiedzi', 'sum(!is.na(ankieta$ocena))', 8],
    ['Warszawa: trzech', 'sum(ankieta$miasto == "Warszawa")', 3],
    ['jedna odpowiedź', 'sum(ankieta$miasto == "Warszawa" & !is.na(ankieta$ocena))', 1]],
};

for (const lesson of LESSONS) {
  const id = lesson.id;
  const { task } = lesson;

  check(`${id}: shape is complete`, () => {
    for (const field of ['id', 'module', 'lecture', 'title', 'scenes', 'play', 'task']) {
      if (!lesson[field]) return `missing ${field}`;
    }
    if (typeof lesson.setup !== 'string') return 'setup must be a string (may be empty)';
    if (lesson.scenes.length < 2 || lesson.scenes.length > 7) return `${lesson.scenes.length} scenes; keep 2-7`;
    // Pictures prepare the code; they never replace it.
    if (lesson.scenes.filter((sc) => sc.code).length < 2) return 'needs at least two scenes with code';
    if (!lesson.play.code || (lesson.play.chips || []).length < 2) return 'sandbox needs code and at least two chips';
    // `starter` may legitimately be an empty string, so test for absence, not falsiness.
    for (const [slot, tk] of tasksOf(lesson)) {
      for (const f of ['prompt', 'solution', 'success', 'check', 'diagnose']) if (!tk[f]) return `${slot}.${f} missing`;
      if (tk.starter === undefined) return `${slot}.starter missing`;
      if ((tk.hints || []).length < 2) return `${slot} needs at least two hints`;
      if (!tk.messages?.general) return `${slot}: no general fallback message`;
    }
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
    const codes = [...lesson.scenes.filter((sc) => sc.code).map((sc) => sc.code), withKeep(lesson.play, lesson.play.code)];
    const long = codes.flatMap((c) => c.split('\n')).filter((line) => line.length > 54);
    return long.length ? `too wide (>54): ${long.map((l) => JSON.stringify(l)).join(', ')}` : null;
  });

  if (FACTS[id]) {
    check(`${id}: numbers in the texts match the data`, () => {
      const text = [...lesson.scenes.map((sc) => sc.say),
        ...tasksOf(lesson).flatMap(([, tk]) => [tk.prompt, tk.success, tk.note])].join('\n');
      for (const [phrase, code, expected] of FACTS[id]) {
        if (!text.includes(phrase)) return `the texts no longer say "${phrase}": update FACTS with them`;
        const r = live(lesson, code);
        const got = r.ok ? r.value.values[0] : `error ${r.error?.message}`;
        if (got !== expected) return `"${phrase}": ${code} gives ${got}, not ${expected}`;
      }
      return null;
    });
  }

  check(`${id}: text stays within its budget`, () => {
    const over = [];
    const test = (kind, s) => { if (s != null && visible(s) > BUDGET[kind]) over.push(`${kind} (${visible(s)}>${BUDGET[kind]}): "${String(s).slice(0, 50)}…"`); };
    test('title', lesson.title);
    lesson.scenes.forEach((s) => test('say', s.say));
    for (const [, tk] of tasksOf(lesson)) {
      test('prompt', tk.prompt);
      tk.hints.forEach((h) => test('hint', h));
      Object.values(tk.messages).forEach((m) => test('message', m));
      test('success', tk.success);
      test('note', tk.note);
      // The success line is shown as plain text: markup in it would be printed as typed.
      if (/[`*]/.test(tk.success)) over.push(`success holds markup that is not rendered: "${tk.success}"`);
    }
    return over.length ? over.join('; ') : null;
  });

  check(`${id}: every scene runs, and what it points at exists`, () => {
    for (const [i, scene] of lesson.scenes.entries()) {
      // A scene without code (D27) shows a survey question and its factor instead.
      if (scene.picture) {
        const p = scene.picture;
        if (!scene.say || scene.code) return `scene ${i + 1}: a picture scene has a sentence and no code`;
        // A table before and after its verbs (D29): the code must run and change the table.
        if (p.kind === 'verb') {
          if (!p.question || !p.code) return `scene ${i + 1}: a verb picture needs a question and code`;
          let m;
          try { m = verbStages(lesson.setup, p); } catch (e) { return `scene ${i + 1}: ${e.message}`; }
          if (m.stages[0].rows.length > 10) return `scene ${i + 1}: ${m.stages[0].rows.length} rows do not fit the picture`;
          // The scenes after it must show the same code typed, so the picture is recognised.
          const typed = lesson.scenes.some((sc) => sc.code && squash(sc.code).includes(squash(p.code)));
          if (!typed) return `scene ${i + 1}: no later scene types the picture's code: ${p.code}`;
          continue;
        }
        if (!PICTURE_KINDS.includes(p.kind)) return `scene ${i + 1}: unknown picture kind ${p.kind}`;
        if (!p.question || !p.factor) return `scene ${i + 1}: picture needs a question and a factor`;
        if (p.kind !== 'pairs' && !p.answers) return `scene ${i + 1}: picture ${p.kind} needs the raw answers`;
        let d;
        try { d = surveyData(lesson.setup, p); } catch (e) { return `scene ${i + 1}: ${e.message}`; }
        if (d.levels.length < 2 || !d.codes.length) return `scene ${i + 1}: the picture's factor is empty`;
        if (d.codes.length > 10) return `scene ${i + 1}: ${d.codes.length} people do not fit the picture`;
        continue;
      }
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
    for (const code of [lesson.play.code, ...lesson.play.chips].map((c) => withKeep(lesson.play, c))) {
      const r = live(lesson, code);
      if (!r.ok) return `${JSON.stringify(code)} failed: ${r.error.message}`;
    }
    return null;
  });

  for (const [slot, tk] of tasksOf(lesson)) {
    const what = slot === 'task' ? id : `${id} extra`;
    check(`${what}: its own solution passes its own check`, () => {
      const { run, session } = attempt(lesson, tk.solution);
      if (!run.ok) return `solution failed: ${run.error.message}`;
      const verdict = tk.check({ value: run.value, code: tk.solution, session });
      if (!verdict.ok) return `check rejected the solution: ${verdict.reason}`;
      return null;
    });

    check(`${what}: the starter does NOT pass`, () => {
      const { run, session } = attempt(lesson, tk.starter);
      if (run.ok) {
        const verdict = tk.check({ value: run.value, code: tk.starter, session });
        if (verdict.ok) return 'the starter already solves the task';
      }
      return null;
    });
  }

  // The extra task (D41) is a second question, not the first one again: its answer
  // must differ, the first task's solution must not pass it, and its solution must
  // fit the box that shows it.
  if (lesson.extra) {
    check(`${id} extra: it asks for something else than the task`, () => {
      const main = attempt(lesson, task.solution);
      if (lesson.extra.check({ value: main.run.value, code: task.solution, session: main.session }).ok) return 'the task\'s solution solves the extra task too';
      const extra = attempt(lesson, lesson.extra.solution);
      if (task.check({ value: extra.run.value, code: lesson.extra.solution, session: extra.session }).ok) return 'the extra solution solves the task too';
      const long = lesson.extra.solution.split('\n').filter((line) => line.length > 54);
      return long.length ? `solution lines too wide (>54): ${long.map((l) => JSON.stringify(l)).join(', ')}` : null;
    });
  }

  check(`${id}: markup is balanced`, () => {
    const strings = [
      lesson.title, ...lesson.scenes.map((s) => s.say), lesson.play.say || '',
      ...tasksOf(lesson).flatMap(([, tk]) => [tk.prompt, ...tk.hints, ...Object.values(tk.messages), tk.success, tk.note || '']),
    ];
    const broken = strings.find((s) => (String(s).match(/\*\*/g) || []).length % 2 || (String(s).match(/`/g) || []).length % 2);
    return broken ? `unbalanced ** or \` in: ${JSON.stringify(broken).slice(0, 80)}` : null;
  });

  // The course's plain style (the teacher's own): short sentences joined by
  // "więc", "a", "bo", never an em dash. The en dash stays for ranges (1–5).
  check(`${id}: no em dashes in student-facing text`, () => {
    const strings = [
      lesson.title, ...lesson.scenes.map((s) => s.say), lesson.play.say || '',
      ...tasksOf(lesson).flatMap(([, tk]) => [tk.prompt, ...tk.hints, ...Object.values(tk.messages), tk.success, tk.note || '']),
    ];
    const dashed = strings.find((s) => String(s).includes('—'));
    return dashed ? `em dash in: ${JSON.stringify(dashed).slice(0, 80)}` : null;
  });
}

// ---------------------------------------------------------------------------
// Near-misses: each lesson's own regression suite
// ---------------------------------------------------------------------------

for (const [lesson, slot, tk] of LESSONS.flatMap((l) => tasksOf(l).map(([slot, tk]) => [l, slot, tk]))) {
  const what = slot === 'task' ? lesson.id : `${lesson.id} extra`;
  for (const nm of tk.nearMisses || []) {
    check(`${what}: "${nm.name}" is diagnosed as ${nm.expect}`, () => {
      const { run, session } = attempt(lesson, nm.code);
      if (!run.ok) {
        // Some near-misses are meant to fail outright; those declare expect: 'error'.
        return nm.expect === 'error' ? null : `code failed to run: ${run.error.message}`;
      }
      if (nm.expect === 'error') return 'expected this to fail, but it ran';

      const result = tk.check({ value: run.value, code: nm.code, session });
      if (result.ok) return 'this near-miss was accepted as correct';
      const key = tk.diagnose?.({ value: run.value, code: nm.code, result });
      if (key !== nm.expect) return `diagnosed as "${key}", expected "${nm.expect}"`;
      if (!tk.messages[key]) return `no message for "${key}"`;
      return null;
    });
  }

  check(`${what}: has near-misses of its own`, () =>
    (tk.nearMisses || []).length >= 2 ? null : 'declare at least two near-misses');

  // A message nobody can reach is text that will rot: every key a task can say is
  // either the fallback, a missing call, or shown by a near-miss.
  if (slot === 'extra') {
    check(`${what}: every message is reached by a near-miss`, () => {
      const reached = new Set((tk.nearMisses || []).map((nm) => nm.expect));
      const idle = Object.keys(tk.messages).filter((k) => k !== 'general' && !k.startsWith('missing.') && !reached.has(k));
      return idle.length ? `no near-miss shows: ${idle.join(', ')}` : null;
    });
  }
}

// ---------------------------------------------------------------------------
// Lesson-specific extras
// ---------------------------------------------------------------------------

// D41: every exercise of lecture 2 offers a task for those who want more.
check('every exercise of lectures 2 and 3 has an extra task (D41, D64)', () => {
  const without = LESSONS.filter((l) => (l.lecture === 2 || l.lecture === 3) && !l.extra).map((l) => l.id);
  return without.length ? `no extra task: ${without.join(', ')}` : null;
});

check('lesson ids are unique and prerequisites exist', () => {
  const ids = LESSONS.map((l) => l.id);
  if (new Set(ids).size !== ids.length) return 'duplicate lesson id';
  for (const l of LESSONS) for (const r of l.requires || []) if (!ids.includes(r)) return `${l.id} requires unknown ${r}`;
  return null;
});

// Exercise 19 (D55): right answers written another way are right.
const percentagesLesson = LESSONS.find((l) => l.id === 'percentages');
if (percentagesLesson) {
  const ways = {
    'the keys the other way round': 'ankieta |> filter(!is.na(opinia)) |> count(opinia, miasto) |> group_by(miasto) |> mutate(procent = n / sum(n) * 100)',
    'group_by() and summarise(n = n()) instead of count()': 'ankieta |> filter(!is.na(opinia)) |> group_by(miasto, opinia) |> summarise(n = n()) |> mutate(procent = n / sum(n) * 100)',
    'drop_na() instead of filter()': 'ankieta |> drop_na(opinia) |> count(miasto, opinia) |> group_by(miasto) |> mutate(procent = n / sum(n) * 100)',
  };
  for (const [name, code] of Object.entries(ways)) {
    check(`percentages: ${name} is accepted`, () => {
      const { run, session } = attempt(percentagesLesson, code);
      if (!run.ok) return `failed: ${run.error.message}`;
      const v = percentagesLesson.task.check({ value: run.value, code, session });
      return v.ok ? null : `rejected: ${v.reason}`;
    });
  }
}

// Exercise 20 (D57): the gap filled another way is still filled.
const crosstabLesson = LESSONS.find((l) => l.id === 'crosstab');
if (crosstabLesson) {
  const S = 'ankieta |> count(plec, miasto) |> ';
  const ways = {
    'values_fill as a list': S + 'pivot_wider(names_from = miasto, values_from = n, values_fill = list(n = 0))',
    'replace_na() after the pivot': S + 'pivot_wider(names_from = miasto, values_from = n) |> replace_na(list(Warszawa = 0))',
    'replace_na() inside mutate()': S + 'pivot_wider(names_from = miasto, values_from = n) |> mutate(Warszawa = replace_na(Warszawa, 0))',
  };
  for (const [name, code] of Object.entries(ways)) {
    check(`crosstab: ${name} is accepted`, () => {
      const { run, session } = attempt(crosstabLesson, code);
      if (!run.ok) return `failed: ${run.error.message}`;
      const v = crosstabLesson.task.check({ value: run.value, code, session });
      return v.ok ? null : `rejected: ${v.reason}`;
    });
  }
}

// Exercise 21 (D58, D70, D74): a rounded mean, n beside it, or the pair grouped the
// other way round are still the ranking.
const batteryLesson = LESSONS.find((l) => l.id === 'battery');
if (batteryLesson) {
  const L = 'ankieta |> pivot_longer(sad:media, names_to = "instytucja", values_to = "zaufanie") |> ';
  const ways = {
    'a rounded mean': L + 'group_by(plec, instytucja) |> summarise(srednia = round(mean(zaufanie), 2)) |> arrange(plec, srednia)',
    'n of the ratings beside the mean': L + 'group_by(plec, instytucja) |> summarise(srednia = mean(zaufanie), n = n()) |> arrange(plec, srednia)',
    'the pair grouped the other way round': L + 'group_by(instytucja, plec) |> summarise(srednia = mean(zaufanie)) |> arrange(plec, srednia)',
    'men above women': L + 'group_by(plec, instytucja) |> summarise(srednia = mean(zaufanie)) |> arrange(desc(plec), srednia)',
    'a mean rounded to one decimal': L + 'group_by(plec, instytucja) |> summarise(srednia = round(mean(zaufanie), 1)) |> arrange(plec, srednia)',
    'arrange() inside each group': L + 'group_by(plec, instytucja) |> summarise(srednia = mean(zaufanie)) |> arrange(srednia, .by_group = TRUE)',
    'na.rm = TRUE out of habit': L + 'group_by(plec, instytucja) |> summarise(srednia = mean(zaufanie, na.rm = TRUE)) |> arrange(plec, srednia)',
    'the ratings picked by -c(id, plec)': 'ankieta |> pivot_longer(-c(id, plec), names_to = "instytucja", values_to = "zaufanie") |> group_by(plec, instytucja) |> summarise(srednia = mean(zaufanie)) |> arrange(plec, srednia)',
  };
  for (const [name, code] of Object.entries(ways)) {
    check(`battery: ${name} is accepted`, () => {
      const { run, session } = attempt(batteryLesson, code);
      if (!run.ok) return `failed: ${run.error.message}`;
      const v = batteryLesson.task.check({ value: run.value, code, session });
      return v.ok ? null : `rejected: ${v.reason}`;
    });
  }
}

// References to other exercises are written by id and numbered at load (D65): a new
// exercise moves the numbers after it, and a hard-written one would point elsewhere.
{
  const { readdirSync, readFileSync } = await import('node:fs');
  const dir = new URL('../src/lessons/', import.meta.url);
  check('no exercise number is written by hand in a lesson', () => {
    const bad = [];
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
      readFileSync(new URL(f, dir), 'utf8').split('\n').forEach((line, i) => {
        if (/^\s*(\*|\/\/)/.test(line)) return;
        if (/ćw\.\s?\d|ćwiczeni\w*\s\d/.test(line)) bad.push(`${f}:${i + 1}`);
      });
    }
    return bad.length ? bad.join(', ') : null;
  });
  check('references by id become the right numbers', () => {
    const l = LESSONS.find((x) => x.id === 'reporting');
    const want = `ćw. ${LESSONS.findIndex((x) => x.id === 'crosstab') + 1}`;
    return l.scenes.some((sc) => (sc.say || '').includes(want)) && !JSON.stringify(LESSONS).includes('{ćw:') ? null : 'unresolved or wrong';
  });
}

check('reporting: the capstone lays its report out across, with pivot_wider() (D64)', () => {
  const l = LESSONS.find((x) => x.id === 'reporting');
  return l.scenes.some((sc) => /pivot_wider\(/.test(sc.code || '')) ? null : 'no scene with pivot_wider()';
});

// D67: lecture 3 read as a student. Right answers by another road pass, and the
// engine says what RStudio would say.
for (const [id, slot, code] of [
  ['percentages', 'extra', 'ankieta |> group_by(miasto) |> summarise(procent = mean(opinia == "dobra", na.rm = TRUE) * 100)'],
  ['crosstab', 'task', 'ankieta |> group_by(plec, miasto) |> summarise(n = n()) |> pivot_wider(names_from = miasto, values_from = n, values_fill = 0)'],
  ['crosstab', 'task', 'ankieta |> count(plec, miasto) |> pivot_wider(names_from = miasto, values_from = n, values_fill = 0) |> mutate(razem = Gdańsk + Kraków + Warszawa)'],
  ['battery', 'extra', 'ankieta |> pivot_longer(sad:media, names_to = "instytucja", values_to = "zaufanie") |> group_by(instytucja) |> summarise(procent = mean(zaufanie >= 4) * 100, n = n()) |> arrange(desc(procent))'],
  ['battery', 'extra', 'ankieta |> pivot_longer(sad:media, names_to = "instytucja", values_to = "zaufanie") |> group_by(instytucja) |> summarise(procent = mean(zaufanie >= 4) * 100, srednia = mean(zaufanie)) |> arrange(desc(procent))'],
  ['battery', 'extra', 'ankieta |> pivot_longer(sad:media, names_to = "instytucja", values_to = "zaufanie") |> group_by(instytucja) |> summarise(procent = sum(zaufanie >= 4) / n() * 100) |> arrange(desc(procent))'],
  ['joining', 'task', 'ankieta |> left_join(miasta, by = "miasto") |> count(region) |> mutate(region = replace_na(region, "brak danych"))'],
  ['plot-report', 'task', 'ggplot(wedlug_plci, aes(x = plec, y = procent)) + geom_col() + geom_text(aes(label = paste0("n = ", n)), vjust = -0.5) + labs(title = "Zadowoleni z zajęć")'],
  ['plot-report', 'task', 'ggplot(wedlug_plci, aes(x = plec, y = procent, label = n)) + geom_col() + geom_text(vjust = -0.5) + labs(title = "Zadowoleni z zajęć")'],
  ['plot-order', 'task', 'ankieta |> mutate(praktyka = fct_relevel(praktyka, "za mało", "w sam raz", "za dużo")) |> ggplot(aes(x = praktyka)) + geom_bar()'],
  ['plot-first', 'task', 'ggplot(srednie, aes(x = miasto, y = round(srednia, 1))) + geom_col() + labs(y = "Średnia ocena")'],
  ['plot-count', 'task', 'ggplot(ankieta, aes(x = plec)) + geom_bar(width = 0.5, fill = "grey")'],
  ['plot-first', 'task', 'ggplot(srednie, aes(x = miasto, y = srednia)) + geom_col(width = 0.5) + labs(y = "Średnia ocena")'],
  ['reporting', 'task', 'ankieta |> filter(!is.na(wiek), !is.na(ocena)) |> mutate(grupa = if_else(wiek >= 40, "40+", "do 39")) |> group_by(grupa) |> summarise(n = n(), procent = mean(ocena >= 4) * 100)'],
  ['reporting', 'extra', 'ankieta |> drop_na(wiek, ocena) |> mutate(grupa = if_else(wiek >= 40, "40+", "do 39")) |> group_by(grupa) |> summarise(n = n(), procent = mean(ocena >= 4) * 100) |> ggplot(aes(x = grupa, y = procent)) + geom_bar(stat = "identity")'],
]) {
  check(`${id}${slot === 'extra' ? ' extra' : ''}: a right answer by another road passes (D67): ${code.slice(0, 60)}`, () => {
    const lesson = LESSONS.find((l) => l.id === id);
    const { run, session } = attempt(lesson, code);
    if (!run.ok) return `failed: ${run.error.message}`;
    const v = lesson[slot].check({ value: run.value, code, session });
    return v.ok ? null : `rejected: ${v.reason}`;
  });
}

for (const [what, code, key] of [
  ['na_if() with a text code on numbers', 'na_if(c(4, 99), "99")', 'err.naIfTextCode'],
  ['na_if() with a number code on text', 'na_if(c("a", "nie wiem"), 9)', 'err.naIfNumberCode'],
  ['.by in summarise()', 'data.frame(g = c("a", "b"), x = 1:2) |> summarise(m = mean(x), .by = g)', 'err.dotBy'],
  ['values_fn in pivot_wider()', 'data.frame(g = c("a", "b"), k = c("x", "x"), v = 1:2) |> pivot_wider(names_from = k, values_from = v, values_fn = mean)', 'err.pivotValuesFn'],
  ['.by in mutate()', 'data.frame(g = c("a", "b"), x = 1:2) |> mutate(m = mean(x), .by = g)', 'err.dotBy'],
]) {
  check(`engine (D67): ${what} stops as in RStudio`, () => {
    const r = new RSession({ trace: false }).run(code);
    return !r.ok && r.error.key === key ? null : `got ${r.ok ? 'no error' : r.error.key}`;
  });
}

// D76: lecture 4 read with the one-idea lens. A column as a label setting is the
// fill slip again; real ggplot2 the trainer lacks is named, never "a typo".
{
  const T = 'tab <- data.frame(g = c("K", "M"), p = c(100, 40), n = c(4, 5))\n';
  for (const [what, code, key, says] of [
    ['a column as the label setting', 'ggplot(tab, aes(x = g, y = p)) + geom_col() + geom_text(label = n)', 'err.ggOutsideAes', 'aes(label = n)'],
    ['scale_x_discrete() for the order', 'ggplot(tab, aes(x = g, y = p)) + geom_col() + scale_x_discrete(limits = c("M", "K"))', 'err.unsupportedFn', 'levels'],
    ['scale_y_continuous()', 'ggplot(tab, aes(x = g, y = p)) + geom_col() + scale_y_continuous()', 'err.unsupportedFn', 'ggplot2'],
    ['geom_label()', 'ggplot(tab, aes(x = g, y = p)) + geom_col() + geom_label(aes(label = n))', 'err.unsupportedFn', 'ggplot2'],
    ['ggsave()', 'ggsave("wykres.png")', 'err.unsupportedFn', 'Dalej w RStudio'],
    // D77, exercise 25 read as a student.
    ['a column name in quotes on y', 'ggplot(tab, aes(x = g, y = "p")) + geom_col()', 'err.ggQuotedColumn', 'aes(y = p)'],
    ['a layer inside ggplot() after a comma', 'ggplot(tab, aes(x = g, y = p), geom_col())', 'err.ggLayerInside', '+ geom_col()'],
    ['a layer in place of aes()', 'ggplot(tab, geom_col())', 'err.ggLayerInside', '+ geom_col()'],
    ['a layer without brackets', 'ggplot(tab, aes(x = g, y = p)) + geom_col', 'err.ggPlusFunction', '+ geom_col()'],
    ['after_stat() from a tutorial', 'ggplot(tab, aes(x = g, y = after_stat(count))) + geom_bar()', 'err.unsupportedFn', 'liczy sam'],
    ['element_text() inside theme()', 'ggplot(tab, aes(x = g, y = p)) + geom_col() + theme(axis.text.x = element_text(angle = 45))', 'err.unsupportedFn', 'legend.position'],
  ]) {
    check(`engine (D76): ${what} gets a message of its own`, () => {
      const r = new RSession({ trace: false }).run(T + code);
      if (r.ok) return 'no error';
      return r.error.key === key && r.error.message.includes(says) ? null : `got ${r.error.key}: ${r.error.message}`;
    });
  }
}

check('engine (D67): a name may hold Polish letters, as in R', () => {
  const r = new RSession({ trace: false }).run('średnia <- 3\nśrednia + 1');
  return r.ok && r.value?.values?.[0] === 4 ? null : `got ${r.ok ? JSON.stringify(r.value?.values) : r.error.message}`;
});

// Exercise 23's extra task (D61): the report drawn and decorated is still the report.
const reportingLesson = LESSONS.find((l) => l.id === 'reporting');
if (reportingLesson) {
  const base = reportingLesson.extra.starter;
  const ways = {
    'a fixed colour': base + 'ggplot(aes(x = grupa, y = procent)) +\n  geom_col(fill = "steelblue")',
    'a colour per group': base + 'ggplot(aes(x = grupa, y = procent, fill = grupa)) +\n  geom_col()',
    'the bars turned': base + 'ggplot(aes(x = grupa, y = procent)) +\n  geom_col() +\n  coord_flip()',
    'n written on the bars': base + 'ggplot(aes(x = grupa, y = procent)) +\n  geom_col() +\n  geom_text(aes(label = n), vjust = -0.5)',
  };
  for (const [name, code] of Object.entries(ways)) {
    check(`reporting extra: ${name} is accepted`, () => {
      const { run, session } = attempt(reportingLesson, code);
      if (!run.ok) return `failed: ${run.error.message}`;
      const v = reportingLesson.extra.check({ value: run.value, code, session });
      return v.ok ? null : `rejected: ${v.reason}`;
    });
  }
}

// Exercise 24 (D62): the right plot decorated, or drawn with geom_bar(stat = "identity").
const plotFirstLesson = LESSONS.find((l) => l.id === 'plot-first');
if (plotFirstLesson) {
  const B = 'ggplot(srednie, aes(x = miasto, y = srednia))';
  const L = ' + labs(y = "Średnia ocena")';
  const ways = {
    'a fixed colour': `${B} + geom_col(fill = "steelblue")${L}`,
    'the bars turned': `${B} + geom_col()${L} + coord_flip()`,
    'the means written on the bars': `${B} + geom_col() + geom_text(aes(label = srednia), vjust = -0.5)${L}`,
    'geom_bar(stat = "identity")': `${B} + geom_bar(stat = "identity")${L}`,
  };
  for (const [name, code] of Object.entries(ways)) {
    check(`plot-first: ${name} is accepted`, () => {
      const { run, session } = attempt(plotFirstLesson, code);
      if (!run.ok) return `failed: ${run.error.message}`;
      const v = plotFirstLesson.task.check({ value: run.value, code, session });
      return v.ok ? null : `rejected: ${v.reason}`;
    });
  }
  // Decoration is not a different answer, and a different answer is not decoration.
  check('plot-first: the counts, decorated, are still refused', () => {
    const code = 'ggplot(liczby, aes(x = miasto, y = n)) + geom_col(fill = "steelblue") + labs(y = "Średnia ocena")';
    const { run, session } = attempt(plotFirstLesson, code);
    return plotFirstLesson.task.check({ value: run.value, code, session }).ok ? 'accepted' : null;
  });
}

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
    const scene = grouping.scenes.find((sc) => sc.tap === 'mean(wiek)');
    if (!scene) return 'no scene points at mean(wiek)';
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

// D39: an answer whose rows come in another order is the same answer, where a task says so.
check('row order can be ignored when comparing tables, and nothing else is', () => {
  const s = new RSession({ trace: false });
  const table = (code) => s.run(code).value;
  const a = table('data.frame(g = c("K", "K", "M"), q = c("p1", "p2", "p1"), x = c(3, 2.5, 4.666667))');
  const moved = table('data.frame(q = c("p1", "p1", "p2"), g = c("K", "M", "K"), x = c(3, 4.6666667, 2.5))');
  const changed = table('data.frame(g = c("K", "K", "M"), q = c("p1", "p2", "p1"), x = c(3, 2.5, 4))');
  const swapped = table('data.frame(g = c("K", "K", "M"), q = c("p2", "p1", "p1"), x = c(3, 2.5, 4.666667))');
  if (valuesEqual(a, moved)) return 'rows in another order pass without being asked';
  if (!valuesEqual(a, moved, { ignoreRowOrder: true, tolerance: 1e-6 })) return 'the same rows in another order are refused';
  if (valuesEqual(a, changed, { ignoreRowOrder: true })) return 'a changed value passes';
  return valuesEqual(a, swapped, { ignoreRowOrder: true }) ? 'values attached to other rows pass' : null;
});

// D33, D34, D45: lecture 1 is everything before dplyr, lecture 2 the verbs, lecture 3 the
// quick analyses, lecture 4 the plots.
check('the contents list splits into lectures, in walking order', () => {
  const lectures = lessonsByLecture();
  const ids = (modules) => modules.flatMap(([, lessons]) => lessons.map((l) => l.id));
  if (lectures.map(([n]) => n).join() !== '1,2,3,4') return `lectures: ${lectures.map(([n]) => n).join()}`;
  const [first, second, third, fourth] = lectures.map(([, modules]) => ids(modules));
  if (first.length !== 10 || second[0] !== 'filtering') return `lecture 1 has ${first.length}, lecture 2 starts with ${second[0]}`;
  if (second.length !== 7 || third[0] !== 'recoding') return `lecture 2 has ${second.length}, lecture 3 starts with ${third[0]}`;
  if (LESSONS.some((l) => (l.module === 7) !== (l.lecture === 2))) return 'a dplyr exercise outside lecture 2, or the reverse';
  if (third.length !== 7 || fourth[0] !== 'plot-first') return `lecture 3 has ${third.length}, lecture 4 starts with ${fourth[0]}`;
  if (LESSONS.some((l) => (l.module === 10) !== (l.lecture === 4))) return 'a plot exercise outside lecture 4, or the reverse';
  const flat = [...first, ...second, ...third, ...fourth].join();
  return flat === LESSONS.map((l) => l.id).join() ? null : `menu order differs from walking order: ${flat}`;
});

console.log(`lessons: ${passed}/${passed + failures.length} checks passed (${LESSONS.length} lesson(s))`);
for (const f of failures) console.log(`  FAIL  ${f}`);
process.exit(failures.length ? 1 : 0);
