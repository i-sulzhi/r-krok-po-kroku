/**
 * Lesson: a factor is not a number -- module 3.
 *
 * The trap that costs real analyses. A numeric column read from a file as a factor
 * looks like numbers on screen, and `as.numeric()` hands back the codes instead:
 * for the answers 0, 1, 2, 5 the codes are 1, 2, 3, 4, so "5 children" becomes 4
 * and the mean is wrong with no warning at all.
 *
 * The lesson opens without code (D27): the factor as a small table, the label each
 * person gave beside the code R keeps for it. The gap between "5" and code 4 is
 * visible before any function is called. Then the same thing typed: the factor
 * printed, `as.numeric()` giving codes, and the way round through text.
 *
 * The task asks for the mean. The mean of the codes (2.125) is the anticipated
 * wrong answer, and is diagnosed as such.
 */

import { resultCheck } from './schema.js';
import { isAtomic, rLength } from '../core/rvalue.js';

const SETUP = `# Liczba dzieci, wczytana z pliku jako czynnik
dzieci <- factor(c("2", "0", "1", "5",
                   "0", "2", "1", "0"))`;

const VIA_TEXT = 'as.numeric(as.character(dzieci))';
const SOLUTION = `mean(${VIA_TEXT})`;

export const factorNumbers = {
  id: 'factor-numbers',
  module: 3,
  requires: ['levels'],
  title: 'Czynnik to nie liczby',
  setup: SETUP,

  scenes: [
    {
      say: 'Widzisz liczby dzieci, ale to **etykiety**. Pod „5” leży kod 4. Kliknij osobę.',
      picture: { kind: 'pairs', question: 'Ile masz dzieci?', factor: 'dzieci', open: true },
    },
    {
      say: 'Czynnik poznasz po linii **Levels** i po braku cudzysłowów.',
      code: `${SETUP}\ndzieci`,
    },
    {
      say: '`as.numeric()` oddaje **kody**, a nie liczby dzieci. Zamiast 5 jest 4.',
      code: 'as.numeric(dzieci)',
    },
    {
      say: 'Najpierw na tekst, potem na liczby. Wtedy 5 to znowu **5**.',
      code: VIA_TEXT,
      pick: VIA_TEXT,
      tap: 'as.character(dzieci)',
    },
  ],

  play: {
    code: 'levels(dzieci)',
    chips: [
      'summary(dzieci)',
      'as.character(dzieci)',
      'mean(as.numeric(dzieci))',
      'table(dzieci)',
      'sum(dzieci == "0")',
      'class(dzieci)',
    ],
  },

  task: {
    prompt: 'Policz **średnią liczbę dzieci**. Uwaga: `dzieci` to czynnik, a nie liczby.',
    starter: '# średnia liczba dzieci\n',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['mean'] }),
    solution: SOLUTION,
    hints: [
      '`mean(dzieci)` nie zadziała, bo kategorie nie mają średniej. Najpierw zrób z nich liczby.',
      'Droga przez tekst: `as.numeric(as.character(dzieci))`, a wokół `mean()`.',
    ],
    messages: {
      'missing.mean': 'Zadanie prosi o średnią, więc użyj `mean()`.',
      codes: 'To średnia z **kodów**, a nie z liczby dzieci. Najpierw `as.character()`, potem `as.numeric()`.',
      notOneNumber: 'Liczby są już dobre. Ma być jedna: otocz je `mean()`.',
      general: 'Jeszcze nie to: czynnik na tekst, tekst na liczby, a z liczb `mean()`.',
    },
    success: 'Dobrze, średnio 1.375 dziecka.',
    note: 'Średnia z kodów dałaby 2.125. R by nie ostrzegł, a wynik poszedłby do raportu.',

    nearMisses: [
      { name: 'averaged the codes', expect: 'codes', code: 'mean(as.numeric(dzieci))' },
      { name: 'converted but never averaged', expect: 'notOneNumber', code: VIA_TEXT },
      { name: 'asked for the mean of the factor itself', expect: 'error', code: 'mean(dzieci)' },
    ],

    diagnose({ value, result }) {
      if (!value || !isAtomic(value)) return 'general';
      if (rLength(value) !== 1) return 'notOneNumber';
      if (Math.abs(value.values[0] - 2.125) < 1e-6) return 'codes';   // mean of the codes
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      return 'general';
    },
  },
};

export default factorNumbers;
