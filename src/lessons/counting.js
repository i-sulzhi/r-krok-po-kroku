/**
 * Lesson: n(), count(), and whether the numbers add up -- module 7, syllabus topic 2.
 *
 * `count()` is `group_by()` + `n()` in one word, and `n()` counts ROWS, not answers:
 * a respondent who skipped the question is still a row. The last scene counts the
 * gaps per group with `sum(is.na(ocena))` -- its funnel shows TRUE cells being
 * counted -- and the task asks for the complement, the real number of answers.
 *
 * This closes the missing-data thread of the course: missing -> filtering ->
 * arranging -> counting.
 */

import { resultCheck } from './schema.js';
import { rLength, getNames, isNA, isDataFrame } from '../core/rvalue.js';

const SETUP = `# Dziesięciu respondentów z trzech miast; dwie osoby nie podały oceny
ankieta <- data.frame(
  id = 1:10,
  miasto = c("Kraków", "Warszawa", "Kraków", "Gdańsk", "Warszawa",
             "Kraków", "Gdańsk", "Warszawa", "Kraków", "Gdańsk"),
  ocena = c(4, 5, 3, 4, NA, 5, 4, NA, 3, 5)
)`;

const SOLUTION = `ankieta |>
  group_by(miasto) |>
  summarise(
    respondentow = n(),
    odpowiedzi = sum(!is.na(ocena))
  )`;

const column = (value, name) => {
  const names = (getNames(value)?.values || []).map(String);
  const at = names.indexOf(name);
  return at === -1 ? null : value.values[at];
};

const total = (col) => col.values.reduce((a, b) => (isNA(b) ? a : a + b), 0);

const LONG = `ankieta |>
  group_by(miasto) |>
  summarise(n = n())`;

const GAPS = `ankieta |>
  group_by(miasto) |>
  summarise(n = n(), braki = sum(is.na(ocena)))`;

// For those who want more (D41): three verbs in a row. Without the filter Warszawa
// has 3 and ties with Gdańsk; with it, it has 1 and falls to the bottom.
const EXTRA = `ankieta |>
  filter(!is.na(ocena)) |>
  count(miasto) |>
  arrange(desc(n))`;

export const counting = {
  id: 'counting',
  module: 7,
  lecture: 2,
  requires: ['grouping'],
  title: 'Liczenie: n() i count()',
  setup: SETUP,

  scenes: [
    // Before any code (D29): the question, and the table before and after.
    {
      say: 'Każde miasto to grupa. Odpowiedzią jest **liczba wierszy** w grupie.',
      picture: { kind: 'verb', question: 'Ilu respondentów jest z każdego miasta?', code: 'ankieta |> count(miasto)' },
    },
    {
      say: '`count()` liczy **wiersze w każdej grupie**.',
      code: 'ankieta |>\n  count(miasto)',
      pick: 'ankieta |>\n  count(miasto)',
    },
    {
      say: 'To samo, co `group_by()` + `n()`, tylko krócej.',
      code: LONG,
      pick: LONG,
      tap: 'n()',
    },
    {
      say: '`n()` liczy **wiersze, nie odpowiedzi**. Braki też są wierszami.',
      code: GAPS,
      pick: GAPS,
      tap: 'sum(is.na(ocena))',
    },
  ],

  play: {
    code: 'ankieta |>\n  count(miasto)',
    chips: [
      'ankieta |> count(miasto) |> summarise(razem = sum(n))',
      'nrow(ankieta)',
      'ankieta |> filter(!is.na(ocena)) |> count(miasto)',
      'ankieta |> count(miasto, ocena)',
    ],
  },

  task: {
    prompt: 'Dla każdego miasta: ilu było respondentów (**respondentow**) i ile odpowiedzi na pytanie o ocenę (**odpowiedzi**).',
    starter: 'ankieta |>\n  ',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['group_by', 'n'] }),
    solution: SOLUTION,
    hints: [
      'Podział na miasta, a potem w `summarise()` dwie kolumny, po przecinku.',
      '`n()` liczy wiersze. Odpowiedzi: `!is.na(ocena)` daje TRUE/FALSE, a `sum()` liczy TRUE.',
    ],
    messages: {
      'missing.group_by': 'Bez `group_by()` liczby dotyczą całej ankiety.',
      'missing.n': 'Liczbę wierszy w grupie daje `n()`.',
      notATable: 'Wynikiem ma być tabela: jeden wiersz na miasto.',
      noGrouping: 'Jeden wiersz dla całej ankiety, bo brakuje `group_by(miasto)`.',
      wrongRows: 'Miasta są trzy, więc wiersze też trzy.',
      missingColumn: 'Kolumny mają się nazywać `respondentow` i `odpowiedzi`.',
      notRespondents: '`respondentow` nie sumuje się do 10. `n()` nie omija nikogo.',
      countedRows: 'Obie kolumny są takie same: `n()` nie odróżnia braku od odpowiedzi. Odpowiedzi to `sum(!is.na(ocena))`.',
      notCounts: 'Druga kolumna to suma ocen, a nie liczba odpowiedzi: `sum(!is.na(ocena))`.',
      general: 'Jeszcze nie to: `n()` oraz `sum(!is.na(ocena))` w grupach miast.',
    },
    success: 'Dobrze. 10 respondentów, 8 odpowiedzi.',
    note: 'Warszawa: trzech respondentów, jedna odpowiedź. Średnia obok byłaby opinią jednej osoby.',

    nearMisses: [
      { name: 'forgot to group', expect: 'noGrouping',
        code: 'ankieta |> summarise(respondentow = n(), odpowiedzi = sum(!is.na(ocena)))' },
      { name: 'counted rows twice', expect: 'countedRows',
        code: 'ankieta |> group_by(miasto) |> summarise(respondentow = n(), odpowiedzi = n())' },
      { name: 'added up the ratings instead of counting them', expect: 'notCounts',
        code: 'ankieta |> group_by(miasto) |> summarise(respondentow = n(), odpowiedzi = sum(ocena, na.rm = TRUE))' },
      { name: 'stopped at count()', expect: 'missingColumn',
        code: 'ankieta |> count(miasto)' },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      if (!isDataFrame(value)) {
        return result?.reason === 'missing-call' ? `missing.${result.detail.name}` : 'notATable';
      }
      const rows = value.values.length ? rLength(value.values[0]) : 0;
      if (rows === 1) return 'noGrouping';
      if (rows !== 3) return 'wrongRows';
      const respondents = column(value, 'respondentow');
      const answers = column(value, 'odpowiedzi');
      if (!respondents || !answers) return 'missingColumn';
      if (total(respondents) !== 10) return 'notRespondents';
      // Ten answers would mean the missing two were counted as if they had replied.
      if (total(answers) === 10) return 'countedRows';
      if (total(answers) !== 8) return 'notCounts';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      return 'general';
    },
  },

  extra: {
    prompt: 'Ile **odpowiedzi** na pytanie o ocenę jest z każdego miasta? Miasto z największą liczbą na górze.',
    starter: 'ankieta |>\n  ',
    // No required call: `group_by()` with `sum(!is.na(ocena))` and `count(sort = TRUE)`
    // are the same answer.
    check: resultCheck({ expected: EXTRA }),
    solution: EXTRA,
    hints: [
      'Odpowiedź to wiersz bez NA. Najpierw `filter(!is.na(ocena))`, potem `count(miasto)`.',
      '`count()` nazywa swoją kolumnę `n`. Według niej sortujesz: `arrange(desc(n))`.',
    ],
    messages: {
      notATable: 'Wynikiem ma być tabela: jeden wiersz na miasto.',
      wrongRows: 'Miasta są trzy, więc wiersze też trzy.',
      noN: 'Kolumna z liczbami ma się nazywać `n`. Tak nazywa ją `count()`.',
      countedRows: 'To liczba respondentów, razem 10. Odpowiedzi jest 8, bo dwie osoby nie podały oceny.',
      notCounts: 'Kolumna `n` nie sumuje się do 8 odpowiedzi.',
      notSorted: 'Liczby są dobre, ale największa nie jest na górze. Dopisz `arrange(desc(n))`.',
      general: 'Jeszcze nie to: `filter()`, `count(miasto)` i `arrange(desc(n))`.',
    },
    success: 'Dobrze. Kraków 4, Gdańsk 3, Warszawa 1.',
    note: 'Bez `filter()` Warszawa miałaby 3 i stała obok Gdańska. Jeden krok zmienia kolejność miast.',

    nearMisses: [
      { name: 'counted respondents', expect: 'countedRows',
        code: 'ankieta |> count(miasto) |> arrange(desc(n))' },
      { name: 'forgot to sort', expect: 'notSorted',
        code: 'ankieta |> filter(!is.na(ocena)) |> count(miasto)' },
      { name: 'sorted ascending', expect: 'notSorted',
        code: 'ankieta |> filter(!is.na(ocena)) |> count(miasto) |> arrange(n)' },
      { name: 'named the count differently', expect: 'noN',
        code: 'ankieta |> group_by(miasto) |> summarise(odpowiedzi = sum(!is.na(ocena))) |> arrange(desc(odpowiedzi))' },
      { name: 'one number for the whole survey', expect: 'notATable', code: 'sum(!is.na(ankieta$ocena))' },
      { name: 'forgot the cities', expect: 'wrongRows',
        code: 'ankieta |> summarise(n = sum(!is.na(ocena)))' },
      { name: 'added up the ratings', expect: 'notCounts',
        code: 'ankieta |> group_by(miasto) |> summarise(n = sum(ocena, na.rm = TRUE)) |> arrange(desc(n))' },
    ],

    diagnose({ value }) {
      if (!value) return 'general';
      if (!isDataFrame(value)) return 'notATable';
      const rows = value.values.length ? rLength(value.values[0]) : 0;
      if (rows !== 3) return 'wrongRows';
      const n = column(value, 'n');
      if (!n) return 'noN';
      if (total(n) === 10) return 'countedRows';
      if (total(n) !== 8) return 'notCounts';
      if (n.values.some((v, i) => i > 0 && n.values[i - 1] < v)) return 'notSorted';
      return 'general';
    },
  },
};

export default counting;
