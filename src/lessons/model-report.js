/**
 * Lesson: the model on a plot and in a report -- module 11, lecture 5 (D98).
 *
 * One idea: `geom_smooth(method = "lm")` draws the same line as `lm()` on the points
 * of exercise 29, and a report takes its numbers from the model, not from the picture.
 *
 * The silent trap of the plan: without `method` ggplot2 draws a curve (loess), not the
 * model, and says so only in a message. The trainer does not imitate loess: that call is
 * an error here with a sentence saying what R would do, met in the task as a near-miss.
 * The scenes stay on the line.
 *
 * Numbers checked in R 4.6.2; the layer itself was compared with real ggplot2 3.x on
 * the Windows PC (the 80 points, the band, the colour), and is compared with base R's
 * predict(se.fit = TRUE) in test/cases-ggplot.txt.
 */

import { buildPlot } from '../core/builtins/ggplot.js';

const SETUP = `# Dwadzieścia osób: wiek, płeć, godziny w internecie dziennie
ankieta <- data.frame(
  wiek = c(19, 20, 21, 21, 22, 22, 23, 23, 24, 25,
           26, 28, 31, 34, 38, 43, 49, 55, 61, 67),
  plec = rep(c("K", "M"), 10),
  godziny = c(10, 7, 5, 6, 4, 8, 5, 6, 4, 5,
              3, 4, 3, 4, 2, 3, 2, 1, 2, 1)
)`;

const BASE = 'ggplot(ankieta, aes(x = wiek, y = godziny)) +\n  geom_point() +';
const NO_SE = `${BASE}\n  geom_smooth(method = "lm", se = FALSE)`;
const WITH_SE = `${BASE}\n  geom_smooth(method = "lm")`;
const SOLUTION = WITH_SE;

/** The line of lm(godziny ~ wiek) over all twenty people, and the points under it. */
function judge(value) {
  if (!value?.gg) return 'notAPlot';
  let b;
  try { b = buildPlot(value); } catch { return 'general'; }
  const points = b.layers.find((l) => l.geom === 'point');
  const smooth = b.layers.find((l) => l.geom === 'smooth');
  const line = b.layers.find((l) => l.geom === 'line');
  if (!smooth) return line ? 'line' : points ? 'noLine' : 'general';
  if (smooth.aes.x !== 'wiek' || smooth.aes.y !== 'godziny') return smooth.aes.x === 'godziny' ? 'swapped' : 'general';
  if (smooth.stat.fits.length !== 1) return 'groups';
  const f = smooth.stat.fits[0];
  if (Math.abs(f.b0 - 8.253009) > 1e-4 || Math.abs(f.b1 + 0.1227917) > 1e-6) return 'general';
  if (!points) return 'noPoints';
  return 'ok';
}

function check({ value }) {
  const verdict = judge(value);
  return verdict === 'ok' ? { ok: true } : { ok: false, reason: 'wrong-value', detail: { verdict } };
}
check.compare = { decorations: true };

export const modelReport = {
  id: 'model-report',
  module: 11,
  lecture: 5,
  requires: ['model-control'],
  title: 'Model na wykresie i w raporcie',
  setup: SETUP,

  scenes: [
    {
      say: '`geom_smooth(method = "lm")` rysuje na punktach **tę samą prostą** co `lm()`.',
      code: NO_SE,
      pick: NO_SE,
      tap: 'method = "lm"',
    },
    {
      say: 'Szary pas: gdzie mogłaby leżeć prosta przy innej próbie. Nie pokazuje, gdzie są ludzie.',
      code: WITH_SE,
      pick: WITH_SE,
    },
    {
      say: 'Po co prosta na wykresie? Widać kierunek i to, jak daleko od niej leżą ludzie.',
      code: NO_SE,
      pick: NO_SE,
    },
    {
      say: 'Do raportu liczby bierz z modelu: o ile, ile wyjaśnia, na ilu osobach.',
      code: 'm <- lm(godziny ~ wiek, data = ankieta)\nsummary(m)',
      pick: 'summary(m)',
    },
  ],

  play: {
    say: 'Twoja kolej. Dodaj podpisy osi albo osobną prostą dla kobiet i mężczyzn.',
    code: WITH_SE,
    chips: [
      'ggplot(ankieta, aes(x = wiek, y = godziny)) + geom_point() + geom_smooth(method = "lm") + labs(x = "Wiek", y = "Godziny w sieci")',
      'ggplot(ankieta, aes(x = wiek, y = godziny, colour = plec)) + geom_point() + geom_smooth(method = "lm", se = FALSE)',
      'ggplot(ankieta, aes(x = wiek, y = godziny)) + geom_point() + geom_line()',
      'coef(lm(godziny ~ wiek, data = ankieta))',
    ],
  },

  task: {
    prompt: 'Narysuj punkty wieku i godzin z tabeli `ankieta` i dodaj prostą z modelu liniowego. Szary pas może zostać.',
    starter: 'ggplot(ankieta, ',
    check,
    solution: SOLUTION,
    hints: [
      'Punkty to `geom_point()`. Prostą modelu dodaje kolejna warstwa po `+`.',
      'Prosta z lm() na wykresie to `geom_smooth(method = "lm")`.',
    ],
    messages: {
      notAPlot: 'To jeszcze nie wykres. Zacznij od `ggplot(ankieta, aes(x = wiek, y = godziny))`.',
      noLine: 'Są punkty, brakuje prostej. Dodaj `+ geom_smooth(method = "lm")`.',
      noPoints: 'Jest prosta, brakuje punktów. Dodaj `+ geom_point()`.',
      line: '`geom_line()` łączy punkty po kolei, to nie model. Prostą daje `geom_smooth(method = "lm")`.',
      swapped: 'Wiek ma być na osi x, godziny na osi y: `aes(x = wiek, y = godziny)`.',
      groups: 'Kolor albo group dzieli dane na osobne proste. Zadanie chce jednej prostej dla wszystkich.',
      general: 'Jeszcze nie to: `geom_point()` i `geom_smooth(method = "lm")` na `aes(x = wiek, y = godziny)`.',
    },
    success: 'Dobrze. To ta sama prosta co w lm(): 8.25 - 0.123 × wiek.',
    note: 'Zdanie do raportu: „Z każdym rokiem o około 7 minut mniej w sieci (n = 20, R² = 0.60, p < 0.001).”',

    nearMisses: [
      { name: 'points only', expect: 'noLine', code: 'ggplot(ankieta, aes(x = wiek, y = godziny)) + geom_point()' },
      { name: 'the line only', expect: 'noPoints', code: 'ggplot(ankieta, aes(x = wiek, y = godziny)) + geom_smooth(method = "lm")' },
      { name: 'points joined by a line', expect: 'line', code: 'ggplot(ankieta, aes(x = wiek, y = godziny)) + geom_point() + geom_line()' },
      { name: 'the axes swapped', expect: 'swapped', code: 'ggplot(ankieta, aes(x = godziny, y = wiek)) + geom_point() + geom_smooth(method = "lm")' },
      { name: 'a line per sex', expect: 'groups', code: 'ggplot(ankieta, aes(x = wiek, y = godziny, colour = plec)) + geom_point() + geom_smooth(method = "lm")' },
      { name: 'a line per group', expect: 'groups', code: 'ggplot(ankieta, aes(x = wiek, y = godziny)) + geom_point() + geom_smooth(aes(group = plec), method = "lm")' },
      { name: 'the table printed', expect: 'notAPlot', code: 'ankieta' },
      { name: 'smooth without a method', expect: 'error', code: 'ggplot(ankieta, aes(x = wiek, y = godziny)) + geom_point() + geom_smooth()' },
    ],

    diagnose({ value }) {
      const verdict = judge(value);
      return verdict === 'ok' ? 'general' : verdict;
    },
  },
};

export default modelReport;
