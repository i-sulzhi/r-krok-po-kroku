/**
 * Lesson: a frequent pair is not a collocation -- module 13, lecture 7 (D152).
 *
 * The neighbours of "krs" in the transcript of 2023-12-20, five words either side within
 * one speech (lecture 7, part 12). O11 is how often a word stands in those windows, R1
 * how often it occurs at all. Of N = 40 508 words, C1 = 1 182 stand in the windows, so a
 * word spread at random would appear there E11 = R1 * C1 / N times. The ratio O11 / E11
 * says how many times more often than chance.
 *
 * Two silent traps. The most frequent neighbour is "w" (45), but "w" is everywhere: its
 * ratio is 1.29. And the highest ratio is not "neo" (33 of its 34 uses, 33.3) but
 * "powołana" (3 of 3, 34.3): a rare word gets a huge ratio from three cases. Requiring
 * at least 10 cases in the windows leaves "neo". The lecture adds G² for the second trap.
 *
 * Numbers computed in WSL R 4.5.2 with tidytext 0.4.2 on the lab 4 table, nine rows of
 * the 588 neighbours (scratchpad ex54.R).
 */

import { isAtomic, rLength } from '../core/rvalue.js';

const SETUP = `# Sąsiedzi „krs”: ile razy słowo stoi w oknach (O11)
# i ile razy pada w całym tekście (R1)
sasiedzi <- data.frame(
  slowo = c("w", "i", "nie", "sędziów", "członków",
            "wyboru", "neo", "polityków", "powołana"),
  O11 = c(45, 25, 13, 10, 15, 7, 33, 4, 3),
  R1 = c(1193, 897, 616, 134, 44, 28, 34, 9, 3)
)
N <- 40508
C1 <- 1182`;

const RATIO = 'E11 <- sasiedzi$R1 * C1 / N\nrazy <- sasiedzi$O11 / E11';
const SOLUTION = `${RATIO}
czeste <- sasiedzi$O11 >= 10
sasiedzi$slowo[czeste][which.max(razy[czeste])]`;
// Scenes 2-5 write E11 and the ratio into the table, next to O11 and R1. The ratio is
// computed from the unrounded E11, so "neo" gets 33.3 and not 33.
const ADD_E = 'E11 <- sasiedzi$R1 * C1 / N\nsasiedzi$E11 <- round(E11, 1)';
const ADD_RAZY = 'sasiedzi$razy <- round(sasiedzi$O11 / E11, 1)';

/** The last line is only a quoted word: the answer was typed, not computed. */
const typedWord = (code) => {
  const lines = String(code || '').split('\n').map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean);
  return /^(c\s*\()?\s*"[^"]*"\s*\)?$/.test(lines[lines.length - 1] || '');
};

const word = (value) => (value && isAtomic(value) && value.type === 'character' && rLength(value) === 1
  ? String(value.values[0]) : null);

/** One word, "neo", picked by code. */
function check({ value, code }) {
  if (typedWord(code)) return { ok: false, reason: 'typed' };
  return word(value) === 'neo' ? { ok: true } : { ok: false, reason: 'wrong-value' };
}
check.compare = {};

export const txtPairs = {
  id: 'txt-pairs',
  module: 13,
  lecture: 7,
  requires: ['txt-forms'],
  title: 'Częsta para to nie kolokacja',
  setup: SETUP,

  scenes: [
    {
      say: 'Najczęściej przy „krs” stoi **w**, aż 45 razy. Czy to znaczy, że to para?',
      code: 'sasiedzi$slowo[which.max(sasiedzi$O11)]',
      pick: 'sasiedzi$slowo[which.max(sasiedzi$O11)]',
      tap: 'which.max(sasiedzi$O11)',
    },
    {
      say: 'Słów jest 40 508, w oknach 1 182. `E11` to wynik przypadku: dla „w” **34.8** razy.',
      code: `N <- 40508
C1 <- 1182
${ADD_E}
sasiedzi`,
      pick: 'sasiedzi$E11 <- round(E11, 1)',
      tap: 'sasiedzi$R1 * C1 / N',
    },
    {
      say: 'Kolumna `razy` to `O11 / E11`: ile razy częściej niż przypadek. Dla „w” tylko **1.3**.',
      code: `${ADD_E}
${ADD_RAZY}
sasiedzi`,
      pick: ADD_RAZY,
      tap: 'sasiedzi$O11 / E11',
    },
    {
      say: 'Wygrywa „powołana”, **34.3**, przed „neo” z 33.3. Ale to tylko 3 przypadki na 3.',
      code: `${ADD_E}
${ADD_RAZY}
sasiedzi[which.max(sasiedzi$razy), ]`,
      pick: 'sasiedzi[which.max(sasiedzi$razy), ]',
      tap: 'which.max(sasiedzi$razy)',
    },
    {
      say: 'Trzy przypadki to za mało. Zostawiamy więc tylko pary, które padły co najmniej **10** razy.',
      code: `${ADD_E}
${ADD_RAZY}
czeste <- sasiedzi$O11 >= 10
sasiedzi[czeste, ]`,
      pick: 'sasiedzi[czeste, ]',
      tap: 'sasiedzi$O11 >= 10',
    },
  ],

  play: {
    say: 'Twoja kolej. Zmieniaj próg i patrz, które słowo wygrywa.',
    keep: RATIO,
    code: 'czeste <- sasiedzi$O11 >= 5\nsasiedzi$slowo[czeste]',
    chips: [
      'round(E11, 1)',
      'sasiedzi[razy > 10, ]',
      'sasiedzi$slowo[razy > 2]',
      'sasiedzi$slowo[which.min(razy)]',
    ],
  },

  task: {
    prompt: 'Które słowo, stojące przy „krs” co najmniej 10 razy, ma najwyższy iloraz `O11 / E11`? Niech kod je wskaże.',
    starter: '',
    check,
    solution: SOLUTION,
    hints: [
      'Policz `E11 <- sasiedzi$R1 * C1 / N` i `razy <- sasiedzi$O11 / E11`.',
      'Zapisz próg jako `czeste <- sasiedzi$O11 >= 10`, a potem szukaj `which.max()` tylko wśród nich.',
    ],
    messages: {
      typed: 'Słowo ma wskazać kod, a nie klawiatura. Policz iloraz i wybierz największy.',
      frequent: '„w” stoi przy „krs” najczęściej, ale pada wszędzie. Pytanie jest o iloraz `O11 / E11`.',
      rare: '„powołana” to tylko 3 przypadki. Najpierw zostaw słowa, które w oknach padły co najmniej 10 razy.',
      lowest: 'To najniższy iloraz, a nie najwyższy. Użyj `which.max()`.',
      expected: 'To słowo ma największe `E11`, czyli liczbę oczekiwaną. Porównaj `O11` z `E11` przez iloraz.',
      several: 'To kilka słów. Wskaż jedno, to z najwyższym ilorazem.',
      general: 'Jeszcze nie to. Policz iloraz, zostaw słowa z `O11 >= 10` i wybierz największy iloraz.',
    },
    success: 'Dobrze. To „neo”, połowa określenia „neo-KRS”.',
    note: 'Próg na liczbę przypadków to decyzja. Wykład zastępuje go testem G², który bierze pod uwagę liczbę przypadków.',

    nearMisses: [
      { name: 'the most frequent neighbour', expect: 'frequent', code: 'sasiedzi$slowo[which.max(sasiedzi$O11)]' },
      { name: 'the highest ratio without a threshold', expect: 'rare', code: `${RATIO}\nsasiedzi$slowo[which.max(razy)]` },
      { name: 'the lowest ratio among frequent ones', expect: 'lowest', code: `${RATIO}\nczeste <- sasiedzi$O11 >= 10\nsasiedzi$slowo[czeste][which.min(razy[czeste])]` },
      { name: 'the largest expected count', expect: 'expected', code: `${RATIO}\nsasiedzi$slowo[which.max(E11)]` },
      { name: 'all frequent words', expect: 'several', code: 'sasiedzi$slowo[sasiedzi$O11 >= 10]' },
      { name: 'a word typed in', expect: 'typed', code: '"neo"' },
    ],

    diagnose({ value, code, result }) {
      if (result?.reason === 'typed' && typedWord(code)) return 'typed';
      if (!value || !isAtomic(value) || value.type !== 'character') return 'general';
      if (rLength(value) > 1) return 'several';
      const w = word(value);
      if (w === 'powołana') return 'rare';
      if (w === 'nie') return 'lowest';
      if (w === 'w') return /which\.max\(\s*E11/.test(code) ? 'expected' : 'frequent';
      return 'general';
    },
  },
};

export default txtPairs;
