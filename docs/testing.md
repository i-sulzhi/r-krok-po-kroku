# Testing

Four layers, each answering a different question.

## 1. Does it parse R the way R does?

`test/diff-syntax.mjs` — 31 precedence-sensitive snippets are parsed by us and by R
itself (`str2lang`), and both trees are compared as s-expressions.

Catches the silent class of bug: `1:n-1` is `(1:n)-1`, `-2^2` is `-(2^2)`.

## 2. Does it compute what R computes?

`test/diff-eval.mjs` — 109 snippets run in our engine and in the real `R` binary; the
printed console output must match line for line. A snippet starting with
`options(width = N);` is compared at that console width: the trainer prints at the
width of its console panel, as RStudio does (D14), so wrapping and R's shortened
`5 Levels: a ... e` line must match at narrow widths too.

The oracle must run under `LC_ALL=en_US.UTF-8`, or Cyrillic and Polish strings come
back as escaped bytes and every comparison fails for the wrong reason.

## 3. Do the packages agree with base R?

`test/diff-paired.mjs` — dplyr and stringr are not installed in the system R, so each
case *pairs* our tidyverse code with an equivalent written in base R. The base-R side
runs in real R; the tidyverse side runs here; the output must match.

- `cases-dplyr.txt` — 70 pairs (filter, select, mutate, arrange, group_by/summarise,
  count, distinct, slice, rename, pull, both pipes)
- `cases-stringr.txt` — 27 pairs

Where the packages *deliberately* differ from base R, the base-R side says so
explicitly (`ifelse(is.na(x), NA, grepl(...))`), and the difference itself is asserted
in layer 4 rather than smoothed over.

## 4. Does it teach correctly?

`test/behaviour.mjs` — 48 checks on the claims R cannot verify for us:

- trace events carry the payloads pictures need (before/after, recycle counts, group
  membership, NA positions)
- the evaluation log records every sub-expression (decision D11): nests of calls
  inside out, one entry per group inside `summarise()`, the failing expression with
  its error, events attributed to the evaluation that emitted them, pointing at a
  character finds the smallest expression under it, a runaway loop is capped
- errors are diagnosed into the *right* advice, matched on the error key
- Polish renders, plurals included (1 wiersz / 2 wiersze / 5 wierszy / 22 wiersze)
- deliberate divergences really behave that way
- hostile input is survived: endless loops, infinite recursion, empty input,
  malformed syntax, 20 000-element vectors

`test/lessons.mjs` — 322 checks. Every piece of code every lesson contains is run:
each scene (and its pre-selected expression and "click here" must exist), the
sandbox, every one-click chip, the solution (must pass), the starter (must not), and
every anticipated wrong answer (must get its own diagnosis). Text budgets are
enforced here: one scene sentence is at most 90 visible characters, and no
student-facing string may contain an em dash (the teacher's plain style; the i18n
suite checks the same for every dictionary string). Every vector a lesson's scenes
use is created on screen in the scene that first uses it (D19), and no code line in a
scene is wider than 54 characters. Every number the texts state ("Pięć osób", "5 + 2 =
7") is listed with the code that proves it on the lesson's data (D21).

`test/pictures.mjs` — the picture sweep. On a minimal DOM shim, every evaluation of
every one of those code pieces (plus 34 snippets no lesson contains) goes through the
stage: 2 152 sub-expressions, each scene's pointer (`show`) drawn on its picked
expression (a spreadsheet panel must appear, in every animation frame too), and the task's goal-vs-answer picture for every solution and anticipated
wrong answer (107). Scenes without code (D27) are walked too: every person and every
answer of each survey picture is pointed at (51), the two sides must light the same
thing and the caption must name the answer. Tables before and after their verbs (D29)
are shown stage by stage (18), and the last stage must equal the table R returns,
row for row and cell for cell. It fails when a picture throws, or when a caption would show a raw
key, an unfilled `{placeholder}`, `undefined`, `NaN` or `[object Object]`.

`test/glossary.mjs` — 170 checks on the "Ściąga" panel (D15). Detection on known
snippets: which concepts, and which exact text carries each label (`oceny` = name,
`<-` = save). Every concept has its texts within budget and is used by some lesson.
Every scene, sandbox and task starter of every lesson draws a panel (89; 158 drawings with the bar): no raw key
or `{placeholder}` on screen, every concept new to the lesson gets an open card, and
each example, read left to right, is a piece of real code. The task step must never
show a line of its own solution. Mutation-checked: an example taken from the
solution, a label shifted by one character and a broken placeholder all fail it. Every example's labels hang under their own parts and never overlap
in a row (D23). A task offers its lesson's concepts (lesson 7: `$`, `[ ]`, `==`);
the function card says what that function does; "Funkcje" lists what was met so far,
`mean()` already in lesson 2 because its task needs it; every function the lessons
show has its line; `name = value` in summarise() reads as a new column (D25).

`test/people.mjs` — 42 checks on names and the report (D17, D26). Names are trimmed and
case-insensitive; progress, saved code and place stay apart per person; removing a
person removes their keys and only theirs; a page load chooses nobody by itself. The
report says who, when, how many and per lesson (first success date kept, an opened
solution reported); its check code survives Windows line ends, doubled blank lines,
non-breaking spaces, indentation and a greeting around it, and catches five kinds of
hand edit. Checks, hints and an opened solution stop counting at the first success,
and a zero is not printed. A report made before that change still checks. Several
reports pasted together are checked one by one, in order, with their facts read back
(a changed one gives none, a heading without a code is reported). Typing on "Kim
jesteś?" narrows the list of names. Mutation-checked.

`test/bundle.mjs` — the built file itself: built to a scratch path, booted on the DOM
shim, every lesson step walked, every sub-expression selected, every solution
checked. It exists because a bug once lived only in the bundle (see D13). It then
plays a shared lab computer (D16, D17): the trainer opens on "Kim jesteś?" with no
lesson behind it; Ania's solved task opens with its starter and offers her code; the
header, menu and report name her and count 13 of 13; the report passes the teacher's
check with mangled spacing and fails it after a hand edit; Bartek starts clean; "ania"
gets Ania back; removing Bartek asks first, cancels cleanly and keeps Ania. Every
solved task keeps its code in the box after the success redraw, and a failed check
goes away once the code changes. Last, the teacher: from "Kim jesteś?", with nobody
chosen, the check opens, judges a pasted report at once (genuine, then edited, then
empty) and closes back to the names without adding anyone. "Dalej w RStudio" (D18)
opens from the solved last lesson and from the menu, with three steps, eight messages
and no raw key, and the stage and memory come back afterwards. A scene that asks for
a mask along a table's rows gets that picture, the same code elsewhere keeps the
usual one, and rows picked by number are not captioned as a mask (D20). In the
filter() picture each row carries its own decision: NA on row 5 of the NA scene, and
one column per condition plus "oba" when there are several (D21).

`test/i18n-coverage.mjs` — every key the code asks for exists, every key the
dictionary defines is used (675, none dead), placeholders are well-formed, and a
count is never followed by a fixed noun.

```bash
node test/run-all.mjs
```

## 5. Does the interface hold up?

Driven in a real browser, not asserted from the source. The built file
(`dist/r-trainer.html`) is opened from a cleared localStorage and walked: every step
of every lesson, and on each step every sub-expression is selected -- 530 visits, plus 65 clicks on the scenes without code --
checking for thrown errors, raw keys, `undefined`/`NaN`/`[object Object]` in
captions, horizontal overflow, and network requests (there must be none). Then each
lesson's task is solved through the interface. Desktop, a narrow window, and a
375-px phone in both colour schemes.

## 6. Does a student get through it?

The suites above check that the machine is right. They cannot tell whether a person
can *use* it. So lessons are walked the way a student would -- real clicks, real
typing, reading only what is on screen.

The 2026-09 walk of the redesign found six problems no automated check raised. The
most instructive: while typing the grouping task, `, na.rm = TRUE` landed one bracket
too early -- `summarise(..., mean(ocena), na.rm = TRUE)`. R accepted it, made a
column of TRUEs called `na.rm`, and the diagnosis said only "there is an NA". It is
exactly the slip a student makes; it is now a near-miss with its own message, and the
task picture outlines both the NA and the extra column before any text is read.

**Repeat this walk for each new lesson.** It is the only layer that catches this class
of problem, and it takes about ten minutes.

## What testing actually found

Forty-five defects, none of which were apparent by reading the code:

| Defect | Layer that caught it |
|---|---|
| `distinct(d, col)` returned every column, not the named ones | 3 (dplyr pairs) |
| `grepl(p, NA)` returned NA; base R returns FALSE | 4 (divergence check) |
| `nchar(NA)` returned 2 instead of NA | 3 (stringr pairs) |
| Infinite recursion blew the JS stack instead of erroring | 4 (robustness) |
| Compound type names (`logical/integer`) leaked a raw key into the UI | 5 (browser sweep) |
| Keyboard navigation died when the event had no element target | 5 (browser sweep) |
| Page scrolled sideways on a phone (`min-width: auto` in grid) | 5 (browser sweep) |
| Panes overlapped: `position: sticky` outranked its own media query | 5 (browser sweep) |
| A runaway loop drew 50 000 progress dots, rebuilt on every step | 5 (browser sweep) |
| Checking an answer showed no result, and pointed at a console holding stale output | 6 (student walk) |
| The lesson's key frames were 14 clicks apart, behind name lookups | 6 (student walk) |
| No scroll to the stage the student was just told to control | 6 (student walk) |
| Opening a lesson left unrelated sandbox code in the editor | 6 (student walk) |
| The stage was blank on arrival, with nothing saying to run the code | 6 (student walk) |
| Text said "on the right" where a narrow window puts things below | 6 (student walk) |
| The lesson picker had no visible label | 6 (student walk) |
| An unclosed bracket was diagnosed as a missing comma | 6 (student walk) |
| A raw NUL byte in a source string shipped into the delivered HTML | tooling (grep refused the file) |
| `table(x)` omitted the header line R prints above the counts | 2 (real R) |
| `as.integer(table(x))` kept the class and printed as a table again | 2 (real R) |
| `round()` dropped a vector's names; R keeps them | 2 (real R) |
| `**bold**` printed its asterisks in every lesson field but two | 6 (student walk) |
| "Оставлено 2 столбцов" -- no plural agreement after a count | 6 (student walk) |
| Russian labels hard-coded inside the Polish interface (three panels, a CSS `content:`, a default argument) | redesign audit; now a build guard |
| The bold-marker test iterated language objects, so Russian was never checked | review |
| A sandbox idea used a column (`plec`) the lesson's data did not have | review; lessons.mjs now runs every chip |
| An NA group label reached the screen as `[object Object]` | picture sweep |
| The build rewrote `'fx.dollar'` inside a string: `fx.dollar$src_ui_viz_focus`, bundle only | 5 (browser walk of the built file) |
| Value chips stacked on the first line; geometry measured before the code box was on the page | 5 (browser walk) |
| The page scrolled sideways on a phone: the header's natural width sized the whole grid | 5 (browser walk) |
| The unfinished task starter (`ankieta \|>`) greeted the student with a red syntax error | 6 (student walk) |
| Base-R row names (3, 5, 8) drawn as 1, 2, 3 while the console printed 3, 5, 8 | 6 (student walk) |
| `na.rm = TRUE` one bracket too early made a column of TRUEs and got a generic message | 6 (student walk) |
| A factor of long labels printed four per line where R prints five: the width counted quotes R never prints | 2 (real R) |
| Named vectors and tables padded each column to its own width; R pads all to one common width | 2 (real R) |
| `factor(c(10, 2, 5))` sorted numeric levels as text (10, 2, 5); R sorts numbers as numbers | 2 (real R) |
| `factor(x, labels = ...)` accepted any number of labels; R errors, and numbers a single label | 2 (real R) |
| `factor(f)` and `droplevels(f)` re-sorted an existing factor's levels alphabetically | 2 (real R) |
| Labels and their codes drifted into different rows once the labels were words that wrap | 6 (lesson walk) |
| The factor caption said "alphabetical" when `levels` had set the order | review |
| `as.numeric()` on a word scale was captioned as a trap, and `mean()` on it advised `as.numeric(as.character(f))` -- which gives NA | review |
| R's 80-column output was cut mid-word by a narrow console panel | 6 (lesson walk) |
| Long sandbox variants widened the whole page on a phone | 5 (browser walk at 375 px) |
| Goal-vs-answer bars matched rows by position: one missing row outlined every correct row after it | 6 (lesson walk, screenshots) |
| The spreadsheet panel vanished in animated pictures: frames were redrawn without it, while the first picture (the one tested) had it | 6 (screenshots); the sweep now checks every frame |

Three are worth singling out.

The runaway-loop one only appears when a student writes `while (TRUE)` -- which is
exactly what beginners do, and exactly what no author tries by accident.

The stale-console one is worse, because the machine was behaving correctly the whole
time: the answer was judged right, the diagnosis was right, and the sentence pointing
the student at the console was the only broken part. No assertion about values would
ever have caught it. Someone had to sit in the student's chair and follow the
instruction.

The NUL byte is the odd one out, because no test layer was looking for it. A group
key had been written with literal control characters instead of escape sequences;
Node loaded the file happily, every suite passed, and the only symptom was that
`grep` treated the file as binary. It mattered anyway: inside a `<script>` element
the HTML parser replaces U+0000 with U+FFFD, so the file students download was
running subtly different source from the one under test. Two guards came out of it --
the build now refuses to write a bundle containing control bytes, and the i18n suite
refuses a count placeholder followed by a fixed noun. Both are the same lesson: when
a defect can only be seen from outside the running program, the check has to live at
the boundary where the artefact is produced.
