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

**Revised after a walk-through before publishing (2026-10-01),** once as a student and
once as the teacher, in a real browser at 1366x768:

- *A solved task lost its code.* A success draws the task again (green star, next
  lesson), and since D16 a drawing starts from the starter. The code just checked now
  stays in the box, with no "Wczytaj" offer for it. A failed check also disappears as
  soon as the code changes: it spoke about code that is no longer there.
- *The teacher could not reach the check.* On the teacher's own computer the trainer
  opens on "Kim jesteś?", and the check lived only in a student's report dialog. A
  link under the names, "Prowadzący? Sprawdź raport studenta", opens the check without
  creating a person, and closing it returns to the names.
- *Fifteen reports in a row.* The verdict follows the pasted text: pasting the next
  report replaces the last verdict at once, no button needed.
- *Report lines read badly.* Lesson titles have colons ("Braki danych: NA"), so
  "title: state" gave two. Lines now read "title → state".
- *A year group on one computer.* Typing a name narrows the "Wracasz?" list.
- Copying falls back to the browser's older copy command before asking for Ctrl+C.

Each is covered by `test/people.mjs` or `test/bundle.mjs` and was mutation-checked.

## D18 — A way out to RStudio, and the first mistake named correctly

**Decided:** after the last lesson, and in the menu under "Dalej", a page "Dalej w
RStudio". It is a page, not a lesson. On the left are three steps: write in a script,
read your own survey with `read.csv2()`, and load packages. On the right, where the
stage usually is, are eight of R's commonest messages verbatim in English, each with
what it means and what to do. Separately, `wiek <- 23, 34` now gets its own diagnosis,
"Kilka wartości trzeba skleić w c()", with the student's own line wrapped in `c()`.
After a failed check the explanation scrolls into view.

Asked as "would this trainer have helped you as a sociology student?", the honest
answer had two gaps. First, the trainer is a closed world: the moment a student opens
RStudio with their own file, three things differ (a script, a file, packages) and
the errors are in English. The course does its real work there (curriculum), so the
bridge is one page that names exactly those differences. It is not a lesson, because
none of it can run here, and simulating files or packages would teach a fiction.
`read.csv2()` rather than `read.csv()` because a Polish Excel writes semicolons and
decimal commas; "CSV UTF-8" because Polish letters otherwise arrive broken.

Second, the first mistake almost every beginner makes, several values without
`c()`, was answered with "usually a missing comma". That is the opposite of the advice
they need. The rule matches the error key and the comma at the error's position, not
the message text (the house rule in diagnose.js), and a real missing comma keeps the general
advice. On a 1366x768 screen the explanation sat below the fold while the verdict said
it was "pod kodem"; the scroll fixes that without changing the layout.

`test/behaviour.mjs` checks the diagnosis and its fix on three shapes, and that a real
missing comma is not misnamed. `test/bundle.mjs` reaches the page from the solved last
lesson and from the menu, checks it for raw keys and em dashes, and checks that the
stage and memory return for a lesson and the sandbox. Mutation-checked: a missing
dictionary key and a lesson that forgets to restore the right column each fail it.

## D19 — The data a lesson uses is created on screen

**Decided:** a lesson's small vectors (`oceny`, `wiek`, `wiek_tekst`, `odpowiedzi`,
`skala`) are still prepared in the hidden setup, but the scene that first uses them
now opens with the lines that create them, including the setup's comment that says
what the data is ("Odpowiedzi dziesięciu osób; dwie nie odpowiedziały"). Data tables
(`ankieta`) stay as they are: lesson 1 introduces them as data read from a file.

The teacher noticed that `labels = skala` came from nowhere: the student never saw
`skala` made, only found it in "Pamięć R". Five lessons had the same gap, and every
setup carried a comment explaining the data that no student ever saw. Students
already know `<-` and `c()` from lesson 1, so seeing the lines costs nothing and
answers "where did this come from?". The lines are clickable like any code, and the
glossary meets them as known concepts. No new scenes: the lesson on selecting
elements already has five, the limit.

Two consequences were fixed with it. "Kliknij w kodzie: x" pointed at the first `x`
in the box, which is now the line creating it; it now looks inside the scene's own
expression first. And a 58-character comment was cut at the box's edge at 1366x768,
so code lines in scenes are now held to 54 characters.

The same pass reworded the factor lesson after reading it as a beginner would. Its
title was "Czynniki (factor)", which a Polish sociologist reads as factor analysis;
it is now "Etykiety kategorii: factor()", and the task note says the two are
unrelated. Scene 2 names the three ideas at once through something students know, a
survey codebook ("Jak książka kodów: każdy poziom dostaje etykietę, a cyfra zostaje
kodem"). Scene 3 now says why the shifted codes matter. Two picture captions lost
their stray colons.

`test/lessons.mjs` checks that every vector a lesson's scenes use is created in the
scene that first uses it (data frames excepted), and that code lines fit the box;
`test/bundle.mjs` checks that every "click here" mark lies inside the scene's own
expression. Mutation-checked: a scene without its data line, the old first-match tap
and the old long comment each fail.

## D20 — A mask on a table is drawn along its rows

**Decided:** a scene can ask (`show: { rows: true }`) for a condition on a table's
column, such as `ankieta$plec == "K"`, to be drawn along the table: the column lit,
the answer added beside it as one more column, one TRUE or FALSE per row, with the
same ✓ and ✗ the next scene uses for `ankieta[mask, ]`. Without the request the
comparison keeps its usual picture.

Read as a beginner would, the data.frame lesson said "a condition on a column is a
mask: one value per row", while its picture showed the recycling of `"K"` eight times,
a fan of dashed lines and no rows at all. Recycling is lesson 3's subject; here it was
noise, and the rows the sentence spoke of were missing. An opt-in keeps lesson 3's
picture where recycling is the point.

The same reading changed three texts. Scene 1 says the table is the one from lesson
1 and names it a data.frame. Scene 4 says what a beginner does not guess: the empty
place after the comma means all columns. Its caption adds that row numbers stay from
the table (3, 5, 8), which looked like a mistake. And rows picked by number
(`ankieta[1:3, ]`) are no longer captioned "rows with TRUE".

`test/bundle.mjs` checks the row picture in its scene, its absence for the same code
outside it, and the caption for rows picked by number. Mutation-checked.

## D21 — filter() decisions live in the table's rows; texts' numbers are tested

**Decided:** the `filter()` picture puts each condition in the table itself, as a
column at the end, headed by the condition's own code, one TRUE, FALSE or NA per row.
With several conditions each gets its column and a last one, "oba / i jedno, i
drugie", shows the rows that stay. Separately, every number a lesson's text states is
listed in `test/lessons.mjs` with the code that proves it on the lesson's data.

Reading the filter lesson as a beginner showed two errors no suite had caught. The
decision column was a separate stack beside the table, sized by hand; it had drifted a
row down, so TRUE stood beside a struck-out respondent, and in the very scene about
NA the NA stood beside row 6 instead of row 5. Inside the table the decision cannot
drift: it is a cell of the row it decides. And the task's success message said four
people rated above 3 and its note "4 + 3 = 7"; the data, checked in real R as well,
gives 5 and 2. Text and data are written apart, so nothing tied them together.

The same reading added one sentence: scene 1 now says that inside `filter()` a column
is written without `ankieta$`. Lesson 7 taught `$`, and only a hint mentioned the
change. The multi-condition columns make scene 4's "i jedno, i drugie" visible.

`test/bundle.mjs` checks each row's decision on scenes 1, 3 and 4 (NA on row 5, three
columns with "oba"); shifting the cells by one row fails it. The facts table covers
ten lessons, twenty numbers; the old "Cztery osoby" and a changed answer in the data
each fail it.


## D22 — The dplyr lessons, read as a beginner

**Decided:** four changes to the last five lessons. `select()` draws its result under
the table, so "one column is still a table" (and the new column order) is seen.
`mutate()` no longer says the original "disappears": the result has the new values,
the table in memory does not change; and a new last scene keeps a result under a name
with `<-`, memory showing both tables. `arrange()` lights the column the rows were
sorted by and says the number on the left is the row's place before. Grouping's note
("two answers, three respondents in Warsaw") joined the tested facts.

The mutate scene was the one that misled: the sentence and the caption said the old
values were gone while "Pamięć R" beside them still showed `ankieta` untouched. Behind
it sat a gap the whole dplyr module shared: no scene said that a verb returns a new
table and keeps nothing. In RStudio that is the first surprise ("I added a column and
it is not there"), and only one error message mentioned it. The new scene answers it
where it matters, in the verb that "adds"; the task accepts a named result too.

Grouping and counting needed nothing: their pictures already say what the sentences
say. `test/bundle.mjs` checks the select result, the two tables in memory after the
new mutate scene, and the lit sort column; mutation-checked.

## D23 — One scrolling column; the glossary's examples drawn tight

**Decided:** the lesson column scrolls as one. The glossary is no longer a dock with
its own scroll area beside the lesson's: it follows the lesson in the same column,
and its bar is held at the bottom of the column (CSS sticky) while the glossary is
out of sight. The bar brings it into view; in view, it folds or opens it. On a tall
monitor the glossary fills the space under the lesson as before. This supersedes the
split-dock layout of D15 and its squeezed and raised states.

Separately, a glossary example is drawn as one unbroken line of code. Labels hang
under their parts, placed in character widths (the code is monospaced), nudged right
when they would collide and moved to a second row only when that fails.

On a 1366x768 screen the old split showed two scroll bars, one above the other, and
which one moved what was a guess. One scrolling box removes the question. The bar
cannot leave the screen, which was D15's point; the column scrolls with scroll
padding at its bottom, so an error explanation scrolled into view is not hidden under
the bar. The labels had stretched the code to their own width: "wiek [3   ]" for
`wiek[3]`, the very spacing a beginner then copies. Labels are positioned in a slot
in the code's font, since `ch` follows the font of the element it is set on.

`test/glossary.mjs` checks, across all 160 panels, that each label starts under its
part and that labels in one row never overlap; centring without the nudge, or a
label pushed off its part, fails it. The single scroll area was measured in the
browser on six steps: only the column scrolls, the bar stays on screen, and the bar
cycles "show, fold, open".
