/**
 * Lesson: colour and groups -- module 10, lecture 4 (D45).
 *
 * `fill` inside `aes()` is a second variable on the plot: it splits every bar into
 * groups, gives each a colour and writes the legend. The three positions then show
 * the same counts three ways. Stacked answers "how many in all", side by side
 * answers "which group is larger", and filled answers "what share", at a price the
 * picture names: every bar is 100% tall, and how many people stand behind it is
 * gone. That is exercise 19's "percent of whom", drawn.
 *
 * The trap is the difference between inside and outside `aes()`. A word inside it
 * is a column holding that word, so `aes(fill = "blue")` paints red bars with a
 * legend entry called "blue". R gives no warning. A fixed colour belongs outside.
 */

import { resultCheck } from './schema.js';
import { buildPlot } from '../core/builtins/ggplot.js';

const SETUP = `# Dziesięć osób z trzech miast
ankieta <- data.frame(
  id = 1:10,
  plec = c("K", "M", "K", "K", "M", "M", "K", "M", "K", "M"),
  miasto = c("Kraków", "Warszawa", "Kraków", "Gdańsk", "Warszawa",
             "Kraków", "Gdańsk", "Warszawa", "Kraków", "Gdańsk")
)`;

const BASE = 'ggplot(ankieta, aes(x = miasto, fill = plec))';
const STACKED = `${BASE} +\n  geom_bar()`;
const DODGED = `${BASE} +\n  geom_bar(position = "dodge")`;
const FILLED = `${BASE} +\n  geom_bar(position = "fill")`;
const WORD = 'ggplot(ankieta, aes(x = miasto, fill = "blue")) +\n  geom_bar()';
const FIXED = 'ggplot(ankieta, aes(x = miasto)) +\n  geom_bar(fill = "steelblue")';

const SOLUTION = FILLED;

export const plotFill = {
  id: 'plot-fill',
  module: 10,
  lecture: 4,
  requires: ['plot-count', 'percentages'],
  title: 'Kolor i grupy: fill',
  setup: SETUP,

  scenes: [
    {
      say: '`fill` w `aes()` dzieli słupek na **grupy**. Każda dostaje kolor i miejsce w legendzie.',
      code: STACKED,
      pick: STACKED,
      tap: 'aes(x = miasto, fill = plec)',
    },
    {
      say: '`position = "dodge"` stawia grupy **obok siebie**. Łatwiej porównać ich wysokość.',
      code: DODGED,
      pick: DODGED,
    },
    {
      say: '`position = "fill"`: każdy słupek to 100%. Widać **udziały**, znika liczba osób.',
      code: FILLED,
      pick: FILLED,
    },
    {
      say: 'Słowo w `aes()` to nie kolor, tylko **kolumna z tym słowem**. Słupki są czerwone.',
      code: WORD,
      pick: WORD,
      tap: 'aes(x = miasto, fill = "blue")',
    },
    {
      say: 'Stały kolor stoi **poza** `aes()`, w samej warstwie. Legendy nie ma, bo nie ma grup.',
      code: FIXED,
      pick: FIXED,
    },
  ],

  play: {
    say: 'Twoja kolej. Te same dziesięć osób, trzy sposoby pokazania.',
    code: DODGED,
    chips: [
      'ggplot(ankieta, aes(x = plec, fill = miasto)) + geom_bar()',
      `${BASE} + geom_bar(position = "dodge") + labs(fill = "Płeć")`,
      `${BASE} + geom_bar() + theme(legend.position = "bottom")`,
      `${BASE} + geom_bar(position = "fill") + coord_flip()`,
      'ankieta |> count(miasto, plec)',
    ],
  },

  task: {
    prompt: 'Pokaż **udział kobiet i mężczyzn** w każdym mieście: słupki tej samej wysokości, podzielone kolorem.',
    starter: 'ggplot(ankieta, ',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['ggplot'], compare: { decorations: true } }),
    solution: SOLUTION,
    hints: [
      'Dwie zmienne: miasto na osi x, płeć jako kolor. Obie stoją w `aes()`.',
      'Udziały, czyli słupki do 100%, daje `geom_bar(position = "fill")`.',
    ],
    messages: {
      'missing.ggplot': 'Wykres zaczyna się od `ggplot(ankieta, aes(...))`.',
      notAPlot: 'To tabela, a ma być wykres: `ggplot(ankieta, aes(x = miasto, fill = plec))` i warstwa.',
      blank: 'Są osie, ale nic nie jest narysowane. Dołóż warstwę: `+ geom_bar(position = "fill")`.',
      noFill: 'Słupki nie są podzielone na płeć. Dopisz w `aes()`: `fill = plec`.',
      constant: 'Słowo w `aes()` nie jest kolorem ani kolumną z danych. Kolorem ma być kolumna: `fill = plec`.',
      swapped: 'Zmienne są zamienione. Miasto idzie na oś x, a płeć jest kolorem.',
      stacked: 'Słupki mają różną wysokość, bo to liczby osób. Udziały daje `position = "fill"`.',
      dodged: 'Słupki stoją obok siebie i pokazują liczby osób. Udziały daje `position = "fill"`.',
      general: 'Jeszcze nie to: `aes(x = miasto, fill = plec)` i `geom_bar(position = "fill")`.',
    },
    success: 'Dobrze. Każde miasto to 100%, podzielone na płeć.',
    note: 'Warszawa wygląda jak „100% mężczyzn”. To trzy osoby. Przy takim wykresie obok zawsze potrzebne jest n.',

    nearMisses: [
      { name: 'left the bars stacked', expect: 'stacked', code: STACKED },
      { name: 'put the bars side by side', expect: 'dodged', code: DODGED },
      { name: 'no second variable', expect: 'noFill', code: 'ggplot(ankieta, aes(x = miasto)) + geom_bar(position = "fill")' },
      { name: 'a word instead of a column', expect: 'constant',
        code: 'ggplot(ankieta, aes(x = miasto, fill = "plec")) + geom_bar(position = "fill")' },
      { name: 'swapped the two variables', expect: 'swapped',
        code: 'ggplot(ankieta, aes(x = plec, fill = miasto)) + geom_bar(position = "fill")' },
      { name: 'counted instead of drawing', expect: 'notAPlot', code: 'ankieta |> count(miasto, plec)' },
      { name: 'axes only', expect: 'blank', code: BASE },
      { name: 'the column outside aes()', expect: 'error',
        code: 'ggplot(ankieta, aes(x = miasto)) + geom_bar(fill = plec, position = "fill")' },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      if (!value.gg) return 'notAPlot';
      const b = buildPlot(value);
      if (!b.layers.length) return 'blank';
      if (b.notes.some((n) => n.kind === 'constantInAes')) return 'constant';
      const layer = b.layers[0];
      if (!layer.marks.some((m) => m.fillKey != null)) return 'noFill';
      if (!b.x.discrete || b.x.levels.join() !== 'Gdańsk,Kraków,Warszawa') return 'swapped';
      if (layer.position === 'dodge') return 'dodged';
      if (layer.position !== 'fill') return 'stacked';
      if (result?.reason === 'missing-call') return `missing.${result.detail.name}`;
      return 'general';
    },
  },
};

export default plotFill;
