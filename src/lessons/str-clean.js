/**
 * Lesson: remove, but not too much -- module 8, lecture 7 (D137).
 *
 * One idea: cleaning a text is removing by a pattern, and afterwards counting what is
 * left. The transcript writes the room's reactions into the speech, "(Oklaski)",
 * "(Dzwonek)", "(Głos z sali: Hańba!)", and they are not the speaker's words.
 *
 * Two traps, both silent. A bare `(` in a pattern is a group, so "(Oklaski)" removes the
 * word and leaves "()". And the greedy `\\(.*\\)` runs from the first bracket to the
 * last: in the first speech a whole sentence of the speaker vanishes. On the full
 * transcript the same pattern loses 53% of the words (docs/lecture-7-design.md).
 *
 * The six speeches are verbatim from the Sejm transcript of 2023-12-20. Numbers checked
 * with stringr 1.6.0: 51 words as they stand, 49 without "(Oklaski)", 38 with
 * str_remove(), 31 with the greedy pattern, 37 with the right one.
 */

import { typedIn } from './schema.js';
import { isAtomic, rLength } from '../core/rvalue.js';

const SETUP = `# Sześć wypowiedzi ze stenogramu Sejmu, 20 grudnia 2023
sejm <- data.frame(mowa = c(
  "Co do sędziów takiej regulacji nie ma. (Dzwonek) Więc pan podaje po prostu nieprawdę. (Oklaski)",
  "Bo na tym polega demokracja. (Oklaski)",
  "Jest czas świąt Bożego Narodzenia. (Dzwonek)",
  "A dziś znowu nie mamy. (Głos z sali: Skandal!)",
  "Proszę dalej podążać tą drogą. (Głos z sali: Ha, ha, ha!)",
  "Będzie nadzieja na zmianę."
))`;

const GET = 'mowy <- sejm$mowa';
const BARE = 'str_remove_all(mowy, "(Oklaski)")';
const ESCAPED = String.raw`str_remove_all(mowy, "\\(Oklaski\\)")`;
const GREEDY = String.raw`str_remove_all(mowy, "\\(.*\\)")`;
const RIGHT = String.raw`str_remove_all(mowy, "\\([^)]*\\)")`;
const WORDS = String.raw`sum(str_count(bez, "\\S+"))`;
const SOLUTION = `${GET}\nbez <- ${RIGHT}\n${WORDS}`;

/** One number, 37, computed from the speeches. */
function check({ value, code }) {
  if (typedIn(code)) return { ok: false, reason: 'typed' };
  if (!value || !isAtomic(value) || rLength(value) !== 1) return { ok: false, reason: 'wrong-value' };
  return Number(value.values[0]) === 37 ? { ok: true } : { ok: false, reason: 'wrong-value' };
}
check.compare = {};

export const strClean = {
  id: 'str-clean',
  module: 8,
  lecture: 7,
  requires: ['str-pattern'],
  title: 'Usuń, ale nie za dużo',
  setup: SETUP,

  scenes: [
    {
      say: 'Stenogram wpisuje w mowę **reakcje sali**. „(Oklaski)” to nie słowa mówcy, więc je usuwamy.',
      code: `${GET}\nmowy`,
      pick: 'sejm$mowa',
    },
    {
      say: 'Nawias we wzorcu ma **inne znaczenie**. Zniknęło słowo, a puste „()” zostało.',
      code: `${GET}\n${BARE}`,
      pick: BARE,
    },
    {
      say: '`\\\\(` to zwykły nawias. Oklaski zniknęły, ale „(Dzwonek)” i głosy z sali zostały.',
      code: `${GET}\n${ESCAPED}`,
      pick: ESCAPED,
    },
    {
      say: '`.` to dowolny znak, a `*` to tyle, ile się da. Z pierwszej mowy zniknęło **całe zdanie**.',
      code: `${GET}\n${GREEDY}`,
      pick: GREEDY,
    },
    {
      say: 'Zostało **31** słów, a powinno 37. Błędu nie ma, tekst po prostu zniknął.',
      code: `${GET}\nbez <- ${GREEDY}\n${WORDS}`,
      pick: WORDS,
    },
    {
      say: '`[^)]*` to dowolne znaki **oprócz** „)”. Wzorzec staje na pierwszym nawiasie: **37** słów.',
      code: `${GET}\nbez <- ${RIGHT}\n${WORDS}`,
      pick: RIGHT,
      tap: WORDS,
    },
    {
      say: '`str_squish()` sprząta podwójne i końcowe spacje, które zostały po nawiasach.',
      code: `${GET}\nbez <- ${RIGHT}\nstr_squish(bez)`,
      pick: 'str_squish(bez)',
    },
  ],

  play: {
    say: 'Twoja kolej. Zmień wzorzec i patrz, co zostaje z mów.',
    keep: GET,
    code: String.raw`str_extract_all(mowy, "\\([^)]*\\)")`,
    chips: [
      String.raw`str_remove(mowy, "\\([^)]*\\)")`,
      String.raw`str_detect(mowy, "\\(")`,
      String.raw`str_count(mowy, "\\S+")`,
      String.raw`str_remove_all(mowy, "\\(Dzwonek\\)")`,
    ],
  },

  task: {
    prompt: 'Usuń z `mowy` wszystkie nawiasy razem z treścią, ale żadnego słowa mówcy. Ile słów zostaje?',
    starter: `${GET}\n`,
    check,
    solution: SOLUTION,
    hints: [
      'Wzorzec ma zacząć się od nawiasu i skończyć na najbliższym zamykającym. Pomoże `[^)]*`.',
      'Wynik zapisz jako `bez`, a słowa policz przez `sum(str_count(bez, "\\\\S+"))`.',
    ],
    messages: {
      typed: 'Liczba ma wyjść z kodu, nie z klawiatury. Usuń nawiasy i policz słowa.',
      none: 'To tyle słów, ile było na początku. Sam `(` we wzorcu nie jest nawiasem, napisz `\\\\(`.',
      oneKind: 'Zostały „(Dzwonek)” i głosy z sali. Wzorzec ma łapać każdą treść w nawiasie.',
      first: '`str_remove()` usuwa tylko pierwsze trafienie w mowie. Tu potrzeba `str_remove_all()`.',
      greedy: 'Za mało. `.*` zjadło zdanie między dwoma nawiasami. Użyj `[^)]*` zamiast `.*`.',
      vector: 'To osobny wynik dla każdej mowy. Zsumuj je przez `sum()`.',
      general: 'Jeszcze nie to. Usuń nawiasy wzorcem z `[^)]*` i policz słowa przez `str_count()`.',
    },
    success: 'Dobrze, 37 słów. Żadne słowo mówcy nie zniknęło.',
    note: 'Po każdym czyszczeniu policz, ile tekstu zostało. Zbyt chciwy wzorzec nie daje błędu, tylko zjada dane.',

    nearMisses: [
      { name: 'nothing removed', expect: 'none', code: String.raw`${GET}
sum(str_count(mowy, "\\S+"))` },
      { name: 'a bare bracket', expect: 'none', code: `${GET}\nbez <- ${BARE}\n${WORDS}` },
      { name: 'only the applause', expect: 'oneKind', code: `${GET}\nbez <- ${ESCAPED}\n${WORDS}` },
      { name: 'only the first bracket', expect: 'first', code: String.raw`${GET}
bez <- str_remove(mowy, "\\([^)]*\\)")
sum(str_count(bez, "\\S+"))` },
      { name: 'the greedy pattern', expect: 'greedy', code: `${GET}\nbez <- ${GREEDY}\n${WORDS}` },
      { name: 'one count per speech', expect: 'vector', code: String.raw`${GET}
bez <- str_remove_all(mowy, "\\([^)]*\\)")
str_count(bez, "\\S+")` },
      { name: 'a number typed in', expect: 'typed', code: `${GET}\n37` },
      { name: 'the number of speeches', expect: 'general', code: `${GET}\nlength(mowy)` },
    ],

    diagnose({ value, code, result }) {
      if (result?.reason === 'typed' && typedIn(code)) return 'typed';
      if (!value || !isAtomic(value)) return 'general';
      if (rLength(value) > 1) return 'vector';
      const x = Number(value.values[0]);
      if (x === 51) return 'none';
      if (x === 49) return 'oneKind';
      if (x === 38) return 'first';
      if (x === 31) return 'greedy';
      return 'general';
    },
  },
};

export default strClean;
