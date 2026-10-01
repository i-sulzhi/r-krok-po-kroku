# Architectural decisions

Short records of choices that would be expensive to revisit. Each says what was
decided, why, and what it costs.

## D1 — Own interpreter, not WebR

**Decided:** implement a tracing interpreter for a subset of R in JavaScript.

WebR runs the real R in WebAssembly, and it was the obvious candidate. It was
rejected because the product is not "run R in a browser" but "show what R does
between the input and the output". WebR executes inside compiled C with no hooks:
it can report that `c(1, "a")` is `c("1", "a")`, but not when or why the double
became a character. It also costs ~30 MB, which breaks offline single-file delivery.

**Cost:** we support a curated subset. Unsupported syntax must fail with a clear
message (see `builtins/index.js`, `KNOWN_UNSUPPORTED`) rather than silently
misbehaving. Real R is retained as a test oracle instead.

## D2 — Events carry data, never prose

**Decided:** trace events hold structured payloads only; wording lives in a separate
explain layer.

Keeps the language of the interface (currently Russian) out of the engine, so the
trainer can be re-worded or translated without touching semantics, and so the same
event can be rendered differently in a tooltip, a caption, and a lesson.

## D3 — Immutable values, explicit copies

**Decided:** R values are frozen; every modification builds a new value.

R's copy-on-modify then falls out of the design rather than being a special case,
and each copy is an observable COPY event we can animate. We do *not* implement R's
reference-counting optimisation: we always copy. That is slower and pedagogically
more honest -- the copy is the thing worth seeing.

## D4 — Eager argument evaluation

**Decided:** function arguments are evaluated before the call, not lazily.

Real R uses promises. Laziness is invisible in beginner code and would add a layer
of indirection to every call diagram. Revisit only if a lesson needs `substitute()`
or missing-argument semantics.

## D5 — Verified against real R, not against intuition

**Decided:** correctness claims are backed by differential tests against the system
`R` binary (`test/diff-syntax.mjs`, `test/diff-eval.mjs`).

Printing rules especially are full of non-obvious behaviour (one decimal width per
vector; scientific notation chosen by *width*, not magnitude; strings left-aligned
while numbers are right-aligned). Every one of those was found by the oracle, not by
reasoning. The oracle must run under `LC_ALL=en_US.UTF-8` or Cyrillic test strings
come back as escaped bytes.

## D6 — Modular source, single-file delivery

**Decided:** develop as ES modules; ship one inlined HTML file.

Students download one file and open it -- no install, no server, no internet. The
build step (`build.mjs`) inlines everything.

## D7 — Two languages, keys not sentences *(superseded in part by D9)*

**Decided:** Polish is the default (the syllabus sets the course language), Russian is
available from a switch. Every user-visible string lives in `src/i18n/`, and errors
carry a message *key* plus parameters instead of a finished sentence.

Rendering is lazy, so switching language re-translates text that was produced before
the switch, including an error already sitting in the console.

Two consequences that are easy to get wrong later:

- **`RError` must call `super()` with no argument.** Passing the key to `super(key)`
  defines an *own* `message` property, which shadows the getter and freezes the text
  in whatever language was active when it was thrown.
- **Diagnosis matches on `error.key`, never on the rendered text.** Text matching
  worked while everything was Russian and would have failed silently in Polish.

`test/i18n-coverage.mjs` fails if the dictionaries drift apart in keys or in
placeholders, so a half-translated build cannot ship.

## D8 — Scope follows the syllabus, and stops where honesty requires

The course (HIFSS.I4.17992.25, *Środowisko R w badaniach socjologicznych*) is about
ten packages, not about base R. The trainer therefore covers:

- **Topic 1** directly -- R's specifics, "zalety i ograniczenia"
- **Topics 2 and 10** (tidyverse verbs, stringr) as the visual layer under them
- everything else *indirectly*, by teaching the base-R mechanics that leak through
  every package: coercion, recycling, NA, factors, copy-on-modify

It deliberately does **not** attempt caret, QCA, Shiny, RCrawler, sentiment or topic
modelling. Those belong in real RStudio, and simulating them would teach a fiction.
Unsupported calls say so plainly (`KNOWN_UNSUPPORTED`) rather than failing obscurely.

---

*D9-D13 were taken in the 2026-09 redesign ("less text, more visualisation; Polish
text; the student should look, click the code and understand"). Working notes:
`docs/redesign-2026-09.md`. D7 is superseded in part by D9: the key-based messages
and the plural rules stay, the second language and the switch are gone.*

## D9 — Polish only

**Decided:** the trainer speaks Polish, the course language. The Russian
dictionaries, lesson texts and the language switch are removed.

A second language doubled every text change and hid bugs: hard-coded Russian labels
shipped inside the Polish interface in three panels, a CSS `content:` string and a
default argument name -- none of them caught while both languages existed, because
each looked plausible in one of them. The build now refuses a bundle containing
Cyrillic text (regex ranges that need Cyrillic letters use `\u` escapes). The i18n
layer stays: it is still where every visible string lives, errors still carry keys,
and Polish still needs three plural forms after a number.

## D10 — The code is the interface

**Decided:** every sub-expression of every example is clickable. Pointing at a piece
of code shows, on the stage, what that piece evaluated to and how; clicking the same
place again climbs to the enclosing expression.

This replaces the global step player (a timeline of 10-20 frames, most of them name
lookups, filtered per lesson by a `focus` list). Choice is now spatial -- the student
decides what to look at by pointing at it -- and time lives inside a picture (the
cell-by-cell animation of `oceny * 20`). "Kolejność R" still walks the evaluation
order, inside out, for anyone who wants the sequence.

## D11 — The engine records what every sub-expression was worth

**Decided:** `Interpreter.eval` reports each node's value to an evaluation log
(`src/trace/evallog.js`): the value, the parent evaluation, and the window of trace
events emitted while it ran. A node evaluated many times (`mean(wiek)` inside a
grouped `summarise()`, a loop body) keeps one entry per evaluation, capped at 5 000.

The UI derives everything from the log -- hover values, the chain of a pipe, "grupa
Gdańsk · 1 z 3" -- and never re-evaluates. It is the same rule as D2: the engine
narrates, the interface draws. Only traced runs build a log; answer checking stays
fast.

## D12 — A lesson is a few scenes, not four text beats

**Decided:** a lesson is 2-5 scenes (one sentence + live code + the pre-selected
expression + the thing to click), a sandbox with one-click variants, and a task whose
goal is shown as a value beside the student's own result. The idea is carried by the
first scene's picture.

Text budgets are enforced by the lesson suite (90 visible characters per scene
sentence). Reading before the task went from about 1 700 characters per lesson to
about 270. What the paragraphs used to explain is now either in a picture or in a
one-line caption with the numbers in it.

## D13 — The build keeps every module in its own scope

**Decided:** the single-file build wraps each module in a function that takes its
imports from a registry and writes its exports back, instead of concatenating all
modules into one scope.

The old build renamed clashing private names with a regex over the whole module
text, strings included. A private function `dollar()` in the stage module turned the
caption key `'fx.dollar'` into `'fx.dollar$src_ui_viz_focus'` -- visible to students
in the built file only, with every source-level test green. Separate scopes remove
the renaming, and `test/bundle.mjs` now boots the built file headlessly and walks
every lesson, because the artefact students receive is not the code the other
suites import.

## D14 — The console prints at the width of its panel

**Decided:** printed values wrap to the number of characters that fit the console
panel (between 30 and R's default 80), measured on screen and re-measured when the
panel changes width -- R's `options("width")`, set the way RStudio sets it.

At a fixed 80 columns the factors lesson broke: a factor of survey labels
("bardzo dobrze") prints lines of 74 characters, and a console panel beside the code
is narrower, so the line was cut mid-word. RStudio never shows that, because it keeps
`width` equal to its console pane; a student moving from the trainer to RStudio should
see the same wrapping. The formatter already took a width; only the caller changed.
It is covered by the R oracle: `test/diff-eval.mjs` runs snippets under
`options(width = N)` and compares, which also caught R's rule for shortening the
`Levels:` line when it does not fit.

## D15 — The grammar around a lesson is explained beside it, from its own code

**Decided:** under each lesson step sits "Ściąga", a glossary of the R grammar present
in the code on screen: assignment, function call, `$`, `:`, quotes, comments,
operators, `NA`, named arguments, `[ ]`, the pipe (15 concepts). Each card takes its
example from that very code and labels the parts (`oceny` = nazwa, `<-` = zapisz,
`c(...)` = wartość), with the value it produced, one plain sentence, a "Czytaj:"
read-aloud line and, where honest, the spreadsheet equivalent.

Lesson 1 is about vectors, but its code already assigns, calls functions and takes a
column; a first-time programmer meets all of that in one screen, and the course has
few hours for basics before tidyverse. Adding scenes would lengthen the lesson and
would explain each piece once; the panel explains it wherever it appears, in every
lesson. Clutter is controlled by rules, not by restraint in writing:

- concepts new in the lesson (first lesson whose code uses them) are open cards;
  ones met earlier are chips that open on demand;
- the task step, whose box starts empty or unfinished, offers the lesson's concepts
  as chips, with examples from its scenes, never from the solution;
- everything met so far is one click away ("Cały słowniczek");
- the panel's size comes from the screen, not from a guess about it. The lesson
  column is split: the lesson takes the height it needs (and scrolls beyond it), the
  glossary dock takes what is left. Its bar ("Ściąga", the symbols, "2 nowe
  pojęcia") never leaves the screen; when there is no room for cards the dock shrinks
  to the bar, and a click raises it over half the column for that step. Measured
  across all 75 steps: at 1920×1080 the cards show on every step, at 1366×768 on 53,
  at 1280×720 on 39, and the bar is visible on all of them. On a phone the panel
  follows the lesson and starts folded.

The lab's monitors are unknown, which is why the layout does not assume any.

The example is live: hovering it lights the code, clicking it selects it and the
stage draws it, so the glossary leads back into the picture instead of away from it.
Concept detection runs on the parse tree (`src/ui/concepts.js`), not on regexes, so
`#` inside a string is not a comment and `|>` is found even though the parser
rewrites it into an ordinary call.

## D16 — A lab computer is shared: saved answers are offered, not filled in

*The menu's "Zacznij od nowa" described below was replaced by names in D17; the
offered-not-filled rule stands.*

**Decided:** a task always opens with its starter. If this browser holds code saved
for the task, a line above the box says so, with the time it was saved ("dziś,
10:42"), and a "Wczytaj" button loads it. The lesson menu ends with "Nowa osoba przy
komputerze?": how many lessons this computer has finished, and "Zacznij od nowa",
which after an in-page confirmation forgets progress, saved code, used hints, the
last place and the glossary preference, and opens lesson 1.

Progress lives in the browser (no accounts, no server). That was designed for a
student at home, but the course runs in a computer lab. There the next student at
the same browser opened a task with the previous student's correct answer already
typed in, saw lessons ticked as done and hints already revealed. Offering instead of
filling keeps the convenience for the student who returns to their own machine; the
time stamp lets them recognise their own code. The confirmation is part of the page
because browser dialogs are not available everywhere the trainer runs.
`test/bundle.mjs` checks the whole story on the built file: a solved task opens
clean, "Wczytaj" loads, the menu counts, the reset asks first and then forgets
everything, cancelling keeps everything.

## D17 — Students say who they are; the teacher gets a report they hand in

**Decided:** the trainer opens on "Kim jesteś?" every time. A name or nickname keeps
that person's progress, saved code and place apart from everyone else's in the same
browser; the people who used it are listed with their progress, one click to
continue. The menu says who is working and offers "Raport dla prowadzącego",
"Zmień osobę" and "Usuń moje dane z tego komputera" (confirmed in the page). The
report is plain text with a check code; the student hands it in through the
university's channels. Published as a static site on GitHub Pages.

The teacher (the author) wanted the site public, names for a group of about 15, and
some view of progress. A live dashboard would need a server and a database, keys to
keep, and students' names stored by an outside service, which is a data-protection
(RODO) question for the university, for 15 people. The report gives the teacher the
same facts with none of that: the data goes where the student sends it. Asking every
time, rather than continuing as the last person, is the point on a shared computer:
one click on your own name is cheap, someone else's progress is not.

The check code is honest about its limit: it catches a report edited by hand, not a
student who reads the JavaScript that computes it. Verification ignores what pasting
does to text (line ends, spacing, a greeting above the report), so a report that went
through an LMS still checks. Data saved before names existed belongs to nobody in
particular and is dropped once. `test/people.mjs` covers the storage and the report
(mutation-checked: shared storage, a removal that leaves progress behind, and a check
that accepts any code each fail it); `test/bundle.mjs` plays the whole lab story on
the built file.

