/**
 * Lesson: is this word here? -- module 8, lecture 7 (D135).
 *
 * The first stringr exercise, done before session 7 (docs/lecture-7-design.md, section
 * 5). One idea: stringr asks every string the same question, text first and pattern
 * second. `str_detect()` answers yes or no, `str_count()` how many times.
 *
 * The silent trap: a capital is another character. "sąd" misses "Sądy" and
 * "Sądownictwa" with no message; the count is only too small (3 sentences of 5).
 *
 * The eight sentences are real, word for word, from the Sejm transcript of 2023-12-20.
 * Numbers checked with stringr 1.6.0: "sąd" in 3 sentences, 5 after str_to_lower(),
 * 6 matches in all because the fourth sentence has two.
 */

import { typedIn } from './schema.js';
import { isAtomic, rLength } from '../core/rvalue.js';

const SETUP = `# Osiem zdań ze stenogramu Sejmu, 20 grudnia 2023
sejm <- data.frame(zdanie = c(
  "Sądy trzeba naprawić.",
  "Walka o sądy trwała 8 lat.",
  "Więcej Polaków nie ufa sądom, niż im ufa.",
  "Sądy nie powinny być zarządzane i ludzie, którzy decydują o sądach...",
  "Krajowa Rada Sądownictwa funkcjonowała.",
  "Czas obrażania ludzi się skończył.",
  "Wszyscy polscy podatnicy za to płacą.",
  "Będzie nadzieja na zmianę."
))`;

const GET = 'zdania <- sejm$zdanie';

const DETECT = 'str_detect(zdania, "sąd")';
const LOWER = 'str_to_lower(zdania)';
const DETECT_LOW = `str_detect(${LOWER}, "sąd")`;
const COUNT_LOW = `str_count(${LOWER}, "sąd")`;
const SOLUTION = `${GET}\nsum(${COUNT_LOW})`;

/** One number, 6, computed from the sentences. */
function check({ value, code }) {
  if (typedIn(code)) return { ok: false, reason: 'typed' };
  if (!value || !isAtomic(value) || rLength(value) !== 1) return { ok: false, reason: 'wrong-value' };
  return Number(value.values[0]) === 6 ? { ok: true } : { ok: false, reason: 'wrong-value' };
}
check.compare = {};

export const strDetect = {
  id: 'str-detect',
  module: 8,
  lecture: 7,
  requires: ['model-cv'],
  title: 'Czy to słowo tu jest?',
  setup: SETUP,

  scenes: [
    {
      say: 'Osiem prawdziwych zdań z Sejmu. W ilu mowa o **sądach**? Niech policzy to R.',
      code: `${GET}\nzdania`,
      pick: 'sejm$zdanie',
    },
    {
      say: '`str_detect()` pyta każde zdanie, czy ma te litery. Najpierw tekst, potem **wzorzec**.',
      code: `${GET}\n${DETECT}`,
      pick: DETECT,
    },
    {
      say: 'TRUE liczy się jak 1, więc `sum()` podaje liczbę zdań: **3**. Ale o sądach jest ich więcej.',
      code: `${GET}\nsum(${DETECT})`,
      pick: `sum(${DETECT})`,
      tap: DETECT,
    },
    {
      say: 'Wielka litera to dla R **inny znak**. „Sądy” nie pasuje do „sąd”, a zamiast błędu jest FALSE.',
      code: 'str_detect("Sądy trzeba naprawić.", "sąd")',
      pick: 'str_detect("Sądy trzeba naprawić.", "sąd")',
    },
    {
      say: '`str_to_lower()` zamienia cały tekst na małe litery. Dopiero w nim szukamy.',
      code: `${GET}\n${LOWER}`,
      pick: LOWER,
    },
    {
      say: 'Teraz wzorzec znajduje wszystkie. O sądach mówi **5** zdań z 8.',
      code: `${GET}\nsum(${DETECT_LOW})`,
      pick: `sum(${DETECT_LOW})`,
      tap: DETECT_LOW,
    },
    {
      say: '`str_count()` liczy trafienia w każdym zdaniu. Czwarte ma ich **2**.',
      code: `${GET}\n${COUNT_LOW}`,
      pick: COUNT_LOW,
    },
  ],

  play: {
    say: 'Twoja kolej. Zmień wzorzec i zobacz, które zdania pasują.',
    keep: GET,
    code: 'str_detect(zdania, "ufa")',
    chips: [
      'str_subset(zdania, "sąd")',
      'str_count(zdania, "a")',
      'str_detect(str_to_lower(zdania), "krajowa")',
      'sum(str_detect(zdania, "trzeba"))',
    ],
  },

  task: {
    prompt: 'Ile razy w `zdania` pada ciąg liter „sąd”, małą albo wielką literą? Podaj jedną liczbę.',
    starter: `${GET}\n`,
    check,
    solution: SOLUTION,
    hints: [
      'Wielkie litery najpierw zamień na małe. Zrobi to `str_to_lower()`.',
      'Trafienia w każdym zdaniu liczy `str_count()`, a całość zsumuje `sum()`.',
    ],
    messages: {
      typed: 'Liczba ma wyjść z kodu, nie z klawiatury. Policz ją przez `str_count()`.',
      lower: 'To tylko małe litery. „Sądy” i „Sądownictwa” uciekły, więc najpierw użyj `str_to_lower()`.',
      sentences: 'To liczba zdań z „sąd”. Czwarte ma dwa trafienia, więc policz je przez `str_count()`.',
      reversed: 'Odwrotna kolejność. W stringr najpierw tekst, potem wzorzec: `str_count(tekst, "sąd")`.',
      vector: 'To osobny wynik dla każdego zdania. Zsumuj je przez `sum()`, żeby dostać jedną liczbę.',
      general: 'Jeszcze nie to. Zamień tekst na małe litery, policz „sąd” i zsumuj trafienia.',
    },
    success: 'Dobrze, 6 razy, w 5 zdaniach z 8.',
    note: 'Wielkość liter nie daje błędu, wynik jest tylko za mały. Przed szukaniem zamień tekst na małe litery.',

    nearMisses: [
      { name: 'capitals forgotten', expect: 'lower', code: `${GET}\nsum(str_count(zdania, "sąd"))` },
      { name: 'sentences, not matches', expect: 'sentences', code: `${GET}\nsum(${DETECT_LOW})` },
      { name: 'the arguments swapped', expect: 'reversed', code: `${GET}\nsum(str_count("sąd", str_to_lower(zdania)))` },
      { name: 'one count per sentence', expect: 'vector', code: `${GET}\n${COUNT_LOW}` },
      { name: 'yes or no per sentence', expect: 'vector', code: `${GET}\n${DETECT_LOW}` },
      { name: 'a number typed in', expect: 'typed', code: `${GET}\n6` },
      { name: 'all the sentences', expect: 'general', code: `${GET}\nlength(zdania)` },
    ],

    diagnose({ value, code, result }) {
      if (result?.reason === 'typed' && typedIn(code)) return 'typed';
      if (!value || !isAtomic(value)) return 'general';
      if (rLength(value) > 1) return 'vector';
      const x = Number(value.values[0]);
      if (x === 3) return 'lower';
      if (x === 5) return 'sentences';
      if (x === 0) return 'reversed';
      return 'general';
    },
  },
};

export default strDetect;
