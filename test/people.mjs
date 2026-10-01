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
 */

import { installDom } from './dom-shim.mjs';
installDom();

const P = await import('../src/ui/progress.js');
const { buildReport, verifyReport } = await import('../src/ui/report.js');
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

check('removing a person removes their keys, and only theirs', () => {
  P.forgetPerson(bartek.id);
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

// --- the report ---------------------------------------------------------------------

const NOW = new Date(2026, 9, 1, 10, 42).getTime();
const report = buildReport({ name: 'Ania K.', lessons: LESSONS, progress: P.allProgress(), now: NOW });

check('the report says who, when, how many, and per lesson', () => {
  const want = ['Osoba: Ania K.', 'Data: 01.10.2026 10:42', 'Ukończone lekcje: 1 z 13',
    `1. ${LESSONS[0].title}: ukończona`, `2. ${LESSONS[1].title}: rozpoczęta`, 'podpowiedzi: 2', 'otwarte rozwiązanie',
    `13. ${LESSONS[12].title}: nierozpoczęta`];
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
  'the total': (s) => s.replace('Ukończone lekcje: 1 z 13', 'Ukończone lekcje: 13 z 13'),
  'a lesson state': (s) => s.replace(/(13\. [^\n]*): nierozpoczęta/, '$1: ukończona 01.10.2026'),
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

console.log(`people: ${passed}/${passed + failures.length} checks passed`);
for (const f of failures) console.log(`  FAIL  ${f}`);
process.exit(failures.length ? 1 : 0);
