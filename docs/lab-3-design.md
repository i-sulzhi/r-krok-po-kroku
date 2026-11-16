# Lab 3: RMarkdown, the model as a report (plan)

Syllabus topic 3 (RMarkdown). Status: plan, 2026-11-16. Nothing built yet.

## 1. Place and goal

Lab 3 follows lab 2 (caret, D114, D121), as decided in `docs/lecture-6-design.md`,
section 9, item 6: "lab 2's script becomes a `.Rmd` report". Lab 2 ends with question
10, "trzy zdania do raportu", written as comments in an `.R` file. Lab 3 turns the same
analysis into a report a reader can open: text, numbers and one plot in one HTML file,
rebuilt from the data by one click (Knit).

The one idea, said on the page and repeated in the questions: **a number in a report
comes from code, not from the keyboard.** Exercise 41 already says it for one sentence;
here the whole report obeys it, and the student sees why when a changed seed rewrites
every number by itself (question 7).

No new statistics. Everything the report says the student computed in lab 2, so the
whole lab is about the form: a reproducible document.

Like lab 2, it is homework from start to finish (assumed; section 11, question 1).

## 2. Input and output

- **In:** the page `lab/lab3.html`, a starter `lab/lab3.Rmd` (YAML header, section
  headings, empty chunks, comments saying what goes where) and the data file
  `ess_polska.sav` from labs 1 and 2. The student's own `lab2_Nazwisko.R` is the
  source to copy code from; a student who did not finish lab 2 can still do lab 3,
  because every question names the code it needs.
- **Out, handed in on Moodle:** `lab3_Nazwisko.Rmd` and the knitted
  `lab3_Nazwisko.html`. The `.Rmd` shows the work; the HTML shows it knits. A report
  that does not knit is not a report (said on the page).

## 3. What the student learns

Five things, each met in a question and each named on the page:

1. **An `.Rmd` file has three kinds of content.** The YAML header between `---` lines
   (title, author, date, output), text with a few Markdown marks (`#` heading, `**bold**`,
   `-` list) and code chunks between ```` ```{r} ```` and ```` ``` ````.
2. **Knit runs the file from scratch, in a fresh R session.** Objects made in the console
   do not exist there; the working directory is the folder of the `.Rmd`. This is the
   trap behind most failed knits (section 6).
3. **Inline code**: `` `r nrow(net)` `` in a sentence puts the number in the text. With
   `round()` it prints as a reader expects.
4. **Chunk options decide what the reader sees.** `echo = FALSE` hides code and keeps the
   result; `include = FALSE` runs and hides both (setup); `message = FALSE` silences
   package messages such as caret's "Ładowanie wymaganego pakietu".
5. **A plot is a chunk.** ggplot2 from lecture 4 and exercise 42 draws the points; the
   page gives `geom_smooth(method = "lm")` for the line; `fig.cap` gives it a caption.

## 4. The report the student writes

Five sections, the shape of a short research note. The starter has the headings; every
number in the text is inline code.

| Section | Content | From lab 2 |
|---|---|---|
| Pytanie | One sentence: how well does age predict daily minutes online for a new person? | intro |
| Dane | ESS round 11, Poland; n after removing missing values, inline | Q1 |
| Metoda | 80/20 split, linear model, 5-fold cross-validation, seed 2026; one paragraph | Q2, Q3 |
| Wyniki | A table of models by error (mean only, line, curve, knn) with `knitr::kable()`; the plot of the points with the line; the forecast for a 35-year-old | Q3-Q7, Q10 |
| Wnioski | Three sentences: the chosen model, its error in minutes and the method, what it cannot do | Q10 |

Code is hidden in the report (`echo = FALSE` in the setup chunk), as in a report for a
reader; the `.Rmd` shows it to the teacher. Classification (lab 2, Q9) and more
variables (Q8) stay out: one model, told well.

## 5. Questions

Eight questions, in order; each builds on the previous one and ends with a Knit. The
first knit comes in question 1, so installation problems surface before any work.

1. **Pierwszy raport.** Open `lab3.Rmd`, save it as `lab3_Nazwisko.Rmd`, press Knit.
   An HTML page with the headings opens. (Checks that rmarkdown is installed.)
2. **Nagłówek.** Fill the YAML: title, own name as author, date. Knit; where did each
   field go?
3. **Przygotowanie.** The setup chunk: `library()` lines, `read_sav()`, and
   `knitr::opts_chunk$set(echo = FALSE, message = FALSE)`, with `include = FALSE`.
   Knit; why is nothing from this chunk on the page?
4. **Dane.** The chunk making `net` (lab 2, Q1); a sentence with `` `r nrow(net)` ``
   people. Knit and compare with the number from lab 2.
5. **Model i tabela.** The split, the line with cross-validation, the mean-only error and
   the curve; a `data.frame` of models and their errors, printed with `knitr::kable()`
   and rounded to whole minutes.
6. **Wykres.** Points of `uczace` and the model line with `geom_smooth(method = "lm")`,
   axis labels in Polish, a caption in `fig.cap`. Many points overlap: `alpha` helps
   (named in the hint).
7. **Wnioski z liczbami z kodu.** Three sentences with inline numbers: the error, the
   method, the forecast for a 35-year-old. Then change `set.seed(2026)` to another number
   and knit again: which numbers in the text changed, and why did nobody have to retype
   them? Put the seed back.
8. **Oddanie.** Knit once more from a freshly restarted R (*Session → Restart R*), check
   the HTML top to bottom, hand in both files.

## 6. Traps and their messages

The page names each trap with the message the student will see. The exact wording
(Polish locale RStudio, current rmarkdown) must be copied from real knits during
verification, not guessed; the list below is what to provoke.

| Trap | What happens | Repair named on the page |
|---|---|---|
| Object made in the console only | Knit stops: `object 'net' not found`, with "Quitting from lines …" | Every object is made in a chunk above its use |
| `library()` run in the console only | `could not find function "train"` | `library()` lines in the setup chunk |
| Data in another folder | `'ess_polska.sav' does not exist` | `.Rmd` and `.sav` in one folder; knit uses the `.Rmd`'s folder |
| `setwd()` with a full path copied from lab 2 | Knits on the student's computer only | No `setwd()` in a report |
| caret's messages and `train()` printout in the HTML | A report full of console text | `message = FALSE`; print only what the reader needs |
| Inline number unrounded | "myli się o 94.26381 minut" | `round(x)` inside `` `r ` `` |
| A chunk error | Knit stops with the line numbers of the chunk | Run the chunk alone first (green arrow), then knit |
| `install.packages()` left in the file | Knit reinstalls or fails | Install in the console, never in the report |
| Inline code inside an HTML comment | Knit runs it anyway and may fail | Write no inline code in comments |

## 7. At the lecture

Lab 3 is homework, so the lecture is the only time students see Knit next to the
teacher, including Knit failing. It shows **why** and **how it breaks**, not Markdown
syntax (that is a cheat sheet on the lab page). About 25 minutes, live in RStudio, no
slides.

The demo files are in `docs/rmd-demo/`: `raport-demo.Rmd` is the starting state with the
steps as HTML comments, `raport-demo-gotowy.Rmd` the finished report (the fallback if
the live edits go wrong). Both need `ess_polska.sav` in the same folder and the packages
haven, ggplot2 and rmarkdown. They use `lm()` and a hand-made split, as exercises 43-44
do, not caret: fewer packages, a faster knit on a lecture computer.

| Step | Minutes | What happens | What students take away |
|---|---|---|---|
| 1. Anatomy | 5 | Open `raport-demo.Rmd`: the header between `---`, text, chunks. Knit. Show where each part went in the HTML; the date comes from code. | An `.Rmd` is text plus code, and Knit turns it into a page |
| 2. The problem | 4 | Type the number from the `rmse` printout into the blank in Wnioski. Knit. Change `set.seed(2026)` to another number, Knit again: the printout changed, the sentence did not. | A number typed by hand goes stale, and nobody notices |
| 3. Inline code | 5 | Replace the typed number with `` `r round(rmse)` ``. Knit; change the seed again; Knit. The sentence follows. Put 2026 back. | A number in a report comes from code |
| 4. The clean room | 5 | In the console: `srednia <- 180`. In Wnioski: a sentence with `` `r srednia` ``. Knit fails: `object 'srednia' not found`, "Quitting from lines". Read the message aloud. Repair: make `srednia` in a chunk (`mean(net$netustm)`). | Knit sees only what the file makes; read the message, find the line |
| 5. For the reader | 4 | In the setup chunk `echo = FALSE, message = FALSE`. Knit: the code and the `geom_smooth()` message disappear, the text, table and plot stay. | A report is for a reader; the `.Rmd` keeps the code |
| Bridge | 2 | "Lab 3 is this, with your model from lab 2." Show the lab page. | |

Steps 3 and 4 are the core; if time runs short, shorten 1 and 5, never these.

**Preparation.**
- Knit both files on the lecture computer before the lecture (rmarkdown installed,
  pandoc found, the `.sav` next to the files). Keep screenshots of both HTML pages in
  case Knit fails in the room.
- Start from a restarted R, so the console holds nothing the demo did not make.
- **Do not write inline code inside an HTML comment**: knitr runs it there too. The step
  notes in `raport-demo.Rmd` therefore say "r round(rmse) w odwrotnych apostrofach"
  instead of writing it. (Found while writing the demo: a `` `r srednia` `` in a comment
  would break the very first Knit.)

**Not shown:** Markdown syntax beyond `#`, `**` and `-`; PDF and LaTeX; themes;
parameters; bookdown; Quarto beyond one sentence that it works the same way.

**Optional, later: an "anatomy" page in the trainer.** The real `raport-demo-gotowy.Rmd`
on the left and its real knitted HTML on the right; a click on a part (header, a chunk
with `echo = FALSE`, inline code) lights up what it became. Not a simulated Knit, a
marked-up reading of one real document, in the spirit of the interactive intro before
exercise 42. About a day of work, and it needs a real knit (Mac or WSL). Build it only
if students mix up what goes where after the lecture.

## 8. The trainer's part

None, as decided: RMarkdown is real RStudio work, and a simulated Knit would teach a
fiction (`docs/curriculum.md`, the out-of-scope row). The trainer gets only:

- the menu link "Laboratorium 3 w RStudio" after lab 2 (`menu.lab3`);
- one sentence in the note of exercise 41, which already teaches the sentence for a
  report: in lab 3 the numbers in that sentence come from code (optional; section 11).

## 9. Files

| File | Public | Content |
|---|---|---|
| `lab/lab3.html` | yes | the page, lab 2's look (light and dark, phone width) |
| `lab/lab3.Rmd` | yes | the starter: YAML, five headings, empty chunks with comments |
| `lab/ess_polska.sav` | yes | already hosted |
| `lab/lab3-klucz.Rmd`, `lab/lab3-klucz.html` | no, `.git/info/exclude` | the solved report and its knit |
| `lab/PLAN3.md` | no | the key's numbers and the provoked messages |

`build.mjs` adds `lab3.html` and `lab3.Rmd` to `LAB_FILES`; the Pages workflow copies
them. An `.Rmd` must download, not open as text: check its MIME type on GitHub Pages and
use `download` on the link, as for `lab2.R`.

## 10. Verification

- **Where.** On this PC R has no knitr, rmarkdown or pandoc, and Smart App Control
  blocks R packages with compiled code since 2026-11-13 (xfun, yaml and htmltools have
  some; so do caret's dependencies). The key is knitted and the traps provoked **on the
  Mac**, in RStudio, with a Polish locale for the messages. The page and the starter can
  be written here.
- **The key.** `lab3-klucz.Rmd` knits from a restarted R; its numbers equal lab 2's key
  (n, the errors, the forecast for a 35-year-old). This also settles the open Q10 line
  of lab 2's key (259.63, computed by hand).
- **As a student.** Solve from the page and the starter only, in order; provoke every
  trap of section 6 and copy each message as RStudio prints it.
- **The page.** Phone width with no horizontal scroll, both themes, links and downloads
  live after deploy, `.Rmd` downloads rather than opens.
- **Suites.** `node test/run-all.mjs` (the bundle test knows the menu links); build.

## 11. Open questions for the author

1. **Homework or class?** Assumed homework from start to finish, like lab 2 (D121).
2. **R Markdown or Quarto?** The syllabus says RMarkdown and the course name uses it;
   new RStudio offers Quarto first. Recommended: R Markdown (`.Rmd`), with one line on
   the page that Quarto (`.qmd`) works the same way.
3. **caret in the report, or `lm()` only?** With caret the report reuses lab 2 as it is.
   With `lm()` and a hand-made split the lab depends on fewer packages, at the cost of
   redoing the error by hand. Recommended: caret, since lab 2 already installed it.
4. **HTML only?** Recommended yes. Word works without extra software; PDF needs LaTeX
   (tinytex), a long install that would dominate the lab.
5. **The sentence in exercise 41's note** pointing to lab 3: add or not?
6. **Grading.** What counts: the knit HTML, the numbers from code, the three sentences?
   A short checklist on the page would tell the student what is checked.

## 12. Order of work

1. The author answers section 11.
2. On the Mac (or WSL): knit both demo files of section 7 and the key `lab3-klucz.Rmd`;
   provoke the traps, record the messages in `lab/PLAN3.md` (local).
3. The starter `lab/lab3.Rmd` and the page `lab/lab3.html` (Polish, full sentences,
   few colons; lab 2's structure: Jak pracować, Gdy utkniesz, Pobierz pliki, Pięć
   rzeczy, Pytania, Źródło danych).
4. Menu link, `LAB_FILES`, README and curriculum rows, decision entry.
5. Solve as a student from the page; fix what confuses.
6. Suites, build, push after "Отправляй", check live, handoff row.
