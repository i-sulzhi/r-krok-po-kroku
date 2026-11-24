/**
 * Lesson: one word, one element -- module 13, lecture 8 (D146).
 *
 * The first step of preparing text for analysis (docs/lecture-8-design.md): cut the
 * speeches into words and count how many different words there are. Each cleaning step
 * changes that number, and the student sees by how much: capital letters ("Nie" and
 * "nie"), punctuation glued to words ("ma." and "ma").
 *
 * The silent trap: a dash " - " standing alone becomes an empty word "" once punctuation
 * is taken off the edges, and "" counts as a word like any other. The transcript has 195
 * such dashes. A second, shown in a scene: `[[:punct:]]` also strips signs inside a word,
 * so "pis-u" becomes "pisu".
 *
 * The four sentences are verbatim from the Sejm transcript of 2023-12-20. Numbers checked
 * with stringr 1.6.0: 41 words, 36 different as they stand, 35 in lower case, 34 with
 * the edges stripped (3 empty words among them), 33 without the empty word.
 */

import { typedIn, callsFunction } from './schema.js';
import { isAtomic, rLength } from '../core/rvalue.js';

const SETUP = `# Cztery zdania ze stenogramu Sejmu, 20 grudnia 2023
sejm <- data.frame(mowa = c(
  "Celem działania PiS-u nie była rzetelna reforma wymiaru sprawiedliwości.",
  "I niespodzianka - notyfikacji nie ma.",
  "W czasie, kiedy państwo - odnoszę się do pani - zamykaliście kopalnie, zamknęliście pięć kopalń.",
  "Nie ma zgody na łamanie demokratycznego państwa prawa, na łamanie konstytucji."
))`;

const GET = 'mowy <- sejm$mowa';
const CUT = String.raw`str_split(mowy, "\\s+")`;
const SPLIT = `slowa <- unlist(${CUT})`;
const LOWER = 'male <- str_to_lower(slowa)';
const EDGE_RHS = String.raw`str_remove_all(male, "^\\p{P}+|\\p{P}+$")`;
const EDGE = `czyste <- ${EDGE_RHS}`;
const DROP = 'czyste <- czyste[czyste != ""]';
const COUNT = 'length(unique(czyste))';
const SOLUTION = `${GET}\n${SPLIT}\n${LOWER}\n${EDGE}\n${DROP}\n${COUNT}`;

/** One number, 33, computed from the speeches. */
function check({ value, code }) {
  if (typedIn(code)) return { ok: false, reason: 'typed' };
  if (!value || !isAtomic(value) || rLength(value) !== 1) return { ok: false, reason: 'wrong-value' };
  return Number(value.values[0]) === 33 ? { ok: true } : { ok: false, reason: 'wrong-value' };
}
check.compare = {};

export const txtTokens = {
  id: 'txt-tokens',
  module: 13,
  lecture: 8,
  requires: ['str-table'],
  title: 'Jedno słowo, jeden element',
  setup: SETUP,

  scenes: [
    {
      say: 'Żeby liczyć słowa, tekst trzeba pociąć. `str_split()` tnie każde zdanie na spacjach.',
      code: `${GET}\n${CUT}`,
      pick: CUT,
    },
    {
      say: '`unlist()` skleja kawałki w jeden wektor. Mamy **41** słów, każde w osobnym elemencie.',
      code: `${GET}\n${SPLIT}\nslowa`,
      pick: `unlist(${CUT})`,
    },
    {
      say: 'Różnych słów jest **36**. Ale „Nie” i „nie” liczą się osobno, tak samo „ma.” i „ma”.',
      code: `${GET}\n${SPLIT}\nlength(unique(slowa))`,
      pick: 'length(unique(slowa))',
      tap: 'unique(slowa)',
    },
    {
      say: '`str_to_lower()` zmienia wielkie litery na małe. „Nie” i „nie” to już jedno słowo: **35**.',
      code: `${GET}\n${SPLIT}\n${LOWER}\nlength(unique(male))`,
      pick: 'str_to_lower(slowa)',
      tap: 'length(unique(male))',
    },
    {
      say: 'Wzorzec zdejmuje znaki interpunkcji tylko z **brzegów** słowa. Dlatego „pis-u” zostaje całe.',
      code: `${GET}\n${SPLIT}\n${LOWER}\n${EDGE}\nczyste`,
      pick: EDGE_RHS,
    },
    {
      say: 'Z trzech myślników zostały **puste słowa** „”. Liczą się jak każde inne, więc je wyrzucamy.',
      code: `${GET}\n${SPLIT}\n${LOWER}\n${EDGE}\nsum(czyste == "")`,
      pick: 'sum(czyste == "")',
      tap: 'czyste == ""',
    },
    {
      say: '`[[:punct:]]` usuwa znaki także ze środka słowa. Z „pis-u” robi się wtedy „pisu”.',
      code: `${GET}\n${SPLIT}\n${LOWER}\nstr_remove_all(male, "[[:punct:]]")`,
      pick: 'str_remove_all(male, "[[:punct:]]")',
    },
  ],

  play: {
    say: 'Twoja kolej. Zmieniaj kroki i patrz, ile różnych słów zostaje.',
    keep: `${GET}\n${SPLIT}\n${LOWER}`,
    code: 'length(unique(male))',
    chips: [
      'sort(table(male), decreasing = TRUE)',
      'str_remove_all(male, "[[:punct:]]")',
      'str_remove_all(male, "[.,]")',
      'length(male)',
    ],
  },

  task: {
    prompt: 'Ile **różnych** słów ma `mowy` po zmianie na małe litery, zdjęciu znaków z brzegów i wyrzuceniu pustych słów?',
    starter: `${GET}\n${SPLIT}\n`,
    check,
    solution: SOLUTION,
    hints: [
      'Najpierw `str_to_lower(slowa)`, potem `str_remove_all()` ze wzorcem ze sceny 5.',
      'Puste słowa wyrzuć przez `czyste[czyste != ""]`, a różne policz przez `length(unique())`.',
    ],
    messages: {
      typed: 'Liczba ma wyjść z kodu, nie z klawiatury. Wyczyść słowa i policz różne.',
      raw: 'Tyle różnych słów jest przed czyszczeniem. „Nie” i „nie” liczą się tu osobno.',
      lowerOnly: 'Małe litery już są, ale „ma.” i „ma” to wciąż dwa słowa. Zdejmij znaki z brzegów.',
      noLower: 'Brakuje małych liter. „Nie” i „nie” to wciąż dwa różne słowa.',
      empty: 'O jedno za dużo. Puste słowo „” po myślnikach liczy się osobno. Wyrzuć je.',
      tokens: 'To liczba wszystkich słów, a pytanie jest o różne. Policzy je `length(unique())`.',
      list: 'To lista kawałków ze `str_split()`. Najpierw sklej ją przez `unlist()`.',
      vector: 'To całe słowa. Potrzebna jest jedna liczba, czyli `length(unique(...))`.',
      general: 'Jeszcze nie to. Małe litery, znaki z brzegów, bez pustych słów, potem `length(unique())`.',
    },
    success: 'Dobrze, 33 różne słowa z 41.',
    note: 'Każdy krok czyszczenia to decyzja. Policz słowa przed nim i po nim, żeby wiedzieć, co zmienił.',

    nearMisses: [
      { name: 'nothing cleaned', expect: 'raw', code: `${GET}\n${SPLIT}\nlength(unique(slowa))` },
      { name: 'lower case only', expect: 'lowerOnly', code: `${GET}\n${SPLIT}\n${LOWER}\nlength(unique(male))` },
      { name: 'no lower case', expect: 'noLower', code: String.raw`${GET}
${SPLIT}
czyste <- str_remove_all(slowa, "^\\p{P}+|\\p{P}+$")
${DROP}
${COUNT}` },
      { name: 'the empty word kept', expect: 'empty', code: `${GET}\n${SPLIT}\n${LOWER}\n${EDGE}\n${COUNT}` },
      { name: 'all words, not different ones', expect: 'tokens', code: `${GET}\n${SPLIT}\n${LOWER}\n${EDGE}\n${DROP}\nlength(czyste)` },
      { name: 'the split list', expect: 'list', code: `${GET}\n${CUT}` },
      { name: 'the words themselves', expect: 'vector', code: `${GET}\n${SPLIT}\n${LOWER}\n${EDGE}\n${DROP}\nunique(czyste)` },
      { name: 'a number typed in', expect: 'typed', code: `${GET}\n33` },
    ],

    diagnose({ value, code, result }) {
      if (result?.reason === 'typed' && typedIn(code)) return 'typed';
      if (value?.kind === 'list') return 'list';
      if (!value || !isAtomic(value)) return 'general';
      if (rLength(value) > 1) return 'vector';
      const x = Number(value.values[0]);
      if (x === 36) return 'raw';
      if (x === 35) return 'lowerOnly';
      if (x === 34) return callsFunction(code, 'str_to_lower') || callsFunction(code, 'tolower') ? 'empty' : 'noLower';
      if (x === 41 || x === 38) return 'tokens';
      return 'general';
    },
  },
};

export default txtTokens;
