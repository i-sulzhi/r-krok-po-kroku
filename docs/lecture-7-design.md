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

**After cleaning:** 137 speeches, 42 239 words (shortest 58, longest 1 329), 340 KB as CSV.

| Debate | Speeches | Words |
|---|---|---|
| Crisis of the constitutional order (KRS), first reading | 61 | 21 481 |
| Energy and climate committee report | 31 | 7 413 |
| Public finance report, special measures | 15 | 5 529 |
| Public finance report, amending act | 12 | 3 836 |
| Statements (Oświadczenia) | 14 | 3 192 |
| Three short items | 4 | 788 |

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
| **Interjections are not the speaker** | 704 brackets, 211 of them "Głos z sali", plus "(Oklaski)", "(Dzwonek)": other people's words counted as the speaker's | Remove them, after looking at what they are |
| **A word is not a pattern** | "sąd" matches 370 times as a substring, 13 as an exact word, 366 with `\\bsąd\\p{L}*`. Polish inflects: sądu, sądów, sądy | Decide what is being counted; `\\b` and `\\p{L}` |
| **Today's data on an old event** | The API's MP list gives each MP's **current** club, not the club of December 2023 | No comparison of clubs without a historical source |
| **`html_elements` vs `html_element`** | One returns all matches, the other the first; a speech has a median of 7 paragraphs | `paste(..., collapse = " ")` |

## 4. The session, 90 minutes

Live in RStudio and a browser, assuming 2 × 45 minutes (question 12.5).

| Min | Step | What students take away |
|---|---|---|
| 0-10 | **Why and may I?** Open one speech, then `robots.txt`. What is public, what is polite | Scraping is a research decision with rules |
| 10-25 | **What a page is.** Right click, Inspect: tags, classes, the tree. "Co widzi rvest" | A page is a structure, and a selector is an address in it |
| 25-45 | **One page.** `read_html()`, the garbled "PoseÅ‚", the fix; speaker, title, and the `p` trap | Look at what came back before believing it |
| 45-60 | **All pages.** A function `czytaj()` and `bind_rows(lapply())`; `Sys.sleep()` on live pages | One page done well, then repeated |
| 60-80 | **Cleaning with stringr.** The chair, the brackets, the greedy pattern and its 53% | Check how many words you lost |
| 80-90 | **Bridge.** Words per debate, save the CSV. **Announce the group projects** | This table feeds the next two sessions |

Steps 25-45 and 60-80 are the core; if time runs short, `lapply()` can be shown ready.

## 5. The trainer: four stringr exercises before the session

Since stringr is new and the session has no room to teach patterns from zero, four short
exercises come **before** it, as module 8 (47-50), on real sentences from this corpus.
rvest itself stays out of the trainer: simulating the web would teach a fiction.

| # | Title | One idea | Silent trap |
|---|---|---|---|
| 47 | Czy to słowo tu jest? (**built, D135**) | `str_detect()`, `str_count()`, string first | a capital is another character: "sąd" misses "Sądy" |
| 48 | Wzorzec to nie słowo (**built, D136**) | `\\b`, `\\p{L}*`, `[Ss]` | "sąd" also finds "najrozsądniej" and "osąd"; one backslash finds nothing |
| 49 | Usuń, ale nie za dużo (**built, D137**) | `str_remove_all()`, `str_squish()`, `.`, `\\(`, `[^)]*` | the greedy `.*` deletes half a sentence; an unescaped `(` means something else |
| 50 | Tekst w tabeli (**built, D138**) | `mutate()` + `str_count()`, `filter()` + `str_detect()`, words per debate | a raw count mostly measures length: KRS 129 hits, energy 55, but 6.0 and 7.4 per 1000 words |

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

`lab/lab4-wyklad.Rmd`, knitted and annotated with the double-click of lab 3
(`annotate-wyklad.py`). Its parts follow section 4. It reads two saved pages from a small
folder, so it knits offline. A model report is not needed again: lab 3 has one.

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

New: **rvest** (with xml2); stringr and readr come with the tidyverse.
`jsonlite` only if the API's index is shown. Everything was run in WSL; it still has to
be checked on Windows R and on the lab computers. Reading all 139 saved pages takes
about 3 seconds, so Knit stays fast.

## 11. The bridge to sessions 8 and 9, and the group projects

The lab's CSV (`plik`, `kto`, `punkt`, `tekst`, `slowa`) is the input of both next sessions.

- **Session 8, sentiment.** Needs a Polish lexicon, not chosen yet. Forms matter: the
  corpus has 8 674 distinct word forms in 41 390 tokens, and a lexicon of base forms will
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
5. The key of lab 4 in WSL, with the messages provoked; `lab/PLAN4.md` local only.
6. The lab page, starter and data, as decided in 12.2.
7. The lecture `.Rmd`, knitted and annotated.
8. Solve as a student with only the lab 3 file; an independent review; then publish.
