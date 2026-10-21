/**
 * Lesson: the order of bars -- module 10, lecture 4 (D45).
 *
 * This is where lecture 1 pays off. Text on an axis stands in alphabetical order,
 * which for a survey scale is no order at all: "często, nigdy, rzadko, zawsze". The
 * order of bars is the order of a factor's levels, so the scale is declared once, in
 * `factor()`, exactly as in exercises 6 and 7, and the plot follows.
 *
 * Categories without an order of their own (cities) are sorted by a number:
 * `fct_infreq()` when the plot counts, `reorder()` when the numbers are ready.
 *
 * The data is built so that the three orders a student can end up with are all
 * different: alphabetical, by frequency, and the scale's own. A wrong answer can be
 * named, not just rejected. A typo in the levels gets its own message, because it
 * shows as a bar called NA and looks like a plotting problem when it is a spelling one.
 */

import { resultCheck } from './schema.js';
import { buildPlot } from '../core/builtins/ggplot.js';

const SETUP = `# Dwa pytania ze skalą słowną
# czesto: jak często korzystasz z biblioteki?
# praktyka: jak oceniasz liczbę zajęć praktycznych?
ankieta <- data.frame(
  id = 1:10,
  miasto = c("Kraków", "Warszawa", "Kraków", "Gdańsk", "Warszawa",
             "Kraków", "Gdańsk", "Warszawa", "Kraków", "Gdańsk"),
  czesto = c("rzadko", "często", "rzadko", "zawsze", "nigdy",
             "często", "rzadko", "często", "zawsze", "rzadko"),
  praktyka = c("w sam raz", "za mało", "w sam raz", "za dużo",
               "za mało", "w sam raz", "w sam raz", "za mało",
               "za dużo", "w sam raz")
)`;

const ALPHABET = 'ggplot(ankieta, aes(x = czesto)) +\n  geom_bar()';
const SCALE = `skala <- c("nigdy", "rzadko", "często", "zawsze")
ankieta |>
  mutate(czesto = factor(czesto, levels = skala)) |>
  ggplot(aes(x = czesto)) +
  geom_bar()`;
const BY_COUNT = 'ggplot(ankieta, aes(x = fct_infreq(miasto))) +\n  geom_bar()';
const REORDERED = `ankieta |>
  count(miasto) |>
  ggplot(aes(x = reorder(miasto, n), y = n)) +
  geom_col()`;

const SOLUTION = `ankieta |>
  mutate(praktyka = factor(praktyka,
    levels = c("za mało", "w sam raz", "za dużo"))) |>
  ggplot(aes(x = praktyka)) +
  geom_bar()`;

const WANTED = ['za mało', 'w sam raz', 'za dużo'];

export const plotOrder = {
  id: 'plot-order',
  module: 10,
  lecture: 4,
  requires: ['plot-count', 'levels'],
  title: 'Kolejność słupków',
  setup: SETUP,

  scenes: [
    {
      say: 'Tekst na osi stoi **alfabetycznie**: często, nigdy, rzadko, zawsze. Skala się rozsypała.',
      code: ALPHABET,
      pick: ALPHABET,
    },
    {
      say: 'Kolejność słupków to kolejność **poziomów czynnika**. Podajesz ją raz, w `factor()`.',
      code: SCALE,
      tap: 'factor(czesto, levels = skala)',
    },
    {
      say: 'Miasta nie mają własnej kolejności. Wtedy porządkuje **liczba**: `fct_infreq()`.',
      code: BY_COUNT,
      pick: BY_COUNT,
      tap: 'fct_infreq(miasto)',
    },
    {
      say: 'Przy gotowych liczbach służy do tego `reorder()`: **co** ustawić i **według czego**.',
      code: REORDERED,
      tap: 'reorder(miasto, n)',
    },
  ],

  play: {
    say: 'Twoja kolej. Kolejność to decyzja: skala, liczba albo alfabet.',
    code: BY_COUNT,
    chips: [
      'ggplot(ankieta, aes(x = fct_rev(fct_infreq(miasto)))) + geom_bar()',
      'ankieta |> count(miasto) |> ggplot(aes(x = reorder(miasto, -n), y = n)) + geom_col()',
      'ggplot(ankieta, aes(x = fct_relevel(miasto, "Warszawa"))) + geom_bar()',
      // Lying bars are a layout choice, not an order (D76): a chip, not a scene.
      'ankieta |> count(miasto) |> ggplot(aes(x = reorder(miasto, n), y = n)) + geom_col() + coord_flip()',
      'levels(factor(ankieta$czesto))',
    ],
  },

  task: {
    prompt: 'Narysuj odpowiedzi z kolumny `praktyka` w kolejności skali: **za mało, w sam raz, za dużo**.',
    starter: 'ankieta |>\n  ',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['ggplot'], compare: { decorations: true } }),
    solution: SOLUTION,
    hints: [
      'Bez czynnika słupki staną alfabetycznie. Kolejność ustawiasz w `mutate()`, przed `ggplot()`.',
      '`factor(praktyka, levels = c("za mało", "w sam raz", "za dużo"))`, a potem `geom_bar()`.',
    ],
    messages: {
      'missing.ggplot': 'Czynnik jest gotowy. Teraz wykres: `ggplot(aes(x = praktyka)) + geom_bar()`.',
      notAPlot: 'To jeszcze nie wykres. Po `mutate()` idzie `ggplot(aes(x = praktyka)) + geom_bar()`.',
      blank: 'Są osie, ale nic nie jest narysowane. Dołóż warstwę: `+ geom_bar()`.',
      wrongColumn: 'Na osi x są inne odpowiedzi. W `aes()` ma stać kolumna `praktyka`.',
      naBar: 'Pojawił się słupek NA: jakiejś odpowiedzi nie ma wśród poziomów. Sprawdź pisownię w `levels`.',
      alphabetical: 'Kolejność jest alfabetyczna. Skalę podaj w `factor(praktyka, levels = c(...))`.',
      byCount: 'To kolejność według liczby odpowiedzi. Skala ma własną: za mało, w sam raz, za dużo.',
      wrongOrder: 'Poziomy są, ale w innej kolejności niż skala: za mało, w sam raz, za dużo.',
      relabelled: '`labels` zmienia nazwy, nie kolejność: odpowiedzi „w sam raz” dostały nazwę „za mało”. Kolejność ustawia `levels`.',
      general: 'Jeszcze nie to: `mutate()` z `factor(..., levels = ...)`, potem `ggplot()` i `geom_bar()`.',
    },
    success: 'Dobrze. Skala idzie od „za mało” do „za dużo”.',
    note: 'Ten sam czynnik ustawi też tabelę z `count()` i legendę. Kolejność podaje się raz.',

    nearMisses: [
      { name: 'left the alphabet in charge', expect: 'alphabetical',
        code: 'ggplot(ankieta, aes(x = praktyka)) + geom_bar()' },
      { name: 'sorted by frequency', expect: 'byCount',
        code: 'ggplot(ankieta, aes(x = fct_infreq(praktyka))) + geom_bar()' },
      { name: 'reversed the scale', expect: 'wrongOrder',
        code: 'ankieta |> mutate(praktyka = factor(praktyka, levels = c("za dużo", "w sam raz", "za mało"))) |> ggplot(aes(x = praktyka)) + geom_bar()' },
      { name: 'a typo in a level', expect: 'naBar',
        code: 'ankieta |> mutate(praktyka = factor(praktyka, levels = c("za malo", "w sam raz", "za dużo"))) |> ggplot(aes(x = praktyka)) + geom_bar()' },
      // Lecture 1's trap (D76): labels without levels rename the alphabetical levels,
      // so the bars stand in the right order with someone else's counts.
      { name: 'labels instead of levels', expect: 'relabelled',
        code: 'ankieta |> mutate(praktyka = factor(praktyka, labels = c("za mało", "w sam raz", "za dużo"))) |> ggplot(aes(x = praktyka)) + geom_bar()' },
      { name: 'drew the other question', expect: 'wrongColumn',
        code: 'ggplot(ankieta, aes(x = czesto)) + geom_bar()' },
      { name: 'made the factor and stopped', expect: 'notAPlot',
        code: 'ankieta |> mutate(praktyka = factor(praktyka, levels = c("za mało", "w sam raz", "za dużo")))' },
      { name: 'axes only', expect: 'blank', code: 'ggplot(ankieta, aes(x = praktyka))' },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      if (!value.gg) return 'notAPlot';
      const b = buildPlot(value);
      if (!b.layers.length) return 'blank';
      const levels = b.x.discrete ? b.x.levels : [];
      if (levels.includes('NA')) return 'naBar';
      if ([...levels].sort().join() !== [...WANTED].sort().join()) return 'wrongColumn';
      const order = levels.join();
      if (order === 'w sam raz,za dużo,za mało') return 'alphabetical';
      if (order === 'w sam raz,za mało,za dużo') return 'byCount';
      if (order !== WANTED.join()) return 'wrongOrder';
      // The right order with the wrong heights: the answers were renamed, not ordered.
      if (b.layers[0].marks.map((m) => m.ymax).join() !== '3,5,2') return 'relabelled';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      return 'general';
    },
  },
};

export default plotOrder;
