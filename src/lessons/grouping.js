/**
 * Lesson: group_by() + summarise() -- module 7, syllabus topic 2.
 *
 * Grouping is invisible in RStudio: the printed table barely changes. Here it is two
 * pictures -- the split into coloured blocks, and each block collapsing to one row --
 * plus the fact that clicking `mean(wiek)` makes visible: it was computed THREE
 * times, once per group, each time on a different slice of the column.
 */

import { resultCheck, callsFunction } from './schema.js';
import { rLength, getNames, isNA, isDataFrame } from '../core/rvalue.js';

const SETUP = `# Dziesięć osób z trzech miast; jedna nie podała oceny
ankieta <- data.frame(
  id = 1:10,
  miasto = c("Kraków", "Warszawa", "Kraków", "Gdańsk", "Warszawa",
             "Kraków", "Gdańsk", "Warszawa", "Kraków", "Gdańsk"),
  wiek = c(23, 34, 45, 29, 51, 38, 27, 42, 19, 60),
  ocena = c(4, 5, 3, 4, 2, 5, 4, NA, 3, 5)
)`;

const SOLUTION = `ankieta |>
  group_by(miasto) |>
  summarise(
    liczba = n(),
    srednia_ocena = mean(ocena, na.rm = TRUE)
  )`;

/** Column of the student's result, by name; null when absent. */
function column(value, name) {
  if (!value || !isDataFrame(value)) return null;
  const names = (getNames(value)?.values || []).map(String);
  const at = names.indexOf(name);
  return at === -1 ? null : value.values[at];
}

const GROUPED = `ankieta |>
  group_by(miasto) |>
  summarise(sredni_wiek = mean(wiek))`;

export const grouping = {
  id: 'grouping',
  module: 7,
  requires: ['tables'],
  title: 'group_by() i summarise()',
  setup: SETUP,

  scenes: [
    // Before any code (D29): the question, and the table before and after.
    {
      say: 'Dwa kroki: wiersze zbierają się w **grupy**, a grupa zwija się do jednego wiersza.',
      picture: { kind: 'verb', question: 'Jaki jest średni wiek w każdym mieście?', code: 'ankieta |> group_by(miasto) |> summarise(sredni_wiek = mean(wiek))' },
    },
    {
      say: '`summarise()` zwija całą tabelę do **jednego wiersza**.',
      code: 'ankieta |>\n  summarise(sredni_wiek = mean(wiek))',
      pick: 'ankieta |>\n  summarise(sredni_wiek = mean(wiek))',
    },
    {
      say: '`group_by()` dzieli tabelę na grupy. **Niczego nie liczy.**',
      code: 'ankieta |>\n  group_by(miasto)',
      pick: 'ankieta |>\n  group_by(miasto)',
    },
    {
      say: 'Razem: `mean(wiek)` liczy się **osobno w każdej grupie**. Kliknij je.',
      code: GROUPED,
      pick: GROUPED,
      tap: 'mean(wiek)',
    },
  ],

  play: {
    code: GROUPED,
    chips: [
      'ankieta |> group_by(miasto) |> summarise(najstarszy = max(wiek))',
      'ankieta |> group_by(miasto) |> summarise(ile = n())',
      'ankieta |> group_by(ocena) |> summarise(ile = n())',
    ],
  },

  task: {
    prompt: 'Dla każdego miasta policz: ilu było respondentów (**liczba**) i średnią ocenę (**srednia_ocena**). Uwaga na NA.',
    starter: 'ankieta |>\n  ',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['group_by', 'summarise'] }),
    solution: SOLUTION,
    hints: [
      'Najpierw `group_by(miasto)`, potem `summarise(nazwa = wyrażenie, ...)`.',
      'Liczbę wierszy w grupie daje `n()`, a średnią `mean()`.',
      'NA w średniej? Dopisz `na.rm = TRUE`.',
    ],
    messages: {
      'missing.group_by': 'Liczby dobre, ale policzone miasto po mieście. Użyj `group_by(miasto)`.',
      'missing.summarise': 'Brakuje `summarise()`, a to ona zwija grupy.',
      notATable: 'Wynikiem ma być tabela: jeden wiersz na miasto.',
      noGrouping: 'Jeden wiersz zamiast trzech, bo brakuje `group_by(miasto)`.',
      forgotNaRm: 'W `srednia_ocena` jest NA. Dopisz `na.rm = TRUE`.',
      naRmOutside: '`na.rm = TRUE` stoi poza `mean()`, więc `summarise()` zrobił z niego kolumnę. Przenieś je do środka `mean()`.',
      missingCount: 'Brakuje kolumny `liczba`. Daje ją `n()`.',
      missingMean: 'Brakuje kolumny `srednia_ocena`.',
      general: 'Jeszcze nie to. Sprawdź nazwy kolumn i grupowanie po `miasto`.',
    },
    success: 'Dobrze. Trzy miasta, trzy wiersze.',
    note: 'W Warszawie średnia liczy się z dwóch odpowiedzi, choć respondentów było trzech.',

    // Wrong-but-plausible answers, each with the diagnosis it must produce.
    nearMisses: [
      { name: 'forgot group_by', expect: 'noGrouping',
        code: 'ankieta |> summarise(liczba = n(), srednia_ocena = mean(ocena, na.rm = TRUE))' },
      { name: 'forgot na.rm', expect: 'forgotNaRm',
        code: 'ankieta |> group_by(miasto) |> summarise(liczba = n(), srednia_ocena = mean(ocena))' },
      // Found in the 2026-09 student walk: one bracket too early, and summarise()
      // quietly turns the argument into a column of TRUEs.
      { name: 'na.rm outside mean()', expect: 'naRmOutside',
        code: 'ankieta |> group_by(miasto) |> summarise(liczba = n(), srednia_ocena = mean(ocena), na.rm = TRUE)' },
      { name: 'no count column', expect: 'missingCount',
        code: 'ankieta |> group_by(miasto) |> summarise(srednia_ocena = mean(ocena, na.rm = TRUE))' },
      { name: 'no mean column', expect: 'missingMean',
        code: 'ankieta |> group_by(miasto) |> summarise(liczba = n())' },
      { name: 'city by city instead of grouping', expect: 'missing.group_by',
        code: 'data.frame(miasto = c("Gdańsk","Kraków","Warszawa"), liczba = c(3,4,3), '
          + 'srednia_ocena = c(mean(ankieta$ocena[ankieta$miasto == "Gdańsk"], na.rm = TRUE), '
          + 'mean(ankieta$ocena[ankieta$miasto == "Kraków"], na.rm = TRUE), '
          + 'mean(ankieta$ocena[ankieta$miasto == "Warszawa"], na.rm = TRUE)))' },
    ],

    /**
     * Order matters. Explaining the SYMPTOM ("one row instead of three") teaches
     * more than reporting the missing call, so the shape is examined first. The
     * "missing call" message is reserved for numbers that are right but were
     * obtained city by city -- a method that stops scaling.
     */
    diagnose({ value, code, result }) {
      if (!value || !isDataFrame(value)) return 'notATable';
      const names = (getNames(value)?.values || []).map(String);
      const rows = rLength(value.values[0] || { values: [] });
      if (rows === 1 && !callsFunction(code, 'group_by')) return 'noGrouping';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      if (names.includes('na.rm')) return 'naRmOutside';
      const ocena = column(value, 'srednia_ocena');
      if (ocena && ocena.values.some(isNA)) return 'forgotNaRm';
      if (!names.includes('liczba')) return 'missingCount';
      if (!names.includes('srednia_ocena')) return 'missingMean';
      return 'general';
    },
  },
};

export default grouping;
