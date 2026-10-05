/**
 * Lesson: a factor inside a table -- module 4.
 *
 * Where factors are actually used. A survey export is a table whose columns hold
 * codes: 1, 2, 3 for education, "K" and "M" for gender. The analyst replaces such a
 * column with a factor once, at the top of the script, and from then on every
 * count, every selection and every report speaks in words and in the scale's order.
 *
 * The three factor lessons before this one worked on loose vectors. Here the same
 * `factor()` call lands in `ankieta$wyksztalcenie <-`, which replaces the column,
 * and the lesson shows what that buys: a count table in words, rows chosen by label,
 * a mean for one group. The mask and the `$` are the previous lesson's.
 *
 * Every run starts from the export again, so each scene repeats the three lines
 * that make the factor: that is also how the script would read. The sandbox keeps
 * those lines above every chip (`play.keep`).
 *
 * The task does the same for gender, whose codes are letters. The check also looks
 * at the table in memory: a correct count made beside the table, with the column
 * left as text, is the anticipated half-answer and is told so.
 */

import { resultCheck } from './schema.js';
import { isAtomic, isFactor, getNames } from '../core/rvalue.js';

const NAMES = 'poziomy <- c("podstawowe", "średnie", "wyższe")';

const SETUP = `# Eksport z ankiety: odpowiedzi zapisane kodami
ankieta <- data.frame(
  id = 1:8,
  plec = c("K", "M", "K", "K", "M", "K", "K", "M"),
  wyksztalcenie = c(3, 2, 3, 1, 2, 3, 2, 3),
  ocena = c(4, 5, 2, 4, 3, 5, 4, 2)
)
${NAMES}`;

// The three lines every later step starts with: the column replaced by a factor.
const CONVERT = `ankieta$wyksztalcenie <- factor(
  ankieta$wyksztalcenie,
  levels = 1:3, labels = poziomy)`;

const SOLUTION = `ankieta$plec <- factor(ankieta$plec,
  levels = c("K", "M"),
  labels = c("kobieta", "mężczyzna"))
table(ankieta$plec)`;

// The reference is computed after the student's code has run, when the column may
// already be a factor: so it is built from the answers themselves, not from the table.
const EXPECTED = `table(factor(c("K", "M", "K", "K", "M", "K", "K", "M"),
  levels = c("K", "M"), labels = c("kobieta", "mężczyzna")))`;

const base = resultCheck({ expected: EXPECTED, requireCalls: ['factor', 'table'], compare: { names: true } });

/** The count must be right, and the table in memory must hold the factor. */
const check = (ctx) => {
  const verdict = base(ctx);
  if (!verdict.ok) return verdict;
  let inTable = false;
  try { inTable = ctx.session.evaluate('is.factor(ankieta$plec)').values[0] === true; } catch { /* no table */ }
  return inTable ? verdict : { ok: false, reason: 'not-in-table' };
};
check.compare = base.compare;

export const factorTable = {
  id: 'factor-table',
  module: 4,
  lecture: 1,
  requires: ['tables', 'factors'],
  title: 'Czynnik w tabeli',
  setup: SETUP,

  scenes: [
    {
      say: 'Eksport z ankiety. W kolumnie `wyksztalcenie` są **kody**, a nie słowa.',
      code: 'ankieta',
      pick: 'ankieta',
    },
    {
      say: '`ankieta$wyksztalcenie <-` **podmienia kolumnę**. Kody stają się czynnikiem.',
      code: `${NAMES}\n${CONVERT}\nankieta`,
    },
    {
      say: 'Tabela liczebności mówi teraz **słowami**, w kolejności skali.',
      code: `${CONVERT}\ntable(ankieta$wyksztalcenie)`,
    },
    {
      say: 'Wiersze wybierasz **etykietą**, w cudzysłowie. Maska jak w poprzednim ćwiczeniu.',
      code: `${CONVERT}\nankieta[ankieta$wyksztalcenie == "wyższe", ]`,
    },
    {
      say: 'Średnia ocena jednej grupy: kolumna `ocena`, a w nawiasie maska z etykiety.',
      code: `${CONVERT}\nmean(ankieta$ocena[ankieta$wyksztalcenie == "wyższe"])`,
    },
  ],

  play: {
    keep: CONVERT,
    code: 'summary(ankieta$wyksztalcenie)',
    chips: [
      'str(ankieta)',
      'levels(ankieta$wyksztalcenie)',
      'sum(ankieta$wyksztalcenie == "średnie")',
      'ankieta[ankieta$wyksztalcenie != "wyższe", ]',
      'ankieta$wyksztalcenie == 3',
      'table(ankieta$plec)',
    ],
  },

  task: {
    prompt: 'Zamień kolumnę `plec` na czynnik: K to **kobieta**, M to **mężczyzna**. Potem policz płeć.',
    starter: '# 1. kolumna plec jako czynnik\n\n# 2. tabela liczebności płci\n',
    check,
    solution: SOLUTION,
    hints: [
      'Jak w scenie 2: po lewej `ankieta$plec <-`, po prawej `factor()` z `levels` i `labels`.',
      'Poziomy to litery: `levels = c("K", "M")`. Ostatnia linia: `table(ankieta$plec)`.',
    ],
    messages: {
      'missing.table': 'Zadanie prosi o tabelę liczebności, więc na końcu użyj `table()`.',
      'missing.factor': 'Słowa da dopiero czynnik: `factor()` z `labels`.',
      codes: 'To wciąż litery K i M. Najpierw podmień kolumnę na czynnik z `labels`.',
      notTable: 'Kolumna to już czynnik. Brakuje ostatniej linii: `table(ankieta$plec)`.',
      inTable: 'Wynik jest dobry, ale kolumna w tabeli to wciąż tekst. Przypisz czynnik: `ankieta$plec <- ...`.',
      swapped: 'Etykiety są zamienione: K to kobieta. `labels` idą w tej samej kolejności co `levels`.',
      lost: 'Suma nie daje 8 osób. Poziom wpisany inaczej niż w danych staje się NA.',
      general: 'Jeszcze nie to: `ankieta$plec <- factor(...)`, a w ostatniej linii `table(ankieta$plec)`.',
    },
    success: 'Dobrze. Pięć kobiet i trzech mężczyzn.',
    note: 'Tak zaczyna się skrypt analizy: kolumny z kodami stają się czynnikami, raz, na samej górze.',

    nearMisses: [
      { name: 'counted the letters', expect: 'codes', code: 'table(ankieta$plec)' },
      { name: 'replaced the column but never counted it', expect: 'notTable',
        code: 'ankieta$plec <- factor(ankieta$plec, levels = c("K", "M"), labels = c("kobieta", "mężczyzna"))\nankieta$plec' },
      { name: 'counted a factor made beside the table', expect: 'inTable',
        code: 'table(factor(ankieta$plec, levels = c("K", "M"), labels = c("kobieta", "mężczyzna")))' },
      { name: 'labels in the other order', expect: 'swapped',
        code: 'ankieta$plec <- factor(ankieta$plec, levels = c("K", "M"), labels = c("mężczyzna", "kobieta"))\ntable(ankieta$plec)' },
      { name: 'a level in lower case', expect: 'lost',
        code: 'ankieta$plec <- factor(ankieta$plec, levels = c("k", "M"), labels = c("kobieta", "mężczyzna"))\ntable(ankieta$plec)' },
    ],

    diagnose({ value, result }) {
      if (result?.reason === 'not-in-table') return 'inTable';
      if (!value || !isAtomic(value)) return 'general';
      if (isFactor(value)) return 'notTable';
      const names = (getNames(value)?.values || []).map(String);
      if (names.length) {
        if (names.join() === 'K,M') return 'codes';
        if (value.values.reduce((a, b) => a + b, 0) !== 8) return 'lost';
        if (names.join() === 'mężczyzna,kobieta') return 'swapped';
      }
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      return 'general';
    },
  },
};

export default factorTable;
