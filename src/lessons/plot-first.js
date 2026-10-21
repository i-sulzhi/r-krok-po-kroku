/**
 * Lesson: the first plot -- module 10, lecture 4 (D45).
 *
 * A ggplot is put together from parts, and the lesson adds them one at a time so
 * each is seen doing its job. `ggplot()` with `aes()` alone gives axes and nothing
 * on them: the plot knows which column goes where and has not been told what to
 * draw. That empty frame is the picture of the idea, so it gets a scene of its own.
 *
 * The data is a table from lecture 3, already counted. Counting inside the plot
 * (`geom_bar()`) is the next exercise; here a bar is simply one row.
 *
 * The last scene joins a pipe to a plot, because that is where the two operators
 * meet and where `|>` gets typed instead of `+`.
 *
 * One idea (D76): a table, `aes()` and layers joined by `+`. A fixed colour outside
 * `aes()` is exercise 27's, beside the trap it repairs, so it is only a chip here.
 */

import { resultCheck } from './schema.js';
import { buildPlot } from '../core/builtins/ggplot.js';

const SETUP = `# Dwie gotowe tabele z poprzedniego wykładu
liczby <- data.frame(
  miasto = c("Gdańsk", "Kraków", "Warszawa"),
  n = c(3, 4, 3)
)
srednie <- data.frame(
  miasto = c("Gdańsk", "Kraków", "Warszawa"),
  srednia = c(4.33, 3.75, 3.5)
)
ankieta <- data.frame(
  id = 1:10,
  miasto = c("Kraków", "Warszawa", "Kraków", "Gdańsk", "Warszawa",
             "Kraków", "Gdańsk", "Warszawa", "Kraków", "Gdańsk")
)`;

const BASE = 'ggplot(liczby, aes(x = miasto, y = n))';
const BARS = `${BASE} +\n  geom_col()`;
const LABELLED = `${BARS} +
  labs(title = "Respondenci według miasta",
       x = "Miasto", y = "Liczba osób")`;
// Lecture 3's count(), kept under the name the next scenes draw from.
const COUNTED = `liczby <- ankieta |>\n  count(miasto)\nliczby`;
const PIPED = `ankieta |>
  count(miasto) |>
  ggplot(aes(x = miasto, y = n)) +
  geom_col()`;

const SOLUTION = `ggplot(srednie, aes(x = miasto, y = srednia)) +
  geom_col() +
  labs(y = "Średnia ocena")`;

const WANTED = 'Średnia ocena';

export const plotFirst = {
  id: 'plot-first',
  module: 10,
  lecture: 4,
  requires: ['counting'],
  title: 'Pierwszy wykres: ggplot()',
  setup: SETUP,

  scenes: [
    // The table is made on screen, from lecture 3's count() (D76).
    {
      say: 'Ile osób w każdym mieście? Tabelę daje `count()`, a wykres pokaże różnicę **bez czytania**.',
      code: COUNTED,
      pick: 'ankieta |>\n  count(miasto)',
    },
    {
      say: '`ggplot()` dostaje tabelę, a `aes()` mówi, **która kolumna gdzie**. Są osie, słupków nie ma.',
      code: BASE,
      pick: BASE,
      tap: 'aes(x = miasto, y = n)',
    },
    {
      say: 'Rysuje dopiero **warstwa**. Dokłada ją znak `+`. `geom_col()` to słupki.',
      code: BARS,
      pick: BARS,
      tap: 'geom_col()',
    },
    {
      say: 'Każde następne `+` coś dokłada. `labs()` zmienia **podpisy**, danych nie rusza.',
      code: LABELLED,
      pick: LABELLED,
    },
    {
      say: 'Potok kończy się na `ggplot()`. Dalej stoi już `+`, **nie** `|>`.',
      code: PIPED,
      pick: PIPED,
    },
  ],

  play: {
    say: 'Twoja kolej. Dokładaj części po jednej i patrz, co każda zmienia.',
    code: BARS,
    chips: [
      `${BASE} + geom_col() + coord_flip()`,
      `${BASE} + geom_col(fill = "tomato", width = 0.5)`,
      `${BASE} + geom_col() + theme_minimal()`,
      'ggplot(srednie, aes(x = miasto, y = srednia)) + geom_col()',
      `${BASE} + geom_col() + labs(title = "Mój tytuł")`,
    ],
  },

  task: {
    prompt: 'Narysuj słupki ze **średnią oceną** w każdym mieście. Dane są w tabeli `srednie`. Oś y podpisz „Średnia ocena”.',
    starter: 'ggplot(srednie, ',
    // geom_bar(stat = "identity") draws the same bars (D62), so geom_col() is not required by name.
    check: resultCheck({ expected: SOLUTION, requireCalls: ['ggplot'], compare: { decorations: true } }),
    solution: SOLUTION,
    hints: [
      'Trzy części, między nimi `+`: `ggplot(srednie, aes(...))`, `geom_col()`, `labs(...)`.',
      'W `aes()` miasto idzie na oś x, a średnia na oś y: `aes(x = miasto, y = srednia)`.',
      'Podpis osi: `labs(y = "Średnia ocena")`.',
    ],
    messages: {
      'missing.ggplot': 'Wykres zaczyna się od `ggplot(srednie, aes(...))`.',
      'missing.geom_col': 'Są osie, ale nic nie jest narysowane. Dołóż warstwę: `+ geom_col()`.',
      notAPlot: 'To tabela, a ma być wykres. Zacznij od `ggplot(srednie, aes(...))`.',
      blank: 'Są osie, ale nic nie jest narysowane. Dołóż warstwę: `+ geom_col()`.',
      wrongTable: 'To liczby osób, a mają być średnie. Dane weź z tabeli `srednie`.',
      noLabel: 'Słupki są dobre. Brakuje podpisu osi y: `labs(y = "Średnia ocena")`.',
      labelText: 'Podpis osi y jest, ale inny niż w poleceniu. Ma być dokładnie „Średnia ocena”, z polską literą.',
      wrongLabel: 'Podpis trafił w inne miejsce. Oś y podpisuje `labs(y = "Średnia ocena")`.',
      general: 'Jeszcze nie to: `ggplot(srednie, aes(x = miasto, y = srednia))`, potem `geom_col()` i `labs()`.',
    },
    success: 'Dobrze. Trzy słupki i oś, która mówi, co mierzy.',
    note: 'Bez `labs()` oś nazywa się tak jak kolumna: „srednia”. Czytelnik raportu nie zna nazw twoich kolumn.',

    nearMisses: [
      { name: 'axes and no layer', expect: 'blank',
        code: 'ggplot(srednie, aes(x = miasto, y = srednia))' },
      { name: 'printed the table', expect: 'notAPlot', code: 'srednie' },
      { name: 'drew the counts', expect: 'wrongTable',
        code: 'ggplot(liczby, aes(x = miasto, y = n)) + geom_col() + labs(y = "Średnia ocena")' },
      { name: 'swapped the axes in aes()', expect: 'error',
        code: 'ggplot(srednie, aes(x = srednia, y = miasto)) + geom_col() + labs(y = "Średnia ocena")' },
      { name: 'forgot the label', expect: 'noLabel',
        code: 'ggplot(srednie, aes(x = miasto, y = srednia)) + geom_col()' },
      { name: 'wrote the label without the Polish letter', expect: 'labelText',
        code: 'ggplot(srednie, aes(x = miasto, y = srednia)) + geom_col() + labs(y = "Srednia ocena")' },
      { name: 'labelled the title instead', expect: 'wrongLabel',
        code: 'ggplot(srednie, aes(x = miasto, y = srednia)) + geom_col() + labs(title = "Średnia ocena")' },
      { name: 'used the pipe between layers', expect: 'error',
        code: 'ggplot(srednie, aes(x = miasto, y = srednia)) |> geom_col()' },
      { name: 'put the plus on the next line', expect: 'error',
        code: 'ggplot(srednie, aes(x = miasto, y = srednia))\n  + geom_col()' },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      const missing = result?.reason === 'missing-call' ? `missing.${result.detail.name}` : null;
      if (!value.gg) return 'notAPlot';
      const b = buildPlot(value);
      if (!b.layers.length) return missing || 'blank';
      const tops = b.layers[0].marks.map((m) => m.ymax);
      if (tops.join() === '3,4,3') return 'wrongTable';
      if (missing) return missing;
      // A label written, but not the one asked for: a typo, a missing Polish letter (D62).
      if (b.y.label !== WANTED && b.set.includes('y')) return 'labelText';
      if (b.y.label !== WANTED) return b.set.some((k) => k !== 'y') ? 'wrongLabel' : 'noLabel';
      return 'general';
    },
  },
};

export default plotFirst;
