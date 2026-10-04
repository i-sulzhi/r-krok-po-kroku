/**
 * People and the teacher's report (D17).
 *
 * One lab browser serves many students, and the report is the teacher's only view
 * of their progress. Both fail quietly if wrong: one student's answers appearing
 * for another, a removed student's data left behind, a report that a pasted line
 * break invalidates or a hand edit does not. This suite checks:
 *
 *   - names: trimmed, the same name in any case is the same person, length capped
 *   - progress, saved code and place are kept apart per person
 *   - removing a person removes their keys, and only theirs
 *   - the report: content, first-success date kept, opened solution reported
 *   - the check code survives what pasting does, and catches hand edits
 *   - what is reported stops at the first success; zeros are not printed
 *   - many reports pasted together are checked one by one, with their facts
 *   - a report made before the format changed still checks
 */

import { installDom } from './dom-shim.mjs';
installDom();

const P = await import('../src/ui/progress.js');
const { buildReport, verifyReport, verifyReports } = await import('../src/ui/report.js');
const { LESSONS } = await import('../src/lessons/index.js');

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

// The shim's localStorage, inspected directly: what is really left behind.
const raw = (k) => localStorage.getItem(k);

// --- names -------------------------------------------------------------------

const ania = P.addPerson('  Ania   K. ');
check('a name is trimmed and spaces collapse', () => (ania?.name === 'Ania K.' ? null : `got ${JSON.stringify(ania?.name)}`));
check('the same name in another case is the same person', () => {
  const again = P.addPerson('ania k.');
  return again.id === ania.id ? null : 'a second person was created';
});
check('an empty name creates nobody', () => (P.addPerson('   ') === null ? null : 'created someone'));
check('a long name is capped', () => {
  const long = P.addPerson('x'.repeat(200));
  const ok = long.name.length === P.MAX_NAME;
  P.forgetPerson(long.id);
  return ok ? null : `length ${long.name.length}`;
});

// --- progress kept apart ---------------------------------------------------------

P.choosePerson(ania.id);
P.noteAttempt('vectors', { code: 'x <- 1' });
P.markDone('vectors', { code: 'wiek <- c(1)' });
P.noteHint('types', 1);
P.noteSolution('types');
P.savePlace({ lesson: 'types', step: 2 });
const aniaDoneAt = P.getProgress('vectors').doneAt;

const bartek = P.addPerson('Bartek');
check('a new person sees none of the previous one\'s progress', () => {
  if (P.currentPerson().id !== bartek.id) return 'Bartek is not current';
  if (P.getProgress('vectors')) return `vectors: ${JSON.stringify(P.getProgress('vectors'))}`;
  if (P.savedPlace()) return `place: ${JSON.stringify(P.savedPlace())}`;
  return P.doneCount() === 0 ? null : `doneCount ${P.doneCount()}`;
});
P.noteAttempt('vectors', { code: 'bartek' });

check('choosing the first person again brings everything back', () => {
  P.choosePerson(ania.id);
  const v = P.getProgress('vectors');
  if (v?.status !== 'done' || v.lastCode !== 'wiek <- c(1)') return `vectors: ${JSON.stringify(v)}`;
  if (P.savedPlace()?.lesson !== 'types') return `place: ${JSON.stringify(P.savedPlace())}`;
  return P.doneCount() === 1 ? null : `doneCount ${P.doneCount()}`;
});

check('the list shows both, the current one marked, with their counts', () => {
  const list = P.people();
  const a = list.find((p) => p.id === ania.id);
  const b = list.find((p) => p.id === bartek.id);
  if (!a || !b) return `list: ${JSON.stringify(list)}`;
  return a.last && !b.last && a.done === 1 && b.done === 0 ? null : `list: ${JSON.stringify(list)}`;
});

check('a page load does not choose anyone by itself', () => {
  P._resetSession();
  const none = P.currentPerson();
  const last = P.lastPerson();
  P.choosePerson(ania.id);
  return none === null && last === ania.id ? null : `current ${JSON.stringify(none)}, last ${last}`;
});

check('the first success date stays when the task is solved again', () => {
  P.markDone('vectors', { code: 'again' });
  return P.getProgress('vectors').doneAt === aniaDoneAt ? null : 'doneAt moved';
});

check('sandbox code is kept per person', () => {
  P.choosePerson(bartek.id);
  P.saveSandbox('bartek <- 1');
  P.choosePerson(ania.id);
  if (P.savedSandbox() != null) return `Ania sees ${JSON.stringify(P.savedSandbox())}`;
  P.choosePerson(bartek.id);
  return P.savedSandbox() === 'bartek <- 1' ? null : `Bartek has ${JSON.stringify(P.savedSandbox())}`;
});

check('removing a person removes their keys, and only theirs', () => {
  P.forgetPerson(bartek.id);
  if (raw(`r-trainer.sandbox.v1:${bartek.id}`) != null) return 'Bartek\'s sandbox code is still stored';
  P.choosePerson(ania.id);
  if (raw(`r-trainer.progress.v2:${bartek.id}`) != null) return 'Bartek\'s progress is still stored';
  if (P.people().some((p) => p.id === bartek.id)) return 'Bartek is still listed';
  if (raw(`r-trainer.progress.v2:${ania.id}`) == null) return 'Ania\'s progress went too';
  return P.currentPerson()?.id === ania.id ? null : 'Ania stopped being current';
});

check('data from before names existed is dropped', () => {
  localStorage.setItem('r-trainer.progress.v1', '{"vectors":{"status":"done"}}');
  P.dropLegacy();
  return raw('r-trainer.progress.v1') == null ? null : 'legacy progress survived';
});

// --- the welcome list narrows as a name is typed ----------------------------------------

const { renderWho } = await import('../src/ui/people.js');
const byClass = (node, cls, out = []) => {
  if (String(node?.className || '').split(' ').includes(cls)) out.push(node);
  for (const c of node?.childNodes || []) byClass(c, cls, out);
  return out;
};
check('typing narrows "Wracasz?" to matching names, and hides it when none match', () => {
  const screen = renderWho({
    people: [{ id: 'a', name: 'Kasia W.', done: 1 }, { id: 'b', name: 'Kuba Ż.', done: 0 }, { id: 'c', name: 'Łucja', done: 0 }],
    total: 17, onChoose() {}, onAdd() {},
  });
  const input = byClass(screen, 'who-input')[0];
  const type = (text) => { input.value = text; for (const fn of input._on?.input || []) fn({}); };
  const shown = () => byClass(screen, 'who-person').filter((b) => !b.hidden).map((b) => b.dataset.name);
  const back = byClass(screen, 'who-back')[0];
  type('ka');
  if (shown().join() !== 'kasia w.') return `"ka" shows ${shown()}`;
  type('ŁUC');
  if (shown().join() !== 'łucja') return `"ŁUC" shows ${shown()}`;
  type('Zenek');
  if (!back.hidden) return 'a new name still shows "Wracasz?"';
  type('');
  return shown().length === 3 && !back.hidden ? null : `cleared field shows ${shown()}`;
});

// --- the report ---------------------------------------------------------------------

const NOW = new Date(2026, 9, 1, 10, 42).getTime();
const report = buildReport({ name: 'Ania K.', lessons: LESSONS, progress: P.allProgress(), now: NOW });

check('the report says who, when, how many, and per lesson', () => {
  const want = ['Osoba: Ania K.', 'Data: 01.10.2026 10:42', 'Ukończone lekcje: 1 z 17',
    `1. ${LESSONS[0].title} → ukończona`, `2. ${LESSONS[1].title} → rozpoczęta`, 'podpowiedzi: 2', 'otwarte rozwiązanie',
    `17. ${LESSONS[16].title} → nierozpoczęta`];
  const missing = want.filter((w) => !report.includes(w));
  return missing.length ? `missing ${JSON.stringify(missing)} in:\n${report}` : null;
});

check('no em dash and no raw key in the report', () => {
  if (report.includes('—')) return 'em dash';
  const rawKey = report.match(/\brep\.[a-zA-Z]+|\{[a-z]+\}/);
  return rawKey ? `raw: ${rawKey[0]}` : null;
});

check('the report passes its own check', () => (verifyReport(report).ok ? null : JSON.stringify(verifyReport(report))));
check('the check names the person', () => (verifyReport(report).name === 'Ania K.' ? null : verifyReport(report).name));

const MANGLED = {
  'Windows line ends': (s) => s.replace(/\n/g, '\r\n'),
  'blank lines doubled': (s) => s.replace(/\n/g, '\n\n'),
  'non-breaking spaces': (s) => s.replace(/ /g, ' '),
  'indented and padded': (s) => s.split('\n').map((l) => `   ${l}  `).join('\n'),
  'text around it': (s) => `Dzień dobry, w załączniku raport.\n\n${s}\n\nPozdrawiam`,
};
for (const [what, mangle] of Object.entries(MANGLED)) {
  check(`pasting survives: ${what}`, () => {
    const r = verifyReport(mangle(report));
    return r.ok ? null : JSON.stringify(r);
  });
}

const EDITS = {
  'the total': (s) => s.replace('Ukończone lekcje: 1 z 17', 'Ukończone lekcje: 17 z 17'),
  'a lesson state': (s) => s.replace(/(17\. [^\n]*) → nierozpoczęta/, '$1 → ukończona 01.10.2026'),
  'the hints': (s) => s.replace('podpowiedzi: 2', 'podpowiedzi: 0'),
  'the name': (s) => s.replace('Osoba: Ania K.', 'Osoba: Bartek'),
  'a dropped line': (s) => s.replace(/\n[^\n]*otwarte rozwiązanie[^\n]*/, ''),
};
for (const [what, edit] of Object.entries(EDITS)) {
  check(`a hand edit is caught: ${what}`, () => {
    const edited = edit(report);
    if (edited === report) return 'test setup: the edit changed nothing';
    return verifyReport(edited).ok ? 'passed the check' : null;
  });
}
check('a report without its code line says so', () =>
  (verifyReport(report.split('\n').slice(0, -1).join('\n')).reason === 'noCode' ? null : 'not reported as noCode'));


check('a zero is not printed: a lesson solved at once reads "(sprawdzenia: 1)"', () => {
  const line = report.split('\n').find((l) => l.startsWith('1. '));
  if (/: 0\b/.test(report)) return `a zero in:\n${report}`;
  return /\(sprawdzenia: 1\)$/.test(line) ? null : `lesson 1 reads ${JSON.stringify(line)}`;
});

// --- what is reported stops at the first success ----------------------------------------

check('checks, hints and the solution after a success are practice, not reported', () => {
  P.addPerson('Cezary');
  P.noteAttempt('types', { code: 'zle' });
  P.noteHint('types', 0);
  P.noteAttempt('types', { code: 'dobrze' });
  P.markDone('types', { code: 'dobrze' });
  // Afterwards: checked again, every hint, the model solution.
  P.noteAttempt('types', { code: 'jeszcze raz' });
  P.noteHint('types', 1);
  P.noteSolution('types');
  const p = P.getProgress('types');
  if (p.attempts !== 2 || p.hintsUsed !== 1 || p.solutionSeen) return `after the success: ${JSON.stringify(p)}`;
  // The code is still kept: the student finds their last version.
  return p.lastCode === 'jeszcze raz' ? null : `last code ${p.lastCode}`;
});

check('before a success, the opened solution is reported', () => {
  P.noteHint('missing', 2);
  P.noteSolution('missing');
  const p = P.getProgress('missing');
  return p.solutionSeen && p.hintsUsed === 3 ? null : JSON.stringify(p);
});

// --- old reports and many reports ---------------------------------------------------

// Made before zeros were dropped (2026-10-01): it must still check, and read.
const OLD = "R krok po kroku: raport postępu\nOsoba: Ania K.\nData: 08.10.2026 21:14\nUkończone lekcje: 6 z 13\n\n1. Od arkusza do wektora → ukończona 01.10.2026 (sprawdzenia: 1, podpowiedzi: 0)\n2. Typy i cicha konwersja → ukończona 01.10.2026 (sprawdzenia: 3, podpowiedzi: 1)\n3. Działania na całym wektorze → ukończona 01.10.2026 (sprawdzenia: 2, podpowiedzi: 0)\n4. Braki danych: NA → ukończona 02.10.2026 (sprawdzenia: 6, podpowiedzi: 2, otwarte rozwiązanie)\n5. Wybieranie elementów → ukończona 02.10.2026 (sprawdzenia: 1, podpowiedzi: 0)\n6. Etykiety kategorii: factor() → ukończona 02.10.2026 (sprawdzenia: 4, podpowiedzi: 2)\n7. Tabela danych: data.frame → rozpoczęta (sprawdzenia: 5, podpowiedzi: 2)\n8. filter() i potok |> → rozpoczęta\n9. select(): wybieranie kolumn → nierozpoczęta\n10. mutate(): nowa kolumna → nierozpoczęta\n11. arrange(): kolejność wierszy → nierozpoczęta\n12. group_by() i summarise() → nierozpoczęta\n13. Liczenie: n() i count() → nierozpoczęta\n\nKod kontrolny: 8041-2E39";
check('a report in the earlier format still checks', () => {
  const r = verifyReport(OLD);
  return r.ok && r.name === 'Ania K.' ? null : JSON.stringify(r);
});

const bartekReport = buildReport({
  name: 'Bartek',
  lessons: LESSONS,
  progress: {
    vectors: { status: 'done', attempts: 2, doneAt: NOW },
    types: { status: 'done', attempts: 5, hintsUsed: 2, solutionSeen: true, doneAt: NOW },
    vectorised: { status: 'seen', attempts: 3 },
    missing: { status: 'seen' },
  },
  now: NOW,
});
const group = [
  'Raporty z grupy 1:', OLD, '', bartekReport, 'Pozdrawiam,', report.replace('Ukończone lekcje: 1 z 17', 'Ukończone lekcje: 9 z 17'),
  'Ostatni:', bartekReport.split('\n').slice(0, -1).join('\n'),
].join('\n');
const all = verifyReports(group);

check('many reports pasted together: one result each, in order', () => {
  const got = all.map((r) => `${r.name}:${r.ok ? 'ok' : r.reason}`).join(' ');
  return got === 'Ania K.:ok Bartek:ok Ania K.:mismatch Bartek:noCode' ? null : got;
});
check('a checked report is read back: date, count, solutions, unfinished lessons', () => {
  const b = all[1];
  const want = { date: '01.10.2026 10:42', done: 2, total: 17, solutions: [2], started: [3, 4] };
  const got = { date: b.date, done: b.done, total: b.total, solutions: b.solutions, started: b.started };
  return JSON.stringify(got) === JSON.stringify(want) ? null : JSON.stringify(got);
});
check('the earlier format is read back too', () => {
  const a = all[0];
  return a.done === 6 && a.solutions.join() === '4' && a.started.join() === '7,8' ? null : JSON.stringify(a);
});
check('a changed report gives no facts to trust', () => (all[2].done === undefined ? null : JSON.stringify(all[2])));
check('empty text is no report at all; text without a code is', () => {
  if (verifyReports('  \n ').length) return 'empty text gave a result';
  return verifyReports('Dzień dobry').map((r) => r.reason).join() === 'noCode' ? null : 'plain text not noCode';
});

console.log(`people: ${passed}/${passed + failures.length} checks passed`);
for (const f of failures) console.log(`  FAIL  ${f}`);
process.exit(failures.length ? 1 : 0);
