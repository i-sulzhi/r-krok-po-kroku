/**
 * Lesson: two variables at once -- module 11, lecture 5 (D97).
 *
 * One idea: `y ~ x1 + x2` compares people who are alike in x2. In this survey the
 * women spend 2.3 hours more online than the men, but the women are also 20 years
 * younger, and hours fall with age. With age in the model the gap between the sexes
 * is 0.08 hours: almost nothing. "Controlling for age" is drawn as two parallel lines,
 * one per sex, nearly on top of each other.
 *
 * The silent trap is reading the raw gap as an effect of sex. Causality is said once,
 * in the note. Numbers checked in R 4.6.2 when the lecture was planned.
 */

import { isAtomic, rLength } from '../core/rvalue.js';
import { isModel } from '../core/builtins/models.js';

const SETUP = `# Dwanaście osób z innej ankiety: kobiety są tu młodsze
siec <- data.frame(
  plec = rep(c("K", "M"), each = 6),
  wiek = c(19, 21, 22, 24, 27, 33,
           26, 34, 41, 48, 55, 63),
  godziny = c(6, 7, 5, 6, 5, 4, 5, 5, 3, 3, 2, 1)
)`;

const RAW = 'lm(godziny ~ plec, data = siec)';
const AGE = 'lm(wiek ~ plec, data = siec)';
const BOTH = 'lm(godziny ~ plec + wiek, data = siec)';
const SOLUTION = `coef(${BOTH})["plecM"]`;

/** The gap between the sexes at the same age, 0.0806, from either side. */
function check({ value, code }) {
  if (!/\blm\s*\(/.test(String(code || ''))) return { ok: false, reason: 'typed' };
  if (!value || !isAtomic(value) || rLength(value) !== 1) return { ok: false, reason: 'wrong-value' };
  const x = Math.abs(Number(value.values[0]));
  return Math.abs(x - 0.0806) <= 0.005 ? { ok: true } : { ok: false, reason: 'wrong-value' };
}
check.compare = { tolerance: 0.06 };

export const modelControl = {
  id: 'model-control',
  module: 11,
  lecture: 5,
  requires: ['model-summary'],
  title: 'Dwie zmienne naraz',
  setup: SETUP,

  scenes: [
    {
      say: 'W tej ankiecie kobiety są w sieci o **2.3 h** dłużej niż mężczyźni. Czy to płeć?',
      code: RAW,
      pick: RAW,
    },
    {
      say: 'Kobiety są tu też o **20 lat** młodsze. A młodsi są dłużej w sieci.',
      code: AGE,
      pick: AGE,
    },
    {
      say: '`+ wiek` porównuje ludzi w tym samym wieku. Różnica płci spada do **0.08 h**.',
      code: BOTH,
      pick: BOTH,
      tap: 'plec + wiek',
    },
  ],

  play: {
    say: 'Twoja kolej. Zamień kolejność zmiennych albo porównaj R² modeli.',
    keep: `m <- ${BOTH}`,
    code: 'coef(m)',
    chips: [
      'lm(godziny ~ wiek + plec, data = siec)',
      'lm(godziny ~ wiek, data = siec)',
      'summary(m)',
      'summary(lm(godziny ~ plec, data = siec))$r.squared',
    ],
  },

  task: {
    prompt: 'Policz różnicę w godzinach między mężczyznami a kobietami **w tym samym wieku**. Podaj jedną liczbę.',
    starter: '',
    check,
    solution: SOLUTION,
    hints: [
      'W tym samym wieku znaczy: wiek też jest w modelu, `plec + wiek`.',
      'Różnicę płci pokazuje współczynnik `plecM`: `coef(m)["plecM"]`.',
    ],
    messages: {
      typed: 'Liczba ma wyjść z modelu z `lm()`, nie z rysunku.',
      raw: 'To różnica bez wieku: kobiety są tu młodsze. Dodaj wiek do modelu: `plec + wiek`.',
      age: 'To nachylenie wieku, nie różnica płci. Potrzebny jest współczynnik `plecM`.',
      intercept: '`(Intercept)` to prosta kobiet przy wieku 0. Różnicę płci pokazuje `plecM`.',
      model: 'To cały model. Jedną liczbę wyjmij z `coef()`: `coef(m)["plecM"]`.',
      all: 'To wszystkie współczynniki naraz. Potrzebny jest jeden: `plecM`.',
      general: 'Jeszcze nie to: `coef(lm(godziny ~ plec + wiek, data = siec))["plecM"]`.',
    },
    success: 'Dobrze: 0.08 h, prawie nic. Różnicę robił wiek, nie płeć.',
    note: 'Kobiety są tu młodsze, a młodsi są dłużej w sieci. „Kontrolować wiek” to porównać ludzi w tym samym wieku.',

    nearMisses: [
      { name: 'the raw gap', expect: 'raw', code: `coef(${RAW})["plecM"]` },
      { name: 'the age slope', expect: 'age', code: `coef(${BOTH})["wiek"]` },
      { name: 'the intercept', expect: 'intercept', code: `coef(${BOTH})[1]` },
      { name: 'the model printed', expect: 'model', code: BOTH },
      { name: 'all coefficients', expect: 'all', code: `coef(${BOTH})` },
      { name: 'a number typed in', expect: 'typed', code: '0.08' },
    ],

    diagnose({ value, result }) {
      if (isModel(value)) return 'model';
      if (result?.reason === 'typed') return 'typed';
      if (!value || !isAtomic(value)) return 'general';
      if (rLength(value) > 1) return 'all';
      const x = Number(value.values[0]);
      const near = (a, b) => Math.abs(a - b) < 0.01;
      if (near(Math.abs(x), 2.333)) return 'raw';
      if (near(x, -0.1197)) return 'age';
      if (near(x, 8.4126)) return 'intercept';
      return 'general';
    },
  },
};

export default modelControl;
