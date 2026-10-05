/**
 * Lesson: filter() and the pipe -- module 7, syllabus topic 2.
 *
 * The same row selection as `ankieta[ankieta$wiek > 40, ]`, in one word -- and with
 * one difference a student must know from day one: a row whose condition is NA is
 * dropped silently. The filter picture shows the TRUE/FALSE/NA behind every row; the
 * condition itself is clickable, and it is the mask from lesson 5.
 *
 * The pipe is introduced as a way to read two steps in order (D30). With one verb
 * `x |> f()` and `f(x)` are the same call and look the same on the stage, so the
 * lesson nests two functions first and then writes the same chain with `|>`.
 */

import { resultCheck } from './schema.js';
import { rLength, isDataFrame, isAtomic, isNA, getNames } from '../core/rvalue.js';

const SETUP = `# Ankieta; jedna osoba nie odpowiedziała na pytanie o ocenę
ankieta <- data.frame(
  id = 1:8,
  plec = c("K", "M", "K", "K", "M", "M", "K", "M"),
  wiek = c(23, 34, 45, 29, 51, 38, 27, 42),
  ocena = c(4, 5, 3, 5, NA, 4, 5, 3)
)`;

const SOLUTION = `ankieta |>
  filter(ocena > 3)`;

export const filtering = {
  id: 'filtering',
  module: 7,
  lecture: 2,
  requires: ['tables'],
  title: 'filter() i potok |>',
  setup: SETUP,

  scenes: [
    // Before any code (D29): the question, and the table before and after.
    {
      say: 'Pytanie wybiera **wiersze**: zostają osoby, które spełniają warunek.',
      picture: { kind: 'verb', question: 'Kto ma więcej niż 40 lat?', code: 'ankieta |> filter(wiek > 40)' },
    },
    {
      say: '`filter()` zostawia wiersze z **TRUE**. Kolumnę pisze się bez `ankieta$`.',
      code: 'filter(ankieta, wiek > 40)',
      pick: 'filter(ankieta, wiek > 40)',
      tap: 'wiek > 40',
    },
    // The pipe earns its place only with two steps (D30): first the nest, read inside
    // out, then the same chain read left to right. The result is the same on purpose.
    {
      say: 'Ile osób? Jedna funkcja w drugiej. R zaczyna **od środka**, więc czytasz od końca.',
      code: 'nrow(filter(ankieta, wiek > 40))',
      pick: 'nrow(filter(ankieta, wiek > 40))',
      tap: 'filter(ankieta, wiek > 40)',
    },
    {
      say: 'Potok `|>` daje **ten sam wynik**. Czytasz od lewej: weź ankietę, odfiltruj, policz.',
      code: 'ankieta |>\n  filter(wiek > 40) |>\n  nrow()',
      pick: 'ankieta |>\n  filter(wiek > 40) |>\n  nrow()',
      tap: '|>',
    },
    {
      say: 'Wiersz z **NA** wypada bez ostrzeżenia.',
      code: 'ankieta |>\n  filter(ocena < 5)',
      pick: 'ankieta |>\n  filter(ocena < 5)',
    },
    {
      say: 'Przecinek między warunkami znaczy **„i jedno, i drugie”**.',
      code: 'ankieta |>\n  filter(plec == "K", wiek > 25)',
      pick: 'ankieta |>\n  filter(plec == "K", wiek > 25)',
    },
  ],

  play: {
    code: 'ankieta |>\n  filter(plec == "K")',
    chips: [
      'ankieta |> filter(is.na(ocena))',
      'ankieta |> filter(ocena <= 3)',
      'ankieta |> filter(wiek > 40) |> nrow()',
      'ankieta[ankieta$wiek > 40, ]',
    ],
  },

  task: {
    prompt: 'Zostaw tylko osoby z oceną **powyżej 3**.',
    starter: 'ankieta |>\n  ',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['filter'] }),
    solution: SOLUTION,
    hints: [
      'Jak w scenach: `ankieta |> filter(...)`, w środku warunek na kolumnie, bez `$`.',
      '„Powyżej 3” to `ocena > 3`.',
    ],
    messages: {
      'missing.filter': 'Zadanie jest o `filter()`, więc użyj go zamiast nawiasów.',
      notATable: 'Wynikiem ma być tabela.',
      gotCount: 'To liczba wierszy, a ma być tabela. Usuń `nrow()`.',
      nothingRemoved: 'Zostało wszystkie osiem wierszy, bo warunek nikogo nie odsiał.',
      wrongDirection: 'Warunek działa w drugą stronę: zostały oceny 3 i niższe.',
      general: 'Jeszcze nie to: `ankieta |> filter(ocena > 3)`.',
    },
    success: 'Dobrze. Pięć osób oceniło powyżej 3.',
    note: 'Sprawdź drugą stronę. `filter(ocena <= 3)` daje dwa wiersze. 5 + 2 = 7, a osób było 8, bo ta z NA wypadła z obu.',

    nearMisses: [
      { name: 'kept the wrong side', expect: 'wrongDirection', code: 'ankieta |> filter(ocena <= 3)' },
      { name: 'condition kept everyone', expect: 'nothingRemoved', code: 'ankieta |> filter(wiek > 0)' },
      { name: 'counted instead of filtering', expect: 'gotCount', code: 'ankieta |> filter(ocena > 3) |> nrow()' },
      { name: 'used base R brackets', expect: 'missing.filter', code: 'ankieta[ankieta$ocena > 3, ]' },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      if (isAtomic(value) && rLength(value) === 1) return 'gotCount';
      if (!isDataFrame(value)) return 'notATable';
      const rows = value.values.length ? rLength(value.values[0]) : 0;
      if (rows === 8) return 'nothingRemoved';

      // Recognise the inverted condition by what is in the result, not by row count:
      // `ocena <= 3` keeps TWO rows here, not three, because the NA row falls out of
      // both sides -- which is the very point the lesson makes.
      const names = (getNames(value)?.values || []).map(String);
      const ocena = value.values[names.indexOf('ocena')];
      if (rows > 0 && ocena && ocena.values.every((v) => !isNA(v) && v <= 3)) return 'wrongDirection';

      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      return 'general';
    },
  },
};

export default filtering;
