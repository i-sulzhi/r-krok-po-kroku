/**
 * Lesson: a plot built step by step -- module 10, lecture 4 (D79).
 *
 * The closing exercise of lecture 4, as "Od pytania do tabeli" closes lecture 2. It
 * adds no function: everything here was met in exercises 25-29. Its one idea is how
 * a plot that looks complicated is made: one `+` at a time, each adding one thing,
 * and the plot run after every step so that a mistake shows where it came in.
 *
 * One scene per `+`. The strip "warstwa po warstwie" above the stage carries the
 * story: a card per step, and under each card what that step added.
 *
 * The data answers a question by sex and city where the answer differs (men in
 * Kraków, women elsewhere), and where n matters: 100% in Warszawa is two people.
 * The task builds the same kind of plot for another table, by age group.
 *
 * Its trap is one a student meets the moment the bars stand side by side: text
 * without `position_dodge()` stands between the two bars, not over each.
 */

import { resultCheck } from './schema.js';
import { buildPlot } from '../core/builtins/ggplot.js';

const SETUP = `# Zadowoleni z zajęć według miasta i płci (wykład 3)
wyniki <- data.frame(
  miasto = c("Gdańsk", "Gdańsk", "Kraków", "Kraków",
             "Warszawa", "Warszawa"),
  plec = c("K", "M", "K", "M", "K", "M"),
  n = c(4, 4, 5, 5, 2, 4),
  procent = c(75, 50, 60, 80, 100, 25)
)
# To samo według grupy wieku
wedlug_wieku <- data.frame(
  grupa = c("do 29", "do 29", "30+", "30+"),
  plec = c("K", "M", "K", "M"),
  n = c(4, 4, 5, 2),
  procent = c(75, 50, 40, 100)
)`;

const STEP1 = `ggplot(wyniki, aes(x = miasto, y = procent,
                   fill = plec))`;
const STEP2 = `${STEP1} +\n  geom_col(position = "dodge")`;
const TEXT = `geom_text(aes(label = n), vjust = -0.5,
            position = position_dodge(0.9))`;
const STEP3 = `${STEP2} +\n  ${TEXT}`;
const STEP4 = `${STEP3} +
  labs(title = "Zadowoleni z zajęć", x = NULL,
       y = "Procent zadowolonych", fill = "Płeć")`;
const STEP5 = `${STEP4} +\n  theme_minimal()`;

// One line per chip: the whole plot so far, then the one thing the chip changes.
const ONE = 'ggplot(wyniki, aes(x = miasto, y = procent, fill = plec)) + geom_col(position = "dodge")';

const SOLUTION = `ggplot(wedlug_wieku, aes(x = grupa, y = procent,
                         fill = plec)) +
  geom_col(position = "dodge") +
  geom_text(aes(label = n), vjust = -0.5,
            position = position_dodge(0.9)) +
  labs(title = "Zadowoleni według wieku")`;

const TITLE = 'Zadowoleni według wieku';

export const plotBuild = {
  id: 'plot-build',
  module: 10,
  lecture: 4,
  requires: ['plot-report', 'plot-fill'],
  title: 'Wykres krok po kroku',
  setup: SETUP,

  scenes: [
    {
      say: 'Czy kobiety i mężczyźni są równie zadowoleni w każdym mieście? **Krok 1**: tabela z wykładu 3.',
      code: 'wyniki',
      pick: 'wyniki',
    },
    {
      say: 'Krok 2: `ggplot()` i `aes()`. Miasto, procent i płeć jako kolor. Słupków jeszcze nie ma.',
      code: STEP1,
      pick: STEP1,
    },
    {
      say: 'Krok 3: `+ geom_col()`. Kobiety i mężczyźni stoją **obok siebie**.',
      code: STEP2,
      pick: STEP2,
      tap: 'geom_col(position = "dodge")',
    },
    {
      say: 'Krok 4: `+ geom_text()` pisze **n**. 100% w Warszawie to dwie osoby.',
      code: STEP3,
      pick: STEP3,
      tap: 'position_dodge(0.9)',
    },
    {
      say: 'Krok 5: `+ labs()`. Tytuł i podpisy mówią czytelnikowi, **co** widzi.',
      code: STEP4,
      pick: STEP4,
    },
    {
      say: 'Krok 6: `+ theme_minimal()` zmienia **wygląd**. Dane zostają te same.',
      code: STEP5,
      pick: STEP5,
    },
  ],

  play: {
    say: 'Twoja kolej. Każdy `+` dokłada jedną rzecz. Po każdym uruchom i zobacz, co się zmieniło.',
    code: STEP3,
    chips: [
      // The trap of side-by-side bars: text without position_dodge() stands between them.
      `${ONE} + geom_text(aes(label = n), vjust = -0.5)`,
      `${ONE} + geom_text(aes(label = paste0(n, " os.")), vjust = -0.5, position = position_dodge(0.9))`,
      `${ONE} + labs(fill = "Płeć") + theme(legend.position = "bottom")`,
      `${ONE} + theme_bw()`,
      'ggplot(wyniki, aes(x = miasto, y = procent, fill = plec)) + geom_col()',
    ],
  },

  task: {
    prompt: 'Z tabeli `wedlug_wieku`: procent zadowolonych w grupach, płcie **obok siebie**, nad słupkami **n**, tytuł „Zadowoleni według wieku”.',
    starter: 'ggplot(wedlug_wieku, ',
    check: resultCheck({ expected: SOLUTION, requireCalls: ['ggplot'], compare: { decorations: true } }),
    solution: SOLUTION,
    hints: [
      'Krok po kroku, jak w scenach: `aes(x = grupa, y = procent, fill = plec)`, potem `geom_col(position = "dodge")`.',
      'Dalej `geom_text(aes(label = n), vjust = -0.5, position = position_dodge(0.9))` i `labs(title = ...)`.',
    ],
    messages: {
      'missing.ggplot': 'Wykres zaczyna się od `ggplot(wedlug_wieku, aes(...))`.',
      notAPlot: 'To tabela, a ma być wykres. Pierwszy krok: `ggplot(wedlug_wieku, aes(x = grupa, y = procent, fill = plec))`.',
      blank: 'Osie są. Następny krok to słupki: `+ geom_col(position = "dodge")`.',
      noFill: 'Słupki nie są podzielone na płeć. W `aes()` dopisz `fill = plec`.',
      nAsHeight: 'Wysokość słupków to n, a ma być procent: `y = procent`. n idzie do napisu.',
      stacked: 'Płcie stoją jedna na drugiej. Obok siebie stawia je `geom_col(position = "dodge")`.',
      noText: 'Słupki są dobre. Następny krok: n nad słupkami, `+ geom_text(aes(label = n), vjust = -0.5, ...)`.',
      textNotDodged: 'Napisy stoją między słupkami. Nad każdym słupkiem postawi je `position = position_dodge(0.9)`.',
      textOffset: 'Napisy są przesunięte względem słupków. W `position_dodge()` szerokość ma być taka jak słupków: `0.9`.',
      swapped: 'Na osi x jest płeć, a mają być grupy wieku. Zamień: `x = grupa`, `fill = plec`.',
      wrongTable: 'To inna tabela. Zadanie jest o grupach wieku: `ggplot(wedlug_wieku, ...)`.',
      wrongLabel: 'Nad słupkami ma stać n, a stoi coś innego: `geom_text(aes(label = n), ...)`.',
      textFirst: 'Napisy są narysowane przed słupkami. Najpierw `geom_col()`, potem `geom_text()`.',
      noTitle: 'Słupki i n są dobre. Ostatni krok: `+ labs(title = "Zadowoleni według wieku")`.',
      wrongTitle: 'Tytuł ma brzmieć dokładnie „Zadowoleni według wieku”.',
      general: 'Jeszcze nie to. Krok po kroku: `aes()`, `geom_col(position = "dodge")`, `geom_text()`, `labs()`.',
    },
    success: 'Dobrze. 100% w grupie 30+ to dwie osoby.',
    note: 'Ten sam kod można napisać od razu w całości. Krok po kroku łatwiej znaleźć błąd: widać, który `+` go wniósł.',

    nearMisses: [
      { name: 'printed the table', expect: 'notAPlot', code: 'wedlug_wieku' },
      { name: 'axes only', expect: 'blank',
        code: 'ggplot(wedlug_wieku, aes(x = grupa, y = procent, fill = plec))' },
      { name: 'no colour by sex', expect: 'noFill',
        code: 'ggplot(wedlug_wieku, aes(x = grupa, y = procent)) + geom_col(position = "dodge") + geom_text(aes(label = n), vjust = -0.5) + labs(title = "Zadowoleni według wieku")' },
      { name: 'n as the height', expect: 'nAsHeight',
        code: 'ggplot(wedlug_wieku, aes(x = grupa, y = n, fill = plec)) + geom_col(position = "dodge") + geom_text(aes(label = n), vjust = -0.5, position = position_dodge(0.9)) + labs(title = "Zadowoleni według wieku")' },
      { name: 'bars stacked', expect: 'stacked',
        code: 'ggplot(wedlug_wieku, aes(x = grupa, y = procent, fill = plec)) + geom_col() + geom_text(aes(label = n), vjust = -0.5) + labs(title = "Zadowoleni według wieku")' },
      { name: 'stopped at the bars', expect: 'noText',
        code: 'ggplot(wedlug_wieku, aes(x = grupa, y = procent, fill = plec)) + geom_col(position = "dodge") + labs(title = "Zadowoleni według wieku")' },
      // The trap of the exercise: text over side-by-side bars needs its own dodge.
      { name: 'text not dodged', expect: 'textNotDodged',
        code: 'ggplot(wedlug_wieku, aes(x = grupa, y = procent, fill = plec)) + geom_col(position = "dodge") + geom_text(aes(label = n), vjust = -0.5) + labs(title = "Zadowoleni według wieku")' },
      { name: 'text dodged by another width', expect: 'textOffset',
        code: 'ggplot(wedlug_wieku, aes(x = grupa, y = procent, fill = plec)) + geom_col(position = "dodge") + geom_text(aes(label = n), vjust = -0.5, position = position_dodge(1)) + labs(title = "Zadowoleni według wieku")' },
      // ggplot2 cannot spread text with a bare "dodge": no width, so it stays in the middle.
      { name: 'text with a bare "dodge"', expect: 'textNotDodged',
        code: 'ggplot(wedlug_wieku, aes(x = grupa, y = procent, fill = plec)) + geom_col(position = "dodge") + geom_text(aes(label = n), vjust = -0.5, position = "dodge") + labs(title = "Zadowoleni według wieku")' },
      { name: 'sex on the axis, age as colour', expect: 'swapped',
        code: 'ggplot(wedlug_wieku, aes(x = plec, y = procent, fill = grupa)) + geom_col(position = "dodge") + geom_text(aes(label = n), vjust = -0.5, position = position_dodge(0.9)) + labs(title = "Zadowoleni według wieku")' },
      { name: 'the table of the scenes', expect: 'wrongTable',
        code: 'ggplot(wyniki, aes(x = miasto, y = procent, fill = plec)) + geom_col(position = "dodge") + geom_text(aes(label = n), vjust = -0.5, position = position_dodge(0.9)) + labs(title = "Zadowoleni według wieku")' },
      { name: 'the percent written on the bars', expect: 'wrongLabel',
        code: 'ggplot(wedlug_wieku, aes(x = grupa, y = procent, fill = plec)) + geom_col(position = "dodge") + geom_text(aes(label = procent), vjust = -0.5, position = position_dodge(0.9)) + labs(title = "Zadowoleni według wieku")' },
      { name: 'text before the bars', expect: 'textFirst',
        code: 'ggplot(wedlug_wieku, aes(x = grupa, y = procent, fill = plec)) + geom_text(aes(label = n), vjust = -0.5, position = position_dodge(0.9)) + geom_col(position = "dodge") + labs(title = "Zadowoleni według wieku")' },
      { name: 'no title', expect: 'noTitle',
        code: 'ggplot(wedlug_wieku, aes(x = grupa, y = procent, fill = plec)) + geom_col(position = "dodge") + geom_text(aes(label = n), vjust = -0.5, position = position_dodge(0.9))' },
      { name: 'another title', expect: 'wrongTitle',
        code: 'ggplot(wedlug_wieku, aes(x = grupa, y = procent, fill = plec)) + geom_col(position = "dodge") + geom_text(aes(label = n), vjust = -0.5, position = position_dodge(0.9)) + labs(title = "Zadowoleni")' },
      { name: 'the pipe between steps', expect: 'error',
        code: 'ggplot(wedlug_wieku, aes(x = grupa, y = procent, fill = plec)) |> geom_col(position = "dodge")' },
    ],

    diagnose({ value, result }) {
      if (!value) return 'general';
      const missing = result?.reason === 'missing-call' ? `missing.${result.detail.name}` : null;
      if (!value.gg) return 'notAPlot';
      const b = buildPlot(value);
      if (!b.layers.length) return 'blank';
      const bars = b.layers.find((l) => l.geom !== 'text');
      const text = b.layers.find((l) => l.geom === 'text');
      if (!bars) return 'general';
      const xs = b.x.discrete ? b.x.levels.join() : '';
      if (xs === 'K,M') return 'swapped';
      if (xs && xs !== '30+,do 29') return 'wrongTable';
      if (!bars.marks.some((m) => m.fillKey != null)) return 'noFill';
      if (bars.marks.map((m) => m.ymax).sort((p, q) => p - q).join() === '2,4,4,5') return 'nAsHeight';
      if (bars.marks.some((m) => m.ymin > 0)) return 'stacked';
      if (!text) return 'noText';
      if (text.marks.map((m) => String(m.label)).join() !== bars.marks.map((m) => {
        const want = { '30+ K': 5, '30+ M': 2, 'do 29 K': 4, 'do 29 M': 4 };
        return String(want[`${m.xKey} ${m.fillKey}`]);
      }).join()) return 'wrongLabel';
      // Over side-by-side bars, text that was not dodged stands at the middle of x.
      if (text.marks.every((m) => Number.isInteger(Math.round(m.xmid * 1000) / 1000))) return 'textNotDodged';
      const barMid = new Map(bars.marks.map((m) => [`${m.xKey} ${m.fillKey}`, m.xmid]));
      if (text.marks.some((m) => Math.abs((barMid.get(`${m.xKey} ${m.fillKey}`) ?? m.xmid) - m.xmid) > 1e-6)) return 'textOffset';
      if (b.layers.indexOf(text) < b.layers.indexOf(bars)) return 'textFirst';
      if (!b.labels.title) return 'noTitle';
      if (b.labels.title !== TITLE) return 'wrongTitle';
      return missing || 'general';
    },
  },
};

export default plotBuild;
