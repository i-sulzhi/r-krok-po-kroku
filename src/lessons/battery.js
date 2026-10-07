/**
 * Lesson: a battery of questions with pivot_longer() -- module 9, lecture 3 (D39).
 *
 * A survey rarely asks one thing. Three questions on the same scale arrive as three
 * columns, and every summary has to be written three times; with twenty questions
 * nobody writes it. `pivot_longer()` folds the columns into two, which question and
 * which answer, and then one `group_by(pytanie)` summarises them all.
 *
 * The price is what a row means. Six people become eighteen rows, and from then on
 * a row is an answer, not a person: `n()` and `count()` count answers, including the
 * empty ones. That is the trap of the exercise, and the same point about missing
 * data as everywhere else on the path, now multiplied by the number of questions.
 *
 * The second, smaller trap is the quotes: the columns to fold exist, so they are
 * written bare; `names_to` and `values_to` are names of columns that do not exist
 * yet, so they are text.
 */

import { resultCheck } from './schema.js';
import { getNames, isNA, isDataFrame } from '../core/rvalue.js';

const SETUP = `# Trzy pytania o zajęcia, skala od 1 do 5
# p1: były ciekawe, p2: jasno tłumaczone, p3: polecę innym
ankieta <- data.frame(
  id = 1:6,
  plec = c("K", "M", "K", "M", "K", "M"),
  p1 = c(4, 5, 3, 4, 2, 5),
  p2 = c(3, 4, NA, 5, 2, 4),
  p3 = c(5, 5, 4, NA, 3, 4)
)`;

const BY_HAND = `ankieta |>
  summarise(p1 = mean(p1),
            p2 = mean(p2, na.rm = TRUE),
            p3 = mean(p3, na.rm = TRUE))`;

const FOLD = `  pivot_longer(p1:p3, names_to = "pytanie",
               values_to = "odpowiedz")`;

const LONG = `ankieta |>\n${FOLD}`;

const COUNTED = `${LONG} |>
  count(pytanie)`;

const MEANS = `${LONG} |>
  group_by(pytanie) |>
  summarise(srednia = mean(odpowiedz, na.rm = TRUE),
            n = sum(!is.na(odpowiedz)))`;

const DROPPED = `ankieta |>
  pivot_longer(p1:p3, names_to = "pytanie",
               values_to = "odpowiedz",
               values_drop_na = TRUE)`;

const SOLUTION = `${LONG} |>
  group_by(plec, pytanie) |>
  summarise(srednia = mean(odpowiedz, na.rm = TRUE))`;

// `group_by(pytanie, plec)` is the same answer with its rows in another order.
const check = resultCheck({ expected: SOLUTION, requireCalls: ['pivot_longer', 'summarise'], compare: { ignoreRowOrder: true } });

export const battery = {
  id: 'battery',
  module: 9,
  lecture: 3,
  requires: ['grouping', 'crosstab'],
  title: 'Bateria pytań: pivot_longer()',
  setup: SETUP,

  scenes: [
    {
      say: 'Trzy pytania, trzy razy **to samo**. Przy dwudziestu pytaniach nikt tak nie pisze.',
      code: BY_HAND,
      pick: BY_HAND,
    },
    {
      say: 'Trzy kolumny składają się w dwie: **które pytanie** i **jaka odpowiedź**.',
      code: LONG,
      pick: LONG,
    },
    {
      say: 'Wiersz to teraz **jedna odpowiedź**, nie osoba. Jest ich 18, po 6 na pytanie.',
      code: COUNTED,
      pick: COUNTED,
    },
    {
      say: 'Jedno `group_by()` liczy **wszystkie pytania naraz**. Obok `n`: ile było odpowiedzi.',
      code: MEANS,
      pick: MEANS,
    },
    {
      say: '`values_drop_na = TRUE` usuwa puste odpowiedzi od razu. Zostaje 16 wierszy.',
      code: DROPPED,
      pick: DROPPED,
    },
  ],

  play: {
    code: `${LONG} |>\n  count(pytanie, odpowiedz)`,
    chips: [
      'ankieta |> pivot_longer(p1:p3, names_to = "pytanie", values_to = "odpowiedz", values_drop_na = TRUE) |> group_by(pytanie) |> summarise(procent_4_5 = mean(odpowiedz >= 4) * 100)',
      'ankieta |> pivot_longer(c(p1, p3), names_to = "pytanie", values_to = "odpowiedz")',
      'ankieta |> pivot_longer(-c(id, plec), names_to = "pytanie", values_to = "odpowiedz") |> count(id)',
      'ankieta |> pivot_longer(p1:p3, names_to = "pytanie", values_to = "odpowiedz") |> count(pytanie, odpowiedz) |> pivot_wider(names_from = odpowiedz, values_from = n, values_fill = 0)',
    ],
  },

  task: {
    prompt: 'Policz średnią odpowiedź na każde pytanie, osobno dla kobiet i mężczyzn. Kolumny: `plec`, `pytanie`, `srednia`.',
    starter: `${LONG} |>\n  `,
    check,
    solution: SOLUTION,
    hints: [
      'Długa tabela już jest. Teraz grupy: `group_by(plec, pytanie)`, potem `summarise()`.',
      'W odpowiedziach są braki, więc średnia potrzebuje `na.rm = TRUE`.',
    ],
    messages: {
      'missing.pivot_longer': 'Zadanie zaczyna się od złożenia pytań: `pivot_longer(p1:p3, ...)`. Bez tego trzeba pisać trzy razy.',
      'missing.summarise': 'To jeszcze pojedyncze odpowiedzi. Średnią w grupach liczy `summarise()` po `group_by()`.',
      notATable: 'Wynikiem ma być tabela: płeć, pytanie i średnia.',
      long: 'To jeszcze pojedyncze odpowiedzi. Średnią w grupach liczy `summarise()` po `group_by()`.',
      hasNA: 'Część średnich to NA, bo w odpowiedziach są braki. Dodaj `na.rm = TRUE` w `mean()`.',
      noSex: 'Są pytania, brakuje podziału na płeć. Grupuj przez obie: `group_by(plec, pytanie)`.',
      noQuestion: 'Jest płeć, ale pytania się zlały w jedną średnią. Grupuj przez obie: `group_by(plec, pytanie)`.',
      wrongName: 'Liczby dobre, ale kolumna ze średnią ma się nazywać `srednia`.',
      general: 'Jeszcze nie to. Po `pivot_longer()` idzie `group_by(plec, pytanie)` i `summarise(srednia = ...)`.',
    },
    success: 'Dobrze. Sześć średnich z jednej linii summarise().',
    note: 'Każda średnia to najwyżej trzy osoby. W raporcie obok średniej stoi `n`.',

    nearMisses: [
      { name: 'forgot the missing answers', expect: 'hasNA',
        code: `${LONG} |> group_by(plec, pytanie) |> summarise(srednia = mean(odpowiedz))` },
      { name: 'grouped by the question only', expect: 'noSex',
        code: `${LONG} |> group_by(pytanie) |> summarise(srednia = mean(odpowiedz, na.rm = TRUE))` },
      { name: 'grouped by sex only', expect: 'noQuestion',
        code: `${LONG} |> group_by(plec) |> summarise(srednia = mean(odpowiedz, na.rm = TRUE))` },
      { name: 'stopped at the long table', expect: 'missing.summarise',
        code: LONG },
      { name: 'named the mean differently', expect: 'wrongName',
        code: `${LONG} |> group_by(plec, pytanie) |> summarise(sr = mean(odpowiedz, na.rm = TRUE))` },
      { name: 'wrote it three times by hand', expect: 'missing.pivot_longer',
        code: 'ankieta |> group_by(plec) |> summarise(p1 = mean(p1), p2 = mean(p2, na.rm = TRUE), p3 = mean(p3, na.rm = TRUE))' },
      { name: 'left the new name without quotes', expect: 'error',
        code: 'ankieta |> pivot_longer(p1:p3, names_to = pytanie, values_to = "odpowiedz")' },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      const missing = result?.reason === 'missing-call' ? `missing.${result.detail.name}` : null;
      if (!isDataFrame(value)) return missing || 'notATable';
      if (missing) return missing;
      const names = (getNames(value)?.values || []).map(String);
      if (names.includes('odpowiedz')) return 'long';
      const hasSex = names.includes('plec');
      const hasQuestion = names.includes('pytanie');
      if (hasQuestion && !hasSex) return 'noSex';
      if (hasSex && !hasQuestion) return 'noQuestion';
      if (!hasSex || !hasQuestion) return 'general';
      const extra = names.filter((nm) => nm !== 'plec' && nm !== 'pytanie');
      if (extra.length !== 1) return 'general';
      if (value.values[names.indexOf(extra[0])].values.some(isNA)) return 'hasNA';
      if (extra[0] !== 'srednia') return 'wrongName';
      return 'general';
    },
  },
};

export default battery;
