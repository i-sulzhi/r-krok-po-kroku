# Lecture 7 design: from a web page to a clean table (rvest + stringr)

Status: agreed with the author, 2026-11-23 (section 12); being built. Every number below was
computed on real pages with R 4.5.2 in WSL (rvest 1.0.5, stringr 1.6.0, xml2 1.5.2).

## 1. Scope from the syllabus

Syllabus topics 9 ("Analiza zasobów internetu - pakiety RCrawler i rvest") and 10
("Manipulacja danymi tekstowymi - pakiet stringr") in one session. The course has six
sessions left and six topics, and grading is a group project with a presentation, so
one session must hold two topics to free the last one for presentations:

| Session | Topic |
|---|---|
| **7** | **rvest + stringr: a corpus from the web** |
| 8 | sentiment, on that corpus |
| 9 | topic modelling, on that corpus |
| 10 | QCA |
| 11 | Shiny |
| 12 | group project presentations, peer assessment |

Two facts change the earlier outline:

- **RCrawler is gone from CRAN** (archived 2025-04-04), and so is `polite` (archived
  2026-09-12). The session teaches rvest and says in one sentence why RCrawler is not
  used. Politeness is taught by hand: `robots.txt` and `Sys.sleep()`.
- **The trainer has no stringr exercises.** `docs/curriculum.md` listed a "module 8" as
  covered, but only the engine functions exist; no lesson uses them. Students meet
  stringr from zero, so the session cannot assume it (section 5).

## 2. The question and the corpus

**Research question:** what did the Sejm talk about on one day, and how much?

**Source:** the transcript of the 1st sitting of the 10th Sejm, 20 December 2023, from
the official API (`api.sejm.gov.pl`, whose `robots.txt` allows everything). Each speech
is its own small real HTML page:

```
https://api.sejm.gov.pl/sejm/term10/proceedings/1/2023-12-20/transcripts/30
```

```html
<h1>10. kadencja, 1. posiedzenie, 1. dzień (...)</h1>
<p class="punkt-tytul">(agenda item)</p>
<h2 class="mowca">Poseł Grzegorz Adam Płaczek:</h2>
<p>   Szanowny Panie Marszałku! ...</p>
```

Why this source: Polish, real, sociologically meaningful, simple enough for a first
scrape, and the agenda item on every page gives a known grouping that sessions 8 and 9
can check their results against. 139 pages, 876 KB.

**After cleaning (D143):** 133 speeches, 40 582 words of the speakers themselves (shortest 58,
longest 1 327).

| Debate | Speeches | Words |
|---|---|---|
| Crisis of the constitutional order (KRS), first reading | 61 | 21 180 |
| Energy and climate committee report | 31 | 7 107 |
| Public finance report, special measures | 15 | 5 511 |
| Public finance report, amending act | 12 | 3 836 |
| Statements (Oświadczenia), delivered only | 10 | 2 197 |
| Three short items | 4 | 751 |

Students work on a **saved copy** (section 9): 30 students on 139 live pages would be
over 4 000 requests, and a live page can change the week of the class. One page is read
live, so that they see it is the real internet.

## 3. What students get wrong without seeing it

All measured on this corpus. The first, third and fourth raise no error.

| Trap | What happens | Repair |
|---|---|---|
| **Encoding** | The pages declare no charset, so `read_html()` shows "PoseÅ‚", from a saved file and from the URL alike | `read_html(x, encoding = "UTF-8")` |
| **`html_element("p")`** | Takes the first `<p>`, which on 137 of 139 pages is the agenda title, not the speech | Select by class; speech is `p:not(.punkt-tytul)` |
| **Greedy pattern** | `str_remove_all(x, "\\(.*\\)")` runs from the first bracket to the last: 53 380 words become 25 013, so **53% of the corpus vanishes** | `"\\([^)]*\\)"` leaves the right 50 023 |
| **The chair is a "speaker"** | Page `000` holds everything the presiding marshal said, with no `h2.mowca`: 7 555 words, **15.1%** of the text, by nobody | Check `is.na(mowca)`, drop it and say so |
| **The chair inside a speech** | On 21 pages a bare paragraph "Marszałek:" starts the chair's remark inside an MP's page: 697 words with the labels, and on page 033 only 202 of 415 words are the speaker's | `czytaj()` keeps the speaker's paragraphs in `wlasny` |
| **Undelivered texts** | Pages 135-138 are marked "(tekst niewygłoszony)": 960 words nobody said in the chamber | Filter on `mowca` and say so |
| **Interjections are not the speaker** | 704 brackets, 211 of them "Głos z sali", plus "(Oklaski)", "(Dzwonek)": other people's words counted as the speaker's | Remove them, after looking at what they are |
| **A word is not a pattern** | "sąd" matches 370 times as a substring, 13 as an exact word, 366 with `\\bsąd\\p{L}*`. Polish inflects: sądu, sądów, sądy | Decide what is being counted; `\\b` and `\\p{L}` |
| **Today's data on an old event** | The API's MP list gives each MP's **current** club, not the club of December 2023 | No comparison of clubs without a historical source |
| **`html_elements` vs `html_element`** | One returns all matches, the other the first; a speech has a median of 7 paragraphs | `paste(..., collapse = " ")` |

## 4. The session, 90 minutes

Live in RStudio and a browser, assuming 2 × 45 minutes (question 12.5).

**Re-timed by D151.** D147 added lecture parts 10-12 (words, keywords, collocations) to a plan
that already filled 90 minutes with rvest and stringr. The plan below fits all twelve parts by
moving work that students do anyway out of the room: the trainer exercises 47-53 come before
the session, and lab 4 is done at home with every piece of code given. So the session shows
each idea once, on the real data, and leaves the practice to the lab.

| Min | Lecture part | Step | Live or ready | What students take away |
|---|---|---|---|---|
| 0-5 | 1-2 | **Why and may I?** One speech in the browser, then `robots.txt` | live, browser | Scraping is a research decision with rules |
| 5-15 | 3, 5 | **What a page is.** Inspect: tags, classes, the tree; one selector in "Co widzi rvest" | live, browser | A selector is an address in a structure |
| 15-28 | 4, 6 | **One page.** `read_html()`, the garbled "PoseÅ‚" and the fix; speaker, title, the `p` trap; `paste(collapse)` | live, RStudio | Look at what came back before believing it |
| 28-33 | 7 | **All pages.** `czytaj()` and `lapply()`, read, not typed; `Sys.sleep(1)` | ready, page | One page done well, then repeated |
| 33-43 | 8-9 | **Cleaning.** The greedy bracket pattern on one sentence, words before and after; the chair's remarks; `str_trunc()` after `group_by()` | live, RStudio | Count what you lost |
| 43-53 | 10 | **Words.** `unnest_tokens()`, the raw top 6, the stop list (356, "dobrze" on it, "panie" not), `zwroty`, 40 508 → 22 816 | live, RStudio | A stop list is borrowed: read it and add to it |
| 53-61 | 11 | **Keywords.** What tf-idf rewards, the table of five points, why titles are cut from the left | ready, page; run once | Keywords separate the debates, counts do not |
| 61-84 | 12 | **Collocations of "krs".** Frequent pairs are grammar; the window; O11 against E11; the rare-word ratio of 34; G² and Bonferroni (40 → 19, 11 with all 588); "neo" and the two names; "u" and "ie" | live to `E11`, then ready | A frequent pair is not a collocation; every number depends on a stated window and filter |
| 84-90 | 13 | **Bridge.** Lab 4 questions 10-11 use the student's own word; save the CSV. **Announce the group projects** | talk | This table feeds the next two sessions |

Part 12 is the core of the second hour and gets the most time, because it carries the only
statistical idea of the session (observed against expected, as in a cross table) and the
traps the lab asks about.

**Before the session.** The instructor's folder holds `lab4-wyklad.Rmd`, `lab4-strona.html`
and `sejm_mowy.csv`, which is not published (the hosting question is open). Packages rvest,
dplyr, stringr, readr, tidytext and stopwords are installed on the room computer, and the
page is knitted once beforehand: a full Knit takes about 5 seconds in WSL R 4.5.2, so
re-running a chunk live costs nothing.

**If the clock slips**, cut in this order, never the core of part 12:

1. Part 9 (`str_trunc()` order): it is repeated in the hint of lab question 8. Saves 3 min.
2. Part 11 shown as the result table only, without the pipeline. Saves 4 min.
3. In part 12, show the G² function as a black box ("copy it") and skip the 588 paragraph,
   which the page keeps. Saves 4 min.
4. Part 7 skipped entirely: lab question 5 gives the whole code. Saves 5 min.

Never cut: the encoding fix (15-28), the greedy pattern (33-43), the stop list check (43-53),
and O11 against E11 with the rare-word trap (61-84). Each is a silent error that the lab
grades.

**Why not split into two sessions.** Sessions 7-12 are fixed by the layout in section 1, and
session 8 (sentiment) needs its own 90 minutes once the lexicon is chosen.

## 5. The trainer: four stringr exercises before the session

Since stringr is new and the session has no room to teach patterns from zero, four short
exercises come **before** it, as module 8 (47-50), on real sentences from this corpus.
rvest itself stays out of the trainer: simulating the web would teach a fiction.

| # | Title | One idea | Silent trap |
|---|---|---|---|
| 47 | Czy to słowo tu jest? (**built, D135**) | `str_detect()`, `str_count()`, string first | a capital is another character: "sąd" misses "Sądy" |
| 48 | Wzorzec to nie słowo (**built, D136**) | `\\b`, `\\p{L}*`, `[Ss]` | "sąd" also finds "najrozsądniej" and "osąd"; one backslash finds nothing |
| 49 | Usuń, ale nie za dużo (**built, D137**) | `str_remove_all()`, `str_squish()`, `.`, `\\(`, `[^)]*` | the greedy `.*` deletes half a sentence; an unescaped `(` means something else |
| 50 | Tekst w tabeli (**built, D138**) | `mutate()` + `str_count()`, `filter()` + `str_detect()`, words per debate | a raw count mostly measures length: KRS 129 hits, energy 55, but 6.1 and 7.7 per 1000 words |

Engine work, **done 2026-11-23 (D134)**: `str_remove()` and `str_remove_all()` exist; `\b`,
`\B`, `\w` and `\W` know Polish letters, as in stringr's ICU; `str_count()` and
`str_extract_all()` no longer stop at 51 matches. The 16 new oracle cases were also run
on the real stringr 1.6.0 in WSL.

## 6. Interactive page: "Co widzi rvest"

**Built (D140):** `lab/lab4-rvest.html`, generated by `lab/tools/make-rvest.py`. It holds one
real page, the oath of the Children's Ombudsman: an official formula, short and neutral,
with two `<h2>` and three `<p>`, so both traps show. It is not linked from the menu yet;
lab 4 will link it.

The counterpart of "Co robi Knit" (`lab/lab3-anatomia.html`). On the left, one real saved
speech page as HTML source; on the right, the page as a browser draws it. The student
types or picks a selector (`h2`, `.mowca`, `p`, `p.punkt-tytul`, `p:not(.punkt-tytul)`)
and sees what it matches in both panes, how many elements, and the R line that does it,
`html_elements(strona, "...")`. `html_element()` lights up only the first match, which
makes the `p` trap visible at a glance. It runs on the browser's own `querySelectorAll`,
so the matches are real.

## 7. The lecture as an .Rmd

**Built (D142):** `lab/lab4-wyklad.Rmd`, knitted and annotated with the double-click of lab 3
(`annotate-wyklad.py wyklad4`, notes in `lab/tools/notes_wyklad4.py`). Its parts follow section 4.
It reads one public page, `lab/lab4-strona.html`, so it knits offline and gives away none of the
lab's corpus numbers. A model report is not needed again: lab 3 has one.

## 8. Lab 4 in RStudio

**Built (D141):** `lab/lab4.html`, the starter `lab/lab4.Rmd` and `lab/pobierz_sejm.R`, which
fetches the 139 pages (the pages themselves stay out of the public repo); homework,
handed in as `.Rmd` and `.html`, as in lab 3, so the report skill is used again. The
page opens with "Gdy utkniesz" for the messages below, provoked on the key.

1. **Patrz.** Open one speech in the browser, then Inspect. Which tag and class hold the
   speaker? What does `robots.txt` allow?
2. **Jedna strona.** `read_html()` on a saved page. What is wrong with the letters? Fix it.
3. **Mówca i punkt.** Take both by class. What does `html_element(strona, "p")` return, and why?
4. **Tekst mowy.** All paragraphs without the title, pasted into one string.
5. **Wszystkie strony.** The ready function `czytaj()` with `bind_rows(lapply())`. How many rows?
6. **Kto nie jest mówcą?** Find the page without a speaker. What share of the words is it?
7. **Nawiasy.** What is in them? Remove them with the greedy pattern, count the words, then
   with the right one. How much did the first one eat?
8. **Debaty.** A table of speeches and words per agenda item, with `kable()`.
9. **Twoje słowo.** Pick a word of your own and count it three ways: substring, exact word,
   all its forms. Own words keep reports different, as `ziarno` did in lab 3.
10. **Zapisz i opisz.** `write_csv()`, read it back, check the Polish letters. Three
    sentences: what is in the corpus, what you removed and why, what it cannot show.

## 9. Ethics and law

What the session teaches, in this order: is it public; what do `robots.txt` and the
terms say; how fast may I ask (`Sys.sleep(1)`, a saved copy, never one student per page
per class); whose words are these; what do I publish. MPs speak here in a public role,
which is why this corpus is a fair first example, and comments of private people would
not be.

**To confirm before anything is hosted.** The plan assumes a copy of the 139 pages in the
public repo. The Polish copyright act (art. 4) excludes official documents and materials
from protection, and a Sejm transcript looks like one, but that is my reading, not legal
advice, and the API's terms of use were not checked. If in doubt, the fallback is a short
script that each student runs once with `Sys.sleep(1)` (about 4 minutes, measured), or a file
shared only on Moodle.

## 10. Packages and machines

New: **rvest** (with xml2); stringr and readr come with the tidyverse. Since D147 also
**tidytext** and **stopwords** (lecture parts 10-12); the author confirmed on 2026-11-24 that
packages can be installed on the lab computers, and lab 4's install line lists both.
`jsonlite` only if the API's index is shown. Everything was run in WSL; it still has to
be checked on Windows R and on the lab computers. Reading all 139 saved pages takes
about 3 seconds, so Knit stays fast.

## 11. The bridge to sessions 8 and 9, and the group projects

The lab's CSV (`plik`, `mowca`, `punkt`, `tekst`, `slowa`) is the input of both next sessions.

- **Session 8, sentiment.** Text cleaning, first planned for it (D145), moved to lecture 7 (D147). Needs a Polish lexicon, not chosen yet. Forms matter: the
  corpus had 8 674 distinct word forms in 41 390 tokens before D143, and a lexicon of base forms will
  miss many of them without lemmatisation.
- **Session 9, topics.** The agenda items are a ready check: do topics find the debates?
  Not tested yet. Forms of address will need a stop list: "panie" 248 times, "marszałku"
  139, "izbo" 99.
- **Group projects** are announced at the end of this session, with a milestone in each
  later one: topic and data (8), first results (10), draft report or Shiny app (11),
  presentation (12).

## 12. Questions for the author

**Answered 2026-11-23: the author took every recommendation.** The corpus is the Sejm
sitting of 2023-12-20. The saved pages do not go into the public repo until the legal
point is confirmed: Moodle or a download script. The four stringr exercises are built.
The layout of sessions 7-12 and the milestones stand, a session is 90 minutes, and lab 4
is homework handed in as `.Rmd` and `.html`. The list below is kept as asked.

1. **The corpus.** Sejm, 20 December 2023, is political, and its largest debate is about
   the KRS. Recommended, because it is public, Polish and has known groups. Alternatives:
   a calmer sitting day, or another official source.
2. **Hosting the copy** (section 9): in the public repo, on Moodle only, or a download script?
   Recommended: Moodle or the script until the legal point is confirmed.
3. **Four stringr exercises in the trainer before the session?** Recommended. Without them
   the session must teach patterns and scraping in 90 minutes.
4. **The layout of sessions 7-12** in section 1, and the project milestones.
5. **Length of a session.** The plan assumes 90 minutes.
6. **Lab 4 as homework** handed in as `.Rmd` and `.html`, like labs 2 and 3?

## 13. Order of work

1. ~~The author answers section 12.~~ Answered 2026-11-23.
2. ~~Engine: oracle cases for Polish patterns, `str_remove()`, `str_remove_all()`.~~ Done (D134).
3. Exercises 47-50 on sentences from the corpus, one at a time. 47-50 are built (D135-D138).
4. ~~"Co widzi rvest" on one real saved page.~~ Done (D140).
5. ~~The key of lab 4 in WSL, with the messages provoked; `lab/PLAN4.md` local only.~~ Done.
6. ~~The lab page, starter and data, as decided in 12.2.~~ Done (D141).
7. ~~The lecture `.Rmd`, knitted and annotated.~~ Done (D142).
8. Solve as a student with only the lab 3 file; an independent review; then publish.
