/**
 * Lesson: arithmetic on a whole vector -- module 1.
 *
 * `oceny * 20` runs once per cell, and a single number is silently repeated to
 * match -- recycling. That second fact is what makes `x - mean(x)` work later, and
 * what produces the famous half-repeated warning when lengths do not divide. The
 * elementwise picture draws both as shapes: one line per pair, fanning out from the
 * reused cell.
 */

import { resultCheck } from './schema.js';
import { rLength, isAtomic } from '../core/rvalue.js';

// The same answers as the survey column `ocena` in lesson 1.
const SETUP = `# Odpowiedzi ośmiu osób, skala 1-5
oceny <- c(4, 5, 3, 5, 2, 4, 5, 3)`;

const SOLUTION = 'oceny - mean(oceny)';

export const vectorised = {
  id: 'vectorised',
  module: 1,
  requires: ['types'],
  title: 'Działania na całym wektorze',
  setup: SETUP,

  scenes: [
    {
      say: 'W arkuszu piszesz `=D2*20` i ciągniesz w dół. W R jedno `oceny * 20` liczy **każdą komórkę**.',
      code: 'oceny * 20',
      pick: 'oceny * 20',
      tap: '20',
      show: { excel: { kind: 'fill', col: 'D', name: 'ocena' } },
    },
    {
      say: 'Krótszy wektor **powtarza się w kółko**, aż starczy dla dłuższego.',
      code: 'oceny + c(0, 100)',
      pick: 'oceny + c(0, 100)',
    },
    {
      say: 'Gdy długości się nie dzielą, powtórzenie urywa się w połowie.',
      code: 'oceny + c(0, 100, 200)',
      pick: 'oceny + c(0, 100, 200)',
    },
    {
      say: 'Porównanie też działa komórka po komórce: wychodzi TRUE albo FALSE.',
      code: 'oceny > 3',
      pick: 'oceny > 3',
    },
  ],

  play: {
    code: 'oceny * 20',
    chips: [
      'oceny / 5',
      'oceny * c(1, 2)',
      'oceny + 1:8',
      'oceny > mean(oceny)',
      'sum(oceny > 3)',
    ],
  },

  task: {
    prompt: 'Odejmij od każdej oceny **średnią ocenę**. Wyjdzie osiem odchyleń od przeciętnej.',
    starter: '# oceny minus ich średnia\n',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['mean'] }),
    solution: SOLUTION,
    hints: [
      'Średnia to `mean(oceny)`, czyli jedna liczba. Jedna liczba powtarza się dla każdej komórki.',
      'Całość to jedno wyrażenie: wektor, minus, `mean(wektor)`.',
    ],
    messages: {
      'missing.mean': 'Potrzebna jest średnia: `mean(oceny)`.',
      collapsed: 'Wyszła jedna liczba, sama średnia. Odejmij ją jeszcze od całego wektora.',
      wrongLength: 'Wyników ma być osiem, po jednym na ocenę.',
      notCentred: 'To nie odchylenia od średniej: po odjęciu średniej suma wyników wynosi zero.',
      general: 'Jeszcze nie to. Potrzebne jest: oceny minus ich średnia.',
    },
    success: 'Tak. Osiem odchyleń i żadnej pętli.',
    note: 'Dodatnie wartości to odpowiedzi powyżej przeciętnej, a ujemne poniżej. Razem sumują się do zera.',

    nearMisses: [
      { name: 'computed the mean only', expect: 'collapsed', code: 'mean(oceny)' },
      { name: 'centred but shifted', expect: 'notCentred', code: 'oceny - mean(oceny) + 1' },
      { name: 'subtracted a guess instead of the mean', expect: 'missing.mean', code: 'oceny - 4' },
    ],

    diagnose({ value, result }) {
      if (!value || !isAtomic(value)) return 'general';
      if (rLength(value) === 1) return 'collapsed';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      if (rLength(value) !== 8) return 'wrongLength';
      const sum = value.values.reduce((a, b) => a + b, 0);
      // Centred data sums to (near) zero; anything else means the mean was not removed.
      if (Math.abs(sum) > 1e-8) return 'notCentred';
      return 'general';
    },
  },
};

export default vectorised;
