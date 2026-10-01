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

const root = new URL('..', import.meta.url).pathname;
// BUNDLE=path checks an existing file instead (used to prove this suite catches the
// old build's renaming bug).
const out = process.env.BUNDLE || join(mkdtempSync(join(tmpdir(), 'r-trainer-')), 'bundle.html');
if (!process.env.BUNDLE) execFileSync('node', [join(root, 'build.mjs'), '--out', out], { encoding: 'utf8' });
const html = readFileSync(out, 'utf8');
const script = html.slice(html.indexOf('<script>') + '<script>'.length, html.lastIndexOf('</script>'));

const failures = [];
const RAW = /\b(fx|ls|lv|ui|val|tv|rx|op|co|mem|badge|module|type|err|diag|warn|env|tok)\.[a-zA-Z][\w.]*|\$src_/;

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
  const ids = ['vectors', 'types', 'vectorised', 'missing', 'subsetting', 'factors', 'tables',
    'filtering', 'selecting', 'mutating', 'arranging', 'grouping', 'counting'];
  for (const id of ids) {
    try {
      app.openLesson(id, { step: 0 });
      const n = app.lessonView.steps().length;
      for (let k = 0; k < n; k++) {
        app.lessonView.goTo(k);
        steps++;
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
      failures.push(`${id}: threw ${e.stack?.split('\n').slice(0, 2).join(' | ')}`);
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
    const view = taskOf('counting');
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

  sharedCheck('the header and the menu say who is working, and how far', () => {
    if (!app.whoLabel.textContent.includes('Ania')) return `header says ${app.whoLabel.textContent}`;
    const text = menuText();
    return text.includes('Ania') && text.includes('13 z 13') ? null : `menu reads ${JSON.stringify(text)}`;
  });

  sharedCheck('the report names the person, counts, and passes its own check', () => {
    app.toggleMenu(true);
    if (!clickIn(app.menu, 'menu-report')) return 'no report button';
    const text = one(app.overlay, 'rep-text')?.value || '';
    handedIn = text;
    if (!text.includes('Osoba: Ania') || !text.includes('Ukończone lekcje: 13 z 13')) return `report reads ${JSON.stringify(text.slice(0, 120))}`;
    // The teacher's check, in the same dialog: pasted with mangled spacing, then edited.
    const paste = byClass(app.overlay, 'rep-paste')[0];
    const checkBtn = byClass(one(app.overlay, 'rep-teacher'), 'ghost-btn')[0];
    paste.value = text.replace(/\n/g, '\r\n\r\n').replace(/: /g, ':   ');
    checkBtn.click();
    if (!/nienaruszony/.test(one(app.overlay, 'rep-verdict').textContent)) return `mangled spacing failed the check: ${one(app.overlay, 'rep-verdict').textContent}`;
    // A hand edit: one lesson's state changed. Must fail.
    const edited = text.replace(/(\n2\. [^\n]*?) → ukończona [^\n(]*/, '$1 → nierozpoczęta');
    if (edited === text) return 'test setup: the edit did not change the report';
    paste.value = edited;
    checkBtn.click();
    const v = one(app.overlay, 'rep-verdict').textContent;
    app.closeOverlay();
    return /nie zgadza/.test(v) ? null : `an edited report passed: ${v}`;
  });

  sharedCheck('the next person starts clean', () => {
    app.showWho();
    if (!app.overlay.textContent.includes('Ania')) return 'Ania is not offered on the welcome screen';
    enterName('Bartek');
    if (!app.whoLabel.textContent.includes('Bartek')) return 'header did not switch';
    if (!menuText().includes('0 z 13')) return `Bartek inherits progress: ${menuText()}`;
    const view = taskOf('vectors');
    if (byClass(app.left, 'ls-saved').length) return 'Bartek is offered Ania\'s code';
    return view.hintsShown === 0 ? null : `hints already used: ${view.hintsShown}`;
  });

  sharedCheck('the returning person gets everything back, by name, any case', () => {
    app.showWho();
    enterName('  ania ');
    if (!app.whoLabel.textContent.includes('Ania')) return `"ania" did not find Ania: ${app.whoLabel.textContent}`;
    return menuText().includes('13 z 13') ? null : `Ania lost progress: ${menuText()}`;
  });

  sharedCheck('"Usuń moje dane" asks first; cancel keeps, yes removes only that person', () => {
    app.toggleMenu(true);
    clickIn(app.menu, 'menu-forget');
    if (!clickIn(app.menu, 'menu-reset-no')) return 'no cancel step';
    if (!menuText().includes('13 z 13')) return 'cancel lost progress';
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
    const verdict = () => one(app.overlay, 'rep-verdict').textContent;
    const pasteIn = (text) => { paste.value = text; for (const fn of paste._on?.input || []) fn({}); };
    // Pasting is enough: no button press, and the next report replaces the last verdict.
    pasteIn(`Dzień dobry,\n\n${handedIn}\n\nPozdrawiam`);
    if (!/nienaruszony.*Ania/.test(verdict())) return `a genuine report, pasted: ${verdict()}`;
    pasteIn(handedIn.replace('13 z 13', '12 z 13'));
    if (!/nie zgadza/.test(verdict())) return `an edited report, pasted over: ${verdict()}`;
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
