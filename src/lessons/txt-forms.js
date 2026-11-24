/**
 * Lesson: one word, many forms -- module 13, lecture 8 (D146).
 *
 * Polish inflects: "sąd" is also "sądu", "sądów", "sądy", "sądzie". Counted form by form,
 * the base form "sąd" is only 13 of the word's 194 uses. A pattern on the start of the
 * word gathers the forms, which is what lemmatisation does for every word at once.
 *
 * The silent trap: `^sąd` also gathers other words that start the same way, the
 * judiciary ("sądownictwa" 135, more than any form of "sąd") and the adjectives
 * ("sądowych", "sądowniczej"). `^sądow` catches exactly those, and "sądów" survives
 * because "ó" is not "o". A near-miss: `^sądo` also drops "sądom".
 *
 * The table is every word starting with "sąd" in the whole transcript of 2023-12-20 and
 * how often it occurs, counted in R 4.5.2 after lower case and punctuation off the edges
 * (the same with unnest_tokens()). Totals: 365 in all, 13 "sąd", 194 forms of "sąd" in 9
 * forms, 151 "sądownictwo", 171 starting with "sądow", 193 with `^sądo` dropped.
 */

import { typedIn } from './schema.js';
import { isAtomic, rLength } from '../core/rvalue.js';

const SETUP = `# Słowa zaczynające się od „sąd” w całym stenogramie
# z 20 grudnia 2023 i ile razy padło każde
formy <- data.frame(
  slowo = c("sądownictwa", "sądów", "sądu", "sądy", "sąd",
            "sądzie", "sądach", "sądami", "sądownictwie",
            "sądownictwo", "sądowych", "sądowniczej", "sądem",
            "sądownicza", "sądowej", "sądom", "sądowniczego"),
  n = c(135, 66, 51, 32, 13, 10, 9, 8, 8, 8, 8, 6, 4, 3, 2, 1, 1)
)`;

const OTHER = 'inny <- str_detect(formy$slowo, "^sądow")';
const SOLUTION = `${OTHER}\nsum(formy$n[!inny])`;

/** One number, 194, computed from the table. */
function check({ value, code }) {
  if (typedIn(code)) return { ok: false, reason: 'typed' };
  if (!value || !isAtomic(value) || rLength(value) !== 1) return { ok: false, reason: 'wrong-value' };
  return Number(value.values[0]) === 194 ? { ok: true } : { ok: false, reason: 'wrong-value' };
}
check.compare = {};

export const txtForms = {
  id: 'txt-forms',
  module: 13,
  lecture: 8,
  requires: ['txt-stop'],
  title: 'Jedno słowo, wiele form',
  setup: SETUP,

  scenes: [
    {
      say: 'Forma „sąd” padła tylko **13** razy. Pozostałe formy tego słowa liczą się osobno.',
      code: 'formy$n[formy$slowo == "sąd"]',
      pick: 'formy$n[formy$slowo == "sąd"]',
      tap: 'formy$slowo == "sąd"',
    },
    {
      say: 'Wszystkie wiersze zaczynają się od „sąd”. Razem to **365** słów.',
      code: 'sum(formy$n)',
      pick: 'sum(formy$n)',
    },
    {
      say: 'Ale „sądownictwa” to inne słowo, **sądownictwo**. Padło 135 razy, częściej niż „sądów”.',
      code: 'formy[formy$n > 30, ]',
      pick: 'formy[formy$n > 30, ]',
    },
    {
      say: 'Wzorzec `^sądow` łapie sądownictwo i przymiotniki, jak „sądowych”. Te wiersze odrzucamy.',
      code: `${OTHER}\nformy$slowo[inny]`,
      pick: 'formy$slowo[inny]',
      tap: 'str_detect(formy$slowo, "^sądow")',
    },
    {
      say: '„sądów” zostaje, bo ma **ó**, a nie **o**. Dla R to dwie różne litery.',
      code: `${OTHER}\nformy$slowo[!inny]`,
      pick: 'formy$slowo[!inny]',
    },
  ],

  play: {
    say: 'Twoja kolej. Zmieniaj wzorzec i patrz, które formy łapie.',
    keep: '',
    code: 'formy$slowo[str_detect(formy$slowo, "^sądo")]',
    chips: [
      'formy$slowo[str_detect(formy$slowo, "^sądow")]',
      'formy$slowo[str_detect(formy$slowo, "^sądown")]',
      'formy$slowo[str_detect(formy$slowo, "y$")]',
      'nrow(formy)',
    ],
  },

  task: {
    prompt: 'Ile razy w sumie padło słowo „sąd”, we wszystkich formach, ale bez sądownictwa i przymiotników?',
    starter: '',
    check,
    solution: SOLUTION,
    hints: [
      'Sądownictwo i przymiotniki zaczynają się od „sądow”. Znajdź je przez `str_detect()`.',
      'Zapisz wynik jako `inny` i zsumuj resztę kolumny `n`: `sum(formy$n[!inny])`.',
    ],
    messages: {
      typed: 'Liczba ma wyjść z kodu, nie z klawiatury. Zsumuj kolumnę `n`.',
      exact: 'To tylko forma „sąd”. Słowo ma też formy „sądu”, „sądów”, „sądy” i inne.',
      all: 'To wszystko, co zaczyna się od „sąd”, razem z sądownictwem i przymiotnikami. Odrzuć `^sądow`.',
      inverted: 'To sądownictwo i przymiotniki, czyli wiersze do odrzucenia. Odwróć wybór przez `!`.',
      sado: 'O jeden za mało. Wzorzec `^sądo` odrzucił też „sądom”. Wystarczy odrzucić `^sądow`.',
      rows: 'To liczba form, a pytanie jest o to, ile razy padły. Zsumuj kolumnę `n`.',
      vector: 'To liczby dla każdej formy osobno. Zsumuj je przez `sum()`.',
      general: 'Jeszcze nie to. Odrzuć wiersze z `^sądow` i zsumuj kolumnę `n` w pozostałych.',
    },
    success: 'Dobrze. „Sąd” padł 194 razy, a nie 13.',
    note: 'To robi lematyzacja, tylko dla każdego słowa naraz. Po polsku umie ją np. pakiet udpipe.',

    nearMisses: [
      { name: 'the base form only', expect: 'exact', code: 'sum(formy$n[formy$slowo == "sąd"])' },
      { name: 'everything starting with sąd', expect: 'all', code: 'sum(formy$n[str_detect(formy$slowo, "^sąd")])' },
      { name: 'the judiciary instead', expect: 'inverted', code: `${OTHER}\nsum(formy$n[inny])` },
      { name: 'sądo drops sądom', expect: 'sado', code: 'inny <- str_detect(formy$slowo, "^sądo")\nsum(formy$n[!inny])' },
      { name: 'the number of forms', expect: 'rows', code: `${OTHER}\nsum(!inny)` },
      { name: 'the counts one by one', expect: 'vector', code: `${OTHER}\nformy$n[!inny]` },
      { name: 'a number typed in', expect: 'typed', code: '194' },
    ],

    diagnose({ value, code, result }) {
      if (result?.reason === 'typed' && typedIn(code)) return 'typed';
      if (!value || !isAtomic(value)) return 'general';
      if (rLength(value) > 1) return 'vector';
      const x = Number(value.values[0]);
      if (x === 13) return 'exact';
      if (x === 365) return 'all';
      if (x === 171) return 'inverted';
      if (x === 193) return 'sado';
      if (x === 9 || x === 17 || x === 8) return 'rows';
      return 'general';
    },
  },
};

export default txtForms;
