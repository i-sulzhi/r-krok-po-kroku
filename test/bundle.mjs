/**
 * The built file, booted headlessly.
 *
 * Every other suite imports the source modules. Students get something else: one
 * HTML file in which the build has rewritten every module. A bug can live only
 * there -- one did: the old build renamed clashing private names with a regex and
 * rewrote the caption key 'fx.dollar' inside a string, so students saw
 * "fx.dollar$src_ui_viz_focus" while every source-level test passed. This suite
 * builds to a scratch file, runs its script on the DOM shim, walks every lesson
 * step, and reads the text a student would see.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installDom } from './dom-shim.mjs';

// The exercises grow lecture by lecture; the checks below follow the count.
const LESSON_COUNT = 18;
const LAST_LESSON = 'recoding';
const ALL_DONE = `${LESSON_COUNT} z ${LESSON_COUNT}`;

const root = new URL('..', import.meta.url).pathname;
// BUNDLE=path checks an existing file instead (used to prove this suite catches the
// old build's renaming bug).
const out = process.env.BUNDLE || join(mkdtempSync(join(tmpdir(), 'r-trainer-')), 'bundle.html');
if (!process.env.BUNDLE) execFileSync('node', [join(root, 'build.mjs'), '--out', out], { encoding: 'utf8' });
const html = readFileSync(out, 'utf8');
const script = html.slice(html.indexOf('<script>') + '<script>'.length, html.lastIndexOf('</script>'));

const failures = [];
const RAW = /\b(fx|ls|lv|ui|val|tv|rx|op|co|mem|badge|module|type|err|diag|warn|env|tok|sv|ba)\.[a-zA-Z][\w.]*|\$src_/;

installDom();
try {
  new Function(script)();          // defines the modules, registers the boot handler
  document.fire('DOMContentLoaded');
} catch (e) {
  failures.push(`boot threw: ${e.stack?.split('\n').slice(0, 2).join(' | ')}`);
}

const app = globalThis.app;
let steps = 0;

/** Elements under `node` with the class. */
function byClass(node, cls, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (String(node.className || '').split(' ').includes(cls)) out.push(node);
  for (const c of node.childNodes || []) byClass(c, cls, out);
  return out;
}
const one = (node, cls) => byClass(node, cls)[0];

/** Type a name on "Kim jesteś?" and submit, the way a student does. */
function enterName(name) {
  const form = one(app.overlay, 'who-form');
  if (!form) return false;
  one(form, 'who-input').value = name;
  for (const fn of form._on?.submit || []) fn({ preventDefault() {} });
  return true;
}

if (app) {
  // The trainer opens on "Kim jesteś?", with nothing of anyone's lesson behind it.
  if (app.overlay.hidden || !app.overlay.textContent.includes('Kim jesteś?')) failures.push('boot: "Kim jesteś?" is not shown');
  if (app.lessonView.lesson) failures.push('boot: a lesson opened before anyone said who they are');
  if (!enterName('Ania')) failures.push('boot: no name form');
  if (!app.overlay.hidden) failures.push('boot: the welcome screen stayed after a name was entered');
}

if (!app) failures.push('the bundle did not create window.app');
else {
  const ids = app.lessonView.opts.lessons.map((l) => l.id);
  if (ids.length !== LESSON_COUNT) failures.push(`the bundle holds ${ids.length} lessons, expected ${LESSON_COUNT}`);
  for (const id of ids) {
    try {
      app.openLesson(id, { step: 0 });
      const n = app.lessonView.steps().length;
      for (let k = 0; k < n; k++) {
        app.lessonView.goTo(k);
        steps++;
        // A scene without code (D27): the questionnaire is clicked instead of code.
        if (app.lessonView.steps()[k].scene?.picture?.kind === 'verb') {
          // A table before and after (D29): the step buttons are clicked instead of code.
          if (app.lessonView.live) failures.push(`${id} step ${k + 1}: a picture scene has a code box`);
          if (!byClass(app.stageHost, 'ba-table').length) failures.push(`${id} step ${k + 1}: the table is not on the stage`);
          if (!/ankieta/.test(app.memHost.textContent)) failures.push(`${id} step ${k + 1}: the table is not in memory`);
          const count = byClass(app.left, 'ba-step').length;
          if (count < 2) failures.push(`${id} step ${k + 1}: fewer than two stages to click`);
          // The hint names only buttons that are there: "po" exists when there are two stages.
          const labels = byClass(app.left, 'ba-step').map((b) => b.textContent);
          if (/„po”/.test(app.left.textContent) && !labels.includes('po')) failures.push(`${id} step ${k + 1}: the hint names a button "po" that is not there`);
          const seen = new Set();
          for (let b = 0; b < count; b++) {
            byClass(app.left, 'ba-step')[b].click();
            const text = `${app.stageHost.textContent} ${app.left.textContent}`;
            const raw = text.match(RAW);
            if (raw) failures.push(`${id} step ${k + 1}: "${raw[0]}" at stage ${b + 1}`);
            seen.add(byClass(app.stageHost, 'st-caption')[0]?.textContent);
          }
          if (seen.size !== count) failures.push(`${id} step ${k + 1}: ${count} stages but ${seen.size} different captions`);
          continue;
        }
        if (app.lessonView.steps()[k].scene?.picture) {
          if (app.lessonView.live) failures.push(`${id} step ${k + 1}: a picture scene has a code box`);
          if (!byClass(app.stageHost, 'sv-on').length) failures.push(`${id} step ${k + 1}: the picture is not on the stage`);
          if (!/pusta/.test(app.memHost.textContent)) failures.push(`${id} step ${k + 1}: memory is not empty before any code`);
          const before = app.stageHost.textContent;
          const buttons = [...byClass(app.left, 'sv-person'), ...byClass(app.left, 'sv-opt')];
          if (buttons.length < 2) failures.push(`${id} step ${k + 1}: nothing to click in the questionnaire`);
          let changed = false;
          for (let b = 0; b < buttons.length; b++) {
            // The questionnaire is drawn again on every click: take the button afresh.
            [...byClass(app.left, 'sv-person'), ...byClass(app.left, 'sv-opt')][b].click();
            const text = `${app.stageHost.textContent} ${app.left.textContent}`;
            const raw = text.match(RAW);
            if (raw) failures.push(`${id} step ${k + 1}: "${raw[0]}" after click ${b + 1}`);
            if (app.stageHost.textContent !== before) changed = true;
          }
          if (!changed) failures.push(`${id} step ${k + 1}: clicking the questionnaire changes nothing on the stage`);
          continue;
        }
        const live = app.lessonView.live;
        for (const entry of live.result?.evalLog?.entries || []) {
          live.select(entry, { animate: false });
          const text = app.stageHost.textContent;
          const raw = text.match(RAW);
          if (raw) failures.push(`${id} step ${k + 1}: "${raw[0]}" in "${text.slice(0, 100)}"`);
        }
        // "Kliknij w kodzie: x" points into the scene's own expression, not at the
        // line above it that creates x.
        const sc = app.lessonView.steps()[k].scene;
        if (sc?.tap && sc.pick?.includes(sc.tap)) {
          const mark = live.box.marks.tap;
          const from = live.source.indexOf(sc.pick);
          if (!mark || mark.start < from) failures.push(`${id} step ${k + 1}: the tap mark is outside "${sc.pick}"`);
        }
        const page = app.left.textContent;
        const raw = page.match(RAW);
        if (raw) failures.push(`${id} step ${k + 1}: "${raw[0]}" in the lesson text`);
      }
      live_solve(app, id);
    } catch (e) {
      failures.push(`${id}: threw ${e.stack?.split('\n').slice(0, 6).join(' | ')}`);
    }
  }
}

function live_solve(appRef, id) {
  const lesson = appRef.lessonView.lesson;
  appRef.lessonView.live.code = lesson.task.solution;
  const verdict = appRef.lessonView.check();
  if (!verdict.ok) failures.push(`${id}: the built file rejects the lesson's own solution`);
  // Solving draws the task again (green star, next lesson): the answer must stay in the box.
  const after = appRef.lessonView;
  if (after.live.code !== lesson.task.solution) failures.push(`${id}: after a success the box holds ${JSON.stringify(after.live.code.slice(0, 40))}`);
  if (byClass(appRef.left, 'ls-saved').length) failures.push(`${id}: after a success the student is offered their own code back`);
}

// --- the opening animation (D29) --------------------------------------------------------
// It plays by itself on arrival and must stop when the student moves on: a timer left
// running would redraw the next scene's stage with the old table.
if (app) {
  try {
    app.openLesson('grouping', { step: 0 });
    const pic = app.lessonView.picture;
    if (!pic?.playing()) failures.push('grouping step 1: the picture does not start playing on arrival');
    app.lessonView.goTo(1);
    if (pic.playing()) failures.push('grouping: the animation keeps running after its scene is left');
    if (app.lessonView.picture) failures.push('grouping: the code scene still holds the picture');
    app.lessonView.goTo(0);
    byClass(app.left, 'ba-step')[1].click();
    if (app.lessonView.picture.playing()) failures.push('grouping: a click on a stage does not stop the animation');
  } catch (e) {
    failures.push(`opening animation: threw ${e.message}`);
  }
}

// --- a sandbox that keeps lines above its chips (D28) ----------------------------------
// Every run starts from the survey export, so the lines that make the factor stay in
// the box when a chip is clicked; the chip changes the last line only.
if (app) {
  try {
    app.openLesson('factor-table', { step: 0 });
    const view = app.lessonView;
    view.goTo(view.steps().findIndex((s) => s.kind === 'play'));
    const keep = view.lesson.play.keep;
    if (!keep || !view.live.code.startsWith(keep)) failures.push('factor-table sandbox: the kept lines are not in the box');
    const chip = byClass(app.left, 'ls-chip').find((b) => b.textContent.includes('levels('));
    if (!chip) failures.push('factor-table sandbox: no levels() chip');
    else {
      chip.click();
      if (!view.live.code.startsWith(keep)) failures.push(`factor-table sandbox: a chip dropped the kept lines: ${JSON.stringify(view.live.code.slice(0, 50))}`);
      if (!view.live.result?.ok) failures.push(`factor-table sandbox: the chip fails: ${view.live.result?.error?.message}`);
      if (!/podstawowe/.test(view.live.console?.textContent || '')) failures.push('factor-table sandbox: the chip shows codes, not the labels of the factor');
    }
  } catch (e) {
    failures.push(`factor-table sandbox: threw ${e.message}`);
  }
}

// --- pictures a scene asks for (D20) -------------------------------------------------
// The mask scene draws the condition along the table's rows; the same comparison
// without the scene's request keeps the recycling picture, which is lesson 3's topic.
if (app) {
  const stageAfter = (lessonId, step, code) => {
    app.openLesson(lessonId, { step: 0 });
    app.lessonView.goTo(step);
    if (code != null) app.lessonView.live.code = code;
    return app.stageHost.textContent;
  };
  try {
    const mask = stageAfter('tables', 2);
    if (!mask.includes('Jedna wartość na wiersz') || !mask.includes('plec == "K"')) {
      failures.push(`tables step 3: the mask is not drawn along the rows: "${mask.slice(0, 120)}"`);
    }
    const plain = stageAfter('tables', 4, 'ankieta$plec == "K"');
    if (plain.includes('Jedna wartość na wiersz')) failures.push('the row picture leaks outside the scene that asks for it');
    const byNumber = stageAfter('tables', 4, 'ankieta[1:3, ]');
    if (/z TRUE/.test(byNumber) || !byNumber.includes('wybrane wiersze')) {
      failures.push(`rows picked by number are captioned as a mask: "${byNumber.slice(-90)}"`);
    }
    // filter(): each row carries its own decision, in the same row of the table, so a
    // TRUE cannot sit beside the wrong respondent (it once did, one row off).
    const decisions = () => byClass(app.stageHost, 'tv-row').map((tr) => byClass(tr, 'tv-cond').map((td) => td.textContent));
    stageAfter('filtering', 1);
    const one = decisions();
    if (one.length !== 8 || one.map((d) => d[0]).join() !== 'FALSE,FALSE,TRUE,FALSE,TRUE,FALSE,FALSE,TRUE') {
      failures.push(`filtering step 1: decisions by row are ${JSON.stringify(one)}`);
    }
    // The nest and the pipe (D30): one chain, one result, written two ways.
    const chain = (step) => {
      stageAfter('filtering', step);
      return { cards: byClass(app.stageHost, 'ch-card').map((c) => c.textContent).join(' > '), out: app.lessonView.live.result.lines.join('|') };
    };
    const nest = chain(2);
    const pipe = chain(3);
    if (!app.lessonView.live.code.includes('|>') || nest.cards.split(' > ').length !== 3) failures.push(`filtering steps 3 and 4: the chain is not drawn: ${JSON.stringify(nest)}`);
    if (nest.cards !== pipe.cards || nest.out !== pipe.out) failures.push(`filtering steps 3 and 4: the nest and the pipe differ: ${JSON.stringify([nest, pipe])}`);
    stageAfter('filtering', 4);
    const na = decisions().map((d) => d[0]);
    if (na[4] !== 'NA' || na.filter((x) => x === 'NA').length !== 1) failures.push(`filtering step 4: NA is not on row 5: ${na}`);
    stageAfter('filtering', 5);
    const both = decisions();
    const heads = byClass(app.stageHost, 'tv-cond-head').map((h) => h.textContent);
    if (heads.length !== 3 || !heads[0].includes('plec == "K"') || !heads[2].includes('oba')) {
      failures.push(`filtering step 5: condition columns are ${JSON.stringify(heads)}`);
    }
    if (both[3]?.join() !== 'TRUE,TRUE,TRUE' || both[0]?.join() !== 'TRUE,FALSE,FALSE') {
      failures.push(`filtering step 5: rows 1 and 4 read ${JSON.stringify([both[0], both[3]])}`);
    }
    // select(): the result is drawn, so "still a table" and the new column order show.
    const sel = stageAfter('selecting', 3);
    if (!/tabela\s*6\s*×\s*1/.test(sel)) failures.push(`selecting step 3: the one-column result table is not drawn: "${sel.slice(-80)}"`);
    // mutate(): the new last scene keeps the result under a name; the original stays.
    stageAfter('mutating', 4);
    const mem = app.memHost.textContent;
    if (!mem.includes('ankieta_pct') || !/ankieta\s*6\s*×\s*6/.test(mem) || !/ankieta_pct\s*6\s*×\s*7/.test(mem)) failures.push(`mutating step 4: memory reads "${mem.slice(0, 120)}"`);
    // arrange(): the column the rows were sorted by is lit in the result.
    stageAfter('arranging', 1);
    const lit = byClass(app.stageHost, 'tv-new').map((x) => x.textContent);
    if (!lit.some((x) => x.startsWith('wiek'))) failures.push(`arranging step 1: the sort column is not lit (${JSON.stringify(lit.slice(0, 3))})`);
  } catch (e) {
    failures.push(`scene pictures: threw ${e.stack?.split('\n').slice(0, 2).join(' | ')}`);
  }
}

// --- a shared lab computer (D16, D17) ------------------------------------------------
// The walk above was Ania's, and solved every task. The next student, Bartek, must
// start clean; Ania must get everything back; the teacher must get a report.

let shared = 0;
const sharedCheck = (name, fn) => {
  shared++;
  try {
    const problem = fn();
    if (problem) failures.push(`shared computer: ${name}: ${problem}`);
  } catch (e) {
    failures.push(`shared computer: ${name}: threw ${e.stack?.split('\n').slice(0, 2).join(' | ')}`);
  }
};

if (app) {
  const taskOf = (id) => {
    app.openLesson(id, { step: 0 });
    app.lessonView.goTo(app.lessonView.steps().length - 1);
    return app.lessonView;
  };
  const menuText = () => { app.toggleMenu(true); const x = one(app.menu, 'menu-reset')?.textContent || ''; app.toggleMenu(false); return x; };
  const clickIn = (node, cls) => { const b = one(node, cls); if (b) b.click(); return !!b; };
  let handedIn = '';   // Ania's report, as the teacher will receive it

  sharedCheck('a solved task opens with its starter, and offers the saved answer', () => {
    const view = taskOf('vectors');
    if (view.live.code !== view.lesson.task.starter) return `the box holds ${JSON.stringify(view.live.code)}`;
    if (!clickIn(app.left, 'ls-saved-load')) return 'no offer to load the saved code';
    return view.live.code === view.lesson.task.solution ? null : `after "Wczytaj" the box holds ${JSON.stringify(view.live.code)}`;
  });

  sharedCheck('a failed check goes away once the code is changed', () => {
    const view = taskOf('vectors');
    view.live.code = 'wiek <- 23, 34';
    if (view.check().ok) return 'a syntax error passed';
    if (!byClass(app.left, 'ls-bad').length && !app.left.textContent.includes('Kod się nie wykonał')) return 'no failure shown';
    view.live.code = 'wiek <- c(23, 34)';
    return app.left.textContent.includes('Kod się nie wykonał') ? 'the old failure still shows under new code' : null;
  });

  sharedCheck('"Dalej w RStudio": reached from the last lesson and the menu, and the way back', () => {
    const view = taskOf(LAST_LESSON);
    const toRs = byClass(app.left, 'ls-next').find((b) => b.textContent.includes('RStudio'));
    if (!toRs) return 'the solved last lesson does not lead to RStudio';
    toRs.click();
    const page = app.left.textContent + app.right.textContent;
    const raw = page.match(RAW) || page.match(/\b(rs|menu)\.[a-zA-Z][\w.]*/);
    if (raw) return `raw text on the page: ${raw[0]}`;
    if (byClass(app.left, 'rs-step').length !== 3) return `${byClass(app.left, 'rs-step').length} steps`;
    if (byClass(app.right, 'rs-msg').length !== 8 || byClass(app.right, 'rs-what').length !== 8) return 'the error list is incomplete';
    if (!page.includes('read.csv2') || !page.includes('library(dplyr)')) return 'the code examples are missing';
    if (page.includes('—')) return 'em dash on the page';
    // Back to a lesson: the stage and memory are where they were.
    app.openLesson('vectors');
    if (!one(app.right, 'stage') || !one(app.right, 'mem') || one(app.right, 'rs-errors')) return 'the right column did not come back';
    // From the menu, and remembered as the place to return to.
    app.toggleMenu(true);
    if (!clickIn(app.menu, 'menu-rstudio')) return 'not in the menu';
    if (!one(app.right, 'rs-errors')) return 'the menu item did not open the page';
    app.openSandbox();
    if (!one(app.right, 'stage') || !one(app.right, 'mem')) return 'the sandbox has no stage or memory';
    return view ? null : 'no view';
  });

  sharedCheck('the sandbox has the survey, a glossary, and keeps the person\'s code', () => {
    app.openSandbox();
    if (!app.sandbox.result?.ok) return `the default sandbox code fails: ${app.sandbox.result?.error?.message}`;
    if (!app.memHost.textContent.includes('ankieta')) return 'no ankieta in memory';
    if (!one(app.left, 'gl-bar')) return 'no "Ściąga" in the sandbox';
    app.sandbox.code = 'ankieta |> filter(ocena > 3) |> nrow()';
    app.openLesson('vectors');
    app.openSandbox();
    if (app.sandbox.code !== 'ankieta |> filter(ocena > 3) |> nrow()') return `came back as ${JSON.stringify(app.sandbox.code)}`;
    return app.sandbox.result?.ok ? null : `the kept code fails: ${app.sandbox.result?.error?.message}`;
  });

  sharedCheck('the header and the menu say who is working, and how far', () => {
    if (!app.whoLabel.textContent.includes('Ania')) return `header says ${app.whoLabel.textContent}`;
    const text = menuText();
    return text.includes('Ania') && text.includes(ALL_DONE) ? null : `menu reads ${JSON.stringify(text)}`;
  });

  sharedCheck('the report names the person, counts, and passes its own check', () => {
    app.toggleMenu(true);
    if (!clickIn(app.menu, 'menu-report')) return 'no report button';
    const text = one(app.overlay, 'rep-text')?.value || '';
    handedIn = text;
    if (!text.includes('Osoba: Ania') || !text.includes(`Ukończone ćwiczenia: ${ALL_DONE}`)) return `report reads ${JSON.stringify(text.slice(0, 120))}`;
    // The whole report is in view, code line included, and the student's window
    // holds no teacher's check: that has its own way in from "Kim jesteś?".
    const box = one(app.overlay, 'rep-text');
    if (Number(box.getAttribute('rows')) < text.split('\n').length) return `the box shows ${box.getAttribute('rows')} of ${text.split('\n').length} lines`;
    if (byClass(app.overlay, 'rep-paste').length) return 'the student\'s report window has the teacher\'s check';
    if (!/ostatnią linią/.test(app.overlay.textContent)) return 'the student is not told to send the last line';
    app.closeOverlay();
    return null;
  });

  sharedCheck('the next person starts clean', () => {
    app.showWho();
    if (!app.overlay.textContent.includes('Ania')) return 'Ania is not offered on the welcome screen';
    enterName('Bartek');
    if (!app.whoLabel.textContent.includes('Bartek')) return 'header did not switch';
    if (!menuText().includes(`0 z ${LESSON_COUNT}`)) return `Bartek inherits progress: ${menuText()}`;
    app.openSandbox();
    if (app.sandbox.code.includes('filter(ocena > 3)')) return 'Bartek sees Ania\'s sandbox code';
    const view = taskOf('vectors');
    if (byClass(app.left, 'ls-saved').length) return 'Bartek is offered Ania\'s code';
    return view.hintsShown === 0 ? null : `hints already used: ${view.hintsShown}`;
  });

  sharedCheck('the returning person gets everything back, by name, any case', () => {
    app.showWho();
    enterName('  ania ');
    if (!app.whoLabel.textContent.includes('Ania')) return `"ania" did not find Ania: ${app.whoLabel.textContent}`;
    return menuText().includes(ALL_DONE) ? null : `Ania lost progress: ${menuText()}`;
  });

  sharedCheck('"Usuń moje dane" asks first; cancel keeps, yes removes only that person', () => {
    app.toggleMenu(true);
    clickIn(app.menu, 'menu-forget');
    if (!clickIn(app.menu, 'menu-reset-no')) return 'no cancel step';
    if (!menuText().includes(ALL_DONE)) return 'cancel lost progress';
    // Remove Bartek, keep Ania.
    app.showWho();
    const bartek = byClass(app.overlay, 'who-person').find((b) => b.textContent.includes('Bartek'));
    if (!bartek) return 'Bartek is not on the list';
    bartek.click();
    app.toggleMenu(true);
    clickIn(app.menu, 'menu-forget');
    if (!clickIn(app.menu, 'menu-reset-yes')) return 'no confirm button';
    if (app.overlay.hidden) return 'after removal the welcome screen should ask who is working';
    const names = byClass(app.overlay, 'who-person').map((b) => b.textContent);
    if (names.some((n) => n.includes('Bartek'))) return 'Bartek is still listed';
    if (!names.some((n) => n.includes('Ania'))) return 'Ania was removed too';
    return null;
  });

  sharedCheck('the teacher checks reports from "Kim jesteś?" without becoming a student', () => {
    const before = byClass(app.overlay, 'who-person').length;
    if (!clickIn(app.overlay, 'who-teacher')) return 'no teacher link on the welcome screen';
    if (!app.overlay.textContent.includes('Sprawdź raport studenta')) return 'the check did not open';
    const paste = one(app.overlay, 'rep-paste');
    const verdict = () => one(app.overlay, 'rep-verdict-host')?.textContent || '';
    const pasteIn = (text) => { paste.value = text; for (const fn of paste._on?.input || []) fn({}); };
    // Pasting is enough: no button press, and the next report replaces the last verdict.
    pasteIn(`Dzień dobry,\n\n${handedIn}\n\nPozdrawiam`);
    if (!/nienaruszony.*Ania/.test(verdict())) return `a genuine report, pasted: ${verdict()}`;
    if (!verdict().includes(`Ukończone ćwiczenia: ${ALL_DONE}`)) return `no summary under the verdict: ${verdict()}`;
    pasteIn(handedIn.replace(/\n/g, '\r\n\r\n').replace(/: /g, ':   '));
    if (!/nienaruszony/.test(verdict())) return `mangled spacing failed the check: ${verdict()}`;
    // A hand edit: one lesson's state changed. Must fail.
    const edited = handedIn.replace(/(\n2\. [^\n]*?) → ukończone [^\n(]*/, '$1 → nierozpoczęte');
    if (edited === handedIn) return 'test setup: the edit did not change the report';
    pasteIn(edited);
    if (!/nie zgadza/.test(verdict())) return `an edited report passed: ${verdict()}`;
    pasteIn(handedIn.replace(ALL_DONE, `${LESSON_COUNT - 1} z ${LESSON_COUNT}`));
    if (!/nie zgadza/.test(verdict())) return `an edited report, pasted over: ${verdict()}`;
    // A group: two reports one under another, the second edited, give a table.
    pasteIn(`${handedIn}\n\nPozdrawiam\n\n${edited}`);
    const rows = byClass(app.overlay, 'rep-table')[0] ? byClass(app.overlay, 'rep-row-ok').length + byClass(app.overlay, 'rep-row-bad').length : 0;
    if (rows !== 2) return `two reports gave ${rows} table rows`;
    if (byClass(app.overlay, 'rep-row-bad').length !== 1) return 'the edited report is not the one flagged';
    pasteIn('');
    if (verdict()) return `an empty box still shows: ${verdict()}`;
    // Closing goes back to the names, and nobody new was added.
    byClass(app.overlay, 'ghost-btn').find((b) => b.textContent === 'Zamknij')?.click();
    const after = byClass(app.overlay, 'who-person').length;
    if (!app.overlay.textContent.includes('Kim jesteś?')) return 'closing did not return to "Kim jesteś?"';
    return after === before ? null : `people on the list went from ${before} to ${after}`;
  });
}

console.log(`bundle: booted, ${steps} lesson steps walked, ${shared} shared-computer checks, ${failures.length} problem(s)`);
for (const f of failures.slice(0, 30)) console.log(`  FAIL  ${f}`);
process.exit(failures.length ? 1 : 0);
