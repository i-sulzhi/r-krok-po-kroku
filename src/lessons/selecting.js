/**
 * Lesson: select() -- module 7, syllabus topic 2.
 *
 * `select()` works on columns and never touches rows, and it ALWAYS returns a table
 * -- even for one column. That is where students lose an afternoon: `select(df, wiek)`
 * is a one-column table, not a vector. `pull()` comes in the same breath, because
 * the pair makes the difference visible: same column, two shapes.
 */

import { resultCheck } from './schema.js';
import { rLength, getNames, isDataFrame } from '../core/rvalue.js';

const SETUP = `# Sześć osób, sześć pytań
ankieta <- data.frame(
  id = 1:6,
  plec = c("K", "M", "K", "M", "K", "M"),
  wiek = c(23, 34, 45, 29, 51, 38),
  miasto = c("Kraków", "Warszawa", "Kraków", "Gdańsk", "Warszawa", "Kraków"),
  wyksztalcenie = c("wyższe", "średnie", "wyższe", "wyższe", "średnie", "średnie"),
  ocena = c(4, 5, 3, 5, 2, 4)
)`;

const SOLUTION = `ankieta |>
  select(miasto, ocena)`;

/** Column names of a table result, or null when it is not a table. */
const namesOf = (v) => (v && isDataFrame(v) ? (getNames(v)?.values || []).map(String) : null);

// For those who want more (D41): rows and columns in one chain, where the order of
// the two steps decides whether the code runs at all.
const EXTRA = `ankieta |>
  filter(ocena >= 4) |>
  select(miasto, wiek)`;

export const selecting = {
  id: 'selecting',
  module: 7,
  lecture: 2,
  requires: ['filtering'],
  title: 'select(): wybieranie kolumn',
  setup: SETUP,

  scenes: [
    // Before any code (D29): the question, and the table before and after.
    {
      say: 'Tu pytanie wybiera **kolumny**. Wszystkie osoby zostają.',
      picture: { kind: 'verb', question: 'Do raportu potrzebne są tylko wiek i płeć.', code: 'ankieta |> select(wiek, plec)' },
    },
    {
      say: '`select()` zostawia **kolumny**. Wiersze zostają nietknięte.',
      code: 'ankieta |>\n  select(wiek, plec)',
      pick: 'ankieta |>\n  select(wiek, plec)',
    },
    {
      say: 'Minus przed nazwą **usuwa** kolumnę.',
      code: 'ankieta |>\n  select(-id, -plec)',
      pick: 'ankieta |>\n  select(-id, -plec)',
    },
    {
      say: 'Jedna kolumna? To **nadal tabela**, nie wektor.',
      code: 'ankieta |>\n  select(wiek)',
      pick: 'ankieta |>\n  select(wiek)',
    },
    {
      say: '`pull()` wyjmuje kolumnę jako **wektor**.',
      code: 'ankieta |>\n  pull(wiek)',
      pick: 'ankieta |>\n  pull(wiek)',
    },
  ],

  play: {
    code: 'ankieta |>\n  select(wiek)',
    chips: [
      'ankieta |> pull(wiek) |> mean()',
      'ankieta |> select(wiek, miasto, id)',
      'ankieta |> rename(wiek_lat = wiek)',
      'ankieta |> select(wiek) |> nrow()',
    ],
  },

  task: {
    prompt: 'Zostaw w tabeli **tylko miasto i ocenę**.',
    starter: 'ankieta |>\n  ',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['select'] }),
    solution: SOLUTION,
    hints: [
      '`ankieta |> select(...)`, w środku nazwy kolumn po przecinku, bez cudzysłowów.',
      'Potrzebne są dwie kolumny naraz: `miasto` i `ocena`.',
    ],
    messages: {
      'missing.select': 'Zadanie jest o `select()`.',
      gotVector: 'To wektor, a nie tabela. `pull()` i `$` wyjmują kolumnę; `select()` zostawia ją w tabeli.',
      nothingDropped: 'Za dużo kolumn, a mają zostać dwie. Wypisz wprost te, które zostają.',
      wrongColumnCount: 'Kolumny mają być dwie: `miasto` i `ocena`.',
      wrongColumns: 'Dwie kolumny, ale nie te. Potrzebne są `miasto` i `ocena`.',
      general: 'Jeszcze nie to: `ankieta |> select(miasto, ocena)`.',
    },
    success: 'Dobrze. Dwie kolumny, wszystkie sześć wierszy.',
    note: '`select()` zwęża tabelę, `filter()` ją skraca. Tu wierszy jest wciąż sześć.',

    nearMisses: [
      { name: 'pulled the column out as a vector', expect: 'gotVector',
        code: 'ankieta |> pull(ocena)' },
      { name: 'used the dollar sign', expect: 'gotVector',
        code: 'ankieta$ocena' },
      { name: 'dropped only the id', expect: 'nothingDropped',
        code: 'ankieta |> select(-id)' },
      { name: 'kept just one of the two columns', expect: 'wrongColumnCount',
        code: 'ankieta |> select(miasto)' },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      const names = namesOf(value);
      // Not a table at all: the column came out as a bare vector.
      if (!names) return 'gotVector';
      if (names.length > 4) return 'nothingDropped';
      if (names.length !== 2) return 'wrongColumnCount';
      if (!names.includes('miasto') || !names.includes('ocena')) return 'wrongColumns';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      return 'general';
    },
  },

  extra: {
    prompt: 'Osoby z oceną **co najmniej 4**. W tabeli mają zostać tylko `miasto` i `wiek`.',
    starter: 'ankieta |>\n  ',
    check: resultCheck({ expected: EXTRA, requireCalls: ['filter', 'select'] }),
    solution: EXTRA,
    hints: [
      'Dwa kroki w potoku: jeden wybiera wiersze, drugi kolumny.',
      'Kolejność ma znaczenie. Po `select(miasto, wiek)` kolumny `ocena` już nie ma.',
    ],
    messages: {
      'missing.filter': 'Wiersze wybiera `filter()`.',
      'missing.select': 'Kolumny wybiera `select()`.',
      gotVector: 'To wektor, a ma być tabela z dwiema kolumnami.',
      extraColumns: 'Za dużo kolumn. Mają zostać tylko `miasto` i `wiek`.',
      wrongColumns: 'Dwie kolumny, ale nie te. Potrzebne są `miasto` i `wiek`.',
      allRows: 'Kolumny dobre, ale zostało wszystkie sześć osób. Najpierw `filter(ocena >= 4)`.',
      wrongRows: 'Liczba wierszy się nie zgadza. „Co najmniej 4” to `ocena >= 4`, więc czwórki też zostają.',
      general: 'Jeszcze nie to: najpierw `filter()`, potem `select()`.',
    },
    success: 'Dobrze. Cztery osoby, dwie kolumny.',
    note: 'W wyniku nie ma kolumny `ocena`, choć to ona wybrała wiersze. Dlatego `filter()` stoi pierwszy.',

    nearMisses: [
      // The trap of the task: the column the condition needs is already gone.
      { name: 'selected before filtering', expect: 'error',
        code: 'ankieta |> select(miasto, wiek) |> filter(ocena >= 4)' },
      { name: 'never filtered', expect: 'allRows', code: 'ankieta |> select(miasto, wiek)' },
      { name: 'kept the rating too', expect: 'extraColumns',
        code: 'ankieta |> filter(ocena >= 4) |> select(miasto, wiek, ocena)' },
      { name: 'left the fours out', expect: 'wrongRows',
        code: 'ankieta |> filter(ocena > 4) |> select(miasto, wiek)' },
      { name: 'pulled one column out', expect: 'gotVector',
        code: 'ankieta |> filter(ocena >= 4) |> pull(miasto)' },
      { name: 'kept the rating instead of the age', expect: 'wrongColumns',
        code: 'ankieta |> filter(ocena >= 4) |> select(miasto, ocena)' },
      { name: 'used base R brackets', expect: 'missing.filter',
        code: 'ankieta[ankieta$ocena >= 4, c("miasto", "wiek")]' },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      const names = namesOf(value);
      if (!names) return 'gotVector';
      if (names.length > 2) return 'extraColumns';
      if (!names.includes('miasto') || !names.includes('wiek')) return 'wrongColumns';
      const rows = rLength(value.values[0]);
      if (rows === 6) return 'allRows';
      if (rows !== 4) return 'wrongRows';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      return 'general';
    },
  },
};

export default selecting;
