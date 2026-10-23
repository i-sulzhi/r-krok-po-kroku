/**
 * Lesson: panels with facet_wrap() -- module 10, lecture 4 (D82).
 *
 * A short exercise after the kinds of plot. One idea: the same plot drawn separately
 * for each group, on shared axes. Colour already tells groups apart on one plot; with
 * two groups that is enough, with three or more the colours mix, and panels keep each
 * group apart while the shared axes keep them comparable. It is how a report shows
 * "the same thing in every city".
 *
 * The survey is exercise 29's twenty people with a city added: eight from Kraków, six
 * from Gdańsk, six from Warszawa. The task asks for the relation of age and hours in
 * each city, so the student picks the points of 29 and adds the panels.
 */

import { resultCheck } from './schema.js';
import { buildPlot } from '../core/builtins/ggplot.js';

const SETUP = `# Te same dwadzieścia osób, teraz także z miastem
ankieta <- data.frame(
  wiek = c(19, 20, 21, 21, 22, 22, 23, 23, 24, 25,
           26, 28, 31, 34, 38, 43, 49, 55, 61, 67),
  plec = rep(c("K", "M"), 10),
  miasto = rep(c("Kraków", "Gdańsk", "Warszawa", "Kraków"), 5),
  godziny = c(10, 7, 5, 6, 4, 8, 5, 6, 4, 5,
              3, 4, 3, 4, 2, 3, 2, 1, 2, 1)
)`;

const COLOUR = 'ggplot(ankieta, aes(x = wiek, y = godziny,\n                    colour = plec)) +\n  geom_point()';
const PANELS = 'ggplot(ankieta, aes(x = wiek, y = godziny)) +\n  geom_point() +\n  facet_wrap(~ plec)';
const CITIES = `ggplot(ankieta, aes(x = wiek)) +
  geom_histogram(binwidth = 10, colour = "white") +
  facet_wrap(~ miasto)`;
const COLUMN = `ggplot(ankieta, aes(x = wiek)) +
  geom_histogram(binwidth = 10, colour = "white") +
  facet_wrap(~ miasto, ncol = 1)`;

const SOLUTION = `ggplot(ankieta, aes(x = wiek, y = godziny)) +
  geom_point() +
  facet_wrap(~ miasto)`;

export const plotFacets = {
  id: 'plot-facets',
  module: 10,
  lecture: 4,
  requires: ['plot-types'],
  title: 'Panele: facet_wrap()',
  setup: SETUP,

  scenes: [
    {
      say: 'Kolor rozróżnia grupy na **jednym** wykresie. Przy dwóch grupach to wystarczy.',
      code: COLOUR,
      pick: COLOUR,
    },
    {
      say: '`facet_wrap(~ plec)` rysuje ten sam wykres **osobno** dla każdej grupy. Osie są wspólne.',
      code: PANELS,
      pick: PANELS,
      tap: 'facet_wrap(~ plec)',
    },
    {
      say: 'Przy trzech miastach kolory by się mieszały. Panele trzymają każde miasto **osobno**.',
      code: CITIES,
      pick: CITIES,
    },
    {
      say: '`ncol = 1` kładzie panele jeden pod drugim. Wiek porównasz wtedy na jednej osi.',
      code: COLUMN,
      pick: COLUMN,
      tap: 'ncol = 1',
    },
  ],

  play: {
    say: 'Twoja kolej. Panele działają z każdym typem wykresu z ćwiczenia {ćw:plot-types}.',
    code: PANELS,
    chips: [
      'ggplot(ankieta, aes(x = wiek, y = godziny, colour = miasto)) + geom_point()',
      'ggplot(ankieta, aes(x = plec, y = godziny)) + geom_boxplot() + facet_wrap(~ miasto)',
      'ggplot(ankieta, aes(x = wiek)) + geom_histogram(binwidth = 10, colour = "white") + facet_wrap(~ miasto, nrow = 1)',
      'ggplot(ankieta, aes(x = plec)) + geom_bar() + facet_wrap(~ miasto)',
    ],
  },

  task: {
    prompt: 'Jak godziny w internecie zależą od wieku **w każdym mieście osobno**? Jeden panel na miasto.',
    starter: 'ggplot(ankieta, ',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['ggplot'], compare: { decorations: true } }),
    solution: SOLUTION,
    hints: [
      'Dwie liczby naraz to punkty, jak w ćwiczeniu {ćw:plot-types}: `aes(x = wiek, y = godziny)` i `geom_point()`.',
      'Osobny panel dla każdego miasta daje `+ facet_wrap(~ miasto)`.',
    ],
    messages: {
      'missing.ggplot': 'Wykres zaczyna się od `ggplot(ankieta, aes(...))`.',
      notAPlot: 'To jeszcze nie wykres. Zacznij od `ggplot(ankieta, aes(x = wiek, y = godziny))`.',
      blank: 'Są osie, ale nic nie jest narysowane. Dwie liczby naraz to `+ geom_point()`.',
      noFacet: 'Wszystkie miasta są na jednym wykresie. Osobny panel dla każdego daje `+ facet_wrap(~ miasto)`.',
      colourOnly: 'Kolor zestawia miasta na jednym wykresie, a mają być osobne panele: `+ facet_wrap(~ miasto)`.',
      wrongFacet: 'Panele są, ale według innej zmiennej. Jeden panel na miasto: `facet_wrap(~ miasto)`.',
      wrongType: 'To nie są punkty. Związek dwóch liczb, wieku i godzin, pokazuje `geom_point()`.',
      general: 'Jeszcze nie to: `ggplot(ankieta, aes(x = wiek, y = godziny)) + geom_point() + facet_wrap(~ miasto)`.',
    },
    success: 'Dobrze. W każdym mieście starsi są w sieci krócej.',
    note: 'Osie paneli są wspólne, więc punkt na tej samej wysokości znaczy wszędzie tyle samo godzin.',

    nearMisses: [
      { name: 'printed the table', expect: 'notAPlot', code: 'ankieta' },
      { name: 'axes only', expect: 'blank', code: 'ggplot(ankieta, aes(x = wiek, y = godziny))' },
      { name: 'one plot for all', expect: 'noFacet', code: 'ggplot(ankieta, aes(x = wiek, y = godziny)) + geom_point()' },
      { name: 'colour instead of panels', expect: 'colourOnly', code: 'ggplot(ankieta, aes(x = wiek, y = godziny, colour = miasto)) + geom_point()' },
      { name: 'panels by sex', expect: 'wrongFacet', code: 'ggplot(ankieta, aes(x = wiek, y = godziny)) + geom_point() + facet_wrap(~ plec)' },
      { name: 'a histogram per city', expect: 'wrongType', code: 'ggplot(ankieta, aes(x = wiek)) + geom_histogram(binwidth = 10) + facet_wrap(~ miasto)' },
      { name: 'the variable without ~', expect: 'error', code: 'ggplot(ankieta, aes(x = wiek, y = godziny)) + geom_point() + facet_wrap(miasto)' },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      if (!value.gg) return 'notAPlot';
      const b = buildPlot(value);
      if (!b.layers.length) return result?.reason === 'missing-call' ? `missing.${result.detail.name}` : 'blank';
      if (b.layers[0].geom !== 'point') return 'wrongType';
      if (!b.panels) return b.fill?.aes === 'colour' ? 'colourOnly' : 'noFacet';
      if (b.facet.code !== 'miasto') return 'wrongFacet';
      return 'general';
    },
  },
};

export default plotFacets;
