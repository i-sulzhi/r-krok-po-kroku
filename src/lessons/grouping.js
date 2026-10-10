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

// `godziny` answers "Ile godzin dziennie spędzasz w internecie?". With `plec` it gives
// the scenes a second and a third question to ask of the same table (D42).
const SETUP = `# Dziesięć osób z trzech miast; jedna nie podała oceny
ankieta <- data.frame(
  id = 1:10,
  plec = c("K", "M", "K", "K", "M", "M", "K", "M", "K", "M"),
  miasto = c("Kraków", "Warszawa", "Kraków", "Gdańsk", "Warszawa",
             "Kraków", "Gdańsk", "Warszawa", "Kraków", "Gdańsk"),
  wiek = c(23, 34, 45, 29, 51, 38, 27, 42, 19, 60),
  godziny = c(5, 3, 2, 4, 1, 3, 6, 2, 7, 1),
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

// The same two lines with another group and another column: another question.
const BY_SEX = `ankieta |>
  group_by(plec) |>
  summarise(srednio_godzin = mean(godziny))`;

// What a report prints: how many people stand behind each number, and the number.
const REPORT = `ankieta |>
  group_by(miasto) |>
  summarise(
    osob = n(),
    srednio_godzin = mean(godziny),
    najwiecej = max(godziny)
  )`;

// For those who want more (D44): the task that tells group_by() from arrange().
// Both "put the cities together" in a student's head. One decides what is computed
// together, the other in what order the rows stand. The answer needs both, each for
// its own job: group and summarise first, sort the result last. The three orders a
// wrong answer can come in (alphabetical, ascending, by name) are all different
// from the right one on this data.
const EXTRA = `ankieta |>
  group_by(miasto) |>
  summarise(sredni_wiek = mean(wiek)) |>
  arrange(desc(sredni_wiek))`;

/** Where a call first stands in the code; -1 when it is not there. */
const at = (code, name) => String(code || '').search(new RegExp(`\\b${name}\\s*\\(`));

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
    // Two more questions a survey report really asks (D42). The pattern stays; only
    // the group and the column change.
    {
      say: 'Inne pytanie, ten sam wzór: kto dłużej siedzi w sieci? Zmieniasz **grupę** i **kolumnę**.',
      code: BY_SEX,
      pick: BY_SEX,
      tap: 'group_by(plec)',
    },
    {
      say: 'Kilka podsumowań naraz, po przecinku. Tak powstaje **tabela do raportu**.',
      code: REPORT,
      pick: REPORT,
      tap: 'n()',
    },
  ],

  play: {
    say: 'Twoja kolej. Każdy wariant to **inne pytanie do ankiety**. Zmień grupę albo funkcję.',
    code: GROUPED,
    // Each chip is a question someone asks of a survey: the oldest person, the
    // typical age, the range, the share of satisfied people, the young against the rest.
    // The last two stand arrange() beside group_by() (D44).
    chips: [
      'ankieta |> group_by(miasto) |> summarise(najstarszy = max(wiek))',
      'ankieta |> group_by(plec) |> summarise(mediana_wieku = median(wiek))',
      'ankieta |> group_by(miasto) |> summarise(od = min(wiek), do = max(wiek))',
      'ankieta |> group_by(miasto) |> summarise(zadowoleni = mean(ocena >= 4, na.rm = TRUE))',
      'ankieta |> group_by(mlodzi = wiek < 30) |> summarise(godzin = mean(godziny))',
      'ankieta |> group_by(ocena) |> summarise(ile = n())',
      // arrange() puts the cities side by side; summarise() after it still sees one table.
      'ankieta |> arrange(miasto)',
      'ankieta |> arrange(miasto) |> summarise(sredni_wiek = mean(wiek))',
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
    prompt: 'Średni wiek w każdym mieście (**sredni_wiek**). Miasto z **najstarszymi** respondentami na górze.',
    starter: 'ankieta |>\n  ',
    check: resultCheck({ expected: EXTRA, requireCalls: ['group_by', 'summarise', 'arrange'] }),
    solution: EXTRA,
    hints: [
      '`group_by()` decyduje, **co liczy się razem**. `arrange()` decyduje, **w jakiej kolejności** stoją wiersze.',
      'Najpierw policz: `group_by(miasto)` i `summarise()`. Wynik ułóż na końcu.',
      'Ostatni krok: `arrange(desc(sredni_wiek))`.',
    ],
    messages: {
      'missing.group_by': 'Średnia ma być osobno dla każdego miasta. To robi `group_by(miasto)`, nie `arrange()`.',
      'missing.summarise': 'Brakuje `summarise()`, a to ona liczy średnią w grupach.',
      'missing.arrange': 'Brakuje ostatniego kroku. Kolejność wierszy ustawia `arrange()`.',
      notATable: 'Wynikiem ma być tabela: jeden wiersz na miasto.',
      sortedNotGrouped: 'Jeden wiersz. `arrange()` ustawił miasta obok siebie, ale to nie są grupy. Grupy robi `group_by(miasto)`.',
      noGrouping: 'Jeden wiersz zamiast trzech, bo brakuje `group_by(miasto)`.',
      notCollapsed: 'Wciąż dziesięć wierszy. `group_by()` i `arrange()` niczego nie liczą. Średnią policzy `summarise()`.',
      wrongName: 'Kolumna ze średnią ma się nazywać `sredni_wiek`.',
      sortedTooEarly: 'Sortowanie sprzed `summarise()` zniknęło i miasta stoją alfabetycznie. `arrange()` idzie na koniec.',
      notSorted: 'Średnie dobre, ale miasta stoją alfabetycznie. `group_by()` nie układa według wyniku. Dopisz `arrange()`.',
      ascending: 'Kolejność jest odwrotna. Najstarsze miasto ma być na górze: `arrange(desc(sredni_wiek))`.',
      byName: 'Ułożone według nazwy miasta, a ma być według średniej: `arrange(desc(sredni_wiek))`.',
      general: 'Jeszcze nie to: `group_by(miasto)`, `summarise()`, a na końcu `arrange()`.',
    },
    success: 'Dobrze. Warszawa na górze, średnio 42 lata.',
    note: '`arrange(miasto)` też stawia miasta obok siebie, ale nic nie liczy. Liczy `group_by()` z `summarise()`.',

    nearMisses: [
      // The confusion the task is for: rows of one city stand together, so it looks grouped.
      { name: 'sorted by city instead of grouping', expect: 'sortedNotGrouped',
        code: 'ankieta |> arrange(miasto) |> summarise(sredni_wiek = mean(wiek))' },
      { name: 'forgot to group, sorted the one row', expect: 'sortedNotGrouped',
        code: 'ankieta |> summarise(sredni_wiek = mean(wiek)) |> arrange(desc(sredni_wiek))' },
      { name: 'summarised without groups', expect: 'noGrouping',
        code: 'ankieta |> summarise(sredni_wiek = mean(wiek))' },
      { name: 'grouped and sorted, never summarised', expect: 'notCollapsed',
        code: 'ankieta |> group_by(miasto) |> arrange(desc(wiek))' },
      { name: 'sorted before summarising', expect: 'sortedTooEarly',
        code: 'ankieta |> arrange(desc(wiek)) |> group_by(miasto) |> summarise(sredni_wiek = mean(wiek))' },
      { name: 'left the result as group_by gives it', expect: 'notSorted',
        code: 'ankieta |> group_by(miasto) |> summarise(sredni_wiek = mean(wiek))' },
      { name: 'sorted ascending', expect: 'ascending',
        code: 'ankieta |> group_by(miasto) |> summarise(sredni_wiek = mean(wiek)) |> arrange(sredni_wiek)' },
      { name: 'sorted by the name of the city', expect: 'byName',
        code: 'ankieta |> group_by(miasto) |> summarise(sredni_wiek = mean(wiek)) |> arrange(desc(miasto))' },
      { name: 'named the mean differently', expect: 'wrongName',
        code: 'ankieta |> group_by(miasto) |> summarise(srednia = mean(wiek)) |> arrange(desc(srednia))' },
      { name: 'typed the table city by city', expect: 'missing.group_by',
        code: 'data.frame(miasto = c("Warszawa", "Gdańsk", "Kraków"), sredni_wiek = c('
          + 'mean(ankieta$wiek[ankieta$miasto == "Warszawa"]), mean(ankieta$wiek[ankieta$miasto == "Gdańsk"]), '
          + 'mean(ankieta$wiek[ankieta$miasto == "Kraków"])))' },
      { name: 'pulled the means out', expect: 'notATable',
        code: 'ankieta |> group_by(miasto) |> summarise(sredni_wiek = mean(wiek)) |> arrange(desc(sredni_wiek)) |> pull(sredni_wiek)' },
    ],

    diagnose({ value, code, result }) {
      if (!value || !isDataFrame(value)) return 'notATable';
      const rows = rLength(value.values[0] || { values: [] });
      if (rows === 10) return 'notCollapsed';
      if (rows === 1) return callsFunction(code, 'arrange') ? 'sortedNotGrouped' : 'noGrouping';
      const mean = column(value, 'sredni_wiek');
      const city = column(value, 'miasto');
      if (!mean || !city) return result?.reason === 'missing-call' ? `missing.${result.detail.name}` : 'wrongName';
      // Three rows with the right means: what is left to tell apart is their order.
      const order = city.values.join();
      if (order === 'Gdańsk,Kraków,Warszawa') {
        const early = at(code, 'arrange') !== -1 && at(code, 'arrange') < at(code, 'summarise');
        return early ? 'sortedTooEarly' : 'notSorted';
      }
      if (order === 'Warszawa,Kraków,Gdańsk') return 'byName';
      if (mean.values.every((v, i) => i === 0 || mean.values[i - 1] <= v)) return 'ascending';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      return 'general';
    },
  },
};

export default grouping;
