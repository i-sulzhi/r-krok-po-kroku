/**
 * Lesson: select() -- module 7, syllabus topic 2.
 *
 * `select()` works on columns and never touches rows, and it ALWAYS returns a table
 * -- even for one column. That is where students lose an afternoon: `select(df, wiek)`
 * is a one-column table, not a vector. `pull()` comes in the same breath, because
 * the pair makes the difference visible: same column, two shapes.
 */

import { resultCheck } from './schema.js';
import { getNames, isDataFrame } from '../core/rvalue.js';

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

export const selecting = {
  id: 'selecting',
  module: 7,
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
};

export default selecting;
