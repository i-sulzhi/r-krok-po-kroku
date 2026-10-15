/**
 * Lesson: a plot for a report -- module 10, lecture 4 (D45).
 *
 * Lecture 3 ended on one habit: n beside every percent. A bar chart of percentages
 * loses it at once, because a bar of 62.5% looks the same whether it stands on eight
 * people or on eight hundred. This exercise puts n back on the picture.
 *
 * `geom_text()` is one more layer, and it shows the layer idea better than any
 * other: the same table, the same x and y, another column written on top. Then the
 * words: a title that says what is shown, an axis that says what is measured, and a
 * caption that says who was asked and who did not answer.
 *
 * Nothing here is decoration. Each part answers a question the reader of a report
 * would otherwise have to ask.
 */

import { resultCheck } from './schema.js';
import { buildPlot } from '../core/builtins/ggplot.js';

const SETUP = `# Opinia o zajęciach. Dwie osoby nie odpowiedziały
ankieta <- data.frame(
  id = 1:10,
  opinia = c("dobra", "dobra", "dobra", "słaba", NA,
             "dobra", "dobra", "słaba", "słaba", NA)
)
wynik <- ankieta |>
  filter(!is.na(opinia)) |>
  count(opinia) |>
  mutate(procent = n / sum(n) * 100)
# Zadowoleni z zajęć według płci (ćwiczenie {ćw:reporting})
wedlug_plci <- data.frame(
  plec = c("K", "M"),
  n = c(4, 5),
  procent = c(100, 40)
)`;

const TABLE = `wynik <- ankieta |>
  filter(!is.na(opinia)) |>
  count(opinia) |>
  mutate(procent = n / sum(n) * 100)
wynik`;
const BASE = 'ggplot(wynik, aes(x = opinia, y = procent)) +\n  geom_col()';
const WITH_N = `${BASE} +\n  geom_text(aes(label = n), vjust = -0.5)`;
const WITH_WORDS = `${BASE} +
  geom_text(aes(label = paste0("n = ", n)),
            vjust = -0.5)`;
const FINISHED = `${WITH_WORDS} +
  labs(title = "Opinia o zajęciach",
       x = NULL, y = "Procent odpowiedzi",
       caption = "8 odpowiedzi, 2 braki")`;

const SOLUTION = `ggplot(wedlug_plci, aes(x = plec, y = procent)) +
  geom_col() +
  geom_text(aes(label = n), vjust = -0.5) +
  labs(title = "Zadowoleni z zajęć")`;

const TITLE = 'Zadowoleni z zajęć';

export const plotReport = {
  id: 'plot-report',
  module: 10,
  lecture: 4,
  requires: ['plot-fill', 'reporting'],
  title: 'Wykres do raportu',
  setup: SETUP,

  scenes: [
    {
      say: 'Tabela z poprzedniego wykładu: procent i `n`. Na wykresie ma być **jedno i drugie**.',
      code: TABLE,
    },
    {
      say: 'Słupki z procentem. Ale 62.5% **z ilu osób**? Tego wykres nie mówi.',
      code: BASE,
      pick: BASE,
    },
    {
      say: '`geom_text()` to kolejna warstwa. Pisze przy słupku wartość z kolumny, tu **n**.',
      code: WITH_N,
      pick: WITH_N,
      tap: 'geom_text(aes(label = n), vjust = -0.5)',
    },
    {
      say: 'Napis można złożyć: `paste0()` skleja tekst z liczbą. Teraz widać **„n = 5”**.',
      code: WITH_WORDS,
      pick: WITH_WORDS,
    },
    {
      say: 'Tytuł mówi, **co** widać. Podpis pod wykresem mówi, **kogo** pytano i kto nie odpowiedział.',
      code: FINISHED,
      pick: FINISHED,
    },
  ],

  play: {
    say: 'Twoja kolej. Każda część odpowiada na pytanie, które zadałby czytelnik raportu.',
    code: WITH_N,
    chips: [
      `${BASE} + geom_text(aes(label = round(procent)), vjust = -0.5)`,
      'ggplot(wynik, aes(x = opinia, y = procent)) + geom_col(fill = "steelblue") + geom_text(aes(label = n), vjust = -0.5)',
      `${BASE} + geom_text(aes(label = n), vjust = 1.5, colour = "white")`,
      `${BASE} + labs(title = "Opinia o zajęciach") + theme_minimal()`,
      'ggplot(wedlug_plci, aes(x = plec, y = procent)) + geom_col()',
    ],
  },

  task: {
    prompt: 'Tabela `wedlug_plci` ma procent zadowolonych i `n`. Narysuj słupki z procentem, nad nimi **n**, i daj tytuł „Zadowoleni z zajęć”.',
    starter: 'ggplot(wedlug_plci, ',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['ggplot', 'geom_col', 'geom_text'], compare: { decorations: true } }),
    solution: SOLUTION,
    hints: [
      'Cztery części: `ggplot()` z `aes()`, `geom_col()`, `geom_text()`, `labs()`. Między nimi `+`.',
      'Słupki: `aes(x = plec, y = procent)`. Napis nad nimi: `geom_text(aes(label = n), vjust = -0.5)`.',
      'Tytuł: `labs(title = "Zadowoleni z zajęć")`.',
    ],
    messages: {
      'missing.ggplot': 'Wykres zaczyna się od `ggplot(wedlug_plci, aes(...))`.',
      'missing.geom_col': 'Słupki rysuje `geom_col()`: liczby w tabeli są już gotowe.',
      'missing.geom_text': 'Słupki są. Brakuje n nad nimi: `+ geom_text(aes(label = n), vjust = -0.5)`.',
      notAPlot: 'To tabela, a ma być wykres. Zacznij od `ggplot(wedlug_plci, aes(...))`.',
      blank: 'Są osie, ale nic nie jest narysowane. Dołóż `geom_col()` i `geom_text()`.',
      nAsHeight: 'Wysokość słupków to n, a ma być procent: `aes(x = plec, y = procent)`. n idzie do napisu.',
      wrongLabel: 'Nad słupkami stoi procent, a ma stać n: `geom_text(aes(label = n))`.',
      textFirst: 'Napisy są narysowane przed słupkami. Najpierw `geom_col()`, potem `geom_text()`.',
      noTitle: 'Słupki i n są dobre. Brakuje tytułu: `labs(title = "Zadowoleni z zajęć")`.',
      wrongTitle: 'Tytuł ma brzmieć dokładnie „Zadowoleni z zajęć”.',
      general: 'Jeszcze nie to: `geom_col()`, `geom_text(aes(label = n))` i `labs(title = ...)`.',
    },
    success: 'Dobrze. 100% z czterech osób i 40% z pięciu.',
    note: 'Bez n nad słupkami ten wykres mówiłby „wszystkie kobiety są zadowolone”. Z n mówi „cztery z czterech”.',

    nearMisses: [
      { name: 'bars without n', expect: 'missing.geom_text',
        code: 'ggplot(wedlug_plci, aes(x = plec, y = procent)) + geom_col() + labs(title = "Zadowoleni z zajęć")' },
      { name: 'n as the height of the bars', expect: 'nAsHeight',
        code: 'ggplot(wedlug_plci, aes(x = plec, y = n)) + geom_col() + geom_text(aes(label = n), vjust = -0.5) + labs(title = "Zadowoleni z zajęć")' },
      { name: 'wrote the percent on the bars', expect: 'wrongLabel',
        code: 'ggplot(wedlug_plci, aes(x = plec, y = procent)) + geom_col() + geom_text(aes(label = procent), vjust = -0.5) + labs(title = "Zadowoleni z zajęć")' },
      { name: 'text layer before the bars', expect: 'textFirst',
        code: 'ggplot(wedlug_plci, aes(x = plec, y = procent)) + geom_text(aes(label = n), vjust = -0.5) + geom_col() + labs(title = "Zadowoleni z zajęć")' },
      { name: 'no title', expect: 'noTitle',
        code: 'ggplot(wedlug_plci, aes(x = plec, y = procent)) + geom_col() + geom_text(aes(label = n), vjust = -0.5)' },
      { name: 'another title', expect: 'wrongTitle',
        code: 'ggplot(wedlug_plci, aes(x = plec, y = procent)) + geom_col() + geom_text(aes(label = n), vjust = -0.5) + labs(title = "Zadowoleni")' },
      { name: 'printed the table', expect: 'notAPlot', code: 'wedlug_plci' },
      { name: 'axes only', expect: 'missing.geom_col', code: 'ggplot(wedlug_plci, aes(x = plec, y = procent))' },
      { name: 'text without a label', expect: 'error',
        code: 'ggplot(wedlug_plci, aes(x = plec, y = procent)) + geom_col() + geom_text()' },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      const missing = result?.reason === 'missing-call' ? `missing.${result.detail.name}` : null;
      if (!value.gg) return 'notAPlot';
      const b = buildPlot(value);
      if (!b.layers.length) return missing || 'blank';
      const bars = b.layers.find((l) => l.geom !== 'text');
      const text = b.layers.find((l) => l.geom === 'text');
      if (bars && bars.marks.map((m) => m.ymax).join() === '4,5') return 'nAsHeight';
      if (missing) return missing;
      if (text && text.marks.map((m) => m.label).join() !== '4,5') return 'wrongLabel';
      if (bars && text && b.layers.indexOf(text) < b.layers.indexOf(bars)) return 'textFirst';
      if (!b.labels.title) return 'noTitle';
      if (b.labels.title !== TITLE) return 'wrongTitle';
      return 'general';
    },
  },
};

export default plotReport;
