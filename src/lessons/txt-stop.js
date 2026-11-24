/**
 * Lesson: words that say nothing -- module 13, lecture 8 (D146).
 *
 * Stop words. The most frequent words of any text are grammar ("na", "nie", "to"), so
 * analyses drop them with a list. Here the list is a vector cut from the Polish
 * stopwords-iso list (stopwords 2.3; every word checked to be on it), and `%in%` asks of
 * every word whether it is on the list.
 *
 * The silent trap: "nie" is on the list. Dropped, "nie zgadzamy" becomes "zgadzamy" and
 * the meaning flips, while the table looks cleaner. On the whole transcript the list
 * removes 616 "nie" (docs/lecture-8-design.md). A second lesson: after the list the
 * forms of address ("panie", "marszałku", "wysoka", "izbo") are still there, because the
 * list was made for other texts. The task builds the student's own list.
 *
 * The answer is the vector of words left, not their number: dropping 10 and keeping 10
 * would otherwise give the same count.
 *
 * Three utterances verbatim from 2023-12-20, as one word per row in lower case without
 * punctuation (what unnest_tokens() gives). Checked in R 4.5.2: 20 words, 8 on the list
 * (40%), 12 left; the student's list leaves 10.
 */

import { resultCheck } from './schema.js';
import { isAtomic, rLength } from '../core/rvalue.js';

const SETUP = `# Trzy wypowiedzi z 20 grudnia 2023, słowo w wierszu,
# jak po unnest_tokens(): małe litery, bez znaków
mowy <- data.frame(slowo = c(
  "panie", "marszałku", "wysoka", "izbo",
  "nie", "ma", "zgody", "na", "łamanie", "demokratycznego",
  "państwa", "prawa", "na", "łamanie", "konstytucji",
  "na", "to", "się", "nie", "zgadzamy"
))`;

const GET = 'slowa <- mowy$slowo';
const STOP = 'stop <- c("na", "to", "się", "nie", "ma", "w", "i",\n  "z", "że", "jest", "tak", "bardzo", "dobrze")';
const MINE = 'moja <- c(stop[stop != "nie"], "panie",\n          "marszałku", "wysoka", "izbo")';
const LEFT = 'slowa[!slowa %in% moja]';
const SOLUTION = `${GET}\n${STOP}\n${MINE}\n${LEFT}`;

const KEPT = ['nie', 'zgody', 'łamanie', 'demokratycznego', 'państwa', 'prawa', 'łamanie', 'konstytucji', 'nie', 'zgadzamy'];
const values = resultCheck({ expected: `c(${KEPT.map((w) => `"${w}"`).join(', ')})` });

/** The ten words left, in order, computed with %in% rather than typed. */
function check(ctx) {
  if (!String(ctx.code || '').includes('%in%')) return { ok: false, reason: 'typed' };
  return values(ctx);
}
check.compare = values.compare;

const words = (value) => (value && isAtomic(value) && value.type === 'character' ? value.values : null);

export const txtStop = {
  id: 'txt-stop',
  module: 13,
  lecture: 8,
  requires: ['txt-tokens'],
  title: 'Słowa, które nic nie mówią',
  setup: SETUP,

  scenes: [
    {
      say: 'Najczęstsze jest „na”, aż 3 razy. Na górze listy słów stoi zwykle gramatyka, nie treść.',
      code: `${GET}\nsort(table(slowa), decreasing = TRUE)`,
      pick: 'sort(table(slowa), decreasing = TRUE)',
      tap: 'table(slowa)',
    },
    {
      say: 'Lista słów do pominięcia to zwykły wektor. Ta jest wycięta z polskiej listy stopwords-iso.',
      code: `${GET}\n${STOP}\nstop`,
      pick: 'stop',
    },
    {
      say: '`%in%` pyta o każde słowo, czy jest na liście. Odpowiedź to TRUE albo FALSE.',
      code: `${GET}\n${STOP}\nslowa %in% stop`,
      pick: 'slowa %in% stop',
    },
    {
      say: '`!` odwraca odpowiedź. Zostaje **12** słów z 20, czyli lista zabrała 40% tekstu.',
      code: `${GET}\n${STOP}\nslowa[!slowa %in% stop]`,
      pick: 'slowa[!slowa %in% stop]',
      tap: '!slowa %in% stop',
    },
    {
      say: 'Zostały „panie”, „marszałku”, „wysoka” i „izbo”. To zwroty do sali, a listy ich nie znają.',
      code: `${GET}\n${STOP}\nc("panie", "izbo") %in% stop`,
      pick: 'c("panie", "izbo") %in% stop',
    },
    {
      say: 'A „nie” jest na liście. Z „nie zgadzamy” zostaje „zgadzamy”, czyli coś odwrotnego.',
      code: `${GET}\n${STOP}\n"nie" %in% stop`,
      pick: '"nie" %in% stop',
    },
    {
      say: '`stop[stop != "nie"]` to ta sama lista bez „nie”. Tym razem „nie zgadzamy” zostaje całe.',
      code: `${GET}\n${STOP}\nbez_nie <- stop[stop != "nie"]\nslowa[!slowa %in% bez_nie]`,
      pick: 'slowa[!slowa %in% bez_nie]',
      tap: 'stop[stop != "nie"]',
    },
  ],

  play: {
    say: 'Twoja kolej. Dopisuj słowa do listy i patrz, co zostaje z wypowiedzi.',
    keep: `${GET}\n${STOP}`,
    code: 'slowa[!slowa %in% stop]',
    chips: [
      'mean(slowa %in% stop)',
      'sum(slowa %in% stop)',
      'slowa[slowa %in% stop]',
      'table(slowa[!slowa %in% stop])',
    ],
  },

  task: {
    prompt: 'Zrób własną listę `moja`: `stop` bez „nie”, ze zwrotami „panie”, „marszałku”, „wysoka” i „izbo”. Pokaż słowa, które zostają.',
    starter: `${GET}\n${STOP}\n`,
    check,
    solution: SOLUTION,
    hints: [
      'Listę bez „nie” daje `stop[stop != "nie"]`. Cztery zwroty dopisz do niej przez `c()`.',
      'Słowa spoza listy pokaże `slowa[!slowa %in% moja]`.',
    ],
    messages: {
      typed: 'Słowa mają wyjść z kodu. Sprawdź je przez `%in%` i własną listę.',
      nieGone: '„nie” zniknęło, więc sens się odwrócił. Wyrzuć je z listy przez `stop[stop != "nie"]`.',
      addressKept: '„nie” zostało, ale zwroty do sali też. Dopisz „panie”, „marszałku”, „wysoka” i „izbo” do listy.',
      stock: 'To gotowa lista bez zmian. Zostały zwroty do sali, a „nie” zniknęło.',
      inverted: 'To słowa z listy, czyli te wyrzucone. Odwróć pytanie przez `!`.',
      logical: 'To odpowiedzi TRUE i FALSE. Użyj ich w nawiasie: `slowa[!slowa %in% moja]`.',
      count: 'To liczba słów. Zadanie prosi o same słowa, więc pokaż `slowa[...]`.',
      general: 'Jeszcze nie to: `moja` to `stop` bez „nie” i z czterema zwrotami, potem `slowa[!slowa %in% moja]`.',
    },
    success: 'Dobrze. Zostało 10 słów, a „nie” jest na miejscu.',
    note: 'Gotową listę zrobiono do innych tekstów. Przeczytaj ją i popraw pod swoje pytanie.',

    nearMisses: [
      { name: '"nie" still on the list', expect: 'nieGone', code: `${GET}\n${STOP}\nmoja <- c(stop, "panie", "marszałku", "wysoka", "izbo")\n${LEFT}` },
      { name: 'forms of address kept', expect: 'addressKept', code: `${GET}\n${STOP}\nmoja <- stop[stop != "nie"]\n${LEFT}` },
      { name: 'the stock list', expect: 'stock', code: `${GET}\n${STOP}\nslowa[!slowa %in% stop]` },
      { name: 'the dropped words', expect: 'inverted', code: `${GET}\n${STOP}\n${MINE}\nslowa[slowa %in% moja]` },
      { name: 'TRUE and FALSE', expect: 'logical', code: `${GET}\n${STOP}\n${MINE}\n!slowa %in% moja` },
      { name: 'a count', expect: 'count', code: `${GET}\n${STOP}\n${MINE}\nsum(!slowa %in% moja)` },
      { name: 'typed by hand', expect: 'typed', code: `c(${KEPT.map((w) => `"${w}"`).join(', ')})` },
    ],

    diagnose({ value, code, result }) {
      if (result?.reason === 'typed') return 'typed';
      if (!value || !isAtomic(value)) return 'general';
      if (value.type === 'logical') return 'logical';
      if (rLength(value) === 1 && value.type !== 'character') return 'count';
      const w = words(value);
      if (!w) return 'general';
      const has = (x) => w.includes(x);
      if (has('na') && !has('łamanie')) return 'inverted';
      if (has('panie') && !has('nie')) return 'stock';
      if (has('panie') && has('nie')) return 'addressKept';
      if (!has('nie') && has('łamanie')) return 'nieGone';
      return 'general';
    },
  },
};

export default txtStop;
