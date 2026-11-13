/**
 * Lesson: what machine learning is -- module 12, lecture 6 (D115).
 *
 * The author asked for an introduction before the practice: a picture with the main
 * ideas, then code. The examples and the rule are the plot and lm() the student knows;
 * five scenes without code (D27) follow, drawn by viz/ml-intro.js on the
 * 30 ESS internet users the lecture uses: examples, a rule learned from them (the
 * model), a forecast for a new person with an age slider, the split into learning and
 * test people, the error on people the model never saw, a flexibility slider that
 * shows overfitting, and the five terms the exercises and lab 2 use, each pointing to
 * where it is practised.
 *
 * The task is the first line of code of the lecture and is meant to be easy: the rule
 * from the examples is the lm() of lecture 5. The next exercise asks whether it
 * forecasts new people.
 */

import { isModel, isModelSummary } from '../core/builtins/models.js';
import { isAtomic } from '../core/rvalue.js';

const SETUP = `# 30 internautów z ESS 2023, Polska: wiek i minuty w sieci
# dziennie (pytanie zadano tylko korzystającym z internetu)
ess <- data.frame(
  wiek = c(15, 16, 17, 20, 22, 22, 23, 23, 24, 27,
           27, 27, 31, 38, 39, 40, 40, 41, 42, 45,
           48, 57, 58, 60, 64, 66, 67, 77, 79, 84),
  minuty = c(480, 300, 90, 360, 240, 120, 180, 360, 360,
             500, 120, 300, 180, 300, 120, 270, 210, 300,
             60, 90, 240, 330, 120, 90, 150, 120, 300,
             180, 120, 60)
)`;

const SOLUTION = 'lm(minuty ~ wiek, data = ess)';
const POINTS = `ggplot(ess, aes(x = wiek, y = minuty)) +
  geom_point()`;

/** The rule from all 30 examples: minutes explained by age. */
function check({ value }) {
  if (!isModel(value)) return { ok: false, reason: 'wrong-value' };
  const info = value.lm;
  const ok = info.responseCode === 'minuty' && info.terms.length === 1 && info.terms[0].code === 'wiek' && info.n === 30;
  return ok ? { ok: true } : { ok: false, reason: 'wrong-value' };
}
check.compare = {};

export const mlIntro = {
  id: 'ml-intro',
  module: 12,
  lecture: 6,
  requires: ['model-report'],
  title: 'Czym jest uczenie maszynowe?',
  setup: SETUP,

  scenes: [
    {
      say: '**Uczenie maszynowe** to szukanie reguły w przykładach. Tu przykładami są 30 osób z ESS.',
      code: POINTS,
      pick: POINTS,
    },
    {
      say: 'Regułę znalezioną w przykładach nazywamy **modelem**. Prosta z wykładu 5 też jest modelem.',
      code: SOLUTION,
      pick: SOLUTION,
    },
    {
      say: 'Model służy do **prognozy**, czyli zgaduje tych, o których nie ma danych. Przesuń suwak wieku.',
      picture: { kind: 'ml', step: 'predict' },
    },
    {
      say: 'Model sprawdza się na ludziach, których **nie widział**. Uczący go uczą, testowi sprawdzają.',
      picture: { kind: 'ml', step: 'split' },
    },
    {
      say: 'Liczy się **pomyłka na nowych** osobach. Na swoich danych model zawsze wygląda lepiej.',
      picture: { kind: 'ml', step: 'error' },
    },
    {
      say: 'Bardziej giętki model nie jest lepszy. Przesuń suwak i patrz na obie pomyłki.',
      picture: { kind: 'ml', step: 'flex' },
    },
    {
      say: 'Pięć słów, które wrócą w ćwiczeniach i w RStudio. Potem już tylko praktyka.',
      picture: {
        kind: 'ml',
        step: 'terms',
        terms: [
          { name: '**Uczenie maszynowe** (machine learning)', say: 'Modele ocenia się po tym, jak przewidują nowe przypadki, a nie jak opisują stare. W R robi to pakiet caret, w Laboratorium 2.' },
          { name: '**Zbiór uczący i testowy** (training set, test set)', say: 'Ludzie, na których model się uczy, i ludzie, na których go sprawdzamy. Ćwiczenie {ćw:model-split}.' },
          { name: '**RMSE** (root mean square error)', say: 'Pierwiastek ze średniej kwadratów pomyłek, czyli typowa pomyłka w jednostkach danych. Ćwiczenie {ćw:model-error}.' },
          { name: '**Przeuczenie** (overfitting)', say: 'Model zapamiętuje swoje dane zamiast reguły. Na nich jest dobry, na nowych słaby. Ćwiczenie {ćw:model-overfit}.' },
          { name: '**Sprawdzian krzyżowy** (cross-validation)', say: 'Podział powtórzony kilka razy, a pomyłki uśrednione, żeby wynik nie zależał od jednego losowania. Ćwiczenie {ćw:model-cv}.' },
        ],
      },
    },
  ],

  play: {
    say: 'Twoja kolej. Narysuj przykłady inaczej albo zbuduj z nich regułę.',
    code: POINTS,
    chips: [
      'lm(minuty ~ wiek, data = ess)',
      'nrow(ess)',
      'predict(lm(minuty ~ wiek, data = ess), data.frame(wiek = 40))',
    ],
  },

  task: {
    prompt: 'Zbuduj model, czyli regułę z przykładów: prostą minut w sieci według wieku dla 30 osób z `ess`.',
    starter: '',
    check,
    solution: SOLUTION,
    hints: [
      'To `lm()` z wykładu 5. Przed `~` stoi to, co zgadujemy, czyli `minuty`.',
      'Całość: `lm(minuty ~ wiek, data = ess)`.',
    ],
    messages: {
      swapped: 'Strony `~` są zamienione. Zgadujemy minuty z wieku: `minuty ~ wiek`.',
      notModel: 'To nie sam model. Zadanie chce wyniku `lm()`, bez `coef()` ani `summary()`.',
      general: 'Jeszcze nie to: `lm(minuty ~ wiek, data = ess)`.',
    },
    success: 'Dobrze, to jest model. Jak zgaduje nowych, sprawdzisz dalej.',
    note: 'Model z wszystkich 30 osób nie mówi jeszcze, jak przewiduje nowe. Dlatego w następnym ćwiczeniu dzielimy ludzi.',

    nearMisses: [
      { name: 'the sides of ~ swapped', expect: 'swapped', code: 'lm(wiek ~ minuty, data = ess)' },
      { name: 'the coefficients only', expect: 'notModel', code: 'coef(lm(minuty ~ wiek, data = ess))' },
      { name: 'the summary', expect: 'notModel', code: 'summary(lm(minuty ~ wiek, data = ess))' },
      { name: 'without data =', expect: 'error', code: 'lm(minuty ~ wiek)' },
    ],

    diagnose({ value }) {
      if (isModel(value)) return value.lm.responseCode === 'wiek' ? 'swapped' : 'general';
      if (isModelSummary(value) || (value && isAtomic(value))) return 'notModel';
      return 'general';
    },
  },
};

export default mlIntro;
