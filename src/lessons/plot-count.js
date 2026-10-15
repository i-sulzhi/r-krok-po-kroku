/**
 * Lesson: geom_bar() and geom_col() -- module 10, lecture 4 (D45).
 *
 * Two functions draw the same bars and differ in one thing: who counts. `geom_bar()`
 * takes raw rows and counts them itself; `geom_col()` takes numbers somebody already
 * computed. Mixing them up gives the two commonest first errors in ggplot2.
 *
 * One of them is loud: `geom_bar()` with a `y` stops with an error. The other is
 * silent and is the reason for scene 3: `geom_col()` on raw answers adds them up.
 * Four ratings of 4, 3, 5 and 3 become one bar of height 15, drawn with full
 * confidence. The picture shows the nine rows piled into three bars and says so.
 *
 * The rule the exercise leaves: a plot draws, it does not compute. A mean is
 * computed before the plot.
 */

import { resultCheck } from './schema.js';
import { buildPlot } from '../core/builtins/ggplot.js';

const SETUP = `# Surowa ankieta: jeden wiersz to jedna osoba
ankieta <- data.frame(
  id = 1:10,
  plec = c("K", "M", "K", "K", "M", "M", "K", "M", "K", "M"),
  miasto = c("Kraków", "Warszawa", "Kraków", "Gdańsk", "Warszawa",
             "Kraków", "Gdańsk", "Warszawa", "Kraków", "Gdańsk"),
  ocena = c(4, 5, 3, 4, 2, 5, 4, NA, 3, 5)
)`;

const COUNTED = 'ggplot(ankieta, aes(x = miasto)) +\n  geom_bar()';
const TWO_STEPS = `ankieta |>
  count(miasto) |>
  ggplot(aes(x = miasto, y = n)) +
  geom_col()`;
const PILED = 'ggplot(ankieta, aes(x = miasto, y = ocena)) +\n  geom_col()';
const MEANS = `ankieta |>
  group_by(miasto) |>
  summarise(srednia = mean(ocena, na.rm = TRUE)) |>
  ggplot(aes(x = miasto, y = srednia)) +
  geom_col()`;
const RATINGS = 'ggplot(ankieta, aes(x = ocena)) +\n  geom_bar()';

const SOLUTION = 'ggplot(ankieta, aes(x = plec)) +\n  geom_bar()';

export const plotCount = {
  id: 'plot-count',
  module: 10,
  lecture: 4,
  requires: ['plot-first', 'counting'],
  title: 'geom_bar() i geom_col()',
  setup: SETUP,

  scenes: [
    {
      say: 'W surowej ankiecie nie ma liczb do narysowania. `geom_bar()` **policzy wiersze sam**.',
      code: COUNTED,
      pick: COUNTED,
      tap: 'geom_bar()',
    },
    {
      say: 'To samo w dwóch krokach: `count()` liczy, a `geom_col()` rysuje **gotowe** liczby.',
      code: TWO_STEPS,
      pick: TWO_STEPS,
      tap: 'geom_col()',
    },
    {
      say: '`geom_col()` na surowych danych **dodaje** oceny osób z miasta. Słupek 15 nic nie znaczy.',
      code: PILED,
      pick: PILED,
      tap: 'geom_col()',
    },
    {
      say: 'Średnią liczysz **przed** wykresem. Wykres rysuje, nie liczy za ciebie.',
      code: MEANS,
      pick: MEANS,
    },
    {
      say: 'Liczba na osi x też działa: rozkład **ocen**. Jedynki nikt nie dał, więc słupka nie ma.',
      code: RATINGS,
      pick: RATINGS,
    },
  ],

  play: {
    say: 'Twoja kolej. Sprawdź, kto liczy: wykres czy ty.',
    code: COUNTED,
    chips: [
      'ggplot(ankieta, aes(x = plec)) + geom_bar()',
      'ankieta |> count(plec) |> ggplot(aes(x = plec, y = n)) + geom_col()',
      'ggplot(ankieta, aes(x = factor(ocena))) + geom_bar()',
      'ggplot(ankieta, aes(x = miasto)) + geom_bar() + coord_flip()',
      'ankieta |> count(miasto)',
    ],
  },

  task: {
    prompt: 'Narysuj, **ile kobiet i ilu mężczyzn** odpowiedziało na ankietę. Zacznij od tabeli `ankieta`.',
    starter: 'ggplot(ankieta, ',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['ggplot'], compare: { decorations: true } }),
    solution: SOLUTION,
    hints: [
      'W ankiecie jeden wiersz to jedna osoba, więc wiersze trzeba policzyć. Zrobi to `geom_bar()`.',
      '`geom_bar()` potrzebuje tylko x: `aes(x = plec)`. Wysokość policzy sam.',
    ],
    messages: {
      'missing.ggplot': 'To tabela z liczbami. Teraz ją narysuj: `ggplot(...)` i warstwa.',
      notAPlot: 'To tabela z liczbami, a ma być wykres. Narysuj ją: `ggplot(ankieta, aes(x = plec)) + geom_bar()`.',
      blank: 'Są osie, ale nic nie jest narysowane. Dołóż warstwę: `+ geom_bar()`.',
      wrongColumn: 'Na osi x są inne kategorie niż płeć. W `aes()` ma stać `x = plec`.',
      piled: '`geom_col()` dodał do siebie wartości z wielu wierszy. Wiersze liczy `geom_bar()`, bez y.',
      wrongNumbers: 'Słupki dla płci są, ale mają inną wysokość niż liczba osób. Wysokość policzy `geom_bar()`.',
      general: 'Jeszcze nie to: `ggplot(ankieta, aes(x = plec)) + geom_bar()`.',
    },
    success: 'Dobrze. Pięć kobiet i pięciu mężczyzn.',
    note: 'Ten sam wykres dają `count(plec)` i `geom_col()`. Różnica jest tylko w tym, kto liczy.',

    nearMisses: [
      { name: 'counted and stopped', expect: 'notAPlot', code: 'ankieta |> count(plec)' },
      { name: 'axes and no layer', expect: 'blank', code: 'ggplot(ankieta, aes(x = plec))' },
      { name: 'counted the cities', expect: 'wrongColumn', code: 'ggplot(ankieta, aes(x = miasto)) + geom_bar()' },
      { name: 'piled the ratings up', expect: 'piled', code: 'ggplot(ankieta, aes(x = plec, y = ocena)) + geom_col()' },
      { name: 'drew the mean rating', expect: 'wrongNumbers',
        code: 'ankieta |> group_by(plec) |> summarise(s = mean(ocena, na.rm = TRUE)) |> ggplot(aes(x = plec, y = s)) + geom_col()' },
      { name: 'gave geom_bar a y', expect: 'error', code: 'ggplot(ankieta, aes(x = plec, y = id)) + geom_bar()' },
      { name: 'geom_col without a y', expect: 'error', code: 'ggplot(ankieta, aes(x = plec)) + geom_col()' },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      if (!value.gg) return 'notAPlot';
      const b = buildPlot(value);
      if (!b.layers.length) return 'blank';
      if (b.notes.some((n) => n.kind === 'piled')) return 'piled';
      if (!b.x.discrete || b.x.levels.join() !== 'K,M') return 'wrongColumn';
      if (b.layers[0].marks.map((m) => m.ymax).join() !== '5,5') return 'wrongNumbers';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      return 'general';
    },
  },
};

export default plotCount;
