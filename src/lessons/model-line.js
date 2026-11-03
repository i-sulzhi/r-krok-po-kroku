/**
 * Lesson: a straight line through the points -- module 11, lecture 5 (D91).
 *
 * Exercise 29 ended on "the older, the fewer hours online". This one asks the next
 * question: by how much per year? One idea: `lm(godziny ~ wiek)` is a line, and its
 * slope is the answer in the units of the data, hours per one year of age.
 *
 * The silent trap is the direction of the formula. `lm(wiek ~ godziny)` runs without
 * a word and answers another question, with another line; it is shown under the
 * right one, as a pair (pitfalls: a trap is shown with its repair).
 *
 * The data are the twenty people of exercise 29, unchanged, so the points are ones
 * the student has already seen. The numbers the texts state were checked in R 4.6.2:
 * slope -0.1228 h per year (7.4 min), -3.684 h per 30 years.
 *
 * The task asks for 30 years (from 20 to 50), not 10: the slope picture draws a step of
 * 10 with its change written beside it, and a task the picture answers is copied.
 */

import { resultCheck, typedIn } from './schema.js';
import { isModel, isModelSummary } from '../core/builtins/models.js';
import { isAtomic, rLength, getNames, isNA } from '../core/rvalue.js';
import { PY_LINE } from './python.js';

const SETUP = `# Dwadzieścia osób: wiek, płeć, godziny w internecie dziennie
ankieta <- data.frame(
  wiek = c(19, 20, 21, 21, 22, 22, 23, 23, 24, 25,
           26, 28, 31, 34, 38, 43, 49, 55, 61, 67),
  plec = rep(c("K", "M"), 10),
  godziny = c(10, 7, 5, 6, 4, 8, 5, 6, 4, 5,
              3, 4, 3, 4, 2, 3, 2, 1, 2, 1)
)`;

const POINTS = 'ggplot(ankieta, aes(x = wiek, y = godziny)) +\n  geom_point()';
const LM = 'lm(godziny ~ wiek, data = ankieta)';
const MODEL = 'm <- lm(godziny ~ wiek, data = ankieta)';
const SWAPPED = 'lm(wiek ~ godziny, data = ankieta)';

const SOLUTION = `${MODEL}\ncoef(m)["wiek"] * 30`;

const base = resultCheck({ expected: SOLUTION, compare: { tolerance: 0.01 } });
/** The number must come out of the model, not be typed in from the picture. */
const fromModel = (code) => /\bcoef(ficients)?\s*\(|\$coefficients|\bpredict\s*\(/.test(String(code || ''));
function check(ctx) {
  if (!fromModel(ctx.code)) return { ok: false, reason: 'typed' };
  return base(ctx);
}
check.compare = base.compare;

export const modelLine = {
  id: 'model-line',
  module: 11,
  lecture: 5,
  requires: ['plot-types'],
  title: 'O ile mniej z każdym rokiem?',
  setup: SETUP,

  scenes: [
    {
      say: 'Starsi są w sieci krócej. Ale **o ile** krócej z każdym rokiem? Punkty tego nie mówią.',
      code: POINTS,
      pick: POINTS,
    },
    {
      say: '`lm()` kładzie przez punkty **jedną prostą**: tę, która pasuje do nich najlepiej.',
      code: LM,
      pick: LM,
    },
    {
      say: 'Przed `~` **zmienna zależna**: to, co wyjaśniamy. Za `~` **niezależna**: to, czym.',
      code: LM,
      pick: 'godziny',
      tap: 'wiek',
    },
    {
      say: 'Zależna to wynik, który chcemy przewidzieć. Niezależna to to, od czego on może zależeć.',
      code: LM,
      pick: 'wiek',
    },
    {
      say: 'Łączy je nachylenie: rok więcej to **0.123 h mniej**, około 7 minut. To liczba przy `wiek`.',
      code: `${MODEL}\ncoef(m)`,
      pick: 'coef(m)',
    },
    {
      say: '`(Intercept)` to prosta przy wieku 0. Nikt w danych nie ma 0 lat, więc tego nie czytamy.',
      code: `${MODEL}\ncoef(m)["(Intercept)"]`,
      pick: 'coef(m)["(Intercept)"]',
    },
    {
      say: 'Strony `~` mają znaczenie. Wiek zależny od godzin to **inna prosta** i inne pytanie.',
      code: `${SWAPPED}\n${LM}`,
      pick: SWAPPED,
      tap: LM,
    },
  ],

  play: {
    say: 'Twoja kolej. Przelicz nachylenie na minuty albo zamień strony `~`.',
    keep: MODEL,
    code: 'coef(m)',
    chips: [
      'coef(m)["wiek"] * 60',
      'm',
      'cor(ankieta$wiek, ankieta$godziny)',
      SWAPPED,
      'coef(m)["(Intercept)"]',
    ],
    // The same lines in statsmodels and scikit-learn (D93).
    python: PY_LINE,
  },

  task: {
    prompt: 'Jak zmienia się liczba godzin w sieci, gdy wiek rośnie o **30 lat**, z 20 do 50? Policz to z modelu `m`.',
    starter: `${MODEL}\n`,
    check,
    solution: SOLUTION,
    hints: [
      'Nachylenie to zmiana na jeden rok. Weź je z `coef(m)`.',
      'Jeden rok to `coef(m)["wiek"]`. Trzydzieści lat to trzydzieści razy więcej.',
    ],
    messages: {
      typed: 'Wynik ma wyjść z modelu, nie z rysunku. Weź nachylenie z `coef(m)`.',
      model: 'To cały model. Jego liczby pokazuje `coef(m)`.',
      summary: 'To cały opis modelu. Potrzebna jedna liczba: nachylenie przy `wiek` razy 30.',
      noName: 'Wyszło NA: w `coef(m)` nie ma takiej nazwy. Wielkość liter się liczy: `"wiek"`.',
      wholeVector: 'To dwie liczby naraz. Potrzebna jest ta przy `wiek`: `coef(m)["wiek"]`.',
      perYear: 'To zmiana na jeden rok. Pytanie jest o 30 lat.',
      perTen: 'To zmiana na 10 lat, ta z rysunku. Pytanie jest o 30 lat.',
      minutes: 'To minuty na jeden rok. Pytanie jest o godziny na 30 lat.',
      intercept: '`(Intercept)` to prosta przy wieku 0. Zmianę z wiekiem mówi nachylenie przy `wiek`.',
      swapped: 'To prosta odwrotna: wiek wyjaśniany godzinami. Przed `~` stoją godziny.',
      sign: 'Liczba się zgadza, ale bez minusa. Godzin ubywa, więc zmiana jest ujemna.',
      cor: 'Korelacja nie mówi, o ile godzin. Mówi to nachylenie z `coef(m)`.',
      general: 'Jeszcze nie to. Nachylenie przy `wiek` razy 30.',
    },
    success: 'Dobrze: -3.68, czyli o 3.68 godziny mniej.',
    note: 'Minus w `coef(m)` znaczy „mniej”. To średnio dla tych 20 osób, nie prawo dla każdego.',

    nearMisses: [
      { name: 'the model printed', expect: 'model', code: MODEL + '\nm' },
      { name: 'both coefficients', expect: 'wholeVector', code: MODEL + '\ncoef(m) * 30' },
      { name: 'the ten years of the picture', expect: 'perTen', code: MODEL + '\ncoef(m)["wiek"] * 10' },
      { name: 'one year only', expect: 'perYear', code: MODEL + '\ncoef(m)["wiek"]' },
      { name: 'minutes per year', expect: 'minutes', code: MODEL + '\ncoef(m)["wiek"] * 60' },
      { name: 'the intercept', expect: 'intercept', code: MODEL + '\ncoef(m)[1] * 30' },
      { name: 'the formula the other way round', expect: 'swapped', code: 'm <- lm(wiek ~ godziny, data = ankieta)\ncoef(m)[2] * 30' },
      { name: 'the minus left out', expect: 'sign', code: MODEL + '\n-coef(m)["wiek"] * 30' },
      { name: 'the correlation', expect: 'cor', code: 'cor(ankieta$wiek, ankieta$godziny) * 30' },
      { name: 'a number typed in', expect: 'typed', code: MODEL + '\n-3.68' },
      { name: 'the summary printed', expect: 'summary', code: MODEL + '\nsummary(m)' },
      { name: 'a name in the wrong case', expect: 'noName', code: MODEL + '\ncoef(m)["Wiek"] * 30' },
    ],

    diagnose({ value, code, result }) {
      if (isModel(value)) return 'model';
      if (isModelSummary(value)) return 'summary';
      if (/\bcor\s*\(/.test(String(code))) return 'cor';
      if (result?.reason === 'typed' && typedIn(code)) return 'typed';
      if (!value) return 'general';
      if (!isAtomic(value) || value.type !== 'double') return 'general';
      if (rLength(value) === 2) return 'wholeVector';
      if (rLength(value) !== 1) return 'general';
      const x = value.values[0];
      if (isNA(x)) return 'noName';
      const near = (a, b) => Math.abs(a - b) <= 0.03 * Math.max(1, Math.abs(b));
      const name = String(getNames(value)?.values[0] ?? '');
      if (name === '(Intercept)') return 'intercept';
      if (/\bwiek\s*~\s*godziny\b/.test(String(code))) return 'swapped';
      if (near(x, -0.1228)) return 'perYear';
      if (near(x, -1.2279)) return 'perTen';
      if (near(x, -7.3675)) return 'minutes';
      if (near(x, 3.6838)) return 'sign';
      return 'general';
    },
  },
};

export default modelLine;
