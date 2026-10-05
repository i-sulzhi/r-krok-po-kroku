/**
 * Lesson: the order of levels -- module 3.
 *
 * The second thing a factor is for. Answers on a scale arrive as words, and words
 * sort alphabetically: "czasem, często, nigdy, rzadko" is no scale at all, and the
 * answer nobody gave ("zawsze") is simply absent. `levels` is where the analyst
 * says what the scale is: its order, and every point on it.
 *
 * The lesson opens without code (D27): the same eight answers counted twice, as
 * text and as a factor, one bar chart above the other. Then the same thing typed.
 * The last scene is the cost of `levels`: a value that is not among them ("Często")
 * becomes NA without a word, which is how typos in survey data disappear.
 *
 * The task is on another question, and the student types the levels by hand: from
 * "tak" to "nie", which is the reverse of the alphabet, so counting the bare text
 * cannot pass by accident.
 */

import { resultCheck } from './schema.js';
import { isAtomic, isFactor, getNames } from '../core/rvalue.js';

// What scene 2 puts on screen: the answers and their scale.
const SHOWN = `# Jak często korzystasz z biblioteki?
czestosc <- c("często", "nigdy", "rzadko", "często",
              "czasem", "rzadko", "często", "nigdy")
skala <- c("nigdy", "rzadko", "czasem",
           "często", "zawsze")`;

// The task's own question waits in memory, like a column read from a file.
const SETUP = `${SHOWN}
# Czy zajęcia były przydatne?
zgoda <- c("tak", "raczej nie", "nie", "tak",
           "raczej tak", "tak", "nie", "raczej tak")`;

const ORDER = ['tak', 'raczej tak', 'raczej nie', 'nie'];

const AS_FACTOR = 'factor(czestosc,\n       levels = skala)';

const SOLUTION = 'table(factor(zgoda,\n  levels = c("tak", "raczej tak",\n             "raczej nie", "nie")))';

export const levels = {
  id: 'levels',
  module: 3,
  lecture: 1,
  requires: ['factors'],
  title: 'Poziomy: kolejność kategorii',
  setup: SETUP,

  scenes: [
    {
      say: 'Te same odpowiedzi policzone dwa razy. Alfabet miesza skalę i gubi „zawsze”.',
      picture: {
        kind: 'order',
        question: 'Jak często korzystasz z biblioteki?',
        factor: 'factor(czestosc, levels = skala)',
        answers: 'czestosc',
      },
    },
    {
      say: 'Tekst nie zna skali. `table()` układa słowa **alfabetycznie**.',
      code: `${SHOWN}\ntable(czestosc)`,
      pick: 'table(czestosc)',
    },
    {
      say: '`levels` podaje kolejność. „zawsze” zostaje poziomem, choć nikt go nie wybrał.',
      code: AS_FACTOR,
      pick: AS_FACTOR,
      tap: 'skala',
    },
    {
      say: 'Tabela z czynnika idzie **według skali** i pokazuje zero.',
      code: 'table(factor(czestosc,\n             levels = skala))',
    },
    {
      say: 'Czego nie ma w `levels`, staje się **NA**. Tu zawiniła wielka litera.',
      code: 'factor(c("często", "Często", "nigdy"),\n       levels = skala)',
    },
  ],

  play: {
    code: 'levels(factor(czestosc))',
    chips: [
      'nlevels(factor(czestosc, levels = skala))',
      'table(factor(czestosc, levels = rev(skala)))',
      'factor(czestosc, levels = skala[1:4])',
      'droplevels(factor(czestosc, levels = skala))',
      'table(zgoda)',
    ],
  },

  task: {
    prompt: 'W pamięci jest **zgoda**. Policz odpowiedzi w kolejności: tak, raczej tak, raczej nie, nie.',
    starter: '# tabela odpowiedzi w kolejności skali\n',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['table', 'factor'], compare: { names: true } }),
    solution: SOLUTION,
    hints: [
      '`table(zgoda)` ułoży słowa alfabetycznie. Kolejność ustala czynnik z `levels`.',
      'Poziomy wpisz sam: `levels = c("tak", "raczej tak", ...)`, a całość otocz `table()`.',
    ],
    messages: {
      'missing.table': 'Zadanie prosi o tabelę liczebności, więc użyj `table()`.',
      'missing.factor': 'Kolejność ustali dopiero czynnik: `factor()` z `levels`.',
      alphabet: 'To kolejność alfabetyczna, od „nie” do „tak”. Ma być odwrotnie: podaj `levels` jak w zadaniu.',
      notTable: 'To czynnik, jeszcze nie tabela. Otocz go `table()`.',
      lost: 'Suma nie daje 8 osób. Któryś poziom jest wpisany inaczej niż w danych, więc stał się NA.',
      wrongOrder: 'Poziomy są, ale w innej kolejności. Ma być: tak, raczej tak, raczej nie, nie.',
      general: 'Jeszcze nie to: czynnik z czterema poziomami w `levels`, a wokół `table()`.',
    },
    success: 'Dobrze. Tabela idzie od „tak” do „nie”.',
    note: 'Wykres słupkowy z takiego czynnika też pójdzie w tej kolejności.',

    nearMisses: [
      { name: 'counted the bare text', expect: 'alphabet', code: 'table(zgoda)' },
      { name: 'made a factor without levels', expect: 'alphabet', code: 'table(factor(zgoda))' },
      { name: 'built the factor but never counted it', expect: 'notTable',
        code: 'factor(zgoda, levels = c("tak", "raczej tak", "raczej nie", "nie"))' },
      { name: 'a level typed with a capital letter', expect: 'lost',
        code: 'table(factor(zgoda, levels = c("Tak", "raczej tak", "raczej nie", "nie")))' },
      { name: 'forgot one level', expect: 'lost',
        code: 'table(factor(zgoda, levels = c("tak", "raczej tak", "nie")))' },
      { name: 'all four levels, another order', expect: 'wrongOrder',
        code: 'table(factor(zgoda, levels = c("tak", "raczej nie", "raczej tak", "nie")))' },
    ],

    diagnose({ value, result }) {
      if (!value || !isAtomic(value)) return 'general';
      if (isFactor(value)) return 'notTable';
      const names = (getNames(value)?.values || []).map(String);
      if (names.length) {
        const total = value.values.reduce((a, b) => a + b, 0);
        if (total !== 8) return 'lost';
        if (names.join() === [...ORDER].reverse().join()) return 'alphabet';
        if (names.join() !== ORDER.join()) return 'wrongOrder';
      }
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      return 'general';
    },
  },
};

export default levels;
