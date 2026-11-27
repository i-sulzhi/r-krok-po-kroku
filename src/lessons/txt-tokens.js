/**
 * Lesson: one word, one element -- module 13, lecture 7 (D146, D147).
 *
 * The first step of preparing text for analysis (docs/lecture-8-design.md): cut the
 * speeches into words and count how many different words there are. Each cleaning step
 * changes that number, and the student sees by how much: capital letters ("Nie" and
 * "nie"), punctuation glued to words ("ma." and "ma").
 *
 * The silent trap: a dash " - " standing alone becomes an empty word "" once punctuation
 * is taken off the edges, and "" counts as a word like any other. The transcript has 195
 * such dashes. A second, shown first so the edge pattern answers it: `[[:punct:]]` also
 * strips signs inside a word, so "pis-u" becomes "pisu". The last scene shows the clean
 * words, the goal of the whole lesson.
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
const COUNT = 'unique(czyste)';
const SOLUTION = `${GET}\n${SPLIT}\n${LOWER}\n${EDGE}\n${DROP}\n${COUNT}`;
// Scenes 5-7: the word before and after each cleaning, side by side in a table; only the
// rows that a cleaning changed are shown, so the table stays short.
const BASE = `${GET}\n${SPLIT}\n${LOWER}`;
const PUNCT_RHS = 'str_remove_all(male, "[[:punct:]]")';
const TAB = `tab <- data.frame(slowo = male,\n  punct = ${PUNCT_RHS})`;
const CHANGED = 'tab[tab$slowo != tab$punct, ]';

// The 33 different words once the speeches are cut, lowered and stripped at the edges.
// The task asks for the words, not their number: with [[:punct:]] the count is also 33,
// but "pis-u" has become "pisu", and only the words show it.
const WORDS = ['celem', 'działania', 'pis-u', 'nie', 'była', 'rzetelna', 'reforma', 'wymiaru',
  'sprawiedliwości', 'i', 'niespodzianka', 'notyfikacji', 'ma', 'w', 'czasie', 'kiedy', 'państwo',
  'odnoszę', 'się', 'do', 'pani', 'zamykaliście', 'kopalnie', 'zamknęliście', 'pięć', 'kopalń',
  'zgody', 'na', 'łamanie', 'demokratycznego', 'państwa', 'prawa', 'konstytucji'];
const textOf = (value) => (value && isAtomic(value) && value.type === 'character' ? value.values.map(String) : null);

/** The 33 different words, in any order, made by code. */
function check({ value, code }) {
  const w = textOf(value);
  if (w && !/str_/.test(String(code || ''))) return { ok: false, reason: 'typed' };
  if (!w || w.length !== WORDS.length) return { ok: false, reason: 'wrong-value' };
  const set = new Set(w);
  return set.size === WORDS.length && WORDS.every((x) => set.has(x)) ? { ok: true } : { ok: false, reason: 'wrong-value' };
}
check.compare = {};

export const txtTokens = {
  id: 'txt-tokens',
  module: 13,
  lecture: 7,
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
      say: 'Tabela stawia słowo przed i po. `[[:punct:]]` czyści też środek: z „pis-u” jest „pisu”.',
      code: `${BASE}\n${TAB}\n${CHANGED}`,
      pick: CHANGED,
      tap: PUNCT_RHS,
    },
    {
      say: 'Kolumna `czyste` zdejmuje znaki tylko z **brzegów**. Kropki znikają, a „pis-u” zostaje całe.',
      code: `${BASE}\n${TAB}\n${EDGE}\ntab$czyste <- czyste\n${CHANGED}`,
      pick: CHANGED,
      tap: EDGE_RHS,
    },
    {
      say: 'Z trzech myślników zostały **puste słowa** „”. Wyrzucamy te wiersze i zostają same słowa.',
      code: `${BASE}\n${TAB}\n${EDGE}\ntab$czyste <- czyste\ntab <- tab[tab$czyste != "", ]\n${CHANGED}`,
      pick: CHANGED,
      tap: 'tab[tab$czyste != "", ]',
    },
  ],

  play: {
    say: 'Twoja kolej. Zmieniaj kroki i patrz, ile różnych słów zostaje.',
    keep: `${GET}\n${SPLIT}\n${LOWER}`,
    code: 'length(unique(male))',
    chips: [
      'sort(table(male), decreasing = TRUE)',
      'str_remove_all(male, "[[:punct:]]")',
      EDGE_RHS,
      'length(male)',
    ],
  },

  task: {
    prompt: 'Pokaż **różne** słowa z `mowy`: małymi literami, bez znaków na brzegach i bez pustych słów.',
    starter: `${GET}
${SPLIT}
`,
    check,
    solution: SOLUTION,
    hints: [
      'Najpierw `str_to_lower(slowa)`, potem `str_remove_all()` ze wzorcem ze sceny 6.',
      'Puste słowa wyrzuć przez `czyste[czyste != ""]`, a różne pokaże `unique()`.',
    ],
    messages: {
      typed: 'Słowa mają wyjść z kodu, nie z klawiatury. Wyczyść je przez `str_remove_all()`.',
      inner: 'Z „pis-u” zrobiło się „pisu”. Ten wzorzec czyści też środek słowa, a zdjąć trzeba tylko brzegi.',
      dash: 'Myślnik „-” został jako słowo. Wzorzec ma zdjąć znaki z brzegów, a wtedy z myślnika zostaje „”.',
      empty: 'Zostało puste słowo „” po myślnikach. Wyrzuć je przez `czyste[czyste != ""]`.',
      noLower: 'Brakuje małych liter. „Nie” i „nie” to wciąż dwa różne słowa.',
      edges: 'Przy słowach zostały kropki i przecinki, jak w „ma.”. Zdejmij znaki z brzegów.',
      repeats: 'To wszystkie słowa, z powtórkami. Różne pokaże `unique()`.',
      count: 'To liczba. Zadanie prosi o same słowa, więc pokaż `unique(czyste)`.',
      list: 'To lista kawałków ze `str_split()`. Najpierw sklej ją przez `unlist()`.',
      general: 'Jeszcze nie to. Małe litery, znaki z brzegów, bez pustych słów, potem `unique()`.',
    },
    success: 'Dobrze, 33 różne słowa z 41, a „pis-u” jest całe.',
    note: 'Każdy krok czyszczenia to decyzja. Policz słowa przed nim i po nim, żeby wiedzieć, co zmienił.',

    nearMisses: [
      { name: '[[:punct:]] also inside', expect: 'inner', code: `${GET}
${SPLIT}
${LOWER}
czyste <- str_remove_all(male, "[[:punct:]]")
unique(czyste[czyste != ""])` },
      { name: 'only dots and commas', expect: 'dash', code: `${GET}
${SPLIT}
${LOWER}
unique(str_remove_all(male, "[.,]"))` },
      { name: 'the empty word kept', expect: 'empty', code: `${GET}
${SPLIT}
${LOWER}
${EDGE}
unique(czyste)` },
      { name: 'no lower case', expect: 'noLower', code: String.raw`${GET}
${SPLIT}
czyste <- str_remove_all(slowa, "^\\p{P}+|\\p{P}+$")
${DROP}
unique(czyste)` },
      { name: 'lower case only', expect: 'edges', code: `${GET}
${SPLIT}
${LOWER}
unique(male)` },
      { name: 'all words, with repeats', expect: 'repeats', code: `${GET}
${SPLIT}
${LOWER}
${EDGE}
${DROP}
czyste` },
      { name: 'the number of words', expect: 'count', code: `${GET}
${SPLIT}
${LOWER}
${EDGE}
${DROP}
length(unique(czyste))` },
      { name: 'the split list', expect: 'list', code: `${GET}
${CUT}` },
      { name: 'words typed in', expect: 'typed', code: 'c("celem", "działania")' },
    ],

    diagnose({ value, code, result }) {
      if (result?.reason === 'typed') return 'typed';
      if (value?.kind === 'list') return 'list';
      if (!value || !isAtomic(value)) return 'general';
      const w = textOf(value);
      if (!w) return rLength(value) === 1 ? 'count' : 'general';
      if (w.includes('pisu')) return 'inner';
      if (w.some((x) => x !== x.toLowerCase())) return 'noLower';
      // A word with a sign still on it ("ma."), before the lone dash, which is a sign only.
      if (w.some((x) => /\p{L}/u.test(x) && /^\p{P}|\p{P}$/u.test(x))) return 'edges';
      if (w.includes('-')) return 'dash';
      if (w.includes('')) return 'empty';
      if (new Set(w).size < w.length) return 'repeats';
      return 'general';
    },
  },
};

export default txtTokens;
