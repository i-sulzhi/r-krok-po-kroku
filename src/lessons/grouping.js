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

// For those who want more (D41): the groups are not a column of the survey yet.
// The student makes the column first, then groups by it. The NA of the main task is
// still there, in the older group.
const EXTRA = `ankieta |>
  mutate(starszy = wiek > 40) |>
  group_by(starszy) |>
  summarise(
    liczba = n(),
    srednia_ocena = mean(ocena, na.rm = TRUE)
  )`;

export const grouping = {
  id: 'grouping',
  module: 7,
  lecture: 2,
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

  extra: {
    prompt: 'Porównaj osoby **powyżej 40 lat** z resztą. Kolumna `starszy` (TRUE/FALSE), a dla obu grup `liczba` i `srednia_ocena`.',
    starter: 'ankieta |>\n  ',
    check: resultCheck({ expected: EXTRA, requireCalls: ['group_by', 'summarise'] }),
    solution: EXTRA,
    hints: [
      'Takiej grupy jeszcze nie ma w tabeli. Najpierw ją dodaj: `mutate(starszy = wiek > 40)`.',
      'Dalej jak w zadaniu: `group_by(starszy)` i `summarise()` z `n()` i `mean()`.',
      'W ocenach jest NA, więc `mean(ocena, na.rm = TRUE)`.',
    ],
    messages: {
      'missing.group_by': 'Podział na dwie grupy robi `group_by(starszy)`.',
      'missing.summarise': 'Brakuje `summarise()`, a to ona zwija grupy.',
      notATable: 'Wynikiem ma być tabela: jeden wiersz na grupę.',
      notCollapsed: 'Tabela ma wciąż dziesięć wierszy. Po `mutate()` dopisz `group_by()` i `summarise()`.',
      byCity: 'Grupy to miasta, a mają być dwie: osoby powyżej 40 lat i reszta.',
      oneGroup: 'Jest jeden wiersz, a grupy mają być dwie. `filter()` wyrzuca resztę. Tu potrzebna jest kolumna TRUE/FALSE.',
      noFlag: 'Brakuje kolumny `starszy`. Dodaj ją przez `mutate(starszy = wiek > 40)`.',
      missingColumn: 'Kolumny mają się nazywać `liczba` i `srednia_ocena`.',
      forgotNaRm: 'W `srednia_ocena` jest NA. Dopisz `na.rm = TRUE`.',
      wrongSplit: 'Grupy mają inną wielkość. Starsi to `wiek > 40`: cztery osoby z dziesięciu.',
      general: 'Jeszcze nie to: `mutate()`, potem `group_by(starszy)` i `summarise()`.',
    },
    success: 'Dobrze. Cztery osoby starsze, sześć młodszych.',
    note: 'Grupować można według kolumny, którą policzysz. Średnia starszych liczy się z trzech odpowiedzi.',

    nearMisses: [
      { name: 'grouped by city', expect: 'byCity',
        code: 'ankieta |> group_by(miasto) |> summarise(liczba = n(), srednia_ocena = mean(ocena, na.rm = TRUE))' },
      { name: 'filtered instead of grouping', expect: 'oneGroup',
        code: 'ankieta |> filter(wiek > 40) |> summarise(liczba = n(), srednia_ocena = mean(ocena, na.rm = TRUE))' },
      { name: 'forgot na.rm', expect: 'forgotNaRm',
        code: 'ankieta |> mutate(starszy = wiek > 40) |> group_by(starszy) |> summarise(liczba = n(), srednia_ocena = mean(ocena))' },
      { name: 'stopped after mutate', expect: 'notCollapsed',
        code: 'ankieta |> mutate(starszy = wiek > 40)' },
      { name: 'cut at another age', expect: 'wrongSplit',
        code: 'ankieta |> mutate(starszy = wiek > 50) |> group_by(starszy) |> summarise(liczba = n(), srednia_ocena = mean(ocena, na.rm = TRUE))' },
      { name: 'one number for the older group', expect: 'notATable',
        code: 'mean(ankieta$ocena[ankieta$wiek > 40], na.rm = TRUE)' },
      { name: 'grouped by an unnamed condition', expect: 'noFlag',
        code: 'ankieta |> group_by(wiek > 40) |> summarise(liczba = n(), srednia_ocena = mean(ocena, na.rm = TRUE))' },
      { name: 'named the columns differently', expect: 'missingColumn',
        code: 'ankieta |> mutate(starszy = wiek > 40) |> group_by(starszy) |> summarise(n = n(), srednia = mean(ocena, na.rm = TRUE))' },
    ],

    diagnose({ value, result }) {
      if (!value || !isDataFrame(value)) return 'notATable';
      const names = (getNames(value)?.values || []).map(String);
      const rows = rLength(value.values[0] || { values: [] });
      if (rows === 10) return 'notCollapsed';
      if (names.includes('miasto')) return 'byCity';
      if (rows === 1) return 'oneGroup';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      if (!names.includes('starszy')) return 'noFlag';
      const liczba = column(value, 'liczba');
      const srednia = column(value, 'srednia_ocena');
      if (!liczba || !srednia) return 'missingColumn';
      if (srednia.values.some(isNA)) return 'forgotNaRm';
      if ([...liczba.values].sort().join() !== '4,6') return 'wrongSplit';
      return 'general';
    },
  },
};

export default grouping;
