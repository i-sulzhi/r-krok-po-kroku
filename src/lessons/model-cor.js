/**
 * Lesson: is there a link? Correlation before regression -- module 11, lecture 5, step
 * zero (D101).
 *
 * One idea: `cor()` gives one number from -1 to 1 for two number columns. The sign is
 * the direction, the size how close the points lie to a straight line. It is the same
 * either way round: correlation has no dependent side, `lm()` has.
 *
 * The silent trap: an arch. Income rising to the forties and falling after gives a
 * correlation near 0, though the link is strong. The picture of every `cor()` is the
 * points themselves, so the arch is seen, not only computed. A second, louder trap: one
 * missing answer makes the correlation NA until `use = "complete.obs"`.
 *
 * The bridge to the next exercises: the correlation squared, 0.581, is the R² of the
 * model on the same table. The table is `badanie` of exercise {ćw:model-data} after
 * `na_if()`, with sleep and income added. Numbers checked in R 4.6.2.
 */

import { isAtomic, rLength, isNA, isDataFrame } from '../core/rvalue.js';
import { isModel } from '../core/builtins/models.js';
import { typedIn } from './schema.js';

const SETUP = `# Tabela z poprzedniego ćwiczenia, już przygotowana,
# i dwie nowe kolumny: sen (godziny) i dochód (tys. zł)
czyste <- data.frame(
  wiek = c(19, 20, 21, 21, 22, 22, 23, 23, 24, 25,
           26, 28, 31, 34, 38, 43, 49, 55, 61, 67),
  godziny = c(10, 7, 5, 6, NA, 8, 5, 6, 4, 5,
              3, 4, 3, 4, 2, 3, 2, NA, 2, 1),
  sen = c(7, 6, 8, 7, 6, 9, 7, 8, 6, 7,
          8, 7, 6, 7, 8, 7, 6, 8, 7, 7),
  dochod = c(3, 4, 4, 4, 5, 5, 5, 5, 6, 6,
             7, 8, 9, 9, 10, 10, 9, 6, 3, 1)
)`;

const RAW = 'cor(czyste$wiek, czyste$godziny)';
const COR = 'cor(czyste$wiek, czyste$godziny,\n    use = "complete.obs")';
const SWAPPED = 'cor(czyste$godziny, czyste$wiek,\n    use = "complete.obs")';
const SQUARE = 'cor(czyste$wiek, czyste$godziny,\n    use = "complete.obs")^2';
const SOLUTION = COR;

const R = -0.7623174;

/** One number, alone or in the one-cell table summarise() gives (D102). */
function oneValue(value) {
  if (value && isAtomic(value) && rLength(value) === 1) return value.values[0];
  if (isDataFrame(value) && value.values.length === 1 && rLength(value.values[0]) === 1) return value.values[0].values[0];
  return undefined;
}

function check({ value, code }) {
  if (typedIn(code) || !/\bcor\s*\(/.test(String(code || ''))) return { ok: false, reason: 'typed' };
  const x = oneValue(value);
  const ok = x !== undefined && !isNA(x) && Math.abs(Number(x) - R) < 0.001;
  return ok ? { ok: true } : { ok: false, reason: 'wrong-value' };
}
check.compare = {};

export const modelCor = {
  id: 'model-cor',
  module: 11,
  lecture: 5,
  requires: ['model-data'],
  title: 'Czy jest związek?',
  setup: SETUP,

  scenes: [
    {
      say: '**Korelacja**: jedna liczba od -1 do 1, czy dwie kolumny idą w parze. Wiek i godziny: **-0.762**.',
      code: COR,
      pick: COR,
    },
    {
      say: 'Minus: im starsi, tym mniej godzin. Blisko -1 albo 1: punkty leżą ciasno wzdłuż prostej.',
      code: COR,
      pick: COR,
    },
    {
      say: 'Jedna brakująca odpowiedź i wynik to **NA**. Pary z brakami pomija `use = "complete.obs"`.',
      code: RAW,
      pick: RAW,
    },
    {
      say: 'Blisko 0: kolumny nie idą w parze. Wiek i sen: **-0.02**, punkty bez żadnego kierunku.',
      code: 'cor(czyste$wiek, czyste$sen)',
      pick: 'cor(czyste$wiek, czyste$sen)',
    },
    {
      say: 'Dochód rośnie do 40 lat, potem spada. Korelacja **-0.01**, a związek jest: to łuk.',
      code: 'cor(czyste$wiek, czyste$dochod)',
      pick: 'cor(czyste$wiek, czyste$dochod)',
    },
    {
      say: 'Zamiana kolejności nic nie zmienia: korelacja nie mówi, co od czego zależy.',
      code: SWAPPED,
      pick: SWAPPED,
    },
    {
      say: 'Do kwadratu: **0.581**. Tę liczbę pokaże potem model `lm()` jako R²: ile różnic wyjaśnia.',
      code: SQUARE,
      pick: SQUARE,
    },
  ],

  play: {
    say: 'Twoja kolej. Dopisz osobę daleko od reszty i zobacz, jak zmienia się korelacja.',
    code: COR,
    chips: [
      'cor(c(czyste$wiek, 70), c(czyste$godziny, 12), use = "complete.obs")',
      'ggplot(czyste, aes(x = wiek, y = dochod)) + geom_point()',
      'cor(czyste$godziny, czyste$sen, use = "complete.obs")',
      'summary(lm(godziny ~ wiek, data = czyste))$r.squared',
    ],
  },

  task: {
    prompt: 'Jak silnie wiek wiąże się z godzinami w sieci? Policz korelację w tabeli `czyste`.',
    starter: 'cor(',
    check,
    solution: SOLUTION,
    hints: [
      'Korelację dwóch kolumn liczy `cor(czyste$wiek, czyste$godziny)`.',
      'W godzinach są braki. Pominie je `use = "complete.obs"`.',
    ],
    messages: {
      typed: 'Liczba ma wyjść z `cor()`, nie z wydruku.',
      na: 'Wyszło NA: w godzinach są braki. Dodaj `use = "complete.obs"`.',
      square: 'To korelacja do kwadratu. Pytanie jest o samą korelację.',
      sign: 'Liczba się zgadza, ale bez minusa. Starsi są w sieci krócej: związek jest ujemny.',
      otherPair: 'To inna para kolumn. Pytanie jest o wiek i godziny.',
      model: 'To model. Korelację liczy `cor()`, a model przyjdzie w ćwiczeniu {ćw:model-line}.',
      general: 'Jeszcze nie to: `cor(czyste$wiek, czyste$godziny, use = "complete.obs")`.',
    },
    success: 'Dobrze: -0.762, silny związek ujemny.',
    note: 'Korelacja mówi, jak ciasno punkty leżą przy prostej. O ile zmieniają się godziny, powie `lm()`.',

    nearMisses: [
      { name: 'the missing answers left in', expect: 'na', code: RAW },
      { name: 'the square', expect: 'square', code: `${SQUARE}` },
      { name: 'na.rm as in mean()', expect: 'error', code: 'cor(czyste$wiek, czyste$godziny, na.rm = TRUE)' },
      { name: 'summarise() without use', expect: 'na', code: 'czyste |> summarise(r = cor(wiek, godziny))' },
      { name: 'without the minus', expect: 'sign', code: 'abs(cor(czyste$wiek, czyste$godziny, use = "complete.obs"))' },
      { name: 'age and sleep', expect: 'otherPair', code: 'cor(czyste$wiek, czyste$sen)' },
      { name: 'a model', expect: 'model', code: 'lm(godziny ~ wiek, data = czyste)' },
      { name: 'a number typed in', expect: 'typed', code: '-0.76' },
    ],

    diagnose({ value, code, result }) {
      if (isModel(value)) return 'model';
      if (result?.reason === 'typed' && typedIn(code)) return 'typed';
      const x = oneValue(value);
      if (x === undefined) return 'general';
      if (isNA(x)) return 'na';
      const v = Number(x);
      if (Math.abs(v - R * R) < 0.002) return 'square';
      if (Math.abs(v + R) < 0.002) return 'sign';
      if (Math.abs(v + 0.0176) < 0.002 || Math.abs(v + 0.0121) < 0.002) return 'otherPair';
      return 'general';
    },
  },
};

export default modelCor;
