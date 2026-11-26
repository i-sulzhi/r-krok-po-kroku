/**
 * Lesson: a pattern is not a word -- module 8, lecture 7 (D136).
 *
 * One idea: a pattern is a row of characters, so "sąd" is found inside "osąd" and
 * "najrozsądniej". `\\b`, the edge of a word, says where it must stand. `\\p{L}*` shows
 * the whole word that was caught, and `[Ss]` is one of two letters.
 *
 * The silent trap: the count looks right and holds false friends (10 instead of 7).
 * A second one sits next to it: one backslash, "\bsąd", is a backspace in an R string,
 * so it finds nothing and says nothing.
 *
 * The twelve fragments are verbatim from the Sejm transcript of 2023-12-20. Numbers
 * checked with stringr 1.6.0: lower-cased "sąd" 10, as written 6, `\\bsąd` lower-cased 7,
 * as written 3, `\\bsąd\\b` lower-cased 2.
 */

import { typedIn } from './schema.js';
import { isAtomic, rLength } from '../core/rvalue.js';

const SETUP = `# Dwanaście fragmentów ze stenogramu Sejmu, 20 grudnia 2023
sejm <- data.frame(fragment = c(
  "Sądy trzeba naprawić.",
  "Walka o sądy trwała 8 lat.",
  "Więcej Polaków nie ufa sądom, niż im ufa.",
  "Sądy nie mogą się wciąż zajmować sobą.",
  "Krajowa Rada Sądownictwa funkcjonowała.",
  "Przecież Sąd Najwyższy 23 stycznia 2022 r.",
  "że źle obsadzony sąd rodzi określone skutki",
  "wpływania na ten osąd z jakiejkolwiek",
  "dla osądzania sytuacji w Polsce.",
  "że najrozsądniej byłoby",
  "Czas obrażania ludzi się skończył.",
  "Będzie nadzieja na zmianę."
))`;

const GET = 'tekst <- str_to_lower(sejm$fragment)';
const ALL = 'str_subset(tekst, "sąd")';
const WORDS = String.raw`str_extract(tekst, "\\p{L}*sąd\\p{L}*")`;
const EDGE_DEMO = String.raw`str_detect(c("ten osąd", "ten sąd"), "\\bsąd")`;
const START = String.raw`sum(str_detect(tekst, "\\bsąd"))`;
const EXACT = String.raw`sum(str_detect(tekst, "\\bsąd\\b"))`;
const CLASS = String.raw`sum(str_detect(sejm$fragment, "\\b[Ss]ąd"))`;
const SOLUTION = `${GET}\n${START}`;

/** One number, 7, computed from the fragments. */
function check({ value, code }) {
  if (typedIn(code)) return { ok: false, reason: 'typed' };
  if (!value || !isAtomic(value) || rLength(value) !== 1) return { ok: false, reason: 'wrong-value' };
  return Number(value.values[0]) === 7 ? { ok: true } : { ok: false, reason: 'wrong-value' };
}
check.compare = {};

export const strPattern = {
  id: 'str-pattern',
  module: 8,
  lecture: 7,
  requires: ['str-detect'],
  title: 'Wzorzec to nie słowo',
  setup: SETUP,

  scenes: [
    {
      say: 'Wzorzec „sąd” trafia **10** fragmentów z 12. Wśród nich są „osąd” i „najrozsądniej”.',
      code: `${GET}\n${ALL}`,
      pick: ALL,
    },
    {
      say: '`\\\\p{L}*` znaczy „dowolnie wiele liter”. Tak widać **całe słowa**, które złapał wzorzec.',
      code: `${GET}\n${WORDS}`,
      pick: WORDS,
    },
    {
      say: 'Wzorzec to **ciąg znaków**, nie słowo. Dla R „osąd” zawiera „sąd” i tyle.',
      code: 'str_detect("ten osąd", "sąd")',
      pick: 'str_detect("ten osąd", "sąd")',
    },
    {
      say: '`\\\\b` to **granica słowa**, w R z dwoma ukośnikami. Tu „sąd” musi zaczynać słowo.',
      code: EDGE_DEMO,
      pick: EDGE_DEMO,
    },
    {
      say: 'Zostaje **7** fragmentów. „Osąd” wypadł, ale „sądownictwa” zostało, choć to inne słowo.',
      code: `${GET}\n${START}`,
      pick: START,
    },
    {
      say: 'Druga granica to za dużo. `\\\\bsąd\\\\b` łapie samo „sąd” i gubi „sądy”: zostają **2**.',
      code: `${GET}\n${EXACT}`,
      pick: EXACT,
    },
    {
      say: 'Nawias `[Ss]` znaczy „jedna z tych liter”. To drugi sposób na wielkie litery, też **7**.',
      code: CLASS,
      pick: CLASS,
    },
  ],

  play: {
    say: 'Twoja kolej. Zmień wzorzec i patrz, które słowa łapie.',
    keep: GET,
    code: String.raw`str_extract(tekst, "\\bs\\p{L}*")`,
    chips: [
      String.raw`str_subset(tekst, "\\bna\\b")`,
      String.raw`str_count(tekst, "\\bw\\b")`,
      String.raw`str_extract(tekst, "\\p{L}+")`,
      'str_detect(tekst, "[sz]ą")',
    ],
  },

  task: {
    prompt: 'W ilu fragmentach jakieś słowo **zaczyna się** od „sąd”, małą albo wielką literą? „Osąd” się nie liczy.',
    starter: `${GET}\n`,
    check,
    solution: SOLUTION,
    hints: [
      'Początek słowa wskazuje `\\\\b`. W R piszesz go z dwoma ukośnikami.',
      'Sprawdź wzorzec `"\\\\bsąd"` przez `str_detect()` na `tekst` i zsumuj wynik przez `sum()`.',
    ],
    messages: {
      typed: 'Liczba ma wyjść z kodu, nie z klawiatury. Policz ją przez `str_detect()`.',
      friends: 'W tej liczbie są „osąd” i „najrozsądniej”. Dodaj granicę słowa: `"\\\\bsąd"`.',
      capitals: 'Tu liczą się tylko małe litery. Szukaj w `tekst`, gdzie wszystko jest już małe.',
      whole: 'Druga granica zostawia samo „sąd” i gubi „sądy”. Wystarczy `\\\\b` na początku.',
      slash: 'Nic nie pasuje. Jeden ukośnik w R to inny znak, więc napisz dwa: `"\\\\bsąd"`.',
      vector: 'To osobny wynik dla każdego fragmentu. Zsumuj je przez `sum()`.',
      general: 'Jeszcze nie to. Szukaj w `tekst` wzorca z granicą słowa i zsumuj trafienia.',
    },
    success: 'Dobrze, 7 fragmentów. Trzy fałszywe trafienia wypadły.',
    note: 'Licząc słowa, zawsze obejrzyj, co złapał wzorzec. Fałszywe trafienia nie dają błędu, tylko większą liczbę.',

    nearMisses: [
      { name: 'no word edge', expect: 'friends', code: `${GET}\nsum(str_detect(tekst, "sąd"))` },
      { name: 'no edge, capitals missed', expect: 'capitals', code: 'sum(str_detect(sejm$fragment, "sąd"))' },
      { name: 'edge, capitals missed', expect: 'capitals', code: String.raw`sum(str_detect(sejm$fragment, "\\bsąd"))` },
      { name: 'both edges', expect: 'whole', code: `${GET}\n${EXACT}` },
      { name: 'one backslash', expect: 'slash', code: String.raw`${GET}
sum(str_detect(tekst, "\bsąd"))` },
      { name: 'one result per fragment', expect: 'vector', code: String.raw`${GET}
str_detect(tekst, "\\bsąd")` },
      { name: 'a number typed in', expect: 'typed', code: `${GET}\n7` },
      { name: 'all the fragments', expect: 'general', code: `${GET}\nlength(tekst)` },
    ],

    diagnose({ value, code, result }) {
      if (result?.reason === 'typed' && typedIn(code)) return 'typed';
      if (!value || !isAtomic(value)) return 'general';
      if (rLength(value) > 1) return 'vector';
      const x = Number(value.values[0]);
      if (x === 10) return 'friends';
      if (x === 6 || x === 3) return 'capitals';
      if (x === 2 || x === 1) return 'whole';
      if (x === 0) return 'slash';
      return 'general';
    },
  },
};

export default strPattern;
