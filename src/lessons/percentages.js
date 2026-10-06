/**
 * Lesson: percentages with count() and mutate() -- module 9, lecture 3 (D37).
 *
 * A count is not yet an answer: "five people" means nothing until it is five of how
 * many. The percent is one line, `n / sum(n) * 100`, and the whole exercise is about
 * its denominator, which changes without the line changing:
 *
 *   - with the missing answers left in, it is everyone who was asked;
 *   - with them filtered out, it is everyone who answered;
 *   - after `group_by(miasto)`, it is everyone in that city.
 *
 * Three different numbers for "dobra" from the same data, none of them wrong, each
 * answering a different question. The same point about missing data as in the rest
 * of the path, one step further: here it moves a percentage by twelve points.
 */

import { resultCheck } from './schema.js';
import { getNames, isNA, isDataFrame } from '../core/rvalue.js';

const SETUP = `# Opinia o zajęciach. Dwie osoby nie odpowiedziały
ankieta <- data.frame(
  id = 1:10,
  miasto = c("Kraków", "Kraków", "Kraków", "Kraków", "Kraków",
             "Kraków", "Gdańsk", "Gdańsk", "Gdańsk", "Gdańsk"),
  opinia = c("dobra", "dobra", "dobra", "słaba", NA,
             "dobra", "dobra", "słaba", "słaba", NA)
)`;

const OF_ALL = `ankieta |>
  count(opinia) |>
  mutate(procent = n / sum(n) * 100)`;

const OF_ANSWERS = `ankieta |>
  filter(!is.na(opinia)) |>
  count(opinia) |>
  mutate(procent = n / sum(n) * 100)`;

const TWO_KEYS = `ankieta |>
  count(miasto, opinia) |>
  mutate(procent = n / sum(n) * 100)`;

const IN_CITY = `ankieta |>
  count(miasto, opinia) |>
  group_by(miasto) |>
  mutate(procent = n / sum(n) * 100)`;

const SOLUTION = `ankieta |>
  filter(!is.na(opinia)) |>
  count(miasto, opinia) |>
  group_by(miasto) |>
  mutate(procent = n / sum(n) * 100)`;

/** The column of numbers that is not `n`: the student's percentages, whatever its name. */
function added(value) {
  const names = (getNames(value)?.values || []).map(String);
  const at = names.findIndex((nm) => !['miasto', 'opinia', 'n'].includes(nm));
  return at < 0 ? null : { name: names[at], col: value.values[at] };
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0);

export const percentages = {
  id: 'percentages',
  module: 9,
  lecture: 3,
  requires: ['counting', 'mutating'],
  title: 'Procenty: count() i mutate()',
  setup: SETUP,

  scenes: [
    {
      say: 'Pięć osób to dużo czy mało? To zależy, **z ilu**. Raport pyta o procent.',
      picture: { kind: 'verb', question: 'Jaki procent osób ma dobrą opinię o zajęciach?', code: OF_ALL },
    },
    {
      say: 'Procent to część przez całość: `n` przez **sumę** `n`, razy 100. „dobra” to 50%.',
      code: OF_ALL,
      pick: OF_ALL,
      tap: 'sum(n)',
    },
    {
      say: 'Bez braków całość to **8 odpowiedzi**, nie 10 osób. „dobra” to już 62.5%.',
      code: OF_ANSWERS,
    },
    {
      say: 'Dwie zmienne, a całość to wciąż **wszyscy**. 40% to nie „40% Krakowa”.',
      code: TWO_KEYS,
    },
    {
      say: 'Po `group_by()` suma liczy się **w każdym mieście osobno**. Kraków: 4 z 6.',
      code: IN_CITY,
      pick: IN_CITY,
      tap: 'sum(n)',
    },
  ],

  play: {
    code: 'ankieta |>\n  count(opinia) |>\n  mutate(procent = round(n / sum(n) * 100))',
    chips: [
      'ankieta |> count(miasto) |> mutate(procent = n / sum(n) * 100)',
      'ankieta |> count(opinia) |> mutate(udzial = n / sum(n))',
      'ankieta |> count(miasto, opinia) |> group_by(opinia) |> mutate(procent = n / sum(n) * 100)',
      'ankieta |> group_by(miasto) |> summarise(dobra = mean(opinia == "dobra", na.rm = TRUE) * 100)',
    ],
  },

  task: {
    prompt: 'Policz **procent odpowiedzi** „dobra” i „słaba” w każdym mieście. Braki pomiń.',
    starter: 'ankieta |>\n  ',
    // Rounded percentages are the same answer: 33.3 for 33.33333.
    check: resultCheck({ expected: SOLUTION, requireCalls: ['count', 'mutate'], compare: { tolerance: 0.02 } }),
    solution: SOLUTION,
    hints: [
      'Cztery kroki: bez braków `filter()`, liczby `count(miasto, opinia)`, potem grupy i procent.',
      'Żeby całością było miasto, przed `mutate()` stoi `group_by(miasto)`.',
    ],
    messages: {
      'missing.count': 'Zacznij od liczb: `count(miasto, opinia)` daje `n` dla każdej pary.',
      'missing.mutate': 'Są liczby, brakuje procentu. Dodaj kolumnę: `mutate(procent = n / sum(n) * 100)`.',
      notATable: 'Wynikiem ma być tabela: miasto, opinia, `n` i procent.',
      noPercent: 'Są liczby, brakuje procentu. Dodaj kolumnę: `mutate(procent = n / sum(n) * 100)`.',
      withNA: 'W tabeli są wiersze z NA, więc procenty liczą też braki. Najpierw `filter(!is.na(opinia))`.',
      ofAll: 'Procenty dają 100 dla całej tabeli, a mają dawać 100 w każdym mieście. Brakuje `group_by(miasto)`.',
      wrongGroup: 'Procenty dają 100 dla każdej opinii, a pytanie jest o miasto. Grupuj przez `miasto`.',
      fraction: 'To ułamki, nie procenty: brakuje `* 100`.',
      oneKey: 'Potrzebne są obie zmienne naraz: `count(miasto, opinia)`.',
      wrongName: 'Liczby dobre, ale kolumna ma się nazywać `procent`.',
      general: 'Jeszcze nie to. Kolejność: `filter()`, `count()`, `group_by(miasto)`, `mutate()`.',
    },
    success: 'Dobrze. W każdym mieście procenty dają razem 100.',
    note: 'Kolumna `n` zostaje obok. W Gdańsku 33% to jedna osoba z trzech.',

    nearMisses: [
      { name: 'left the missing answers in', expect: 'withNA',
        code: 'ankieta |> count(miasto, opinia) |> group_by(miasto) |> mutate(procent = n / sum(n) * 100)' },
      { name: 'forgot the groups', expect: 'ofAll',
        code: 'ankieta |> filter(!is.na(opinia)) |> count(miasto, opinia) |> mutate(procent = n / sum(n) * 100)' },
      { name: 'grouped by the answer, not the city', expect: 'wrongGroup',
        code: 'ankieta |> filter(!is.na(opinia)) |> count(miasto, opinia) |> group_by(opinia) |> mutate(procent = n / sum(n) * 100)' },
      { name: 'stopped at the counts', expect: 'missing.mutate',
        code: 'ankieta |> filter(!is.na(opinia)) |> count(miasto, opinia)' },
      { name: 'left fractions', expect: 'fraction',
        code: 'ankieta |> filter(!is.na(opinia)) |> count(miasto, opinia) |> group_by(miasto) |> mutate(procent = n / sum(n))' },
      { name: 'counted one variable only', expect: 'oneKey',
        code: 'ankieta |> filter(!is.na(opinia)) |> count(opinia) |> mutate(procent = n / sum(n) * 100)' },
      { name: 'named the column differently', expect: 'wrongName',
        code: 'ankieta |> filter(!is.na(opinia)) |> count(miasto, opinia) |> group_by(miasto) |> mutate(proc = n / sum(n) * 100)' },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      const missing = result?.reason === 'missing-call' ? `missing.${result.detail.name}` : null;
      if (!isDataFrame(value)) return missing || 'notATable';
      const names = (getNames(value)?.values || []).map(String);
      if (!names.includes('miasto') || !names.includes('opinia')) return missing || 'oneKey';
      const column = (nm) => value.values[names.indexOf(nm)].values;
      const extra = added(value);
      if (!extra) return missing || 'noPercent';
      if (column('opinia').some(isNA)) return 'withNA';
      const pct = extra.col.values.map(Number);
      const total = sum(pct);
      // Which whole do they add up to? 1 or 100 per city, per answer, or for the table.
      const per = (key) => {
        const by = new Map();
        column(key).forEach((k, i) => by.set(k, (by.get(k) || 0) + pct[i]));
        return [...by.values()];
      };
      const all = (xs, target) => xs.every((x) => Math.abs(x - target) < 0.5 * (target / 100 || 0.01) + 0.02 * target);
      if (all(per('miasto'), 1)) return 'fraction';
      if (all(per('miasto'), 100)) return extra.name !== 'procent' ? 'wrongName' : (missing || 'general');
      if (Math.abs(total - 100) < 2) return 'ofAll';
      if (all(per('opinia'), 100)) return 'wrongGroup';
      return missing || 'general';
    },
  },
};

export default percentages;
