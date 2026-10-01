/**
 * Lesson: missing values -- module 1.
 *
 * NA means "unknown", so anything computed from it is unknown too -- and
 * `na.rm = TRUE` does not repair the data, it changes the denominator. The funnel
 * picture shows both: the NA cell poisoning the result, then the same cells with
 * the gaps struck out and the count shrinking.
 *
 * The scene demonstrates `na.rm` on sum(), and the task asks for mean(): the student
 * transfers the argument rather than copying a line.
 */

import { resultCheck } from './schema.js';
import { rLength, isAtomic, isNA } from '../core/rvalue.js';

const SETUP = `# Odpowiedzi dziesięciu osób; dwie nie odpowiedziały
oceny <- c(4, 5, NA, 3, 5, 2, NA, 4, 5, 3)`;

const SOLUTION = 'mean(oceny, na.rm = TRUE)';

export const missing = {
  id: 'missing',
  module: 1,
  requires: ['vectorised'],
  title: 'Braki danych: NA',
  setup: SETUP,

  scenes: [
    {
      say: '**NA** znaczy „nie wiadomo”. Działanie z nieznanym daje nieznane.',
      // The data is created on screen, not only in the hidden setup.
      code: `${SETUP}\noceny + 1`,
      pick: 'oceny + 1',
    },
    {
      say: 'W arkuszu `ŚREDNIA` pomija puste komórki. W R jedno NA robi **całą średnią** nieznaną.',
      code: 'mean(oceny)',
      pick: 'mean(oceny)',
      show: { excel: { kind: 'blank', col: 'D', name: 'ocena' } },
    },
    {
      say: '`na.rm = TRUE` pomija braki. Wtedy R liczy **z mniejszej liczby** wartości.',
      code: 'sum(oceny, na.rm = TRUE)',
      pick: 'sum(oceny, na.rm = TRUE)',
      tap: 'na.rm = TRUE',
    },
    {
      say: '`is.na()` pokazuje, **gdzie** są braki.',
      code: 'is.na(oceny)',
      pick: 'is.na(oceny)',
    },
  ],

  play: {
    code: 'is.na(oceny)',
    chips: [
      'sum(is.na(oceny))',
      'sum(!is.na(oceny))',
      'length(oceny)',
      'NA > 3',
      'NA == NA',
      'NA & FALSE',
    ],
  },

  task: {
    prompt: 'Policz **średnią ocenę** tych, którzy odpowiedzieli.',
    starter: '# średnia mimo braków\n',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['mean'] }),
    solution: SOLUTION,
    hints: [
      'Samo `mean(oceny)` da NA. I słusznie, bo dwie wartości są nieznane.',
      'Pozwól pominąć braki tym samym argumentem co w scenie 3: `na.rm = TRUE`.',
    ],
    messages: {
      'missing.mean': 'Zadanie prosi o średnią, więc użyj `mean()`.',
      gotNA: 'Wyszło NA, bo braki wciąż biorą udział w obliczeniu. Dopisz `na.rm = TRUE`.',
      notOneNumber: 'Średnia to jedna liczba.',
      countedGaps: 'Tak wyszłoby, gdyby braki były zerami. NA to nie zero, więc pomiń je przez `na.rm = TRUE`.',
      general: 'Jeszcze nie to: `mean(oceny, na.rm = TRUE)`.',
    },
    success: 'Dobrze, 3.875 policzone z ośmiu odpowiedzi.',
    note: 'W raporcie: „średnia 3,9 (n = 8 z 10)”. Sama średnia, bez n, jest niepełna.',

    nearMisses: [
      { name: 'forgot na.rm', expect: 'gotNA', code: 'mean(oceny)' },
      { name: 'treated the gaps as zeros', expect: 'countedGaps',
        code: 'mean(ifelse(is.na(oceny), 0, oceny))' },
      { name: 'counted the answers instead', expect: 'missing.mean', code: 'sum(!is.na(oceny))' },
    ],

    diagnose({ value, result }) {
      if (!value || !isAtomic(value)) return 'general';
      if (rLength(value) === 1 && isNA(value.values[0])) return 'gotNA';
      if (rLength(value) === 1 && Math.abs(value.values[0] - 3.1) < 1e-8) return 'countedGaps';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      if (rLength(value) !== 1) return 'notOneNumber';
      return 'general';
    },
  },
};

export default missing;
