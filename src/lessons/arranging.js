/**
 * Lesson: arrange() -- module 7, syllabus topic 2.
 *
 * The one verb that changes nothing: rows move, data stays. Two things to learn:
 * `desc()` reverses, and NA always sinks to the bottom in both directions -- so the
 * last row of a sorted table is "did not answer", not "lowest score". The picture is
 * before/after with each row's origin number, so the student can follow every row.
 */

import { resultCheck } from './schema.js';
import { getNames, isNA, isDataFrame } from '../core/rvalue.js';

const SETUP = `# Ankieta; jedna osoba nie odpowiedziała na pytanie o ocenę
ankieta <- data.frame(
  id = 1:6,
  miasto = c("Kraków", "Warszawa", "Kraków", "Gdańsk", "Warszawa", "Kraków"),
  wiek = c(23, 34, 45, 29, 51, 38),
  ocena = c(4, 5, 3, NA, 2, 4)
)`;

const SOLUTION = `ankieta |>
  arrange(desc(ocena))`;

const column = (value, name) => {
  const names = (getNames(value)?.values || []).map(String);
  const at = names.indexOf(name);
  return at === -1 ? null : value.values[at];
};

// For those who want more (D41): two columns in arrange(), where the second one
// only speaks when the first is tied. The data has exactly one tie: two fours.
const EXTRA = `ankieta |>
  filter(!is.na(ocena)) |>
  arrange(desc(ocena), desc(wiek))`;

export const arranging = {
  id: 'arranging',
  module: 7,
  lecture: 2,
  requires: ['mutating'],
  title: 'arrange(): kolejność wierszy',
  setup: SETUP,

  scenes: [
    // Before any code (D29): the question, and the table before and after.
    {
      say: 'Dane się nie zmieniają. Zmienia się **kolejność** wierszy.',
      picture: { kind: 'verb', question: 'Kto jest najmłodszy, a kto najstarszy?', code: 'ankieta |> arrange(wiek)' },
    },
    {
      say: '`arrange()` przestawia wiersze. **Dane się nie zmieniają.**',
      code: 'ankieta |>\n  arrange(wiek)',
      pick: 'ankieta |>\n  arrange(wiek)',
    },
    {
      say: '`desc()` odwraca kolejność: od największej.',
      code: 'ankieta |>\n  arrange(desc(wiek))',
      pick: 'ankieta |>\n  arrange(desc(wiek))',
      tap: 'desc(wiek)',
    },
    {
      say: '**NA zawsze ląduje na dole**, w obu kierunkach.',
      code: 'ankieta |>\n  arrange(ocena)',
      pick: 'ankieta |>\n  arrange(ocena)',
    },
  ],

  play: {
    code: 'ankieta |>\n  arrange(miasto, wiek)',
    chips: [
      'sort(ankieta$ocena)',
      'ankieta |> arrange(miasto, desc(wiek))',
      'ankieta |> arrange(wiek) |> nrow()',
    ],
  },

  task: {
    prompt: 'Ustaw wiersze tak, żeby **najwyższe oceny były na górze**. Nikt nie może zniknąć.',
    starter: 'ankieta |>\n  ',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['arrange'] }),
    solution: SOLUTION,
    hints: [
      '`arrange()` domyślnie sortuje rosnąco. Tu trzeba odwrotnie.',
      'Odwrotnie = `desc()` wokół kolumny: `arrange(desc(...))`.',
    ],
    messages: {
      'missing.arrange': 'Zadanie jest o `arrange()`. `sort()` porządkuje samą kolumnę i gubi NA.',
      notATable: 'Wynikiem ma być cała tabela w nowej kolejności.',
      wrongColumns: 'Brakuje kolumn. `arrange()` niczego nie usuwa.',
      droppedRows: 'Zostało mniej niż sześć wierszy. `arrange()` nikogo nie usuwa.',
      notSorted: 'Kolejność się nie zmieniła.',
      wrongDirection: 'Posortowane, ale rosnąco. Owiń kolumnę w `desc()`.',
      wrongColumn: 'Posortowane, ale nie według ocen.',
      general: 'Jeszcze nie to: `ankieta |> arrange(desc(ocena))`.',
    },
    success: 'Dobrze. Najwyższe oceny na górze, NA na dole.',
    note: 'Ostatni wiersz to nie najgorsza ocena. To brak odpowiedzi.',

    nearMisses: [
      { name: 'sorted the wrong way round', expect: 'wrongDirection',
        code: 'ankieta |> arrange(ocena)' },
      { name: 'sorted by age instead', expect: 'wrongColumn',
        code: 'ankieta |> arrange(desc(wiek))' },
      { name: 'removed the missing answer first', expect: 'droppedRows',
        code: 'ankieta |> filter(!is.na(ocena)) |> arrange(desc(ocena))' },
      { name: 'sorted the column, not the table', expect: 'missing.arrange',
        code: 'sort(ankieta$ocena, decreasing = TRUE)' },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      if (!isDataFrame(value)) {
        return result?.reason === 'missing-call' ? `missing.${result.detail.name}` : 'notATable';
      }
      const id = column(value, 'id');
      const ocena = column(value, 'ocena');
      if (!id || !ocena) return 'wrongColumns';
      if (id.values.length !== 6) return 'droppedRows';
      if (id.values.join(',') === '1,2,3,4,5,6') return 'notSorted';
      const present = ocena.values.filter((v) => !isNA(v));
      const descending = present.every((v, i) => i === 0 || present[i - 1] >= v);
      const ascending = present.every((v, i) => i === 0 || present[i - 1] <= v);
      if (ascending && !descending) return 'wrongDirection';
      if (!descending) return 'wrongColumn';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      return 'general';
    },
  },

  extra: {
    prompt: 'Tylko osoby, które podały ocenę. Najwyższa ocena na górze, a przy **tej samej ocenie** starsza osoba wyżej.',
    starter: 'ankieta |>\n  ',
    check: resultCheck({ expected: EXTRA, requireCalls: ['arrange'] }),
    solution: EXTRA,
    hints: [
      'Najpierw usuń wiersz z NA: `filter(!is.na(ocena))`.',
      '`arrange()` przyjmuje dwie kolumny po przecinku. Druga rozstrzyga remisy w pierwszej.',
    ],
    messages: {
      'missing.arrange': 'Kolejność wierszy ustawia `arrange()`.',
      notATable: 'Wynikiem ma być tabela w nowej kolejności.',
      wrongColumns: 'Brakuje kolumn. Tu nie trzeba usuwać żadnej.',
      keptNA: 'Na dole został wiersz z NA. Usuń go przed sortowaniem: `filter(!is.na(ocena))`.',
      tooFew: 'Zniknęło za dużo osób. Wypaść ma tylko wiersz z NA.',
      notSorted: 'Oceny nie idą od najwyższej. Pierwsza kolumna w `arrange()` to `desc(ocena)`.',
      noTie: 'Oceny dobrze, ale przy dwóch czwórkach młodsza osoba jest wyżej. Dopisz drugą kolumnę: `desc(wiek)`.',
      general: 'Jeszcze nie to: `filter()`, potem `arrange()` z dwiema kolumnami.',
    },
    success: 'Dobrze. Pięć osób, a remis rozstrzygnął wiek.',
    note: 'Kolejność kolumn w `arrange()` ma znaczenie. Pierwsza sortuje, druga działa tylko przy remisie.',

    nearMisses: [
      { name: 'no tie-break', expect: 'noTie',
        code: 'ankieta |> filter(!is.na(ocena)) |> arrange(desc(ocena))' },
      { name: 'tie-break the wrong way', expect: 'noTie',
        code: 'ankieta |> filter(!is.na(ocena)) |> arrange(desc(ocena), wiek)' },
      { name: 'kept the missing answer', expect: 'keptNA',
        code: 'ankieta |> arrange(desc(ocena), desc(wiek))' },
      { name: 'age first, rating second', expect: 'notSorted',
        code: 'ankieta |> filter(!is.na(ocena)) |> arrange(desc(wiek), desc(ocena))' },
      { name: 'pulled the ratings out', expect: 'notATable',
        code: 'ankieta |> arrange(desc(ocena)) |> pull(ocena)' },
      { name: 'dropped columns on the way', expect: 'wrongColumns',
        code: 'ankieta |> filter(!is.na(ocena)) |> arrange(desc(ocena), desc(wiek)) |> select(ocena, wiek)' },
      { name: 'filtered the low ratings out too', expect: 'tooFew',
        code: 'ankieta |> filter(ocena > 3) |> arrange(desc(ocena), desc(wiek))' },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      if (!isDataFrame(value)) {
        return result?.reason === 'missing-call' ? `missing.${result.detail.name}` : 'notATable';
      }
      const [id, ocena, wiek] = ['id', 'ocena', 'wiek'].map((name) => column(value, name)?.values);
      if (!id || !ocena || !wiek) return 'wrongColumns';
      if (ocena.some(isNA)) return 'keptNA';
      if (id.length < 5) return 'tooFew';
      if (ocena.some((v, i) => i > 0 && ocena[i - 1] < v)) return 'notSorted';
      if (ocena.some((v, i) => i > 0 && ocena[i - 1] === v && wiek[i - 1] < wiek[i])) return 'noTie';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      return 'general';
    },
  },
};

export default arranging;
