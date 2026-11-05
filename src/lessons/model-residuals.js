/**
 * Lesson: why this line -- module 11, lecture 5 (D92).
 *
 * Exercise 33 took the line as given. This one asks why R chose that one, when a line
 * can be drawn by eye. One idea: a residual is "real minus predicted", and lm() takes
 * the line whose squared residuals add up to the least. The student sees the sum for
 * R's line (41.6) and for a line typed by hand (48.6) on the same points.
 *
 * The silent trap, that one person far from the rest pulls the line, is a sandbox chip
 * (`ankieta[-1, ]`, slope -0.108 instead of -0.123), not a scene: it is the second idea
 * of the exercise (design, section 3).
 *
 * The task asks for the person furthest BELOW the line (row 11, residual -2.06), not
 * the furthest from it: the residual picture names the furthest one (row 1, above the
 * line) in its caption, and a task the picture answers is copied (D91). It also tells a
 * residual from a raw value: the fewest hours are in rows 18 and 20, where the line is
 * low too. Numbers checked in R 4.6.2.
 */

import { isAtomic, isDataFrame, rLength, getAttr } from '../core/rvalue.js';
import { isModel } from '../core/builtins/models.js';
import { PY_RESIDUALS } from './python.js';

const SETUP = `# Dwadzieścia osób: wiek, płeć, godziny w internecie dziennie
ankieta <- data.frame(
  wiek = c(19, 20, 21, 21, 22, 22, 23, 23, 24, 25,
           26, 28, 31, 34, 38, 43, 49, 55, 61, 67),
  plec = rep(c("K", "M"), 10),
  godziny = c(10, 7, 5, 6, 4, 8, 5, 6, 4, 5,
              3, 4, 3, 4, 2, 3, 2, 1, 2, 1)
)`;

const MODEL = 'm <- lm(godziny ~ wiek, data = ankieta)';
const HAND_LINE = 'na_oko <- 8 - 0.1 * ankieta$wiek';
const HAND_SUM = 'sum((ankieta$godziny - na_oko)^2)';
const SOLUTION = `${MODEL}\nwhich.min(residuals(m))`;

/** The row number, however it came: 11, 11L, "11", or the row itself. */
function rowOf(value) {
  if (!value) return null;
  if (isDataFrame(value)) {
    const rn = getAttr(value, 'row.names');
    return value.values.length && rLength(value.values[0]) === 1 && rn ? String(rn.values[0]) : null;
  }
  if (isAtomic(value) && rLength(value) === 1) return String(value.values[0]);
  return null;
}

/** The number must come from the model, not be read off the picture. */
const fromModel = (code) => /\b(residuals|resid|fitted|predict)\s*\(/.test(String(code || ''));

function check({ value, code }) {
  if (!fromModel(code)) return { ok: false, reason: 'typed' };
  return rowOf(value) === '11' ? { ok: true } : { ok: false, reason: 'wrong-value' };
}
check.compare = {};

export const modelResiduals = {
  id: 'model-residuals',
  module: 11,
  lecture: 5,
  requires: ['model-line'],
  title: 'Dlaczego ta prosta?',
  setup: SETUP,

  scenes: [
    {
      say: 'Szukamy prostej, która **najlepiej** pokazuje związek wieku i godzin. Co znaczy „najlepiej”?',
      code: MODEL,
      pick: 'lm(godziny ~ wiek, data = ankieta)',
    },
    {
      say: 'Prosta zgaduje godziny z wieku. **Reszta** to jej pomyłka, prawdziwe godziny minus prosta.',
      code: `${MODEL}\nresiduals(m)`,
      pick: 'residuals(m)',
    },
    {
      say: 'Pomyłki na plus i na minus się znoszą. **Kwadrat** robi z nich plusy i mocniej karze duże.',
      code: `${MODEL}\nresiduals(m)^2`,
      pick: 'residuals(m)^2',
    },
    {
      say: 'Suma kwadratów, **41.6**, to łączna pomyłka prostej. Duże pomyłki ważą w niej najwięcej.',
      code: `${MODEL}\nsum(residuals(m)^2)`,
      pick: 'sum(residuals(m)^2)',
      tap: 'residuals(m)^2',
    },
    {
      say: 'Prosta na oko ma sumę kwadratów **48.6**, więcej niż 41.6. `lm()` daje najmniejszą możliwą.',
      code: `${HAND_LINE}\n${HAND_SUM}`,
      pick: HAND_SUM,
      tap: HAND_LINE,
    },
  ],

  play: {
    say: 'Twoja kolej. Wpisz własną prostą albo usuń osobę z wiersza 1.',
    keep: MODEL,
    code: 'residuals(m)',
    chips: [
      'residuals(m)^2',
      'sum((ankieta$godziny - (7 - 0.08 * ankieta$wiek))^2)',
      'lm(godziny ~ wiek, data = ankieta[-1, ])',
      'fitted(m)',
      'which.max(residuals(m))',
    ],
    // The same lines in statsmodels and scikit-learn (D93).
    python: PY_RESIDUALS,
  },

  task: {
    prompt: 'Kto spędza w sieci **najmniej w porównaniu z prostą**? Podaj numer jego wiersza.',
    starter: `${MODEL}\n`,
    check,
    solution: SOLUTION,
    hints: [
      'Pod prostą reszta jest ujemna. Szukamy najmniejszej z `residuals(m)`.',
      'Numer najmniejszej wartości daje `which.min()`.',
    ],
    messages: {
      typed: 'Numer ma wyjść z modelu, nie z rysunku. Użyj `residuals(m)`.',
      above: 'To osoba najdalej **nad** prostą: największa reszta. Szukamy najmniejszej, ujemnej.',
      farthest: 'To osoba najdalej od prostej w ogóle, i to nad nią. Szukamy najdalej pod prostą.',
      closest: 'To osoba najbliżej prostej. Szukamy najdalej pod nią: najmniejszej reszty.',
      rawHours: 'To najmniej godzin w ogóle. Pytanie jest o najmniej w porównaniu z prostą, czyli o resztę.',
      fitted: 'To najniższy punkt prostej, nie osoba pod nią. Potrzebne są reszty: `residuals(m)`.',
      value: 'To sama reszta. Pytanie jest o numer wiersza: poda go `which.min()`.',
      all: 'To wszystkie reszty naraz. Wybierz z nich jedną, najmniejszą: `which.min()`.',
      model: 'To cały model. Reszty pokaże `residuals(m)`.',
      general: 'Jeszcze nie to. Reszty pokaże `residuals(m)`, numer najmniejszej `which.min()`.',
    },
    success: 'Dobrze, to wiersz 11 (26 lat, 3 h). Prosta mówi 5.06 h.',
    note: 'Reszta -2.06 to o tyle mniej, niż mówi prosta. Najmniej godzin mają wiersze 18 i 20, ale tam prosta też jest nisko.',

    nearMisses: [
      { name: 'the largest residual', expect: 'above', code: `${MODEL}\nwhich.max(residuals(m))` },
      { name: 'the largest in size', expect: 'farthest', code: `${MODEL}\nwhich.max(abs(residuals(m)))` },
      { name: 'the closest to the line', expect: 'closest', code: `${MODEL}\nwhich.min(abs(residuals(m)))` },
      { name: 'the fewest hours', expect: 'rawHours', code: `${MODEL}\nwhich.min(ankieta$godziny)` },
      { name: 'the lowest point of the line', expect: 'fitted', code: `${MODEL}\nwhich.min(fitted(m))` },
      { name: 'the residual itself', expect: 'value', code: `${MODEL}\nmin(residuals(m))` },
      { name: 'every residual', expect: 'all', code: `${MODEL}\nsort(residuals(m))` },
      { name: 'the model printed', expect: 'model', code: `${MODEL}\nm` },
      { name: 'a number typed in', expect: 'typed', code: `${MODEL}\n11` },
    ],

    diagnose({ value, code, result }) {
      if (isModel(value)) return 'model';
      // The right row typed in: said so. Any other number is diagnosed by what it is.
      if (result?.reason === 'typed' && rowOf(value) === '11') return 'typed';
      if (!value || !isAtomic(value)) return 'general';
      if (rLength(value) > 1) return 'all';
      const x = value.values[0];
      if (typeof x === 'number' && !Number.isInteger(x)) return 'value';
      const row = String(x);
      if (row === '1') return /\babs\s*\(/.test(String(code)) ? 'farthest' : 'above';
      if (row === '16') return 'closest';
      if (row === '18') return 'rawHours';
      if (row === '20') return 'fitted';
      return 'general';
    },
  },
};

export default modelResiduals;
