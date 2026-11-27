/**
 * Lesson: words in company -- module 13, lecture 7 (D154).
 *
 * What a collocation is, before any measure: words that stand together more often than
 * chance would put them. Two sentences, one word per row, and a window of two words
 * either side of "krs". Every word falls into one of four cells of a 2x2 table: is it
 * "w" or another word, does it stand in a window or outside. The cells and their sums
 * carry the names used in the literature (Evert): O11 is the observed count in row 1,
 * column 1; R1 the sum of row 1; C1 the sum of column 1; N all words; E11 the count
 * expected by chance, R1 * C1 / N. Exercise 55 then uses the same names on the full
 * transcript.
 *
 * The trainer has no two-way table(), so the 2x2 table is a data.frame of four sums,
 * one per cell; each sum shows which words go into its cell.
 *
 * The window flags are typed in the setup; computed in R from the positions of "krs"
 * they come out the same (scratchpad toy54.R): N 12, C1 7, R1 2, O11 1, E11 1.17 for
 * "w" and 0.58 for "neo".
 */

import { typedIn } from './schema.js';
import { isAtomic, rLength } from '../core/rvalue.js';

const SETUP = `# Dwa zdania, słowo w wierszu. okno = TRUE, gdy słowo
# stoi najwyżej dwa miejsca od „krs”
tekst <- data.frame(
  slowo = c("członków", "neo", "krs", "wybrali", "politycy",
            "w", "krs", "zasiadają", "sędziowie", "wybrani",
            "w", "sejmie"),
  okno = c(TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE,
           TRUE, FALSE, FALSE, FALSE)
)`;

const MARK = 'w <- tekst$slowo == "w"\nokno <- tekst$okno';
const CELLS = `kratki <- data.frame(
  slowo = c("w", "inne"),
  w_oknie = c(sum(w & okno), sum(!w & okno)),
  poza = c(sum(w & !okno), sum(!w & !okno)))`;
const BASE = `${MARK}\n${CELLS}`;
const SUMS = `R1 <- kratki$w_oknie[1] + kratki$poza[1]
C1 <- sum(kratki$w_oknie)
N <- nrow(tekst)`;
const SOLUTION = `w <- tekst$slowo == "neo"
okno <- tekst$okno
R1 <- sum(w)
C1 <- sum(okno)
N <- nrow(tekst)
R1 * C1 / N`;

/** One number, E11 for "neo": 1 * 7 / 12. */
function check({ value, code }) {
  if (typedIn(code)) return { ok: false, reason: 'typed' };
  if (!value || !isAtomic(value) || rLength(value) !== 1) return { ok: false, reason: 'wrong-value' };
  return Math.abs(Number(value.values[0]) - 7 / 12) < 0.006 ? { ok: true } : { ok: false, reason: 'wrong-value' };
}
check.compare = {};

const near = (x, y) => Math.abs(x - y) < 0.006;

export const txtWindow = {
  id: 'txt-window',
  module: 13,
  lecture: 7,
  requires: ['txt-forms'],
  title: 'Słowa w towarzystwie',
  setup: SETUP,

  scenes: [
    {
      say: '**Kolokacja** to słowa stojące razem częściej, niż dałby przypadek. Szukamy ich przy „krs”.',
      code: 'tekst$slowo',
      pick: 'tekst$slowo',
    },
    {
      say: '**Okno** to dwa słowa przed „krs” i dwa po nim. Zaznacza je kolumna `okno`.',
      code: 'tekst',
      pick: 'tekst',
    },
    {
      say: 'Każde słowo trafia do jednej z czterech kratek: „w” albo inne, w oknie albo poza nim.',
      code: `${BASE}\nkratki`,
      pick: 'kratki',
      tap: 'sum(w & okno)',
    },
    {
      say: 'Kratka „w” w oknie to **O11**: O od *observed*, 11 od wiersza 1 i kolumny 1.',
      code: `${BASE}\nkratki$w_oknie[1]`,
      pick: 'kratki$w_oknie[1]',
    },
    {
      say: '**R1** to suma wiersza 1 (*row*), **C1** suma kolumny 1 (*column*), a N to wszystkie słowa.',
      code: `${BASE}\n${SUMS}\nc(R1 = R1, C1 = C1, N = N)`,
      pick: 'c(R1 = R1, C1 = C1, N = N)',
    },
    {
      say: 'E od *expected*: przypadek dałby „w” w oknach R1 * C1 / N = **1.2** raza. To **E11**.',
      code: `${BASE}\n${SUMS}\nround(R1 * C1 / N, 1)`,
      pick: 'round(R1 * C1 / N, 1)',
      tap: 'R1 * C1 / N',
    },
    {
      say: '„w” stoi w oknie raz, a przypadek daje 1.2. Para „krs” i „w” to więc nie kolokacja.',
      code: `${BASE}\n${SUMS}\nc(O11 = kratki$w_oknie[1], E11 = R1 * C1 / N)`,
      pick: 'c(O11 = kratki$w_oknie[1], E11 = R1 * C1 / N)',
    },
  ],

  play: {
    say: 'Twoja kolej. Wpisz inne słowo zamiast „w” i patrz, jak zmieniają się kratki.',
    keep: '',
    code: `w <- tekst$slowo == "neo"\nokno <- tekst$okno\n${CELLS}\nkratki`,
    chips: [
      'sum(tekst$okno)',
      'tekst$slowo[tekst$okno]',
      'table(tekst$slowo)',
      'nrow(tekst)',
    ],
  },

  task: {
    prompt: 'Ile wynosi **E11** dla słowa „neo”? Policz R1, C1 i N z tabeli `tekst`.',
    starter: 'w <- tekst$slowo == "neo"\nokno <- tekst$okno\n',
    check,
    solution: SOLUTION,
    hints: [
      'R1 to liczba „neo” w całym tekście, C1 liczba słów w oknach, a N wszystkie słowa.',
      'Policz `sum(w)`, `sum(okno)` i `nrow(tekst)`, a potem `R1 * C1 / N`.',
    ],
    messages: {
      typed: 'Liczba ma wyjść z kodu, nie z klawiatury. Policz R1, C1 i N.',
      count: 'To jedna kratka albo suma wiersza. E11 to dopiero `R1 * C1 / N`.',
      copied: 'To E11 dla „w” ze scen. Słowo „neo” pada tylko raz, więc R1 jest inne.',
      share: 'To udział „neo” w całym tekście, R1 / N. Pomnóż go jeszcze przez C1.',
      margin: 'To C1 albo N, czyli suma kolumny albo wszystkie słowa. Potrzebny jest wzór `R1 * C1 / N`.',
      vector: 'To kilka liczb naraz. Potrzebna jest jedna: `R1 * C1 / N`.',
      general: 'Jeszcze nie to. E11 to R1 * C1 / N, policzone dla „neo”.',
    },
    success: 'Dobrze. Przypadek dałby „neo” 0.58 raza, a stoi tam raz.',
    note: 'Te same nazwy, O11, R1, C1, N i E11, są w literaturze o kolokacjach i w następnym ćwiczeniu.',

    nearMisses: [
      { name: 'the cell only', expect: 'count', code: 'w <- tekst$slowo == "neo"\nsum(w & tekst$okno)' },
      { name: 'E11 for w copied', expect: 'copied', code: 'w <- tekst$slowo == "w"\nsum(w) * sum(tekst$okno) / nrow(tekst)' },
      { name: 'R1 / N only', expect: 'share', code: 'w <- tekst$slowo == "neo"\nsum(w) / nrow(tekst)' },
      { name: 'C1 instead', expect: 'margin', code: 'sum(tekst$okno)' },
      { name: 'several numbers', expect: 'vector', code: 'w <- tekst$slowo == "neo"\nc(sum(w), sum(tekst$okno))' },
      { name: 'a number typed in', expect: 'typed', code: '0.58' },
    ],

    diagnose({ value, code, result }) {
      if (result?.reason === 'typed' && typedIn(code)) return 'typed';
      if (!value || !isAtomic(value)) return 'general';
      if (rLength(value) > 1) return 'vector';
      const x = Number(value.values[0]);
      if (x === 1 || x === 2) return 'count';
      if (near(x, 14 / 12) || near(x, 1.2)) return 'copied';
      if (near(x, 1 / 12)) return 'share';
      if (x === 7 || x === 12) return 'margin';
      return 'general';
    },
  },
};

export default txtWindow;
