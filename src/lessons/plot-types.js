/**
 * Lesson: which plot for which question -- module 10, lecture 4 (D81).
 *
 * Until here every plot was bars, and a student could leave thinking a plot is bars.
 * The questions a sociologist asks most often are not "how many in each category"
 * but "how is this number spread", "do the groups differ", "do two numbers go
 * together", "how did it change". One idea: the kind of plot follows from the
 * question and from what the variables are. Each scene is one question and one geom,
 * with as little decoration as a plot for a reader needs: labels and a colour.
 *
 * The data carry what each plot is for: ages crowded at the young end (histogram),
 * a woman with 10 hours a day beyond the whiskers (boxplot), fewer hours with age
 * (points), two age groups whose trust in the Sejm moves apart and back (lines).
 *
 * The task names a question, not a geom: comparing the age of women and men by
 * median and spread asks for boxes, and a histogram or points are told why not.
 */

import { resultCheck } from './schema.js';
import { buildPlot } from '../core/builtins/ggplot.js';

const SETUP = `# Dwadzieścia osób: wiek, płeć, godziny w internecie dziennie
ankieta <- data.frame(
  wiek = c(19, 20, 21, 21, 22, 22, 23, 23, 24, 25,
           26, 28, 31, 34, 38, 43, 49, 55, 61, 67),
  plec = rep(c("K", "M"), 10),
  godziny = c(10, 7, 5, 6, 4, 8, 5, 6, 4, 5,
              3, 4, 3, 4, 2, 3, 2, 1, 2, 1)
)
# Procent ufających Sejmowi, dane wymyślone na wzór sondaży
zaufanie <- data.frame(
  rok = rep(2015:2024, 2),
  grupa = rep(c("18-34", "35+"), each = 10),
  procent = c(22, 20, 18, 17, 19, 15, 14, 16, 13, 18,
              30, 29, 27, 28, 26, 27, 25, 24, 26, 28)
)`;

const BARS = 'ggplot(ankieta, aes(x = plec)) +\n  geom_bar()';
// White edges part the bins, which ggplot2 draws touching and in one grey.
const HIST = 'ggplot(ankieta, aes(x = wiek)) +\n  geom_histogram(binwidth = 5, colour = "white")';
const BOX = 'ggplot(ankieta, aes(x = plec, y = godziny)) +\n  geom_boxplot()';
const POINTS = 'ggplot(ankieta, aes(x = wiek, y = godziny)) +\n  geom_point()';
const LINES = `ggplot(zaufanie, aes(x = rok, y = procent,
                     colour = grupa)) +
  geom_line()`;
const LABELLED = `${LINES} +
  labs(title = "Zaufanie do Sejmu", x = NULL,
       y = "Procent ufających", colour = "Wiek")`;

const SOLUTION = `ggplot(ankieta, aes(x = plec, y = wiek)) +
  geom_boxplot() +
  labs(y = "Wiek")`;

const WANTED = 'Wiek';

export const plotTypes = {
  id: 'plot-types',
  module: 10,
  lecture: 4,
  requires: ['plot-order'],
  title: 'Jaki wykres do jakiego pytania?',
  setup: SETUP,

  scenes: [
    {
      say: 'Słupki mówią, **ile w każdej kategorii**. Inne pytania potrzebują innych wykresów.',
      code: BARS,
      pick: BARS,
    },
    {
      say: 'Ile lat mają badani? Jedna liczba to **histogram**: ile osób w każdym przedziale wieku.',
      code: HIST,
      pick: HIST,
      tap: 'binwidth = 5',
    },
    {
      say: 'Liczba w grupach to **pudełko**: mediana i środkowa połowa. Kobieta z 10 h odstaje.',
      code: BOX,
      pick: BOX,
    },
    {
      say: 'Dwie liczby naraz to **punkty**: każdy to jedna osoba. Im starsza, tym mniej godzin.',
      code: POINTS,
      pick: POINTS,
    },
    {
      say: 'Zmiana w czasie to **linia**, jedna na grupę. Linia nie ma wnętrza: kolor daje `colour`.',
      code: LINES,
      pick: LINES,
      tap: 'colour = grupa',
    },
    {
      say: '`labs()` działa na każdym wykresie. `colour = ` podpisuje legendę kolorów.',
      code: LABELLED,
      pick: LABELLED,
    },
  ],

  play: {
    say: 'Twoja kolej. To samo pytanie, inny wykres: zobacz, co każdy pokazuje, a co gubi.',
    code: HIST,
    chips: [
      'ggplot(ankieta, aes(x = wiek)) + geom_histogram(binwidth = 10)',
      'ggplot(ankieta, aes(x = wiek)) + geom_bar()',
      'ggplot(ankieta, aes(x = wiek, y = godziny, colour = plec)) + geom_point()',
      'ggplot(zaufanie, aes(x = rok, y = procent, colour = grupa)) + geom_line() + geom_point()',
      'ggplot(ankieta, aes(x = wiek)) + geom_histogram()',
      // fill on a line (D88): grouped, but nothing to fill, so both lines stay one colour.
      'ggplot(zaufanie, aes(x = rok, y = procent, fill = grupa)) + geom_line()',
    ],
  },

  task: {
    prompt: 'Porównaj **wiek kobiet i mężczyzn**: mediana, środkowa połowa i kto odstaje. Oś y podpisz „Wiek”.',
    starter: 'ggplot(ankieta, ',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['ggplot'], compare: { decorations: true } }),
    solution: SOLUTION,
    hints: [
      'Mediana i środkowa połowa w każdej grupie to pudełko: `geom_boxplot()`.',
      'Grupy na osi x, liczba na osi y: `aes(x = plec, y = wiek)`, a podpis w `labs(y = "Wiek")`.',
    ],
    messages: {
      'missing.ggplot': 'Wykres zaczyna się od `ggplot(ankieta, aes(...))`.',
      notAPlot: 'To jeszcze nie wykres. Zacznij od `ggplot(ankieta, aes(x = plec, y = wiek))`.',
      blank: 'Są osie, ale nic nie jest narysowane. Porównanie grup to `+ geom_boxplot()`.',
      histogram: 'Histogram pokazuje jedną liczbę dla wszystkich naraz. Porównanie grup to pudełka: `geom_boxplot()`.',
      histogramGroups: 'Histogramy dla każdej płci pokazują rozkład, ale medianę i środkową połowę trzeba zgadywać. Pudełka podają je wprost.',
      quotedColumn: '"plec" w cudzysłowie to tekst, nie kolumna: wyszło jedno pudełko dla wszystkich. Kolumnę piszesz bez cudzysłowu.',
      points: 'Punkty pokazują każdą osobę osobno, mediany na nich nie widać. Porównanie grup to `geom_boxplot()`.',
      bars: 'Słupki liczą osoby albo pokazują jedną liczbę. Medianę i rozrzut pokazuje `geom_boxplot()`.',
      swapped: 'Wiek stoi na osi x, a płeć na y. Grupy idą na x: `aes(x = plec, y = wiek)`.',
      wrongColumn: 'Pudełka są, ale dla innej liczby. Porównujemy wiek: `y = wiek`.',
      noLabel: 'Pudełka są dobre. Brakuje podpisu osi y: `labs(y = "Wiek")`.',
      labelText: 'Podpis osi y jest, ale inny niż w poleceniu. Ma być dokładnie „Wiek”.',
      general: 'Jeszcze nie to: `ggplot(ankieta, aes(x = plec, y = wiek)) + geom_boxplot()` i `labs()`.',
    },
    success: 'Dobrze. Mediana: kobiety 25 lat, mężczyźni 26.5.',
    note: 'Kobieta z 61 latami odstaje: to kropka poza wąsami. Dwa pudełka obok siebie porównuje się jednym spojrzeniem.',

    nearMisses: [
      { name: 'printed the table', expect: 'notAPlot', code: 'ankieta' },
      { name: 'axes only', expect: 'blank', code: 'ggplot(ankieta, aes(x = plec, y = wiek))' },
      { name: 'a histogram of age', expect: 'histogram', code: 'ggplot(ankieta, aes(x = wiek)) + geom_histogram(binwidth = 5) + labs(y = "Wiek")' },
      { name: 'histograms by sex', expect: 'histogramGroups', code: 'ggplot(ankieta, aes(x = wiek, fill = plec)) + geom_histogram(binwidth = 5) + labs(y = "Wiek")' },
      { name: 'histograms in panels', expect: 'histogramGroups', code: 'ggplot(ankieta, aes(x = wiek)) + geom_histogram(binwidth = 5) + facet_wrap(~ plec) + labs(y = "Wiek")' },
      { name: 'the column in quotes', expect: 'quotedColumn', code: 'ggplot(ankieta, aes(x = "plec", y = wiek)) + geom_boxplot() + labs(y = "Wiek")' },
      { name: 'one box without x', expect: 'error', code: 'ggplot(ankieta, aes(y = wiek)) + geom_boxplot() + labs(y = "Wiek")' },
      { name: 'points by sex', expect: 'points', code: 'ggplot(ankieta, aes(x = plec, y = wiek)) + geom_point() + labs(y = "Wiek")' },
      { name: 'bars of the mean', expect: 'bars',
        code: 'ankieta |> group_by(plec) |> summarise(wiek = mean(wiek)) |> ggplot(aes(x = plec, y = wiek)) + geom_col() + labs(y = "Wiek")' },
      { name: 'the boxes of hours', expect: 'wrongColumn', code: 'ggplot(ankieta, aes(x = plec, y = godziny)) + geom_boxplot() + labs(y = "Wiek")' },
      { name: 'no label', expect: 'noLabel', code: 'ggplot(ankieta, aes(x = plec, y = wiek)) + geom_boxplot()' },
      { name: 'another label', expect: 'labelText', code: 'ggplot(ankieta, aes(x = plec, y = wiek)) + geom_boxplot() + labs(y = "wiek osób")' },
      { name: 'a bar chart with a y', expect: 'error', code: 'ggplot(ankieta, aes(x = plec, y = wiek)) + geom_bar()' },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      if (!value.gg) return 'notAPlot';
      const b = buildPlot(value);
      if (!b.layers.length) return result?.reason === 'missing-call' ? `missing.${result.detail.name}` : 'blank';
      const geom = b.layers[0].geom;
      if (geom === 'hist') return b.panels || b.layers[0].marks.some((m) => m.fillKey != null) ? 'histogramGroups' : 'histogram';
      if (geom === 'point') return 'points';
      if (geom === 'col' || geom === 'bar') return 'bars';
      if (geom !== 'box') return 'general';
      if (!b.x.discrete) return 'swapped';
      if (b.notes.some((n) => n.kind === 'constantInAes' && n.aes === 'x')) return 'quotedColumn';
      const mids = b.layers[0].marks.map((m) => m.middle).join();
      if (mids !== '25,26.5') return 'wrongColumn';
      if (b.y.label !== WANTED) return b.set.includes('y') ? 'labelText' : 'noLabel';
      return 'general';
    },
  },
};

export default plotTypes;
