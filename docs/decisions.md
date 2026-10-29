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

## D24 — Tasks and sandbox, tried with a beginner's answers

**Decided:** thirty-five answers a beginner plausibly writes were run through every
task. What came back led to four kinds of change.

- *A crash.* A dplyr verb with no table (`summarise(n = count())`, or a line after a
  missing `|>`) threw a JavaScript error out of the interpreter and broke the code
  panel. Verbs now say in R's terms that they need a table, and the session turns any
  failure inside the trainer into an error on screen ("To błąd trenażera"), logged to
  the console, never a broken page.
- *Valid R called wrong.* `na.rm = T` was "object T not found", `na.omit()` was "check
  your spelling", and an unnamed `summarise(mean(wiek))` was "each result needs a
  name". In R, T and F are TRUE and FALSE, `na.omit()` exists, and dplyr names an
  unnamed column by its code. All three now behave as in R, checked against the R
  binary (`diff-eval`, `diff-paired`). `na.omit()` on a vector leaves out R's
  "na.action" attribute, a simplification noted in the code.
- *Errors named for what they are.* A pipe broken at a line's end ("Brakuje |> na
  końcu linii 2", whatever error the next line causes); a column written outside a
  verb (`plec` for `ankieta$plec`); a text value without quotes (`K` for "K"); a
  function used without parentheses (`oceny - mean`); `ankieta$x = ...` as a new
  column's name. Each comes with the student's line corrected. The session looks up a
  missing name among the tables in memory so the diagnosis can say which.
- *Seeing the difference.* A table goal and answer stood side by side and were cut
  off; the one differing cell (an NA) was outside the box. They now stand one above
  the other. Task 13's column name `respondentow` read as a misspelling and now sits
  in brackets after the word.

The sandbox had no data, so half the course could not be tried in it, lost its code
on every visit, and had no glossary. It now starts with the course's survey in memory
(said under its title), keeps each person's code (removed with their data), and has
"Ściąga", built from the same dock as the lessons (`dock.js`, extracted from the
lesson view rather than copied).

`test/behaviour.mjs` checks the diagnoses with their fixes, the three R behaviours,
and that no verb without a table escapes as an exception; `test/people.mjs` and
`test/bundle.mjs` check the sandbox's data, glossary and kept code, per person. Each
was mutation-checked.

## D25 — "Ściąga" becomes a cheat sheet

**Decided:** the glossary now says what functions do. A function's card adds one line
for that function ("group_by() dzieli tabelę na grupy według kolumny"), and a new list,
"Funkcje", gives every function met so far, one line each: 26 by the last lesson. A
task offers all the concepts its lesson's steps used, not only those the lesson
introduced. In mutate() and summarise(), `name = value` reads as a new column.

Read as a beginner would, the panel explained syntax well and functions not at all:
every function was the same card, "Czytaj: wykonaj group_by na tym, co w nawiasie",
which says nothing about grouping. For a Polish student "ściąga" is exactly the list
the panel lacked. And in a task, where no example is on screen, the panel was nearly
empty: lesson 7's task showed "Komentarz" only, while it needs `$`, `[ ]` and `==`,
because those were introduced in earlier lessons and "Z tej lekcji" took only new
ones. `sredni_wiek = mean(wiek)` was read as "set the argument", which is not what it
does in summarise().

A function counts as met in the lesson whose scenes, sandbox or chips show it, or
whose hints name it (`mean()` is needed in lesson 2's task, shown from lesson 3),
never from a solution. Five card texts were sharpened: `!=` beside `==`, `na.rm = TRUE`
beside NA, "without `$` inside filter() and mutate()" beside `$`, `[wiersze, kolumny]`
beside `[ ]`, and a named range instead of a worksheet tab for a name.

`test/glossary.mjs` checks each change and that every function the lessons show has
its line; each check was mutation-checked.

## D26 — The report reads at a glance, and the teacher checks a group at once

**Decided:** a lesson line in the report prints only what happened ("(sprawdzenia: 1)",
no "podpowiedzi: 0"), and the student's window is wide and tall enough to show the whole
report, code line included, with a line asking to send it all. The teacher's check left
the student's window; it is reached from "Kim jesteś?". Checks, hints and an opened
solution are counted up to the first success only. The check reads one report or many
pasted one under another: one gives a verdict with a short summary (date, lessons done,
lessons with an opened solution, lessons started and not finished), several give a
table, one row per person, a changed report flagged in its row.

Read as the student, the report was a wrapped text box showing five lessons of thirteen,
with the code line out of sight, and a teacher's check below that a student has no use
for. Read as the teacher, the verdict said only "nienaruszony" and the name, and a group
of fifteen meant fifteen pastes. One fact was misleading: a student who solved a task and
then opened the model solution to compare was reported as "otwarte rozwiązanie", with
no way to tell the two apart; checks after a success also kept counting.

The check code is computed from the report's own text, so the new wording does not break
reports made before it; only the first line, "Osoba:", "Kod kontrolny:" and the salt
must stay. A report from before this change is kept in `test/people.mjs` and still
checks. Each code line closes one report, which starts at the last report heading above
it, so greetings between reports do no harm; a heading with no code after it is reported
as missing its code rather than skipped.

`test/people.mjs` checks the shorter lines, the facts stopping at a success, the old
report, and a pasted group (order, verdicts, facts read back, no facts from a changed
report); `test/bundle.mjs` checks the student's window and the group table on the built
file. Each was mutation-checked.

## D27 — Factors are shown before they are typed, and get three lessons

**Decided:** a scene may have a picture instead of code (`Scene.picture`,
`viz/survey.js`). The questionnaire stands where the code would: one question, its
answers, the people who filled it in. The stage shows what R holds. Pointing at a
person or an answer lights the same thing on both sides. Three kinds: `codebook` (the
sheet keeps bare codes, the questionnaire says what they mean), `pairs` (the factor
as a table: for each person a label and a code, and beside it the levels), `order`
(the same answers counted as text and as a factor). Factors grow from one lesson to
three, each opening with such a scene: codes and labels, the order of levels, and a
factor is not a number. The course has fifteen lessons.

The teacher's first group already knew vectors and data frames from an earlier
course; factors and dplyr were new to them, and factors had one lesson with one task.
A factor is also the first thing in the course with nothing typed before it to stand
on, so the first contact is a picture, not a call. The pictures are computed, not
drawn by hand: the lesson's setup runs, the scene's factor is evaluated, and the
codes, labels and levels shown are R's own (text is counted by R's `table()`, so the
alphabetical order is R's). Memory is empty on such a scene, because nothing has run.
A lesson must still have two scenes with code: pictures prepare the code, they never
replace it.

The teacher's remark that a factor resembles a data frame, several vectors describing
one row of observations, is used in the `pairs` picture where it holds: label and
code stand side by side for each person, as two columns. It is not said as a rule,
because the levels are not a third column: they have one entry per category, not per
person. The picture shows them as a separate small table for that reason.

The second lesson's task uses another question and makes the student type the levels,
from "tak" to "nie", the reverse of the alphabet, so counting the bare text cannot
pass. A level typed differently from the data loses answers to NA; the diagnosis says
the total is not 8. The stage now captions that case itself ("Poza levels: 1 wartość.
Każda staje się NA"). The third lesson's anticipated wrong answer is the mean of the
codes (2.125 instead of 1.375), diagnosed as such. `sort()` on a factor returned bare
codes; it now returns the sorted factor, as R does.

`test/lessons.mjs` validates picture scenes and the numbers in the new texts;
`test/pictures.mjs` points at every person and answer of every picture; `test/bundle.mjs`
clicks the questionnaire in the built file; 19 oracle cases compare the new lessons'
R with real R. Each new check was mutation-checked.

## D28 — Why `levels` exists, and a factor used inside a table

**Decided:** the first factor lesson shows the problem before its cure, in three
steps instead of two: `factor(odpowiedzi)` (R has only the data, so the levels are
2, 3, 4, 5, numbered from 1), then `levels = 1:5` alone (which answers were possible:
the code equals the answer again), then `labels`. The stage says where guessed levels
came from ("Bez levels R zna tylko dane. Poziomy to: 2, 3, 4, 5...") and marks it as
a trap; the level list is headed "kod → poziom". A new lesson, "Czynnik w tabeli",
follows the data frame lesson: a survey export whose columns are codes, a column
replaced by a factor (`ankieta$wyksztalcenie <- factor(...)`), and what that buys:
a count table in words, rows chosen by label, a mean for one group. The course has
sixteen lessons. A lesson may have up to six scenes.

The teacher read the lesson and could not tell from it why `levels` is needed or why
the numbering goes wrong without it. The old order gave the cure first (levels and
labels in one call) and the failure afterwards as a warning; the reason, that R knows
the data and not the questionnaire, was never on screen. Three loose-vector lessons
also left open what a factor is for in an actual analysis.

Every run starts from the lesson's data, so each scene of the new lesson repeats the
three lines that make the factor, as the script would. The sandbox keeps those lines
above every chip (`play.keep`), so a chip is still one short line. The task's check
also looks at the table in memory: a correct count made beside the table, with the
column left as text, is the anticipated half-answer and is told so. Its reference is
built from the answers themselves, because it is computed after the student's code
has already turned the column into a factor.

Two things in the interpreter were wrong and are fixed. `table(a, b)` counted `a`
alone, a wrong answer that looked right; it is now refused, with `count(tabela, a, b)`
offered. `str()` printed a table's columns in its own layout; it now prints R's
(padded names, no length inside a table, levels cut after about 13 characters), since
`str(ankieta)` is a chip in the new lesson and the RStudio page tells students to
use it.

`test/lessons.mjs`, `test/pictures.mjs`, `test/behaviour.mjs` and `test/bundle.mjs`
check each of these, 16 more oracle cases compare the new code with real R, and each
new check was mutation-checked.

## D29 — Each dplyr verb opens with its table before and after; a closing lesson chains them

**Decided:** the six verb lessons each start with a scene without code
(`picture.kind: 'verb'`, `viz/before-after.js`): a research question in plain words,
the steps "przed" and "po", and one table that moves between them. Rows fade and
close up (filter), columns leave (select), a column grows (mutate), rows travel
(arrange), rows gather by colour and fold into one row per group (group_by,
summarise, count). It plays once on arrival, about a second and a half per stage,
and can be replayed or stepped by hand. A new closing lesson, "Od pytania do
tabeli", answers one question with four verbs in a row, typed one step at a time,
and ends with a factor made inside `mutate()`. The course has seventeen lessons.

The teacher's first group met dplyr for the first time here, as they did factors,
and asked for the result of each verb to be shown, animated, before the lesson
starts. An animation alone shows the mechanics and not the reason; a research
question alone (what worked for factors, which are a concept) does not show what a
verb does to a table, which is all a verb is. So the question sets the goal and the
motion shows the verb. The pictures that already existed drew the same things, but
only once the code was on screen.

Nothing is drawn by hand. The lesson's setup runs, `picture.code` runs with the trace
on, and the stages are read off the verbs' own events, so the rows kept, the order,
the groups and the values are R's. Every row and every cell exists once and is placed
absolutely; a stage only says where each one is and whether it shows. That is what
makes a row visibly the same row before and after, and it is why one renderer serves
a single verb and a pipeline of four. The picture's code must be typed in a later
scene of the same lesson, so the student recognises what they watched. The table is
in memory on such a scene (it stands for a file already read), unlike the survey
scenes, where nothing has run.

Each verb lesson keeps its one task: the closing lesson carries the exercise on
chaining, a different question on the same table. Its anticipated wrong answers are
counting everyone, forgetting to sort, and sorting the wrong way.

`test/pictures.mjs` shows every stage of every picture and compares the last one
with the table R returns, row for row and cell for cell; `test/lessons.mjs` checks
that the picture's code runs, fits, and is typed later; `test/bundle.mjs` clicks the
stages in the built file and checks that the animation starts on arrival and stops
when the scene is left. Each check was mutation-checked. The motion itself was
watched in a real browser; with reduced motion the stages switch without it.

## D30 — The pipe is taught as a way to read nested calls

The teacher asked why the result of `filter(ankieta, wiek > 40)` and of
`ankieta |> filter(wiek > 40)` look the same in the console and on the stage. They
look the same because they are the same call: R rewrites the pipe before it runs
anything. With one verb the pipe has nothing to show, so two scenes in a row gave one
picture and no reason for the second spelling.

**Decided:** the filter lesson introduces the pipe with two steps, not one. A scene
asks "how many people?" and nests two functions, `nrow(filter(ankieta, wiek > 40))`,
read inside out. The next scene writes the same chain with `|>`, read left to right.
The stage draws the same strip of steps and the same result for both, and the text
says so: the pipe changes the order of reading, not the result. The scene with
`filter(ankieta, wiek > 40)` stays, because the pipe hands the table over as the
first argument and the student has to have seen where that is.

The closing lesson's sandbox gains one chip: its four steps written as one nested
call. Four levels of brackets make the case without a sentence.

`test/bundle.mjs` checks that the two scenes draw the same chain of three steps and
print the same output (mutation-checked: a different condition in one of them fails).

## D31 — On a phone the table's frame follows the new column and shrinks with the table

Two faults showed at 375 px in the scenes that open the verb lessons (D29). In
`mutate()` the new column joined beyond the right edge of the frame, so the stage
"po" looked like "przed" while the caption announced a column. In the closing
lesson the last table has three rows, yet the frame kept scrollbars, because rows
and columns that have left stay in the DOM, faded, at their old places.

**Decided:** when a stage adds a column, the frame scrolls until that column's right
edge is in view, and scrolls home on a stage that adds none. The table clips what
lies outside its current size, so faded rows no longer hold the frame open. It
shrinks over 0.6 s, so rows fade before they are cut, and grows at once, so a column
that joins is never cut and the frame can scroll to it straight away. In a background
tab, which draws no frames, the scroll is instant.

`test/pictures.mjs` checks where the frame is sent (mutation-checked). The scrolling
itself was measured in a browser at 375 px: every stage of every picture, the new
column inside the frame, no scrollbars left on the short tables, the page itself
never scrolling sideways.

## D32 — Row numbers stay in place when the table is scrolled

Once the frame follows a new column (D31), the row numbers scrolled out of sight
with the left columns. They are what says a row is the same row before and after,
so they are the last thing that should leave.

**Decided:** the number of each row sticks to the frame's left edge, opaque, and the
cells pass under it. The table clips with `overflow: clip`, not `hidden`, because a
hidden box would itself become the scroller the numbers stick to. The frame has no
left padding in these scenes, so nothing shows beside the numbers.

This is layout only, so it was measured in a browser, not in the headless suites: at
375 px and at 1024 px, on all 18 stages, with the frame at rest, at its far end and
halfway, every visible row number sits on the frame's left edge.


## D33 — The units are exercises, grouped under two lectures

The trainer called its 17 units lessons ("Lekcja 3 z 17"). In the course they are
not lessons. The teacher gives two lectures, and students work through the units
after each one. Lecture 1 is everything before dplyr, lecture 2 starts with
`filter()`.

**Decided:** a unit is an exercise ("Ćwiczenie 3 z 17") everywhere a student or
the teacher reads it. The contents list groups them under "Wykład 1. Podstawy R"
(exercises 1-10) and "Wykład 2. dplyr" (11-17), and the modules stay as
subheadings. Each lesson object carries `lecture`, next to `module`.

Numbering stays 1-17 across both lectures, so saved progress, cross-references in
the texts and report lines keep their meaning. The scenes are unchanged: a student
who missed the lecture can still work alone. In the code the word stays `lesson`;
only the Polish text changed.

The report changes wording with it ("Ukończone ćwiczenia", "ukończone",
"rozpoczęte"). Its check code is a hash of the text, so reports written before
this still check. The checker reads both wordings (`rep.totalWas`, `rep.doneWas`,
`rep.startedWas`), so their facts still come out too.

`test/lessons.mjs` checks the split and that the menu order is the walking order.
`test/people.mjs` checks that a report in the lesson wording still reads. Both
were mutation-checked.

## D34 — Lecture 3 "Szybkie analizy" starts: recoding with if_else() and case_when()

After exercise 17 a student has the five verbs and the pipe, and cannot yet do what
every survey report needs: recode answers, count percentages, cross two variables,
attach a second table. Lecture 3 is the second half of syllabus topic 2, one
exercise per such question (the list is in `docs/curriculum.md`). They are built one
at a time; this record covers the first, exercise 18.

**The engine** gained `if_else()` and `case_when()`. Both refuse to mix text and
numbers in one column, as dplyr does and base `ifelse()` does not. An NA condition
claims nothing. `case_when()` is a special builtin: it receives `condition ~ value`
unevaluated and evaluates each side in the caller's data mask. Eleven reference
cases run against real R. Writing them showed that a table printed a missing text
as `NA` where R prints `<NA>`; that is fixed in `formatDataFrame`.

**The picture** (`src/ui/viz/recode.js`) is one line per row and one column per
condition, in reading order. The condition that took the row is lit and the ones
after it are blank, because R never looked at them. The caption names what went
unnoticed (`recodeTraps`): a condition that is TRUE somewhere yet got nobody, rows
no condition took, rows with no answer that `.default` took anyway. The engine
reports this in one `RECODE` event; the picture computes nothing about R itself.

**The exercise** makes the same point about missing data as the rest of the path, in
a new place: person 6 gave no age, ends in no group, and with `.default = "50+"`
is counted among the oldest.

`test/pictures.mjs` checks who took each row in all four scenes and each trap.
Swapping "first TRUE" for "last TRUE", and letting NA count as TRUE, both fail these
claims and the R reference cases.

Counts that follow the number of exercises are no longer written into the tests as
17: `test/people.mjs` reads `LESSONS.length`, `test/bundle.mjs` holds one constant.

## D35 — What a walk through the live site as a student found

On 2026-10-06 the published site was walked from "Kim jesteś?" to the report, by
clicking its buttons and typing into its editor: 18 exercises, every R step of
every scene, every sandbox chip, 81 anticipated wrong answers, the report and its
check, a second person at phone width. The exercises held. The sandbox did not:
code a beginner types on their own met four faults the lessons never touch.

**Decided:**

- `filter(wiek = 40)` stops with "Czy chodziło o `wiek == 40`?", as dplyr does. It
  used to treat the named argument as a condition that is always TRUE and hand back
  every row. One `=` for two is the commonest slip a beginner makes, and the trainer
  answered it with a plausible table.
- Group keys sort as their type: numbers as numbers (they sorted as text, so 100
  came before 5), FALSE before TRUE, a factor by its levels and not its labels, and
  a missing key last.
- `count()` knows its own settings `sort` and `name`. `count(x, sort = TRUE)` ended
  in the trainer's "internal error" message, as did a misspelt column name.
- A key of `group_by()` and `count()` may be computed or named (`wiek > 40`,
  `grupa = plec`). It joins the table as a column first, which is what dplyr does.
  One helper, `groupingKeys`, serves both verbs.
- `read.csv2()` no longer promises "an exercise about data". It points to the page
  that does show reading a file, "Dalej w RStudio".

Left as it is, on purpose: `mean()` of text is an error here and a warning with NA
in R. Exercise 2 is built on it and the RStudio page says what R itself does. Text
keys still sort by Polish rules where dplyr 1.1 uses the C locale. No exercise
groups by such text, but the sandbox can: `count(wyksztalcenie)` gives "średnie"
then "wyższe" here and the reverse in RStudio. That is open, and its own decision.

Eleven more reference cases run against real R, and three behaviour checks cover
the messages. Each fix was mutation-checked: undoing it fails a test.

The walk itself is not a suite. It ran in a browser against the live site, and its
gap is the one that let these through: the suites run the code the lessons contain,
not the code a student invents. The sandbox deserves its own list of beginner
inputs next.

## D36 — A student's own report brings their progress to another computer

Progress lives in the browser it was made in (D17). A student who works in the lab
and opens the trainer at home starts from nothing, and their progress stays on the
lab computer. The question was raised as "accounts".

Accounts would need a server, would put students' names and progress on it, and
would end both "nothing is sent" and "one file that works offline". For eighteen
exercises that is out of proportion, and it is not a decision the trainer can take
for the university.

**Decided:** the report is the carrier. It already says, per exercise, what was
done, and it already has a check code. "Kim jesteś?" gains a link, "Masz raport z
innego komputera? Przywróć postęp": the student pastes their report, and if its
code holds, continues under the name on it with the progress in it. The report
screen now tells the student to send the text to themselves as well.

- The format of the report did not change, so reports already handed in work too.
- Lines go to exercises by title, not by number. A report keeps its meaning when
  exercises are added. A title that no longer exists is left out and counted on the
  screen, never guessed.
- Bringing a report only adds (`restorePerson`): a finished exercise stays finished,
  the first finishing date stays, counts take the larger number. Pasting an old
  report after working on does no harm.
- What a report does not hold does not travel: the code saved in tasks and the
  place in an exercise.
- A report restores only under its own name. Changing the name breaks the code.
  The code stops a hand edit, not a programmer, as before; forging one gains
  nothing that forging the report itself would not.

Known limit: on a shared computer two students with the same name are one person
(D16 asks them to add an initial). A report pasted there merges into that person.

`test/people.mjs`: a report brought to a browser that never saw the student gives
back the same report, to the character; work done since is kept; a changed report
brings nothing; a report from the 13-lesson version brings what still exists.
`test/bundle.mjs` does it through the screen, after removing the student's data.
Four mutations of the merge and of the check were tried; each fails a test.

## D37 — Exercise 19, percentages; and the verbs learn what a group is

Exercise 19 is one line, `mutate(procent = n / sum(n) * 100)`, shown three times
with three wholes: everyone asked (50% say "dobra"), everyone who answered (62.5%),
everyone in that city (Kraków 66.7%). None is wrong. Each answers another question,
and the line itself never changes: what changes is the `filter()` before it and the
`group_by()` before it. The task asks for the share of answers in each city, so it
needs both.

Writing it showed that the engine did not know what a group is outside
`summarise()`. `group_by(miasto) |> mutate(p = n / sum(n))` divided by the sum of
the whole table and printed the result without a word. The same held for
`filter()`, `slice()` and `count()` on a grouped table. No exercise used them that
way, so no test saw it; a student in the sandbox would have got a plausible wrong
table.

**Decided:**

- After `group_by()`, `mutate()` and `filter()` evaluate their expressions inside
  each group (`sum(n)`, `mean(wiek)`, `n()` are the group's), `slice(1)` is the
  first row of each group, and `count()` counts inside the groups. `arrange()` still
  ignores groups, as in dplyr. One helper, `groupsOf`, serves all four.
- A grouped `mutate()` reports its groups in the trace event. The picture colours
  the rows by group and the caption says the column was worked out inside each.
- The task accepts rounded percentages (33.3 for 33.33333): rounding is not a
  misunderstanding. Its diagnosis reads which whole the numbers add up to (100 per
  city, per answer, or for the table; or 1), so "you forgot `group_by()`" and "these
  are fractions" are told apart from the values, not from the code.

Sixteen reference cases run against real R (`ave()` on the base side). Turning the
group handling off in any one of the four verbs fails them.

R prints the grouped percentages as `25.00000`, because the column holds
`66.66667` and a column is printed to a common number of digits. The trainer prints
the same. It is ugly and it is what a student will see in RStudio.

## D38 — Exercise 20, the cross table; pivot_wider() and its picture

`count(miasto, plec)` holds the answer as a list of pairs. A report shows it as a
cross table. `pivot_wider()` changes the shape and not one number, so the exercise
is about the one thing the shape does change: a pair nobody belongs to has no row
in the long table and must have a cell in the wide one. That cell is NA. For
counts it means zero and `values_fill = 0` says so. For means it means "nobody to
average", and filling it would invent an answer. The same gap is shown both ways,
and the task asks for the counts turned the other way round, gap filled.

**The engine** gained `pivot_wider(names_from, values_from, values_fill)`. New
columns and rows come in order of first appearance, as in tidyr. Two rows for one
cell are refused with "count or summarise first": tidyr would build list-columns
there, which answers nothing a first-year student asked. The arguments must be
named; a missing one, a misspelt column and a positional argument each get their
own sentence.

`summarise()` now keeps every grouping level but the last, as dplyr does. With
grouped `mutate()` in place (D37) the difference is visible: `group_by(miasto,
plec) |> summarise(n = n()) |> mutate(n / sum(n))` gives shares within a city.

Logical values in group labels and new column names read `TRUE` and `FALSE`, not
`true` and `false`. The reference cases showed it.

**The picture** (`renderPivotWider`) puts the long table above the wide one and
gives each value of `names_from` one colour: a row of the long table wears the
colour of the column it goes to, and so does that column. A cell no row went to is
hatched. The engine reports, per cell, which row fed it; the picture works nothing
out.

Six reference cases against real R (`table()` and `tapply()` on the base side) and
one behaviour check for the refusals. Four mutations were tried: a gap turned to 0
unasked, `values_fill` ignored, `summarise()` dropping all groups, a repeated cell
taken silently. The last one passed until the behaviour check was added.

## D39 — Exercise 21, a battery of questions; pivot_longer()

Three questions on one scale arrive as three columns, and every summary has to be
written three times. `pivot_longer()` folds them into two, which question and which
answer; one `group_by(pytanie)` then summarises all of them. The first scene shows
the hand-written version so the gain is seen, not asserted.

The price is what a row means. Six people become eighteen rows; from there on a row
is an answer, `count()` counts answers, and it counts the empty ones too. The
caption of the picture says it every time: "Wiersz to już nie osoba."

**The engine** gained `pivot_longer(cols, names_to, values_to, values_drop_na)`.
The columns to fold are chosen as in `select()`: `p1:p3`, `c(p1, p3)`, `-c(id,
plec)`. `select()` and `pivot_longer()` also learnt `starts_with()`,
`ends_with()`, `contains()` and `everything()`. `starts_with("p")` on this table
catches `plec` as well; folding text with numbers is refused with a sentence that
names the columns, which is the lesson a student needs at that moment.

`names_to` and `values_to` name columns that do not exist yet, so they are text in
quotes, while the columns to fold are written bare. A bare new name gets its own
message with the corrected line in it.

**The picture** (`renderPivotLonger`) mirrors exercise 20: the wide table above
with one colour per folded column, the long one below with each row wearing the
colour of the column it came from. Only the rows of the first two people are
drawn; the pattern is complete after two.

**The task** gives the folded table and asks for the mean of each question by sex.
`group_by(pytanie, plec)` is the same answer with its rows in another order, so
`valuesEqual` gained `ignoreRowOrder`, off unless a task asks for it. The picture
of goal and answer uses the same rule, so it turns green with the verdict.

Found on the way: a printed table left-aligns its row labels in R ("9 " above
"10"). The trainer right-aligned them, which only shows from ten rows up; no
reference case had that many. Fixed in `formatDataFrame`.

Seven reference cases against real R, four mutations, and a check that a success
line holds no markup (it is shown as plain text, and one had backticks).

## D40 — Exercise 22, two tables; left_join() and its family

The question is about regions and the survey holds only the city. The region lives
in a second table, one row per city, and `left_join()` brings it over. Nothing is
computed, so a join looks harmless; it is the one verb on the path that changes
the number of rows without being asked to.

The exercise shows three silent outcomes on one small survey. A city missing from
the second table leaves the person with NA: honest, and visible in every later
count. `inner_join()` drops that person, and the table is a row shorter with no
word about it. A city listed twice in the second table gives each of its people
twice: six respondents become eight. The habit taught is one line long: after a
join, count the rows.

**The engine** gained `left_join`, `inner_join`, `right_join`, `full_join`,
`semi_join` and `anti_join` as one function with a table of what each keeps. Rows
come in the order of the left table, partners in the order of the right one, and
rows the right table holds alone are appended; NA meets NA, as in dplyr. A column
name on both sides that is not a key gets `.x` and `.y`. `by` is read as
`"miasto"`, `c("a", "b")`, `c("lewa" = "prawa")`, `join_by(a)`,
`join_by(a == b)`, or by position; without it the common columns are used and the
line `Joining with ...` is printed, as R prints it.

`by = miasto` is what a student writes after a chapter of bare column names. It
gets its own message with the corrected line. A text key against a number key is
refused, as dplyr refuses it. A key repeated on both sides gives a warning, on one
side only it gives none: that is dplyr's rule, and the reason the doubled rows of
a one-to-many join are the dangerous case.

Not carried over: `suffix`, `keep`, `relationship`, `na_matches`. They are refused
by name with a sentence about what a join needs.

**The picture** (`renderJoin`) is the first with two tables in. Left and right
tables stand above, the result below, and one colour runs through a key value: a
person, the city they matched and the row they make together. What has no partner
has no colour. A left row that stays empty is flagged in the warning colour, and
its NA cell is dashed; a row that does not come along is struck out. The palette
skips the hue that sits next to the warning colour. `semi_join` and `anti_join`
draw no result table: they only keep or strike rows of the left one.

The caption (`joinCaption`) is ordered by what should worry a student first: rows
that multiplied, then left rows with no partner, and only then what the right
table held that nobody asked for.

**The task** asks how many people answered in each region. The check requires
`left_join` and ignores row order; `group_by(region) |> summarise(n = n())` is
accepted. Wrong answers are told apart by what the counts add up to: fewer than
six is `inner_join()`, more than six is a second join that multiplied rows, and a
region nobody answered from means the tables were swapped.

Left as it is: `slice(which(plec == "K")[1])` fails here, because `slice()` does
not see columns. dplyr does. Found while writing a test for this exercise.

Fifteen reference cases against real R, with the base-R side written with
`match()`; dplyr is not installed locally, so the row order of `right_join` and
`full_join` rests on dplyr's documentation, not on a run. Two behaviour checks,
twelve picture claims, twenty mutations, all caught.

## D41 — A second task "dla chętnych" in the exercises of lecture 2

Lecture 2 takes a strong student about 45 minutes and a weak one up to two hours
(an estimate from the amount of material, not a measurement). The strong ones need
something to do; the weak ones must not get more to do.

**A lesson may hold `extra`**, a second task of the same shape as `task`. It is one
more step after the task, drawn by the same screen. It has its own hints, opened
solution, saved code and goal.

**It never finishes the exercise.** Its record lives inside the exercise's own,
under `extra`, and never touches `status`. The count of finished exercises, the
menu tick and the way to the next exercise depend on the first task alone.

**It is offered late and never stands in the way.** The button "Zadanie dla
chętnych" appears on the task step only once the exercise is finished; before that
it would be one more thing to do for someone still working. "Następne ćwiczenie"
stays the main button on both steps. The step's dot is dashed and is always
reachable, so a student who wants it earlier can open it.

**The report says it only when solved**, as one more fact on the exercise's line
("zadanie dla chętnych"), so it reads as a plus and its absence as nothing. A report
brought to another computer brings it along. Attempts and hints of the extra task
are kept but not reported.

**No new material.** Each extra task joins the exercise's verb with earlier ones
and has one trap:

| Exercise | Extra task | Trap |
|---|---|---|
| filter() | men over 35 who answered | `wiek > 35` lets the NA row through |
| select() | rating at least 4, keep city and age | `select()` first removes the column the filter needs |
| mutate() | TRUE where age is above the mean, three columns | a typed number instead of `mean(wiek)` |
| arrange() | answered only, best rating first, older first on a tie | one tie in the data: without the second column the order differs |
| group_by() | people over 40 against the rest | the group is not a column yet; the NA sits in the older group |
| n(), count() | answers per city, most first | without the filter Warszawa has 3, with it 1 |
| pipeline | cities with at least two answers | `filter()` after `summarise()`; `n()` without the first filter counts respondents |

The counting task requires no call: `count(sort = TRUE)` and `group_by()` with
`sum(!is.na(ocena))` are the same answer.

Tests: every check a task gets, the extra task gets too (solution passes, starter
does not, budgets, near-misses). Three more for extra tasks only: it asks for
something else than the task (neither solution passes the other check), its
solution fits the code box, and every message is reached by a near-miss. The
bundle test solves each extra task before the task itself and checks that the
exercise stays unfinished. Twenty mutations, all caught; two survived the first
run (the way on led through the extra task; the extra step offered the first
task's saved code) and got checks of their own.

Not done: extra tasks for lectures 1 and 3; a starter with gaps for students who
fail a task twice. The second would help the weak more than this does.

## D42 — More questions in exercise 15, group_by() and summarise()

The teacher's note after reading the exercise: this pair is the most useful part of
dplyr for survey work, and the exercise showed it on one question only (mean age
per city).

**The data got two columns**: `plec` and `godziny` ("Ile godzin dziennie spędzasz w
internecie?"). `wiek` and `ocena` are untouched, so the task, the extra task and
their numbers stay as they were.

**Two more scenes**, six in all, which is the limit a lesson may hold:

- the same two lines with another group and another column (`group_by(plec)`,
  `mean(godziny)`): the pattern stays, the question changes;
- three summaries at once (`n()`, `mean()`, `max()`): the table a report prints.

The second one is close to the task in shape. That is meant: the task still needs
another column, other names and `na.rm = TRUE`, and the weak student no longer
starts from an empty line.

**The sandbox offers seven questions instead of three**: the oldest person, the
median age, the age range, the share of satisfied people (`mean(ocena >= 4)`), the
young against the rest (`group_by(mlodzi = wiek < 30)`), a count per rating, and
the whole survey without groups. "Ściąga" gained `min()` and `median()`.

Left out on purpose: two grouping variables (exercise 20 is about that) and
percentages through `mutate()` in groups (exercise 19).

Six reference cases against real R for what the new examples use. No new engine
code was needed.

## D43 — Exercise 23, from a question to a report

The last exercise of lecture 3 adds no verb and no engine code. It takes one
question a report asks, "are the younger more satisfied?", and walks it through
what lecture 3 taught: a group made from a number (`if_else()`), a percent
(`mean(ocena >= 4) * 100`), and the missing answers on the way.

**Four steps, one scene each**, after the opening picture:

1. the group is made from age;
2. the percent comes out with two NA: the person without an age forms a group
   called NA, the person without a rating turns the percent of his group into NA;
3. both are removed at the top of the chain, by name, where a reader of the code
   sees who was left out;
4. `n` stands beside the percent.

The sixth scene cuts the same ten people into three groups with `case_when()`.
"100%" in the oldest group is two people, and "0%" in the middle one is two as
well. That is the sentence the exercise is for.

**The task** changes the threshold (40 instead of 30) and asks for `n` and
`procent` per group. A rounded percent is accepted (tolerance 2%), and so is any
row order. The diagnosis reads the table in the order a mistake is worth
explaining: a row called NA, a group spread over several rows (the `count()` way
of exercise 19, right numbers in the wrong shape), wrong labels, a missing `n`, a
percent that is NA.

The quiet mistake gets its own message: `mean(ocena >= 4, na.rm = TRUE)` gives the
right percent, while `n()` still counts the person who gave no rating. Nine people
stand behind eight ratings. The message asks for `filter()` instead of `na.rm`.

If everything about the people is right and the answer is still wrong, what is
left is the measure, so the fallback says that ("zadowolony to ocena 4 lub 5")
and not "try again". This came from a mutation that survived: `ocena > 4` in
place of `ocena >= 4` changed nothing any check looked at.

Not included: a join and a pivot in the same chain. Both have their own exercise;
a capstone that needs all five verbs of the lecture at once would be a puzzle, not
a report.

Five reference cases against real R (109 in all), fourteen mutations, all caught.

## D44 — A task that tells group_by() from arrange()

Students take the two for the same thing: after `arrange(miasto)` the rows of one
city stand together, and it looks grouped. The teacher asked for a task about the
difference.

It is the task "dla chętnych" of exercise 15, where both verbs are known for the
first time. **It replaces the task D41 put there** (people over 40 against the
rest). A lesson holds one extra task, and that idea lives on in the sandbox
(`group_by(mlodzi = wiek < 30)`) and in exercise 23, which makes its groups from
age. The older task is in `.snapshots/pre-arrange-vs-group-2026-10-10`.

**The task**: the mean age in each city, the city with the oldest respondents on
top. The answer needs both verbs, each for its own job: `group_by()` with
`summarise()` to compute, `arrange()` last to order the result.

**The teaching is in the wrong answers.** Each says what the verb in question does
and does not do:

| What the student wrote | What the result is | What the message says |
|---|---|---|
| `arrange(miasto) |> summarise(...)` | one row | sorting put the cities side by side, but those are not groups |
| `group_by(miasto) |> arrange(...)` | ten rows | neither verb computes anything |
| `arrange(...)` before `summarise()` | alphabetical | the sorting is gone; `arrange()` goes last |
| no `arrange()` | alphabetical | `group_by()` does not order by the result |
| `arrange(sredni_wiek)` | ascending | the other way round |
| `arrange(desc(miasto))` | by name | by the mean, not by the name |

The data makes these tellable apart: alphabetical (Gdańsk, Kraków, Warszawa),
ascending (Kraków, Gdańsk, Warszawa), by name descending (Warszawa, Kraków,
Gdańsk) and the answer (Warszawa, Gdańsk, Kraków) are four different orders.

"Sorted too early" and "never sorted" give the same table, so they are told apart
by where `arrange(` stands in the code.

The first hint states the difference in one line: `group_by()` decides what is
computed together, `arrange()` in what order the rows stand. The sandbox gained two
variants that show it without a task: `arrange(miasto)`, and the same followed by
`summarise()`, which gives one row.

Three reference cases against real R (112 in all). Eight mutations, all caught; one
survived the first run (the check without its required calls) and got a near-miss
of its own, the table typed city by city.

## D45 — ggplot2 in the trainer: lecture 4

The syllabus has ggplot2 as its own topic, and it follows directly from lecture 3:
the tables made there are what a plot draws. Until now the trainer kept plots out
("real RStudio work", and `ggplot()` answered with a sentence saying so). The
reason to reverse it is that ggplot2 is built from parts, and parts are
what the trainer shows: click `aes(x = miasto)` and see which column went where,
click `geom_bar()` and see the table it counted.

### Two halves that stay apart

**The object.** `ggplot()` returns a plot value. `+` adds a part to it: a layer,
labels, a flipped coordinate system, a theme. The evaluator asks `addToPlot()`
before ordinary arithmetic, so `+` on numbers is untouched. `aes()` holds
expressions, not values, which is why these are special builtins like the dplyr
verbs.

**The build.** `buildPlot()` turns the object into plain tables: for every bar its
position, its top and bottom, its colour and the rows it came from; for the axes
their levels or breaks; the legend's keys. It is what `ggplot_build()` is in R. The
tests look only at this, and the renderer (`ui/viz/plot.js`) reads only this and
knows nothing about R.

One deliberate difference from R: aesthetics are evaluated when a layer is added,
not when the plot is printed. A misspelt column fails at the `+`, where the student
is looking. In R the same message comes at print time.

### What is implemented

`ggplot`, `aes` (x, y, fill, colour, label, group), `geom_col`, `geom_bar`,
`geom_text`, `position` as "stack", "dodge", "fill", "identity" and as
`position_dodge()`, `position_stack()`; fixed `fill`, `colour`, `alpha`, `width`,
`vjust`, `hjust`; `labs`, `ggtitle`, `xlab`, `ylab`; `coord_flip`; five themes;
`theme(legend.position = )`; `layer_data()`. For the order of bars: `reorder()`,
`fct_reorder()`, `fct_infreq()`, `fct_rev()`, `fct_inorder()`, `fct_relevel()`.
Also `pretty()`.

Followed from ggplot2 because a student would notice otherwise: the first level
stands on top of a stack; dodged bars share the width of their x, so a lone bar is
wide; unused factor levels take no place; a missing category is a bar called NA,
last; rows with a missing y are dropped; a plot prints nothing in the console.

### What a student gets wrong, and what they are told

Twenty mistakes have a sentence each. The ones that matter most:

- `|>` between layers, and `+` at the start of a line;
- `geom_bar()` given a y, `geom_col()` given none;
- a column outside `aes()` (`geom_bar(fill = plec)`): "object not found", with the
  corrected call.

Three things R does without a word are named on the stage as traps:

- `geom_col()` on raw rows piles them up: "9 rows went into 3 bars";
- a word inside `aes()` is a column holding that word, so `aes(fill = "blue")`
  paints red bars;
- rows with NA are dropped.

### The pictures

A plot's chain is its layers: a strip of small plots, one per `+`. A layer is shown
with the table it draws from; for `geom_bar()` that table is the count it made,
which is the whole difference between it and `geom_col()`. `aes()` is shown as one
row per aesthetic with the column's values beside it.

In a task the goal and the answer are two plots, one above the other.

### When two plots are the same

By what they draw: the bars' positions, heights and colours, the order of the axis,
a flip. Not by the code: `geom_bar()` on answers and `geom_col()` on their count are
one plot. Labels count only where the goal set them with `labs()`, so a task that
does not ask for a title does not fail for one, and an answer may add its own.

### Honest limits

- **Nothing was compared with real ggplot2.** It is not installed here. The numbers
  of a plot are checked against base R (65 cases); the look is not checked against
  anything. Colours are the hue palette written out by hand for up to eight groups.
- **Axis breaks are R's `pretty()`**, verified against R, with two corrections for
  cases where ggplot2 is known to differ (no half ticks on a count; quarters on a
  share). Elsewhere ggplot2 may choose other breaks.
- **A label lifted above its bar gets headroom.** ggplot2 cuts it at the panel's
  edge. Kinder here, and not what RStudio will show.
- A number as `fill` is refused with a sentence that offers `factor()`. In R it
  makes a gradient, or is dropped under `geom_bar()` with a warning.
- `geom_bar()` along y, `scale_*`, `facet_*`, `ylim`, per-layer data: not there.

### Not done

Histograms, boxplots, scatter plots and facets. The engine has the places for them
(a stat, a geom, a panel), and "exploration" in the syllabus topic means them. They
are the next step, not a detail.

The teacher's notes for lecture 4 and oral scripts do not exist.

Verified: 65 reference cases, 138 plot checks, 31 mutations of the engine and the
renderer (five survived the first run and got checks of their own), a browser walk
of all five exercises at 1280 px and 375 px in both colour schemes.


## D46 — "Usuń moje dane" clears the page too

Found on the live site while testing lecture 2. "Usuń moje dane z tego komputera"
removed the person's name, progress and code from the browser's storage, and then
showed "Kim jesteś?". The exercise and the code box stayed in the page behind that
screen. The screen is opaque, and the next person started from a clean exercise 1,
so nobody saw it. The code could still be read with the browser's developer tools
until the next name was entered. That is not what "znikną z tej przeglądarki" says.

Now the removal also closes the exercise or the sandbox and empties the stage, the
memory panel and the title in the header. `LessonView.close()` does the first part,
`App.clearScreen()` the rest.

"Zmień osobę" is left as it was. It can be cancelled, and then the person goes on
where they were, so the page must stay.

Verified: the shared-computer check for removal now reads the page behind the
welcome screen. With the call to `clearScreen()` switched off it fails.

## D47 — Where `sredni_wiek = mean(wiek)` comes from

The author's remark on exercise 15: the lesson opened with
`summarise(sredni_wiek = mean(wiek))` and never said what stands on each side of
`=`. A student could take `sredni_wiek` for something R knows.

The scene that showed `summarise()` on the whole table is now two. The first runs
`summarise(mean(wiek))`: one row, and a column called `mean(wiek)`, which is what
dplyr does when no name is given. The second adds the name: before `=` a name the
student makes up, after `=` what R should compute. The awkward column name in the
first scene is the reason for the second.

This makes seven scenes, so the limit moves from six (D28) to seven. Exercise 15 is
the only one that uses the seventh.

Verified: the lesson suite, the picture suite and the bundle walk pass with the new
scene; the page at 375 px is not wider than the window with ten step dots.

## D48 — Groups survive the next verb; `head()` cuts a table by rows

Found on the live site while testing lecture 3, by typing an answer the lesson did
not foresee. In exercise 19 the route
`group_by(miasto) |> count(opinia) |> mutate(procent = n / sum(n) * 100)` is right
in dplyr: `count()` keeps the groups the table came with, so the percentages add up
to 100 in each city. The engine dropped them, printed shares of the whole table,
refused the answer and said "Brakuje group_by(miasto)" to code that had it.

An audit of every verb after `group_by()` found more:

- `count()` now returns a table grouped as its input was.
- `select()` on a grouped table crashed when the group column was not picked. It now
  keeps that column in front, as dplyr does ("Adding missing grouping variables").
- `distinct(x)` on a grouped table crashed. The group columns now count as named.
- `rename()` of a group column left the groups pointing at the old name.
- `head()` and `tail()` treated a table as a list and returned its first or last
  **columns**, printed as a list. This had nothing to do with groups; it was wrong
  for every table. They now cut by rows and keep the row numbers, as R does.

`mutate()`, `filter()`, `arrange()`, `slice()`, `left_join()`, `ungroup()` and
`summarise()` were already right.

How `head()` on a table went unnoticed: no lesson uses it, and no reference case
did. It is the first thing a student types in RStudio, so the sandbox was the place
it would have shown.

Limits. dplyr itself is not installed here, so what dplyr does with groups is taken
from its documentation and checked only as numbers against base R. `arrange()` on a
grouped table ignores the groups, as in dplyr; `.by_group` is not supported. The
pivots still drop groups.

Verified: 22 new reference cases (134 in all) agree with real R; eight mutations of
the fixes are each caught by them.

## D49 — Exercise 23 gets a task for those who want more: draw the report

Lecture 3 ends with a table of percentages, and lecture 4 starts by drawing tables
like it. The author asked for a bridge inside the trainer: an optional task in
exercise 23 that turns the report into bars.

The task gives the whole table in the box and asks only for the two lines a plot
adds: `ggplot(aes(x = grupa, y = procent))` and `+ geom_col()`. `ggplot()` has no
scene before it here, so the hints carry the syntax in full, and the note sends the
student to exercise 24 for the plot and 28 for `n` on the bars. The last line of
the table is broken in two so that `|>` after it fits the box.

Wrong answers it names: the table left as a table, axes with no layer, `|>` between
the layers, `geom_bar()` counting the rows of the report (bars of height 1),
`geom_bar()` given a y, the number of people drawn instead of the percent, and the
axes swapped.

Like every task "dla chętnych" (D41), it does not count towards finishing the
exercise, and the way on stays the main button.

Limit: `requireCalls: ['ggplot', 'geom_col']` is kept for its messages, but it is
not what refuses a wrong plot. A mutation that drops it survives, because no other
call draws the same bars: `geom_bar(stat = "identity")` is refused by the engine.

Verified: the lesson suite (601 checks), the bundle walk with eight extra tasks, four
of five mutations of the task caught (the fifth is the redundancy above), and a
browser walk at 1280 px and 375 px.

## D50 — Why a function exists, before how it works (pilot: exercise 18)

The author's remark: the exercises start well, with a question, but a new function
arrives without saying what it is for and when to take it instead of the one before.
The example was `case_when()`: usually defined as a way to vectorise a chain of
`if` / `else if`, and that definition is worth showing, together with why
vectorising was needed at all.

Exercise 18 now tells it as one story in three scenes:

1. Plain `if` / `else if` decides for **one person**: `wiek <- 45` gives "30-49".
   The same `if` on the column stops with an error, because eight people would need
   eight decisions. The scene opens on that error, and the diagnosis under it says
   what to use instead.
2. `if_else()` is `if` / `else` made for every row.
3. `case_when()` is `if` / `else if` made for every row, the tool for more than two
   groups. The sandbox opens with the same three groups written as nested
   `if_else()`: it works, and reads inside out.

The glossary lines for both functions now say the same: "`if` / `else` dla każdego
wiersza" and "`if` / `else if` dla każdego wiersza".

A scene could not fail until now. `fails: true` lets one show R refusing: the lesson
suite checks that its last line fails and that every line above it runs. The
diagnosis for `if` on a vector now names `if_else()` beside `ifelse()`.

Plain `if` / `else if` now has a picture of its own: the recode table of
`case_when()` with a single row. The conditions stand in reading order, the first
TRUE is lit, the ones after it and `else` stay blank. Two scenes later
`case_when()` draws the same table with a row per person. That is the picture of
"vectorised": the same decision, made for every row. The scene's pointer pulses on
the one-person `if`, so a student clicks it and sees the single row first.

This is a pilot. The same "what for, and instead of what" opening may suit other
functions; which ones is the author's call.

Verified: all suites pass; three mutations of the new scene (no `fails`, a first
line that fails too, a last line that runs) and four of the `if` picture (not
routed, wrong condition lit, `else` column lost, `else` not taken) are each caught;
browser at 1280 px and 375 px.

## D51 — `if` on a column: too many answers, not a dropped column

The author's remark on the scene of D50: it read as if `if` checked one cell and
the rest of the column fell out, while the stage drew `ankieta$wiek < 30` as an
operation on the whole vector. Both pictures were true, and nothing joined them.

Now they are joined in two places:

- The example of one person is taken from the column: `wiek <- ankieta$wiek[3]`,
  person 3, 45 years. The sentence says "Osoba 3 ma 45 lat: `if` daje „30-49”. Cała
  kolumna to **8 odpowiedzi**, a `if` bierze jedną."
- When `if` stops on a condition longer than one, the stage draws the condition's
  answers above the error, and the caption says the comparison worked for every
  person; it is `if` that can take only one way. So the vector picture and the
  error tell one story: the comparison is vectorised, `if` is not.

Verified: a picture check (answers drawn, error kept, caption names the count),
which fails with the new branch switched off; all suites; browser at 1280 px and
375 px.

## D52 — The `if` scene, simplified

The author found the scene of D50 and D51 overloaded: four lines of code, a chain of
`else if`, an error, a long diagnosis under it, and eight answers on the stage. The
idea behind it is one sentence: plain `if` makes one decision, and a column needs
one for every person, which is why `if_else()` exists.

Now two neighbouring scenes say it with the same words:

1. `wiek <- ankieta$wiek[3]` and `if (wiek >= 40) "40+" else "do 39"`. The stage
   shows the recode table with one row. "`if` decyduje za **jedną osobę**: osoba 3
   ma 45 lat, więc „40+”."
2. `if_else(wiek >= 40, "40+", "do 39")` inside `mutate()`. The same table with eight
   rows. "`if_else()` to ten sam `if` dla **każdego wiersza**."

One row against eight carries the point; no error is needed. The `else if` chain
moved to where it is used: the `case_when()` scene calls it "`if` / `else if` dla
każdego wiersza".

The error scene and the `fails` option for scenes (D50) are gone, since nothing
uses them. The picture of `if` on a column (D51) stays: a student who types it in
the sandbox still sees the comparison's answers above the error.

Verified: all suites; browser at 1280 px and 375 px.

## D53 — Which functions come from a package

The author asked for a mark that tells where the code works with dplyr and where
with standard functions. In the trainer every function is loaded at once, so nothing
told `if_else()` (dplyr) from `ifelse()` (base R), while in RStudio the first one
works only after `library(dplyr)`.

`src/core/packages.js` lists the functions of each package the course uses: dplyr,
tidyr, stringr, ggplot2, forcats. Anything else the trainer provides is base R
("bazowy R"). The mark appears in three places:

- **On the stage**, beside the code of the clicked call: a small tag "dplyr" or
  "bazowy R". A student's own function gets none. A call after `|>` is labelled too.
- **In "Ściąga"**, in every function's line: `if_else()` dplyr, `mean()` bazowy R.
- **Under the exercise title**: what to load in RStudio, "W RStudio:
  library(dplyr) library(tidyr)", or "bazowy R" when nothing is needed. It is worked
  out from the functions the scenes, the sandbox and the task call. The task "dla
  chętnych" is left out, so exercise 23 does not ask for ggplot2 on its main path.

`tibble()` belongs to the tibble package; it is marked dplyr because
`library(dplyr)` is what makes it available. `reorder()` is base R (stats), unlike
`fct_reorder()`.

On the way: the glossary lines of `if_else()` and `case_when()` written in D50 held
backticks, which the glossary shows as they are. They are plain text now, and a
glossary check forbids markup in function lines.

Verified: the map against the engine (every listed function exists; nothing that
looks like a package function is left as base R; 34 named pairs), the stage tag
(dplyr, base R, after a pipe, none for an own function), the header of four
exercises in the built file, four mutations caught (one survived at first and got
the 34 pairs), browser at 1280 px and 375 px in both themes.

## D54 — Exercise 18 read as a second-year student

A walk through exercise 18 as a sociology student would take it: every sentence and
caption read, the code clicked, and twelve likely answers typed into the task. The
story held, but two pieces of syntax arrived unexplained, and five answers got a
message that did not help. All of it is fixed:

1. `if` appears here for the first time in the course. The scene now says how it is
   written: "`if (warunek) A else B` wybiera A albo B dla **jednej osoby**." The age
   of that person is `wiek_osoby`, so it cannot be taken for the column `wiek` that
   `if_else()` uses in the next scene.
2. `if_else()` says its arguments again: condition, value for TRUE, value for FALSE.
3. The scene with `count()` answers the opening question: "**3 osoby** mają 40+".
4. `case_when()` says what `~` is: "Przed `~` **warunek**, po `~` **wartość**".
5. "Ściąga" has two new cards, `if else` and `~`, with the parts of each labelled.
6. The caption of the one-row `if` picture no longer names `case_when()` before it
   is shown: "Jedna wartość, jeden wynik. if_else() zrobi to samo dla każdego wiersza."
7. The task now answers five mistakes in their own words:
   - "srednia" without the accent: one label differs from the prompt (it was "the
     levels are mixed up", which sent the student to the order of conditions);
   - `ocena == 1:2`: compares in turn with 1, 2, 1, 2; several values need `%in%`;
   - `=` instead of `~` in `case_when()`: a diagnosis with the line fixed (the parser
     asked for a closing bracket);
   - a missing comma between lines: "Brakuje przecinka", naming the line and the fix
     (also "something is unclosed" before);
   - `ankieta |> case_when(...)` without `mutate()`: "case_when() dostał całą
     tabelę. Nową kolumnę robi mutate()".

The same piped mistake with `if_else()` is caught earlier by R itself: it evaluates
the arguments and stops at the bare column name, whose hint already says the name
works inside `mutate()`.

Verified: two near-misses, five behaviour checks and two glossary detections added;
five mutations (each new diagnosis and the table check switched off) caught; all
suites; browser at 1280 px and 375 px.

## D55 — Exercise 19 read as a second-year student

The same walk as D54, on the percentages exercise: every sentence and caption read,
`sum(n)` clicked, thirteen answers typed into the task. The idea came through; two
right answers were refused, and the most common mistake with NA got a wrong hint.

Scenes:

- In a grouped `mutate()` the stage now names the group of each evaluation, as it did
  for `summarise()`: "Grupa Gdańsk: … 4", "Grupa Kraków: … 6". Before, clicking
  `sum(n)` in the scene that says "Kraków: 4 z 6" showed a bare 4.
- That scene says why NA is back: "Kraków: 4 z 6, z jednym NA". The task joins it
  with the scene that removed the missing answers.
- The prompt names the column: "(kolumna **procent**)".

Task:

- Accepted now: the keys the other way round, `count(opinia, miasto)` (row order no
  longer matters), counts made with `group_by()` and `summarise(n = n())` instead of
  `count()` (the author's choice: the same numbers, a longer way), and `drop_na()`.
- `filter(opinia != NA)` empties the table; it was told "brakuje `* 100`". It is now
  told that nothing compares with NA and what removes missing answers.
- One denominator for every row (`n / nrow(ankieta)`, a number) and a percent turned
  into text with "%" get messages of their own.

Engine:

- `drop_na()` from tidyr exists now, drawn as a filter. A student typing it got
  "check the spelling" for a real function.
- The error for `summarise()` given several values ends with "albo mutate(), jeśli
  wynik ma mieć wartość dla każdego wiersza tabeli", since that is the usual fix here.

Verified: six reference cases for `drop_na()` against R (140 in all), three
near-misses and three accepted routes, a picture check for the group captions, seven
mutations caught, all suites, browser at 1280 px and 375 px.

## D56 — Habits that keep "the first TRUE wins" from biting

The author asked for good practice beside the scene where `wiek < 50` takes the
young: knowing the rule is not the same as knowing how not to trip on it.

Three places, each short:

- **The scene** now ends with the rule to follow, not only the trap: "Pierwszy TRUE
  wygrywa: `wiek < 50` zabiera młodych. Dlatego **najwęższy** warunek stoi pierwszy."
- **The sandbox** opens with the habits in one sentence (narrowest condition first,
  a range closed on both sides, missing answers on their own, `count()` at the end)
  and a chip for each one that was missing: the middle group written as
  `wiek >= 30 & wiek < 50` and listed first, which still comes out right because a
  closed range does not depend on order; and `case_when()` followed by
  `count(grupa)`, which shows every group and the one NA at a glance. The chip with
  `is.na(wiek) ~ "brak danych"` first was already there.
- **"Ściąga"** cards may now carry a "Dobra praktyka" line, held to 100 characters
  like the rest. The `~` card has the first one.

Verified: all suites; the closed-range chip gives the same groups as the ordered
scene; browser at 1280 px and 375 px.

## D57 — Exercise 20 read as a second-year student

The walk of D54 and D55 on the cross-table exercise. The scenes held up well; what
failed was the student reaching for what lecture 1 taught (`table()`) or for real
tidyr that the trainer did not know.

- **Why not `table()`**: the scene with means says it now, "Średnie zamiast liczb,
  czego `table()` nie zrobi". `table()` counts people; `pivot_wider()` lays out any
  value.
- `table(a, b)` is still not drawn by the trainer, but its message no longer reads as
  a dead end: "W RStudio `table(a, b)` zrobi tabelę krzyżową… tę samą tabelę dają tu
  `count()` i `pivot_wider()`".
- The message about the trainer's limits named "bazowy R, dplyr i stringr". It names
  tidyr and ggplot2 too. The message for `plot()` said plots are made in RStudio; it
  points to `ggplot()` now.
- `values_fill = list(n = 0)` is accepted, as in tidyr.
- `replace_na()` (tidyr) exists: on a table with `list(col = value)`, on a vector
  inside `mutate()`. The value takes the column's type, so a count stays a count.
- `as.data.frame()` answers that it works in RStudio and is missing here, instead of
  "check the spelling".
- **The opening picture shows the cross table.** It stopped at `count()`, so the
  question about a cross table had no cross table under it. The before-and-after
  picture now draws `pivot_wider()`: the long rows fly into the wide row they feed,
  the values of `names_from` become columns, and the missing pair stays NA. Exercise
  21 (`pivot_longer()`) does not open with this picture, so the other direction is
  not drawn yet.

Verified: six reference cases against R (146 in all, one with a gap filled from a
list), three accepted routes, four behaviour checks, a picture check of the stages,
five mutations caught, all suites, browser at 1280 px and 375 px.

## D58 — Exercise 21 read as a second-year student

The walk of D54, D55 and D57 on the battery exercise. The fold itself came through;
the student did not know what was folded, and two answers that followed the
exercise's own advice were refused.

- **What p1, p2 and p3 ask** was only in a comment of the hidden setup. The scene
  with the means written by hand now starts with the three questions as comments.
  Its three lines are the same now: `p1` got `na.rm = TRUE` like the others.
- **The exercise opens with a question**, as every other in the lecture: "Które
  pytanie o zajęcia oceniono najwyżej?". The before-and-after picture learned
  `pivot_longer()`: each person's row splits into three answers, which start where
  the person stood and spread out (6 rows, then 18), then group and fold into three
  means. The picture used to start from the first verb with a preview; a pivot has
  an input table instead, and that is now read too.
- **`p1:p3` opened the "Ciąg liczb" card**, which says the colon makes numbers. A
  colon between two names is now its own card, "Zakres kolumn".
- **The trap is named** in the scene with `n`: "`n` to odpowiedzi bez braków: `n()`
  liczyłoby puste".
- The task accepts a rounded mean, and an `n` beside it when it counts the answers
  given (16 in all). An `n` from `n()`, which counts the empty ones too, is told so
  with the numbers. A question column under another name is told its name, instead
  of "the questions merged into one mean".

Verified: two accepted routes, two near-misses, a glossary detection and a picture
check added; six mutations caught; all suites; browser at 1280 px and 375 px.

## D59 — The trap shown with its repair

The author's remark on D56: the scene said that `wiek < 50` takes the young and that
the narrowest condition goes first, but did not show how a student avoids it in the
code in front of them.

The scene now holds both, one under the other, each marked with a comment:

- `# Źle: szeroki warunek stoi pierwszy`, the order of D34, where `wiek < 30` gets
  nobody;
- `# Dobrze: przedział z obu stron`, the same order of lines, with the middle group
  written `wiek >= 30 & wiek < 50`. It no longer reaches the young, so the order
  stops mattering.

The scene opens on the trap; its pointer pulses on `wiek >= 30 & wiek < 50`, and a
click there shows the repaired table with every group filled. The sentence: "Pierwszy
TRUE wygrywa: `wiek < 50` zabiera młodych. Niżej naprawa: przedział **z obu stron**."
The other repair, the narrowest condition first, is the scene before it and a habit
named in the sandbox (D56).

Verified: a picture check that the repaired version gives every group and hides no
condition; all suites; browser at 1280 px and 375 px.

## D60 — Exercise 22 read as a second-year student

The walk of D54-D58 on the join exercise. The three silent things a join does (NA,
a vanished row, doubled rows) were each shown well. Missing were the words "left"
and "right", the opening question, and the habit; and one message blamed a function
the student had not used.

- **Left and right**: the scene with the first join says which is which, "dokłada do
  **lewej** tabeli (`ankieta`) kolumny prawej (`miasta`)". The captions after it
  speak of left and right tables, and so does the name `left_join()`.
- **The exercise opens with a question**, "Jak oceniają zajęcia osoby z każdego
  regionu?", and the before-and-after picture learned joins: the left rows keep
  their places and get the new column, a row with no partner keeps NA there, an
  inner join drops it, and a repeated key makes copies born where their row stood.
  Seven scenes now, the limit.
- **The habit** opens the sandbox: "Nawyk po każdym złączeniu: policz wiersze. Było
  6, ma zostać 6."
- A count that lost the person from Radom said "`inner_join()` gubi osobę z Radomia"
  even when the student had joined with `left_join()` and then filtered the NA row
  away. That case now has its own message: the NA row is a person who answered.
- `merge()` answers that it works in RStudio and that `left_join()` joins here. The
  messages for `merge()` and `as.data.frame()` no longer repeat the function's name.

Verified: a near-miss, a behaviour check and three picture checks (the region added
to the same rows, copies born from Kraków's rows, the inner join dropping Radom);
four mutations caught; all suites; browser at 1280 px and 375 px.

## D61 — Exercise 23 read as a second-year student

The last walk of lecture 3. The main task took every one of twelve right answers
written differently and named both wrong ones; the scenes held. Two things were
fixed:

- **Why `mean(ocena >= 4)` is a percent** was nowhere said. Clicking it showed
  "Średnia = suma ÷ liczba wartości: 2 ÷ 4 = 0.5", a sum of comparisons. The mean of
  a comparison now reads "Średnia z TRUE i FALSE to udział TRUE: 2 z 4, czyli 0.5.
  Razy 100 daje procent", wherever it appears. The glossary line of `mean()` says it
  too: "Z TRUE/FALSE daje udział TRUE".
- **The task for those who want more** refused a decorated plot: a colour, a colour
  per group, the bars turned with `coord_flip()`, and `n` written on the bars, which
  the task's own note suggests. It now takes any plot whose `geom_col()` bars stand
  at the goal's categories with the goal's heights. Bars of the wrong height still
  get their messages.

Verified: four accepted decorations, a caption check, three mutations caught (one of
them: any bars accepted), all suites, browser at 1280 px and 375 px.

## D62 — Exercise 24 read as a second-year student; decorated plots are answers

The first walk of lecture 4. The scenes add one part of a plot at a time and held
up. The task refused right plots and called a typo a missing label.

- **Decorations are answers, in every plot task.** A fixed colour (scene 5 teaches
  it), a flip (a sandbox chip shows it), the values written on the bars, a theme:
  each was refused with "Jeszcze nie to". The comparison has a second mode,
  `compare: { decorations: true }`, used by all five tasks of lecture 4 and by the
  task for those who want more in exercise 23 (which had its own version since D61).
  Every layer of the goal must be drawn by a layer of the answer with the same marks,
  in the same order of layers and of categories, and the labels the goal set must
  match. The answer may add a colour where the goal has none, a flip, a theme, more
  layers. A goal coloured by a column still needs that column's groups.
- **`geom_bar(stat = "identity")`** is `geom_col()`, as in ggplot2. Old tutorials
  write it everywhere; the trainer refused it. Exercise 24 no longer requires
  `geom_col()` by name, so an empty plot is told "Są osie, ale nic nie jest
  narysowane" through its own check instead.
- **A label with a typo** ("Srednia ocena") was told the label was missing. It is
  now told the label differs and must be written exactly, with the Polish letter.
- **`barplot()`, `hist()`, `boxplot()`** point to `ggplot()`, as `plot()` does.
- The first scene asks a question: "W którym mieście odpowiedziało najwięcej osób?"

Verified: two reference cases for `geom_bar(stat = "identity")` (67 in all), four
accepted decorations and one refused answer in exercise 24, three direct checks of
the lenient comparison (another column shaped alike, a theme and a flip, another
order of categories), a behaviour check; six mutations caught, two of them only
after the checks were made sensitive enough; all suites; browser at 1280 px and
375 px.

## D63 — Exercise 25 read as a second-year student

The rule of the exercise, "who counts: the plot or you", carried through every scene,
and the task accepted ten right answers written ten ways. What the walk found:

- **NA dropped in silence (an engine fault).** `geom_bar()` on a number axis skipped
  rows with NA and said nothing: the ratings plot showed nine people and its caption
  said "z 10 wierszy". ggplot2 drops them with a warning. The build now notes the
  dropped rows, as it already did for `geom_col()`, and the caption says so.
- **Two captions in poor Polish**, shown on every plot that needs them: "wypadło 1
  wiersz" and "3 wiersze ułożyło się". They read "Wiersze z NA wypadły bez słowa:
  1 wiersz" and "W 3 słupki ułożyły się dane z 9 wierszy" now.
- **A column in quotes, `aes(x = "plec")`**, draws one bar named plec. The task said
  "other categories than sex"; it now says the quotes make text, not a column, and
  the stage says the same.
- **`ggplot(ankieta, x = plec)`**: ggplot2 lets the stray `x` pass and fails at the
  layer, asking for an `x` the student did give. The trainer stops at `ggplot()` and
  shows `aes(x = plec)`. A deliberate departure from R, for a clearer message.
- **`geom_histogram()`, `geom_point()`, `geom_boxplot()`, `geom_line()`,
  `geom_density()`, `geom_smooth()`, `facet_wrap()`, `facet_grid()`** answer that
  ggplot2 has them and the trainer not yet, instead of "check the spelling". They
  count as ggplot2 for the package labels.

On the way: three behaviour checks read a missing error as a pass, because
`JSON.stringify(undefined)` is not a string. They say "no error" now; a mutation that
let a stray `x` pass found it.

Verified: two reference cases (69 in all), three picture checks, a near-miss, two
behaviour checks, five mutations caught; all suites; browser at 1280 px and 375 px
on a rebuilt file (the browser had served a cached one at first).

## D64 — Lecture 3 as one story: three quick repairs

Asked to read lecture 3 (exercises 18-23) as one immersion, I found the method held
(a question and a picture at every entry, missing data as the thread, `n` beside every
number) and the material did not: each exercise uses its own `ankieta` with other
people and other columns, satisfaction is measured three ways, and the capstone uses
only half of the lecture. A single study running through all six exercises was
proposed and deferred by the author; these three repairs were chosen instead, with
the data unchanged:

1. **A promise kept.** Exercise 18's closing note said `count(zadowolenie)` was "the
   next exercise". Exercise 19 never uses that column. The note now says the next
   exercise shows how to turn such counts into percentages, which it does.
2. **The capstone uses the cross table.** Exercise 23 gets a seventh scene: the report
   laid out with `pivot_wider()`, age group by sex, "jak w ćw. 20", and "100% u kobiet
   30+ to jedna osoba" to keep the `n` habit.
3. **A task for those who want more in every exercise of the lecture**, as in lecture
   2 (D41). Each turns on one point of its exercise:
   - 18: the missing age as its own group, `is.na(wiek) ~ "brak danych"` first;
   - 19: one number per city, where a filter before the percent changes the whole;
   - 20: means across, where the gap must stay NA, not 0;
   - 21: the percent of 4-5 per question, with `values_drop_na = TRUE`;
   - 22: who will be left without a partner, `anti_join()` before the join.
   The lesson suite now requires a task "dla chętnych" in lectures 2 and 3.

Still open, the author's call: one study through the lecture (one set of ten people
carrying every trap: no age, no rating, no men in Warszawa, a city missing from the
second table, empty answers in the battery). It would rewrite the data, the numbers
in every text, the near-misses and the lecture notes.

Verified: 16 near-misses for the new tasks, two lesson checks (extras in lecture 3,
`pivot_wider()` in the capstone), a fact for the new number, six mutations caught;
all suites (13 extra tasks solved in the built file); browser at 1280 px and 375 px.

## D65 — Exercise 23: missing data, before the report

The author agreed that lecture 3 runs missing data as a thread through every exercise
but never gathers it, and asked for an exercise on it before the report. It is
exercise 23, "Braki danych: kody i NA"; the report is 24 and lecture 4 is 25-29.

What it teaches, scene by scene, on one survey of ten people:

1. A question and a picture: the mean rating, with `na_if()` changing `ocena` in
   place (the picture now says "zmiana kolumny" for a column given new values, not
   "nowa kolumna").
2. A survey has two kinds of missing answer. `na.rm` removes NA, but the code 99 for
   "nie wiem" stays a rating, and the mean on a scale of 1-5 comes out 25.
3. `na_if(ocena, 99)` turns the code into NA; the mean is 3.86.
4. Missing counted per column before anything is removed.
5. `drop_na()` with no column removes a person for a missing age although she rated
   the course: 6 people instead of 7.
6. `replace_na()` names a gap, a row "brak danych" in the report.
7. `complete()` writes the pair nobody belonged to, men from Warszawa, with 0.

The task: per city `n` and the percent satisfied, 99 turned into NA, only people
without a rating removed. Six wrong answers are named: 99 kept, `drop_na()` without a
column, `na.rm` instead of removing (so `n` counts the empty), nothing removed, no
`n`, fractions. The task for those who want more: show who will be lost before
losing them, `filter(is.na(ocena) | ocena == 99)`; `== NA` and each half alone get
their own messages.

Engine: `na_if()` (dplyr) and `complete()` (tidyr, with `fill = list(...)`, factor
levels kept, rows in the order of the combinations, columns in their order). Six
reference cases against R (152 in all).

Numbering: references to other exercises in lesson texts are now written by id,
`{ćw:crosstab}`, and turned into numbers when the lessons load. A new exercise moved
four hand-written references ("ćwiczenie 28" would have pointed at the wrong plot
exercise). A lesson check forbids hand-written exercise numbers; the engine messages
that named "ćwiczenie 24" say "wykład 4" instead.

Not done: the lecture notes `docs/wyklad-3-analizy.md` (local, not in the repo) still
describe six exercises; their section 8 on missing data matches this one in spirit.

Verified: 152/152 reference cases, 700 lesson checks (the new exercise's facts tied
to its data, the numbering checks), a picture check; five mutations caught; all
suites; browser at 1280 px and 375 px.

## D66 — Exercise 23 read as a second-year student

The walk of D54-D63 on the new missing-data exercise. The idea came through; the
stage was silent exactly where the scenes turn, and two task messages were wrong.

- **Captions in numbers.** `drop_na()`, `complete()`, `na_if()` and `replace_na()`
  showed "X dostaje argumenty i oddaje wynik" or "działa na każdej komórce osobno".
  They now say what they did: "drop_na() bez kolumn usunął 4 wiersze z NA w dowolnej
  kolumnie. Zostało: 6." (marked as a trap) against "drop_na(ocena) usunął 3 wiersze…
  Zostało: 7."; "complete() dopisał 1 wiersz: pary, których nie było w danych.";
  "na_if() zamienił na NA 2 komórki z kodem 99."; "replace_na() wpisał "brak danych"
  w 3 komórki z NA." Everywhere these functions appear, not only here.
- **"Procent dobry" when it was not.** Keeping the empty answers with `%in% 4:5` or
  `replace_na(…, 0)` counts them as dissatisfied, so the percent is wrong too. That
  case has its own message now; "the percent is right, n is not" stays for `na.rm`,
  where it is true.
- Three answers that got "Jeszcze nie to" are named: no `group_by(miasto)`, pairs
  from `count()` instead of one row per city, and `drop_na()` before `na_if()` (the
  codes become NA after the gaps were removed).

Verified: four near-misses, four caption checks on real code, four mutations caught,
all suites, browser at 1280 px.

## D67 — Lecture 3 read whole, as a student and as an expert

Exercises 18-24 read in one pass, with about a hundred plausible answers run through
the same checks the page uses. Most alternatives were already accepted (nested
`if_else`, `%in%`, `TRUE ~`, `drop_na()` or `na.omit()` for `filter(!is.na())`,
`join_by()`, `filter(ocena != 99)`). Sixteen fixes followed.

**Messages that blamed the wrong thing.**
- 18: a right recoding followed by `count()` got "the levels are mixed up"; now
  "the table is already counted". In the extra task, `wiek == NA` gets "never TRUE,
  use `is.na()`", the scene's labels "18-29" get "the labels are exactly…", and
  overwriting `wiek` gets "the column is called `grupa`".
- 21 extra: `%in% 4:5` with the empty answers kept got "satisfied is 4 or 5"; now
  "the empty answers count as dissatisfied" (as in 23).
- 23 extra: `filter(is.na(ocena), ocena == 99)` and `&` got "`== NA` gives NA";
  now "a comma in filter() means and; or is `|`". `== c(NA, 99)` gets `%in%`-style advice.
- 24: `count(grupa)` got "group_by() is missing"; now "the percent is missing".
  `liczba = n()` gets "call it `n`". `count(miasto)` in 23 gets the same.
- 24 extra: `summarise(...) + ggplot(...)` keeps R's error, and the help below it now
  says the table goes into ggplot() with `|>`, not `+`.
- A label after `~` without quotes gets "a label is written in quotes".
- `t()` joined the unsupported list; it got "typo, there is «n»".

**Right answers that were refused.** The share from `summarise(mean(opinia ==
"dobra", na.rm = TRUE) * 100)` in 19's extra (a chip of the same exercise shows it);
an `n` beside the percent in 21's extra (the lecture's own advice; the task already
allowed it); the NA region named with `replace_na()` in 22 (its own note says so);
`geom_bar(stat = "identity")` in 24's extra (it got "geom_bar counts rows, height 1").

**The seam between 23 and 24.** Exercise 23 teaches `drop_na(ocena)`; the report
right after it removed gaps with `filter(!is.na())`. Exercise 24 now uses
`drop_na(wiek, ocena)` in its scenes, solution, hints and messages (the `filter()`
form still passes), and 23's scene 5 says `drop_na(ocena)` is `filter(!is.na(ocena))`.
23's scene 7 names its link to `values_fill` in exercise 20.

**Engine closer to RStudio.**
- `na_if(ocena, "99")` passed here and fails in dplyr 1.1 (the code is cast to the
  column's type). It is an error now, with the fix.
- `.by` in filter/mutate/summarise/slice was taken for a column. It now says it works
  in RStudio and the trainer uses `group_by()`.
- Names may hold Polish letters (`średnia <- 3`), as in R in a UTF-8 locale; the
  lexer said "Nierozpoznany znak".

**What RStudio will say and the trainer never did.** "Dalej w RStudio" lists three
more messages lecture 3's code produces: summarise's grouped output, "Joining with
`by = join_by(miasto)`", and the many-to-many warning. Exercise 22's scene 7, where
Kraków repeats in both tables, says RStudio will warn.

**Method.** 21 says a mean of a 1-5 scale is a convention (the gaps between answers
need not be equal); the share of 4-5 does not assume it.

Verified: 23 new lesson checks (near-misses, accepted variants, engine errors as in
RStudio, Polish names), two diagnosis checks, seven mutations caught, all suites;
browser at 1280 px (23's scenes 5 and 7, the comma message) and 375 px (the RStudio
page, no sideways scroll). dplyr was not run locally (the R oracle has base R only);
the dplyr 1.1 behaviour is from its documentation.

## D68 — Lecture 3 walked on the live site

A script drove the published page through `window.app`: every step of exercises
18-24 (65), every sub-expression on every scene (454 clicks), every chip (32), every
declared wrong answer through the task's own check (108), every hint, and all 14
solutions. Nothing failed: no raw keys, no script errors, every message as declared.
The defects were in what the stage said and in one corner of the layout.

**Captions read one by one.**
- One value compared or computed was "Porównanie w każdej komórce osobno" or
  "Działanie osobno w każdej komórce: 1 raz", in the scene about one person. It is
  now "Jedno porównanie, jeden wynik: TRUE." (and the same for arithmetic and `&`).
- `drop_na(wiek, ocena)` removed rows "w tej kolumnie"; with more columns it is
  "w którejś z tych kolumn".
- `pivot_wider()` with no row key said "Jeden wiersz to teraz jedno: -."; with a key,
  "Jeden wiersz to teraz jedno: grupa." Now "…a w wierszach zostaje «grupa»" and,
  without a key, "Zostaje jeden wiersz na całą tabelę."
- The group prefix gave "Grupa Gdańsk: Suma wszystkich komórek: 4" (two colons, a
  capital after one). Now "Grupa Gdańsk. Suma…".
- `list(n = 0)` in `complete(fill = …)` had the generic "list() dostaje argumenty i
  oddaje wynik"; now "list() zbiera wartości z nazwami w jedną paczkę: n = 0."
- The step picture of exercise 24 called its `drop_na()` stage `filter()` (the
  engine reports both as a row filter). The stage is named "bez braków", "To robi
  drop_na()"; the name does not pass on to the stages after it.

**A value chip nobody could reach.** The chip after a line sat past the end of the
textarea's own scroll: on a phone after any long line, and on a 1280 px screen in 16
of lecture 3's steps (a 47-character line already pushes it out). The whole box now
scrolls when the code is wider than it: the textarea and its highlight layer are as
wide as the longest line, the chips count in the box's scroll, the caret still
brings the box along when typing, and a resize fits the width again. Code that fits
is unchanged.

Verified: six caption checks on real code, four mutations caught, all suites; in the
browser at 375 px all 105 chips of lecture 3 are within the box's scroll, the caret
follows typing to both ends, nothing scrolls the page sideways; at 1280 px in both
colour schemes. An answer the check accepts by another road (exercise 19's
`summarise()`) shows no red marks against the goal.

## D69 — An empty table printed as no table

Updating the lecture 3 notes (teacher-only, `docs/wyklad-3-analizy.md`), every R
example in them was run through the engine and compared with the output the notes
print. One of the new examples, `filter(ocena == NA)`, printed "data frame with 0
columns and 0 rows". R names the columns and says `<0 rows> (or 0-length
row.names)`: the table is empty, not gone, and the column names are what tell a
student which table it is. The printer now does as R does; "0 columns" stays for a
table without columns. Two cases joined the R-oracle suite (eval 150/150), and the
old printer fails them.

The same check corrected D67: the trainer does print the many-to-many warning, in
Polish, in the console. What it leaves out are the two messages that are only
information (grouped output, the guessed `by`).

The notes now follow lecture 3 as the trainer has it: seven exercises (18-24), a
chapter on missing codes (`na_if()`, `drop_na()` with and without columns,
`replace_na()`, `complete()`), the report with `drop_na(wiek, ocena)`, `if` for one
person, two-sided intervals and the four habits of `case_when()`, one number per
city, mean versus share of 4-5, and a chapter on what RStudio will say. All 44
examples with printed output match the engine.

## D70 — Why a long table: a ranking the wide one cannot make

Students read a wide table at once and did not see why anyone makes it long. Read as
a student who knows vectors, exercise 21 showed why: three questions, and "which is
rated highest" was answered by a wide `summarise()` and the eye. The long table was a
detour.

The exercise now has a battery that needs it: trust in six institutions (sąd,
policja, sejm, media, uczelnia, samorząd), eight people, 1 to 5, and a question that
is a ranking, separately for women and men. The data make the answer differ: women
trust the Sejm least, men the media. With six columns the eye no longer ranks, and
`arrange()` on the wide summary orders the two sexes, which is the scene's point:
`arrange()` orders rows, and the institutions are not rows.

The argument is the vector mechanics students know from lecture 1. The institution
lives only in the column names; no vector stands beside the ratings and says which
institution each one is about, so nothing can filter, group or arrange by it.
(Saying "a column name is not a vector" would fail: `names()` is one. What is missing
is a vector parallel to the ratings.) `pivot_longer()` makes it; one scene then picks
the Sejm's ratings the way `ocena[plec == "K"]` picked, and the next says what the
long table adds: `group_by()` does that for every institution, nobody types a name.

The task is the ranking per sex (`arrange(plec, srednia)`); the extra task ranks the
share of 4-5. The data were tuned so every declared mistake is visible: one rating of
the police is missing, so counting the empty as distrust changes a percent (with the
gaps only in the Sejm and the media, both 0% either way, it would have passed).

Accepted by another road: men above women (whole blocks may swap, mixed sexes may
not), `group_by(instytucja, plec)`, ratings dropped while folding, n beside the mean,
and `arrange(srednia, .by_group = TRUE)`. The last one exposed an engine bug: `.by_group`
was taken for a sort key of one value and silently ignored. `arrange()` now puts the
grouping columns first when it is TRUE; two pairs against base R cover it. New
messages: the lowest only via `filter(srednia == min(srednia))` ("that answers who is
at the bottom; the task wants the whole ranking"), the sexes spread back by
`pivot_wider()`, unsorted, mixed sexes, and from the highest.

Verified: twelve near-misses in the task and seven in the extra, six accepted variants,
four mutations caught, all suites; browser at 1280 px (the wide scene's `arrange()`,
the picked vector, the five steps of the opening picture).

## D71 — Exercise 21 read again as a student

The rebuilt exercise (D70), walked as a second-year student with a dozen answers
nobody had declared.

- **The scene that should show the point did not.** `arrange(sejm)` on the wide
  summary moved nothing: women were already first. The caption said "rows
  reordered" over an unchanged table. It is `arrange(media)` now; men's lower mean
  puts them on top, and the swap of the two sexes is what the scene is about.
- Scene 4 said "you do not type the name" over code that types "sejm". It now says
  the name is typed by hand here and `group_by()` does it alone.
- `pivot_longer(-plec, ...)` folds the `id` into an institution, and got "the means
  are right". It now names the `id`.
- `median()` instead of `mean()` got "the means are right, sort them". The means are
  now checked against the data before the order is judged.
- A mean rounded to one decimal gives the same ranking and is accepted (tolerance
  0.05).
- Extra task: a mean beside the percent is accepted (the note asks for both), the
  percent under another name is named, and a long table from `count()` is told it
  needs one row per institution.

Notes and textbook text updated to `arrange(media)`. Verified: five new near-misses, two new accepted variants,
five mutations caught, all suites, every example of both documents against the
engine.

## D72 — Exercise 20 read as a student

The cross table, walked as a second-year student, with the lecture's open problem in
mind: students read wide tables and do not see what the long ones are for.

- The sandbox had no words of its own. It now says the point that exercise 21 builds
  on: counting is done on the long table, the wide one is for reading, so
  `pivot_wider()` stands at the end.
- `pivot_wider()` straight on the survey, the commonest picture of "wide" (cities
  into columns), got "no man answered in Warszawa, fill 0". What happened is that
  the ratings spread and every person stayed a row; the message says so and points
  to `count()`.
- Counts made by `group_by()` and `summarise(n = n())` are the same counts and were
  refused for not calling `count()`. Only `pivot_wider()` is required now.
- A row total beside the cities (`razem = Gdańsk + Kraków + Warszawa`) is a report's
  habit and is accepted: a column holding each row's sum is set aside.
- Extra task: `mutate()` in place of `summarise()` (people stay rows) and an `n`
  kept beside the mean (it splits the rows of the wide table) got the general
  message; both are named. `values_fn = mean`, which works in RStudio, said
  "pivot_wider() does not understand values_fn"; it now says it works there and
  the mean is a step of its own here.

Verified: three new near-misses, two accepted variants, an engine check of the
`values_fn` message, five mutations caught, all suites; browser at 1280 px.

## D73 — Exercise 22 read as a student

- **The join captions counted where they could name.** "Bez pary w prawej tabeli:
  1 wiersz z lewej… Z prawej tabeli nie wchodzi 1 wiersz" made the student find
  the row. The join event now carries the key values without a partner, and the
  captions name them, three at most: "Bez pary w prawej tabeli: Radom… Z prawej
  tabeli nie wchodzi: Poznań." Everywhere a join is drawn.
- **The right person found the wrong way passed.** The extra task asks for the
  people whose city is not in `miasta`; `filter(miasto == "Radom")`, typed after
  looking at the data, and `anti_join(uczelnie, ...)`, which misses Radom by chance,
  both passed. The answer must now come from a comparison with `miasta`: Radom by
  hand is told that with three hundred cities nobody can, the universities that
  the question is about the other table.
- Answers that got "Jeszcze nie to" are named: `count(miasto, region)` in the task
  (pairs, not regions), a mean beside `n` (one column too many), `region == NA` in
  the extra task, and `count()` after `anti_join()` (a number, not the people).

Verified: six new near-misses, the join caption tests rewritten to the named keys,
four mutations caught, all suites; browser at 1280 px (scenes 3 and 6, the
hand-picked message).

## D74 — Exercise 21: four vectors, one line

The author found D70 made the exercise harder, not clearer. It explained four things
at once: why a long table, picking from a vector (`dlugo$zaufanie[dlugo$instytucja
== "sejm"]`, which answered a question nobody asked), the price of a long table
(`n()` counts the empty ratings) and `values_drop_na`. Six institutions, missing
ratings and sixteen near-misses on top.

The intuition was simpler: one grouped vector is easier than four vectors one by
one. The exercise is now built on that alone.

- **Data.** Four institutions (`sad`, `policja`, `sejm`, `media`), 8 people, no
  missing ratings. The answer still differs by sex: women trust the Sejm least
  (1.75), men the media (2.00), and the common ranking puts the media at the bottom.
- **Scenes, 7 to 4.** The question; four lines of `mean(ankieta$...)`, one per
  vector, which students know from lecture 1; `pivot_longer()` puts every rating
  into one vector `zaufanie` with `instytucja` beside it; one `mean()` under
  `group_by(instytucja)` does all four, "and would do twenty". The row-is-a-rating
  price moved to the play line (32 rows, 8 people times 4).
- **Gone:** the vector-picking scene, the "`arrange()` on the wide summary orders
  the sexes" argument, the `count()` and `values_drop_na` scenes, and the
  `na.rm`/`n()` traps (`hasNA`, `nCountsEmpty`, `emptyAsAnswer`).
- **The task** is the last scene plus sex: `group_by(plec, instytucja)` and
  `arrange(plec, srednia)`. Fourteen near-misses. The extra task is the share of
  4-5 per institution, now without missing ratings (police 75%, media 0%).
- **Missing ratings moved to exercise 23.** A scene with a three-person battery
  and two empty ratings: an empty rating in a long table is a whole row, and
  `values_drop_na = TRUE` drops it, 4 rows of 6. Exercise 23 keeps seven scenes:
  the "count the gaps in every column" scene became a play chip (its advice is
  already the play line). `data.frame()` got its glossary line, now that a scene
  shows it.

Verified: FACTS rewritten for the new numbers, two new accepted variants (`na.rm`
out of habit, `-c(id, plec)`), four mutations caught, all suites; browser at
1280 px (four means, the 32-row fold, the ranking, the exercise 23 scene).

## D75 — A result chip fits its code line

The author saw the table thumb after `pivot_longer()` in exercise 21 drawn over
the line above it. A chip is one code line tall (24.75 px), but the table thumb
in it drew up to fourteen rows of squares, about 80 px, centred on the line. It
showed only on long tables, so 32 rows of ratings made it plain; it was there
before for every table longer than three rows. The plot thumb was 29 px.

In a chip a table now shows three rows of squares and no "⋮" (its size is written
beside it: "32 × 4"), and a plot thumb is 32 px wide instead of 44. Everywhere
else the thumbs are as they were.

Verified in the browser: every chip of every scene and play chip of the 29
exercises (339 chips) measured, none taller than its line (25 px at most).

## D76 — Lecture 4 read with the one-idea lens

Before new lectures the method was distilled into a skill (one idea per exercise,
a cost the student can count, a question that needs the tool, a trap beside its
repair, the lesson's own advice always accepted). Lecture 4 was read against it,
and 56 plausible answers went through the tasks' own checks. The lecture held up
better than exercise 21 had: one idea each, traps beside repairs. Ten changes:

**Errors.**
1. Exercise 29 refused what its own scene 4 teaches: `geom_text(aes(label =
   paste0("n = ", n)))` was told "the percent stands over the bars". The plot
   comparison for decorated answers now takes a label that holds the goal's value
   as a whole word ("n = 4" for 4, not "n = 40"); the messages tell a percent from
   any other wrong label.
2. Exercise 28: `factor(praktyka, labels = c(...))` without `levels` renames the
   alphabetical levels, so the bars stand in the right order with someone else's
   counts. It got "Jeszcze nie to"; it now gets its own message: `labels` renames,
   `levels` orders.
3. `geom_text(label = n)` said "geom_text() does not know the setting label" in the
   trainer, as if it were a limit of the trainer. It is the `fill = plec` slip: it
   now says the column belongs in `aes()`. (`n` alone finds dplyr's function, which
   counts as not found.)
4. Real ggplot2 the trainer lacks was called a typo: `scale_y_continuous()`,
   `scale_x_continuous()`, the `scale_fill_*`/`scale_colour_*` pair, `xlim()`,
   `ylim()`, `geom_label()`. They are named now; `scale_x_discrete()` points to the
   order of levels, `ggsave()` to the RStudio page.

**One idea per exercise.**
5. Exercise 25 lost its fixed-colour scene: exercise 27 has it beside the trap it
   repairs (`fill = "blue"` inside `aes()`). Exercise 25 keeps a chip with a colour.
6. Exercise 25 opens on its table being made, `liczby <- ankieta |> count(miasto)`,
   from lecture 3, and no longer says the plot shows "at a glance" what three
   numbers show as fast.
7. Exercise 26's scene with ratings on the x axis (a second idea) is a chip now.
8. Exercise 28's `coord_flip()` scene is a chip: lying bars are layout, not order.
   `fct_infreq()` and `reorder()` stay as scenes: one idea, the levels by count,
   once for raw rows and once for a counted table, as in exercise 26.
9. Exercises 26 and 27 open with a question, as the rest of the course does.

**The bridge.**
10. "Dalej w RStudio" has a fourth step, saving a plot for the report: the Plots
    pane, Export or `ggsave()` with its size given (without it the plot takes the
    window's size), and `library(ggplot2)`. The list of messages adds ggplot2's
    warning about rows removed for missing values, which the trainer shows only as
    a caption. Its wording is ggplot2 3.5's, from the documentation: ggplot2 is not
    installed here.

Verified: five engine checks, three accepted variants, three near-misses, five
mutations caught (labels compared strictly, no word boundary, the label branch
off, the relabelled branch off, `scale_x_discrete` unnamed); all suites; in the
browser the five exercises walked (every step, 222 sub-expressions selected, every
chip, 45 declared wrong answers, 5 solutions, no raw keys), every result chip
inside its line, and at 375 px no sideways scroll on any step or on the RStudio page.

## D77 — Exercise 25 read as a second-year student

Every sentence and caption read, every part clicked, 33 answers typed into the task
(13 in D76, 20 more here). The right routes all passed (`data =`, `mapping =`,
single quotes, `labs()` before the layer, `ylab()`, a colour per city, a theme, a
flip, a title of one's own). What misled were the messages for the commonest slips,
two captions and an unnamed table. Nine changes:

1. **A column in quotes**, `aes(y = "srednia")`, was told that y needs numbers and
   that `coord_flip()` lays bars down. It is now told that the quotes make text, not
   the column: `aes(y = srednia)`. A quoted x in the task gets the same advice.
2. **A layer inside `ggplot()`**, `ggplot(srednie, aes(...), geom_col())`, drew axes
   only and was told to add `geom_col()`, which the student had written. It now stops
   and says the layer stands inside the bracket and goes after it with `+`. A
   deliberate departure: ggplot2 would draw empty axes without a word.
3. **`+ geom_col` without brackets** was "not an ordinary value". It now says that
   without brackets it is the function itself.
4. **A label without quotes**, `labs(y = Średnia ocena)`, was a parse error about a
   closing bracket (one word: an object not found). Both now get "a label is
   written in quotes" with the student's line corrected, for `labs()`, `xlab()`,
   `ylab()` and `ggtitle()`.
5. **"Średnia ocena "** with a trailing space was told to mind the Polish letter.
   The label message now tells a space, a letter (`Srednia`, `średnia`) and other
   words apart.
6. **"liczby dostaje nową wartość, a stara przepada"** in scene 1, where the table is
   rebuilt with the very value it had in the hidden setup. An assignment that keeps
   the value now says so; a real replacement keeps its warning. Everywhere.
7. **"Rysuje dopiero geom"**: the word had not been introduced. Now "Rysuje dopiero
   warstwa, np. geom_col()".
8. **The task's table was never on screen** and its columns were not named. The
   prompt names them: `srednie` (kolumny `miasto` i `srednia`).
9. **A mean rounded inside `aes()`** was "Jeszcze nie to". Heights within 2% now
   pass; the counts of `liczby` still do not.

Verified: three engine checks plus one for the other branch, three diagnoses, two
near-misses, an accepted variant, three caption checks; eight mutations caught (one
first missed a branch no test reached, which then got its test); all suites; in the
browser exercise 25 walked (7 steps, 36 parts, 5 chips, 11 wrong answers, the
solution) with each new message seen on the page, and at 375 px.

## D78 — Exercise 26 read as a second-year student

Every sentence and caption read, every part clicked, 22 answers typed into the task.
The scenes held (the piled-up bar of 15 beside its repair), and the right routes
passed: `count()` with `geom_col()`, `group_by()` with `summarise()`, `count(name =)`,
`stat = "count"`, `aes()` inside the layer, colour by sex, dodge, labels, numbers on
the bars. Seven changes:

1. **A narrower bar was another answer.** `geom_bar(width = 0.5)` got "Jeszcze nie
   to", though exercise 25 shows width in a chip. The lenient comparison for plot
   tasks now matches bars by their centre, not their edges, so width is a
   decoration. The strict comparison (used where plots must be the same) still
   tells them apart.
2. **Bars split by city**, `aes(x = plec, fill = miasto)`, were told their heights
   were wrong. They are right; the bars are split by a variable the question does
   not ask about. Stacked or side by side, that is what the message says now.
3. **The person without a rating filtered out** first gave 5 and 4 and the advice
   that `geom_bar()` counts, which the student had used. It is now told that this
   person answered the survey, and the question is about sex.
4. **Shares instead of people** got the same `geom_bar()` advice; now "to udziały,
   a pytanie jest o liczbę osób".
5. **`y = ..count..` and `y = after_stat(count)`** from tutorials were "not found"
   and "check the spelling". Both are named as ggplot2's (`..count..` its old
   spelling) that work in RStudio and are not needed: `geom_bar()` counts anyway.
6. **A column one capital letter off**, `aes(x = Plec)` or `filter(Plec == "K")`,
   pointed to the memory panel, where columns do not show. The name lookup now finds
   the column under another case and says so: "W tabeli «ankieta» jest kolumna
   «plec», a nie «Plec»". Everywhere, not only in plots.
7. **A missing answer as a bar.** The chip with `factor(ocena)` drew five bars and
   said nothing about the fifth being NA, beside a chip with numbers that says the
   NA row dropped out. Its caption now says one bar is NA, a category of its own.

Found on the way: the first edit for item 1 changed both comparisons, because the
line was the same in the two; a plot check that a narrower bar is another plot
caught it.

Verified: three near-misses, two accepted variants, three diagnoses, an engine check,
two caption checks; eight mutations caught; all suites; in the browser exercise 26
walked (6 steps, 39 parts, 5 chips, 12 wrong answers, the solution, the narrower
bar) with each new message seen on the page, and at 375 px.

## D79 — Exercise 30, a plot step by step; the strip says what each step added

The author's aim: show students how a complex visualisation is built layer by layer.
A static diagram of the grammar of graphics was weighed and left out: seven planes,
two of which (scales, facets) the trainer cannot draw, and a picture drawn by hand,
not from the code on screen. Two things were missing instead. No exercise built a
plot longer than four parts. And the strip "warstwa po warstwie" above a plot
showed one card per `+`, but after the bars every card looked the same: text and
titles are not drawn at thumbnail size, and a card was named only by its function.

**The strip.** Under each card it says what the step added: "osie", "słupki obok
siebie", "napisy: n", "podpisy: title, y", "osie zamienione", "wygląd". In a
thumbnail, text is drawn as small dashes where it stands and a title as a bar at the
top, so a step that adds them looks different from the one before. Everywhere a plot
is built with `+`.

**Exercise 30, "Wykres krok po kroku"**, closes lecture 4 as "Od pytania do tabeli"
closes lecture 2. One idea: a complex plot is simple steps, one `+` each, run after
every one. No new function. The question (are women and men equally satisfied in
each city?) has an answer that differs (men in Kraków, women elsewhere) and an n
that matters (100% in Warszawa is two people). One scene per step: the table,
`aes()` with colour by sex, bars side by side, n over them, labels, a theme. The
sandbox opens with the habit, and its first chip is the trap: text over
side-by-side bars without `position_dodge()` stands between the two bars.

The task builds the same kind of plot from another table (by age group). Twelve
wrong answers are named, among them bars stacked, no colour by sex, n as the height,
text not dodged, text drawn before the bars. Decorations pass (a theme, a colour).
The exercise has no task "dla chętnych", like the rest of lecture 4.

Verified: two facts, twelve near-misses, a picture check of the strip (the words
under five cards; dashes and a title bar in the thumbnails); five mutations caught;
all suites (30 exercises); in the browser the exercise walked (8 steps, 81 parts,
5 chips, 12 wrong answers, the solution, with a theme added), and at 375 px every
step of lecture 4 with its plot selected: no sideways scroll, the strip wraps inside
its column, every result chip within its line.

## D80 — Lecture 4 walked whole: as a student, as an expert, every button

Exercises 25-30 walked in the built file: every sentence and caption read, the plots
compared with what ggplot2 draws, plausible answers typed into the tasks, a sandbox
of beginner plot code, and every button of every step pressed. Done on the local
build, the same file the site will serve: D78 and D79 were not yet published.

**Captions that said the wrong thing where a scene turns.**
- `fct_infreq()`, `reorder()`, `fct_rev()`, `fct_relevel()`, `fct_inorder()` said
  "works on each cell". They change no value, only the order of levels, and now say
  so with the levels: "Poziomy od najczęstszego: Kraków (4), Gdańsk (3), Warszawa (3)".
  `fct_infreq()` is the key of exercise 28's third scene.
- `paste0()` (exercise 29's fourth scene) said only "takes arguments and returns a
  result"; now "skleja kawałki… „n = 5”, „n = 3”". `geom_text()` with an expression
  as its label no longer calls the expression a column.
- `position_dodge(0.9)`, the part exercise 30's fourth scene points at, said it is
  "added to the plot with +". It is an argument of the layer; the caption says what
  it does.
- Groups stacked in one bar were "5 bars" over three bars on screen. Now three bars
  in five parts; for ready numbers, that they are added up, with the top of the
  highest (percentages stacked give 140, a sum that means nothing).
- A fixed colour in a layer and `theme(legend.position = ...)` say what they did.

**Closer to ggplot2.**
- `geom_text(position = "dodge")` spread the labels and passed. Text has no width,
  so ggplot2 warns "Width not defined" and leaves them in the middle; the trainer now
  does the same and the caption says to write `position_dodge(0.9)`. From ggplot2's
  documented behaviour; ggplot2 is not installed here.
- Ratings on a number axis had ticks at 2.5, 3.5 and 4.5. Whole-number data now gets
  whole-number ticks, where ggplot2's own breaks fall for these data.
- `element_text()` and the other theme elements were "check the spelling"; they are
  named as ggplot2's, with what `theme()` does here.

**Exercise 30.** Its step numbers ran one behind its dots ("Krok 3" on dot 4); the
first scene is now step 1, the table. A dodge of another width than the bars, sex
and age swapped between x and colour, and the scenes' table instead of the task's
each get their own message.

**Layout.** On a phone the strip of steps wraps, and an arrow could stay at the end
of a row with its card on the next. An arrow and its card now wrap as one, in the
plot strip and the pipe strip alike.

**What held.** Every dot, "Dalej", "Wstecz", the R-order stepper, "Ściąga", hints,
"Pokaż rozwiązanie" and "Wstaw do kodu", "Sprawdź", "Następne ćwiczenie" through all
six exercises, exercise 30 leading to "Dalej w RStudio", the menu of lecture 4 and
the report lines 25-30; no console error; light and dark; 375 px. The expert reading
found the plots as ggplot2 draws them: "count" on the axis, 5% expansion, the first
level on top of a stack, a lone dodged bar at full width, ties kept in the levels'
order by `fct_infreq()` and `reorder()`, 0-1 breaks for shares.

Left as it is: narrower bars dodged with a matching `position_dodge()` for the text
(`width = 0.7` and `position_dodge(0.7)`) draw the right plot and are refused in
exercise 30, because the comparison places dodged bars by their centre. Rare; open.

Verified: eleven caption checks, two plot checks, an engine check, four near-misses;
eleven mutations caught (one first survived, the arrow pairing, and got its check);
all suites; the browser walk above.

## D81 — Exercise 29: which plot for which question; four more kinds of plot

The author's concern: lecture 4 showed everything as bars, and other plots seemed to
be left out. The questions a sociologist asks most often are about a distribution,
groups compared, two numbers together, and change in time. A new exercise after the
order of bars, before the report: "Jaki wykres do jakiego pytania?". Facets follow as
their own short exercise (next).

**One idea:** the kind of plot follows from the question and from what the variables
are. One scene per question and geom, with labels and a colour only: bars recalled
("how many in each category"), a histogram of age, boxes of hours online by sex,
points of age against hours, lines of trust in the Sejm over ten years for two age
groups, then `labs()` on the lines. The data carry each point: ages crowd at the
young end, a woman with 10 hours a day stands beyond the whiskers, hours fall with
age, the two groups' lines move apart and back. The task names a question, not a
geom: compare the age of women and men by median, middle half and who stands out.
A histogram, points and bars of a mean each get a message saying why not.

**The engine** gained `geom_histogram()`, `geom_boxplot()`, `geom_point()` and
`geom_line()`:
- bins as ggplot2 makes them: with `binwidth`, centred on its multiples, closed on
  the right (the lowest also on the left); without it, 30 bins with the first centred
  on the smallest value and a caption saying what RStudio will say;
- boxes from quartiles of type 7, whiskers to the furthest value within 1.5 box
  heights, the rest drawn as outliers and kept inside the axis;
- points and lines coloured by `colour` with a legend titled by `labs(colour = )`;
  bars and boxes keep `fill`. `binwidth` and `bins` belong to the histogram only.
Each has its picture, its step table ("policzone przez geom_histogram()", median and
middle half for boxes), its caption with the numbers, and its word under a card of
the strip. Eleven paired cases check bins, quartiles, whiskers and points against
base R (`cut()`, `quantile()`); ggplot2 itself is not installed here.

Found on the way: the box rectangle was first given the class `gp-box`, already the
plot container's, whose CSS width stretched it. The headless suites cannot see CSS;
the browser showed it. The class is `gp-bp-box`. A histogram in ggplot2's own grey
bins with no outline reads as one block, so the scene adds `colour = "white"`.

Verified: four facts, nine near-misses, a check that points, boxes and lines are each
drawn as computed, eleven paired cases (80 in all); six engine and lesson mutations
caught; all suites; in the browser exercise 29 walked (8 steps, 50 parts, 5 chips,
9 wrong answers, the solution and a decorated one) and at 375 px.

## D82 — Exercise 30, panels: facet_wrap()

The author asked for facets as a short exercise of its own: important in practice.
It stands after the kinds of plot (29) and before the report (31).

**One idea:** the same plot drawn separately for each group, on shared axes. Colour
already tells groups apart on one plot; with two groups that is enough (scene 1),
`facet_wrap(~ plec)` draws the same points per sex (scene 2), three cities in colour
would mix and panels keep them apart (scene 3, histograms of age), and `ncol = 1`
stacks the panels so age is compared along one axis (scene 4). The survey is
exercise 29's twenty people with a city. The task: how hours online depend on age in
each city, one panel per city. One plot for all, colour instead of panels, panels by
sex, a histogram per city and `facet_wrap(miasto)` without `~` each get their message.

**The engine.** `facet_wrap(~ var)`, also `vars(var)` and `"var"`, with `ncol` and
`nrow`. The plot is built once on all rows and once per panel on its own rows; panels
share the y axis and a numeric x axis (the union of their spans), category levels
come from all the data, and a histogram takes its bins from all rows so they line up
across panels. The grid follows ggplot2's `wrap_dims()` (up to three panels in one
row). `layer_data()` gives the marks panel by panel with a `PANEL` column. Two
faceted plots are alike when their panels are, panel by panel; a faceted plot and a
plain one are not. A bare name without `~` is told to add it. `facet_grid()` stays
named as ggplot2's and not here.

**The picture.** One SVG with a panel per group at the compact size, each headed by a
strip with its group, the title once above, the legend once beside the last panel.
The caption counts what each panel holds ("Gdańsk (5), Kraków (10), Warszawa (5)").
The strip of steps says "panele: miasto". A plot of panels one under another is a
tall thumbnail; in a code chip its height is kept to the line.

Verified: seven near-misses, four paired cases against base R (84 in all), a check
that every panel's marks are drawn; four mutations caught; all suites; in the browser
exercise 30 walked (6 steps, 41 parts, 4 chips, 7 wrong answers, the solution and a
decorated one), and at 375 px with every result chip inside its line.

## D83 — Plot settings say what they do

The author's request: explain special arguments such as `vjust = -0.5`. Clicking the
value of a ggplot2 setting now explains that setting with its own value instead of
"minus changes the sign": `vjust`, `hjust`, `width` (bars and boxes), `binwidth`,
`bins`, `alpha`, `fill` and `colour` outside `aes()`, `size`, `linewidth`,
`position`, `ncol`, `nrow`, the width in `position_dodge(0.9)`, the arguments of
`labs()` (with `x = NULL`: the label disappears) and `legend.position`. `-0.5` is
reached from its `0.5` too. So that vjust is seen without a click, the caption of a
`geom_text()` layer adds where vjust put the text ("podnosi napisy nad słupki").
A number that is not a plot setting keeps its own caption.

Verified: eleven caption checks, two mutations caught, all suites. Not yet walked in
the browser.

## D84 — What aes() is for

The author asked for a fuller explanation of `aes()`: why it exists and what logic
stands behind it. It had one sentence ("which column where") and the trap of
`fill = "blue"`; the rule that joins that trap and `geom_bar(fill = plec)` was never
said, and the Polish "estetyka" reads as prettiness.

The idea, said where `aes()` first appears and nowhere as a new scene: **aes() is an
assignment, a column to a feature of the plot.** Each row of the table becomes a
mark, and the mapped columns decide where it stands, how tall it is and its colour.
Whatever is in `aes()` changes from row to row and gives groups and a legend;
whatever is outside it is one value for all.

- Exercise 25, scene 2 says it: "aes() przypisuje kolumny do cech wykresu: miasto → x,
  n → y". The caption of `aes()` reads as the assignment ("miasto → x, n → y. Każdy
  wiersz tabeli bierze z tych kolumn swoje cechy na wykresie").
- The picture of `aes()` is headed "kolumna z tabeli → cecha wykresu, wiersz po
  wierszu", and each feature is named in plain words ("miejsce w poziomie",
  "wysokość", "kolor wypełnienia: grupy i legenda").
- "Ściąga" has a card "aes(): przypisanie", found wherever `aes()` is written: the
  column and the feature labelled in the student's own code, "to nie upiększanie,
  tylko przypisanie", and as good practice the rule in and out of `aes()`.
- Exercise 27's scene on a fixed colour rests on the same rule: "Poza aes() jedna
  wartość dla wszystkich: stały kolor, bez grup i bez legendy."

Verified: the aes picture check and the glossary budgets; two mutations caught (the
card not found, the picture without its header); all suites; browser at 1280 px.

## D85 — Exercise 29 read as a second-year student

Every caption read, 16 answers typed into the task. The right routes passed
(positional `aes()`, `ylab()`, colour by sex, a fixed fill, `coord_flip()`, points over
the boxes, a title). Nine things misled:

1. Histograms split by sex (`fill = plec` or panels) were told a histogram shows one
   number for everyone. Now: they show the distribution, but the median and the
   middle half must be guessed; boxes give them directly.
2. `aes(x = "plec")` was told the boxes were of another number; it is the quotes, one
   box for all. It gets the quoted-column message of exercises 25 and 26.
3. One box without `x` was "geom_boxplot() needs x". It works in RStudio; the message
   says so and that here a box compares groups.
4. Boxes with the axes swapped were told about "lying bars"; now "lying boxes".
5. `geom_violin()` was "check the spelling"; it is named as ggplot2's.
6. A bin "17.5–22.5" of whole ages reads "czyli 18–22".
7. The box caption says what the whiskers are before it counts what is beyond them.
8. The line caption's grammar ("od najmniejszego rok") reads "w kolejności «rok», od
   najmniejszej wartości do największej".
9. `colour = "white"` on bars says it outlines them, so neighbouring bins do not merge.

Verified: four near-misses, four caption checks, two mutations caught, all suites.

## D86 — The third fill

The author's idea for exercise 27: `fill` stands in three places of the code and means
three different things. In `aes()` it names a column that makes groups and a legend;
in a layer (`geom_bar(fill = "steelblue")`) it is one colour for all; in
`scale_fill_manual(values = ...)` it picks the colours the groups get. A sixth scene
shows the third, after the scene on the fixed colour: "Trzecie fill:
scale_fill_manual() wybiera kolory grup. Grupy z aes() i legenda zostają."

**The engine** gained `scale_fill_manual()` and `scale_colour_manual()` (and
`scale_color_manual()`): `values` by name (`K = "tomato"`) or in the order of the
levels. Too few colours stop at the `+` with the counts, as ggplot2 stops (it does so
at printing). The caption names each group's colour; the strip says "kolory grup";
clicking `values` explains it. A plot with chosen colours passes the task as a
decoration.

Verified: an engine check for too few colours, an accepted variant, a caption check,
all suites. Found on the way: the first version checked the count while drawing, so a
task check would have thrown; the check moved to the `+`.

## D87 — The fourth fill: a fixed colour over groups

The author asked what happens when the colour is changed on the shape
(`geom_bar(fill = "steelblue")`) of a plot already coloured by `aes(fill = plec)`.
As in ggplot2, the fixed colour covers the mapped one: the groups stay (the bars
still stand side by side), but all in one colour and without a legend, so nobody can
tell which bar is which. The caption said only "a fixed colour, no legend".

- The caption now says the fixed colour covers the colours of `aes(fill = plec)`, the
  groups stayed and cannot be told apart, and that `scale_fill_manual()` chooses the
  colours of groups. It is marked as a trap.
- Exercise 27's sandbox has a chip with exactly this code.
- Such an answer passed the task: the comparison of decorated plots looked at groups
  and heights only. Where the goal is coloured by a column, a fixed colour in the
  answer's layer is no longer a decoration, in every plot task; exercise 27 names it.

So exercise 27 shows `fill` four ways: a column in `aes()`, one colour for all, the
colours of the groups, and a fixed colour that hides the groups.

Verified: a near-miss, a caption check, one mutation caught (the refusal off lets the
near-miss pass), all suites.

## D88 — colour or fill on a line

The author wanted exercise 29's line scene to show why it is `colour = grupa` that
colours the lines. A line or a point has no inside to fill. In ggplot2 `fill = grupa`
on a line still splits it into groups (two lines), but both are drawn in the one ink colour and there
is no legend: the same trap as a fixed colour over groups (D87). The trainer coloured
the lines by `fill` as if it were `colour`, which taught the wrong thing.

- The engine: on points and lines only `colour` paints and gives a legend; `fill`
  (or `group`) only makes the groups.
- Scene 5 says: "Linia nie ma wnętrza: kolor daje colour."
- A sandbox chip draws the same lines with `fill = grupa`, and its caption says the
  lines were split but have nothing to fill: both in one colour (the theme ink, so "black" would be wrong in the dark theme), no legend; colour gives the
  colour. It is marked as a trap.

As elsewhere in lecture 4, ggplot2's behaviour is taken from its documentation; it is
not installed here. Verified: an engine check (fill: two groups, one colour, no
legend; colour: two colours and a legend), a caption check, one mutation caught, all
suites.

## D89 — A lab in RStudio, published beside the trainer

The author asked for one test lab where students leave the trainer and work in real
RStudio: ten research questions of rising difficulty on live data, covering all four
lectures, with everything they need downloadable from the trainer's site.

- **Data.** European Social Survey, Poland, rounds 1-11 (2002-2023), 19 131 people.
  ESS data are CC BY-NC-SA 4.0. ESS asks for a correct citation, a note that the data
  are free on its portal, and no suggestion of being linked to ESS ERIC; it recommends
  linking to the portal rather than hosting files. The site hosts a trimmed copy
  (`lab/ess_polska.sav`: Poland only, 18 of 2 747 variables, values and labels
  unchanged, 437 KB) with the "Adapted from" citation, editions, DOIs and the portal
  link, because a registration step would stop a lab. The full download stays local
  in `lab/data/` (gitignored).
- **Page.** `lab/index.html` (Polish, light and dark, phone width): the three
  downloads, setup in RStudio, three things the trainer did not show (`read_sav()`
  and labelled numbers, short variable names, ESS missing codes already NA), the
  variable table, ten questions (1-7 in class, 8-10 at home) each naming the trainer
  exercise that helps, an optional task on weights, the data source.
- **Starter script** `lab/lab.R`; the key with expected numbers and the plan stay
  local (`lab/lab-klucz.R`, `lab/PLAN.md`, in `.git/info/exclude`): the repo is public.
- **Trainer.** The menu has "Laboratorium 1 w RStudio" under "Dalej", a link that opens
  `lab/` in a new tab. The Pages workflow copies the four lab files to `_site/lab/`.

Verified: the key runs end to end on the trimmed file with the same numbers as on the
full download; the trimmed file reads identically to the original after
`read_sav()`; all suites green; a local copy of the site built like the workflow
serves every lab link (200) and the downloaded data reads in R; the page has no
horizontal scroll at 375 px in the dark theme; the menu link resolves to `lab/`.
Not verified: the questions with real students, and whether 1-7 fit 90 minutes.

## D90 — The lab read as a second-year student

The lab page was read whole and about thirty plausible answers were run in real R on
the published data: the key's routes, other right ones (`as_factor()`, `if_else()`,
`starts_with("trst")`, `cut()`, a mean of a logical), and the usual slips. Every
question has a working route from the trainer. Eleven places would trip a student or
give "other" numbers; all were changed.

- The introduction no longer gives question 1's answer (19 131 people).
- Question 4 asks how many in each group *answered* (672 and 749), not how many there
  are (675 and 767); the key accepts both and points to exercise 16.
- Question 5 counts people who gave their age and answered; its hint says that a last
  group given by `.default` or `TRUE ~ "60+"` takes the 28 people without an age (511
  instead of 483 in 60+), and asks to check the group sizes.
- Question 6: the key records the expected answer "no group stands out" (7.16-7.65).
- Question 8 asks how many people were asked in the two voivodeships and whether that
  is enough to speak of a change (podlaskie 45 and 44, warmińsko-mazurskie 59 and 33).
  The key accepts a mean of region means too (mazowieckie +0.10 instead of +0.12).
- Question 10's hint says the age groups exist only in `ess23` and gives the year as
  `if_else(essround == 11, 2023, 2000 + 2 * essround)` (`2000 + 2 * essround` alone
  gives 2022 for round 11).
- Setup: check and install the packages before class; save the script as
  `lab_Nazwisko.R` and hand that in. The starter script names the page instead of a
  file that no longer exists.

Verified: the key runs end to end; the `if_else()` years equal the key's table; the
page has no element past 375 px. Left as is: `read.csv()` on R older than 4.2 under
Windows may garble the Polish names in `regiony.csv` (the join by code still works).

A run as a student on the files downloaded from the live site (same session) found two
more. The DOIs in "Źródło danych" lacked the version suffix and all eleven returned 404;
they now carry it (`10.21338/ess1e06_7` and so on, matching the editions) and are links.
The trainer's RStudio module teaches `read.csv2()` for a Polish Excel file, but
`regiony.csv` uses commas, so `read.csv2()` reads one glued column and the join fails;
question 8's hint now names `read.csv()`. Checked as well: the downloaded `.sav` equals
the ESS original in all 18 columns and their value labels, with no duplicate
(`essround`, `idno`); every region code of rounds 9 and 11 is in `regiony.csv`; the
starter script and the key run on the downloaded files; every exercise number in the
hints names the matching lesson.

A full solve as a student, from the page text alone and only with what the trainer
teaches, found four more (same session).
- Question 7 gave a silently wrong answer. The trainer selects a battery as a range
  (`sad:media`), and the page's table lists `trstprl` first and `trstun` last, but the
  file stored the columns in another order, so `trstprl:trstun` took 3 institutions of
  7 and put the UN first (4.89) instead of the police (5.26). The columns of
  `ess_polska.sav` now follow the table (essround, idno, cntry, gndr, agea, the seven
  trust items, stflife, netustm, region, anweight, pspwght, dweight). It is rewritten
  with `compress = "zsav"` as before (419 KB) and still equals the ESS original in every
  value and label.
- Question 9's box plot showed a fifth group, NA (28 people without an age); the hint
  now says to drop them.
- Question 8: counting people with `count()` gives everyone asked (46 and 44, 62 and
  33); the key accepts that next to those who answered the Sejm item.
- dplyr 1.2 prints a five-line "`summarise()` has regrouped the output" message after a
  two-group `summarise()`, which the trainer never shows. "Trzy rzeczy" became "Cztery
  rzeczy" with one line: a message is not an error; an error starts with "Error".

A second full solve, from the site's front door (trainer, menu, lab page, downloads) in
a replica built as CI builds it, answered all ten questions and the weights task with
the key's numbers, and found three more.
- Question 5's hint asked to check the group sizes, but with `.default` the four groups
  look normal (no NA row), so the check hid the trap. It now gives
  `sum(is.na(ess23$agea))` (28): that many people cannot land in any group.
- Question 9 asks what "Removed 385 rows" means and the key had no answer. Of the 385,
  372 do not use the internet (code 6666, "Not applicable", never asked) and 13
  refused, did not know or gave no answer. Students see only NA, so "385 without an
  answer" is accepted; the key adds that the plot mostly loses older people without
  the internet, so the real age gap is wider.
- "Komunikat to nie błąd" also names the "Conflicts" block with red crosses that
  `library(tidyverse)` prints.
Left to the author: the lab is the last item of the menu, after 32 exercises, so Moodle
should link `/lab/` directly.

Hosting the ESS extract, settled with the author (2026-10-29). The site is a free
course site for one student group, so the use is non-commercial. CC BY-NC-SA 4.0
allows sharing an adapted extract on four conditions, all met on the page:
attribution (citation with editions and DOIs), non-commercial use, the same licence
named for the extract, and a note of the changes. ESS's own asks (data free on the
portal, no link to ESS ERIC) are there too. Its advice to link rather than host is a
recommendation, not a licence term. The site and repository are public, which the
licence allows. Decision: `lab/ess_polska.sav` stays on the site.
