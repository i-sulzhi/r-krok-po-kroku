# Lecture 5 design: linear models

Status: approved 2026-11-02; all seven exercises built (D91-D98, 2026-11-03). Step zero,
two exercises before them on data and correlation, is built (D101, 2026-11-03): they
are 33 and 34, and the seven model exercises are now 35-41. Python
panels exist for 33 and 34 (D93); 35-39 wait for the author. Lab 2 is not started. Where the build departed from this plan, the change is noted in its section.

## 1. Scope from the syllabus

Syllabus topic 5 is "Modele liniowe w pakiecie stats i rozwinięciach". The card gives
no hours and no detail per topic. Two lines of it shape this lecture:

- Topic 1 says the course puts "szczególny nacisk" on "wnioskowanie i interpretację
  wyników". So the lecture is about reading a model, not about calling `lm()`. A
  student who can type `lm(y ~ x)` but says "age causes less internet" has missed it.
- "i rozwinięciach" leaves the extensions open. The trainer covers `lm()` from
  `stats` with numbers and categories. Logistic regression (`glm()`) goes to the lab
  or to an extra task (question 9.2).

This is the first lecture where the trainer computes something a student cannot
check by hand, so the oracle matters more than before: every number on screen comes
from the engine and is compared with real R (section 5).

It follows lecture 4 directly. Exercise 29 ({ćw:plot-types}) already drew age
against hours online as points and said "fewer hours with age". Lecture 5 starts
from that picture and asks the next question: by how much?

## 2. What students get wrong without seeing it

These are the hidden mechanisms. Each one becomes an exercise or a picture.

1. **The formula has a direction.** `godziny ~ wiek` and `wiek ~ godziny` give two
   different lines. Nothing warns. The left side is what we explain.
2. **The slope is a unit statement.** −0.12 means "per one year of age, 0.12 hours
   less", about 7 minutes. Students read the number without its units.
3. **The intercept is often nonsense.** It is the prediction at age 0. Read it only
   when 0 is a real value.
4. **The line is chosen, not drawn by eye.** It is the line with the smallest sum of
   squared residuals. One person far from the rest pulls it.
5. **A prediction outside the data is invented.** The same line says a 90-year-old
   spends −2.8 hours a day online.
6. **A category becomes differences from the first group.** `plecM = 0.5` is the gap
   between men and women, and women are the baseline only because K comes before M
   alphabetically. This ties back to factor levels in lecture 1.
7. **Digits are not categories.** Education coded 1, 2, 3 as a number forces a
   straight line through the groups. No error, and the answer is wrong.
8. **Missing answers vanish.** `lm()` drops every row with NA in any variable used.
   `print()` says nothing; only `summary()` mentions it in one line. The NA thread of
   the whole course meets the model here.
9. **"Controlling for" changes the answer.** The gap between women and men can shrink
   to nothing once age is in the model, when the women in the sample are younger.
10. **A small p is not a big effect, and a slope is not a cause.** Interpretation,
    said once, where the numbers make it visible.

## 3. The exercises

Seven exercises, 33 to 39, the same shape as lectures 3 and 4: a research question, a
before-and-after picture, scenes, a sandbox with chips, a task judged by result.
Each has one idea and one silent trap.

| # | id | Title (Polish, draft) | The one idea | The silent trap |
|---|---|---|---|---|
| 33 | `model-line` | O ile mniej z każdym rokiem? | `lm(godziny ~ wiek)` is a line, and its slope answers "by how much per year" | `lm(wiek ~ godziny)` gives another line and another answer |
| 34 | `model-residuals` | Dlaczego ta linia? | A residual is "real minus predicted"; `lm()` takes the line with the smallest sum of their squares | One person far from the rest pulls the line |
| 35 | `model-predict` | Ile godzin u 40-latka? | `predict()` reads the line for a new person | Outside the ages in the data the line invents answers (−2.8 h at 90) |
| 36 | `model-groups` | Kategorie w modelu | A category becomes a difference from the first group | Education coded 1-2-3 as a number forces a straight line |
| 37 | `model-summary` | Co czytać w `summary()` | Four things: the estimate, how sure (p), how much explained (R²), on how many people | Rows with NA dropped silently; n is in one line |
| 38 | `model-control` | Dwie zmienne naraz | `y ~ x1 + x2` compares people of the same age | The raw gap between women and men disappears once age is in |
| 39 | `model-report` | Model na wykresie i w raporcie | `geom_smooth(method = "lm")` is the same line; a report sentence names slope, unit and n | `geom_smooth()` without `method` draws a curve, not the model |

### Step zero: two exercises before 33 (planned and built 2026-11-03, D101)

The author's note after the expert walk: the lecture starts with `lm()`, but the first
question of any model is which data to put in it, how to prepare them, and what they
must look like. That step is missing. Two exercises go before 33 and the lecture reads
as one road: what the data are, whether there is a link, how big it is.

| # | id | Title (Polish, draft) | The one idea | The silent trap |
|---|---|---|---|---|
| 33 | `model-data` | Zanim lm(): jakie dane? | Look at types and values first; the dependent variable must be a number with no codes in it | A refusal code 99 counted as 99 hours turns the slope from minus to plus |
| 34 | `model-cor` | Czy jest związek? | `cor()`: sign and strength of a straight-line link, the same both ways | An arch gives a correlation near 0 although the link is strong: look at the points first |

The seven built exercises become 35-41. Their ids do not change, and progress is kept
by id (to be checked before the build).

#### 33. Zanim lm(): jakie dane?

Question: "Chcemy wiedzieć, jak wiek wiąże się z czasem w sieci. Czy te dane się do
tego nadają?" Before: the table as it came from the survey. After: the same table
ready for a model, and its line.

The table `badanie`: the 20 people of `ankieta`, plus `wyksztalcenie` coded 1-2-3, with
two survey habits in `godziny`: one person refused (code 99, row 18) and one did not
answer (NA, row 5).

- Scene 1: `str(badanie)`. Four columns, three kinds of data: numbers, text, digits
  that are categories. The picture names each kind.
- Scene 2: `summary(badanie)`. Max 99 hours a day; a day has 24. 99 is the survey's
  code for "odmowa", not a number of hours.
- Scene 3: the points of `godziny` against `wiek`. One point sits at 99 above the rest
  and squeezes everyone else to the bottom of the plot.
- Scene 4: `lm(godziny ~ wiek, data = badanie)`. The slope is +0.41: "older people
  are online longer". One code turned the answer round.
- Scene 5: `badanie |> mutate(godziny = na_if(godziny, 99))`, then the model: -0.124,
  on 18 people (two rows without an answer drop out, as exercise 39 will show again).
- Scene 6: what can stand before `~`. `lm(plec ~ wiek)` is an error with a sentence:
  the dependent variable must be a number. A category can stand after `~` (exercise
  38, `factor()` for digits).
- Sandbox chips: `filter(godziny != 99)` (the same line by another road), `table(
  badanie$wyksztalcenie)`, the plot after cleaning, `lm()` with 99 left in.
- Task: "Przygotuj dane i policz, o ile zmieniają się godziny z każdym rokiem." Answer
  the slope after cleaning, -0.124. Accepted: `na_if()`, `filter(godziny != 99)`,
  `ifelse()`/`replace()`, `[badanie$godziny == 99] <- NA`.
- Near-misses: the slope with 99 left in (+0.41, its own message: "jeden kod
  odwrócił wynik"), `filter(godziny < 99)` with NA kept (accepted, same rows),
  `na.omit()` alone (99 stays), the mean of hours, a number typed in.
- Note: "W ESS kody odmowy to 7777, 8888, 9999. W RStudio sprawdź `summary()` przed
  każdym modelem."

The practical conditions for a straight-line model, said in this exercise and the
next, each one visible on the picture: the dependent variable is a number without
codes; the points run roughly along a line, not an arch; no single point pulls the line
(exercise 36's sandbox). Formal assumptions (normal residuals, independent
observations) get one sentence in the lecture text, not an exercise.

#### 34. Czy jest związek?

Question: "Zanim policzymy, o ile: czy wiek i czas w sieci w ogóle idą w parze?"
Before: the cleaned points. After: one number beside them.

- Scene 1: `cor(badanie$wiek, badanie$godziny)` is NA: one missing answer is enough.
  `use = "complete.obs"` gives -0.762. The picture: the points and the number.
- Scene 2: the sign says the direction (minus: the older, the fewer hours), the size
  says how close the points lie to a line: 0 none, -1 or 1 all on it.
- Scene 3: `cor(wiek, sen)`, hours of sleep: -0.02. Points with no direction.
- Scene 4: the trap. `dochod` (income, thousands a month) rises to the forties and
  falls after: an arch. `cor(wiek, dochod)` is -0.01, yet the link is strong. Look at
  the points first.
- Scene 5: `cor(godziny, wiek)` equals `cor(wiek, godziny)`: correlation has no
  dependent and independent side. `lm()` has (exercise 35).
- Scene 6: the bridge. `cor(...)^2` is 0.581, and `summary(lm(...))$r.squared` is
  0.581 too: R² of a line with one variable is the correlation squared. Correlation
  says how close, the model will say by how much.
- Sandbox chips: `cor()` without `use`, `cor(badanie$wiek, badanie$godziny,
  use = "complete.obs")^2`, the arch's points, one extra person far away (a single
  point moves the correlation).
- Task: "Policz korelację wieku i godzin w przygotowanej tabeli." Answer -0.762.
  Accepted: `use = "complete.obs"` or `"pairwise.complete.obs"`, after `na_if()` or
  `filter()`, the arguments either way round.
- Near-misses: NA (no `use`, its own message), +0.279 with 99 left in, the square
  0.581, the slope -0.124, a number typed in.

### 33. O ile mniej z każdym rokiem?

Question: "Starsi spędzają mniej czasu w internecie. O ile mniej z każdym rokiem?"
Before: the points of exercise 29. After: the same points with the line.

- Scene 1: the points, code from exercise 29. One sentence: the question.
- Scene 2: `lm(godziny ~ wiek, data = ankieta)`. Click `wiek`: the slope triangle
  "+1 rok → −0,12 h".
- Scene 3: click `(Intercept)`: the line at age 0, drawn far left of the data, with
  "nikt tu nie ma 0 lat".
- Sandbox chips: `lm(wiek ~ godziny, ...)` (the other line), `cor(ankieta$wiek,
  ankieta$godziny)` (one number, same in both directions), `* 60` on the slope
  (minutes).
- Task, as built (D91): "Jak zmienia się liczba godzin w sieci, gdy wiek rośnie o 30
  lat, z 20 do 50?" Answer `coef(m)["wiek"] * 30`, -3.68. The plan said 10 years, but
  the slope picture draws a step of 10 with its change (-1.23) written beside it, so a
  10-year task would be copied from the picture. Ten years now has its own message.
- Near-misses: swapped formula, the intercept, one year, ten years, minutes, the minus
  left out, `cor()`, a number typed in instead of taken from the model.

### 34. Dlaczego ta linia?

Question: "Linię można narysować na oko. Dlaczego R wybrał właśnie tę?"

- Scene 1: `residuals(m)`: each point gets a vertical segment to the line, the
  person aged 19 with 10 hours has the longest.
- Scene 2: the squares on the segments, and their sum. One sentence: R picks the
  line with the smallest sum.
- Scene 3: a hand-made line `8 - 0.1 * wiek` and its sum, larger.
- Sandbox chips: other hand-made lines; `ankieta[-1, ]` (without the 19-year-old):
  slope −0.108 instead of −0.123; `fitted(m)`.
- Task, as built (D92): "Kto spędza w sieci najmniej w porównaniu z prostą?" Row 11
  (26 years, 3 h, the line says 5.06), `which.min(residuals(m))`. The plan asked for
  the person furthest from the line, but the residual picture names row 1 in its
  caption. The fewest raw hours (rows 18 and 20) get their own message.
- Note: the trap is a chip, not a scene. It is the second idea of the exercise.

### 35. Ile godzin u 40-latka?

Question: "Ankieta nie ma nikogo w wieku 40 lat. Ile godzin przewiduje model?"

- Scene 1: `predict(m, data.frame(wiek = 40))`: a point on the line at 40, 3.34 h.
- Scene 2: `wiek = c(20, 40, 90)`: 90 is outside the data, drawn as a dashed piece of
  line in a "brak danych" zone, −2.8 h.
- Sandbox chips: ages 15, 67 (the oldest in the data), 100.
- Task: "Przewidź godziny dla 25, 45 i 65 lat." Three numbers.
- Near-miss: `predict(m)` without new data (20 numbers for the 20 people), a
  vector `predict(m, 40)` (an R error: newdata must be a table).

### 36. Kategorie w modelu

Question: "Czy kobiety i mężczyźni spędzają w sieci tyle samo czasu?"

- Scene 1: `lm(godziny ~ plec)`: two group means (K 4.0, M 4.5) and the arrow
  between them, labelled `plecM = 0,5`.
- Scene 2: the intercept is the mean of K. K is first because of the alphabet; the
  level table from lecture 1 is drawn beside it.
- Scene 3, the trap, on a second table `oceny`: education coded 1, 2, 3.
  `lm(zadowolenie ~ wyksztalcenie)` draws a straight rising line, +0.5 per level.
  The group means are 5.0, 7.5, 6.0: secondary is highest.
- Sandbox chips: `factor(wyksztalcenie)` (three means, two differences 2.5 and 1.0),
  `relevel(factor(plec), "M")` (the sign flips, the model is the same).
- Task: "Zrób model, który pokaże różnicę dla każdego poziomu wykształcenia." The
  check wants two coefficients 2.5 and 1.0. Accepted: `factor()` inside the formula
  or a factor column made with `mutate()`, labels or digits.
- Near-misses: the numeric model (one coefficient 0.5, "jedna liczba na trzy
  grupy: R policzył cyfry jak liczby").

### 37. Co czytać w `summary()`

Question: "Wynik `summary()` ma 20 linijek. Które cztery są ważne?"

Data: the 20-person table with three missing answers on hours.

- Scene 1: `summary(m)` with four places lit: the `wiek` estimate, its `Pr(>|t|)`,
  `Multiple R-squared`, and the line "(3 observations deleted due to
  missingness)".
- Scene 2: click the deleted line: the three rows struck out in the table, n = 17.
- Scene 3: click the p-value: one sentence, "jak bardzo pewne jest, że nachylenie nie
  jest zerem", not how big it is.
- Sandbox chips: `nobs(m)`, `print(m)` (no word about the missing), `sum(!is.na(
  ankieta$godziny))`.
- Task: "Na ilu osobach policzono model?" 17. Near-miss: `nrow(ankieta)`, 20.
- Note: the Polish system locale prints the deleted line in Polish in real RStudio
  ("3 obserwacje zostały skasowane z uwagi na braki w nich zawarte"). The trainer
  shows the English line and the bridge page says so (question 9.4).

### 38. Dwie zmienne naraz

Question: "Kobiety w tej ankiecie spędzają w sieci o 2,3 godziny więcej. Czy to
płeć?"

Data: a new table `siec`, 12 people, in which the women are younger.

- Scene 1: `lm(godziny ~ plec, data = siec)`: `plecM = −2.33`.
- Scene 2: the ages of the two groups as points: women 24, men 44.5 on average.
- Scene 3: `lm(godziny ~ plec + wiek, data = siec)`: two parallel lines, one per sex,
  almost on top of each other. `plecM = +0.08`.
- Sandbox chips: `+ wiek` removed and added; `summary()` of both (R² 0.47 vs
  0.91: age alone gives 0.908, so sex adds nothing); a model with `wiek` alone.
- Task: "Policz różnicę między płciami u osób w tym samym wieku." The `plecM` of
  the two-variable model.
- Near-miss: the one-variable model ("to różnica bez porównania w tym samym
  wieku").

### 39. Model na wykresie i w raporcie

Question: "Jak pokazać model w raporcie?"

- Scene 1: `geom_smooth(method = "lm", se = FALSE)` over the points of 33: the same
  line, its ends at the same numbers as `predict()`.
- Scene 2: `se = TRUE`: the grey band, "tu linia mogłaby leżeć przy innej próbie".
- Scene 3: `geom_smooth()` with no method: R writes "using method = 'loess'" and draws
  a curve. The trainer does not draw loess (section 8); it says so and shows the
  message R gives.
- Task: the plot of exercise 33 with the model line and labels, compared like the
  plot tasks of lecture 4.
- Success note: the report sentence, built from the numbers: "Z każdym rokiem
  życia o około 7 minut mniej w internecie (n = 20, R² = 0,60)."

### Python beside R (D93)

The students met linear models in Python (statsmodels and scikit-learn) before this
course. Every exercise of this lecture gets a "To samo w Pythonie" panel under its
sandbox: the R lines beside both libraries, with the shared result, checked in real
Python. A panel never holds its exercise's task answer.

## 4. Data, with numbers checked in R

All numbers below were computed in R 4.6.2 on 2026-11-02. Each becomes a tested fact
in the lesson suite before any text states it.

### `badanie` (step zero, planned): `ankieta` as a survey delivers it

The 20 people of `ankieta`; `wyksztalcenie` added as digits (2 1 3 2 2 3 1 2 3 3 2 1 3 2
1 2 3 1 2 1, to be fixed in the build); `godziny` with 99 in row 18 (was 1) and NA in
row 5 (was 4). Checked in R 4.6.2 on 2026-11-03:

| Fact | Value |
|---|---|
| `summary()` of `godziny` | max 99.000, mean 9.421, 1 NA |
| `lm(godziny ~ wiek)` with 99 left in | (Intercept) -4.097, wiek +0.408, n = 19 |
| the same after `na_if(godziny, 99)` | (Intercept) 8.403, wiek -0.1239, n = 18, R² 0.5811 |
| `cor(wiek, godziny)` | NA |
| with `use = "complete.obs"`, 99 left in | +0.279 |
| after cleaning | -0.7623; squared 0.5811, equal to R² above |
| `cor(wiek, sen)`, sleep 7 6 8 7 6 9 7 8 6 7 8 7 6 7 8 7 6 8 7 7 | -0.018 |
| `dochod` = round(10 - ((wiek - 40) / 8)^2), at least 1: 3 4 4 4 5 5 5 5 6 6 7 8 9 9 10 10 9 6 3 1 | `cor(wiek, dochod)` -0.012 |

The full `ankieta` gives cor -0.7739 and its square 0.5989, R² of exercise 41: the
bridge holds on every table of the lecture.

### `ankieta` (exercises 33-35, 39): the table of exercise 29, unchanged

20 people: `wiek`, `plec` (K, M alternating), `godziny`. Reusing it means the
student already knows the points.

| Fact | Value |
|---|---|
| `coef(lm(godziny ~ wiek))` | (Intercept) 8.2530, wiek −0.1228 |
| per year in minutes | −7.37 |
| per 10 years | −1.228 h |
| `lm(wiek ~ godziny)` slope | −4.877 (× 10 = −48.8) |
| `cor(wiek, godziny)` | −0.774 |
| R², adjusted R² | 0.5989, 0.5766 |
| p of the slope | 6.25e-05 |
| sum of squared residuals, `lm` line | 41.62 |
| the same, hand line `8 - 0.1 * wiek` | 48.56 |
| largest residual | row 1 (19 years, 10 h), +4.08 |
| slope without row 1 | −0.1079 |
| `predict()` at 15, 25, 40, 45, 65, 67, 90, 100 | 6.41, 5.18, 3.34, 2.73, 0.27, 0.03, −2.80, −4.03 |
| `lm(godziny ~ plec)` | (Intercept) 4.0, plecM 0.5 |

A fact for the author: the line is already near zero at the oldest people in the
data (0.03 h at 67) while they report 1 to 2 hours. A straight line fits the young
well and the old badly. Exercise 35 can show this with the 67 chip, without a new
idea: "nawet w danych linia przy 67 latach mówi prawie 0".

### `ankieta` with three missing answers (exercise 37)

`godziny` set to NA in rows 5, 14 and 18.

| Fact | Value |
|---|---|
| `nobs(m)` | 17 |
| slope, p | −0.1238, 0.000378 |
| R² | 0.5806 |
| the line in `summary()` | "(3 observations deleted due to missingness)" in English; in Polish locale "(3 obserwacje zostały skasowane z uwagi na braki w nich zawarte)" |

### `oceny` (exercise 36): education coded with digits

12 people, 4 per level. `wyksztalcenie` 1, 2, 3; `zadowolenie` 0-10.

| Fact | Value |
|---|---|
| group means 1, 2, 3 | 5.0, 7.5, 6.0 |
| numeric model | (Intercept) 5.17, wyksztalcenie +0.5 |
| `factor()` model | (Intercept) 5.0, level 2 +2.5, level 3 +1.0 |

The numeric model says "the higher, the happier". The groups say secondary is
happiest. With labels instead of digits the base level stays "podstawowe": R under
the Polish locale sorts podstawowe, średnie, wyższe, and so does the engine
(`localeCompare` with 'pl' and 'en'). Under the C locale R puts "średnie" last; a lab
computer set to English could show that order, which the bridge page should mention.

### `siec` (exercise 38): the women are younger

12 people, 6 women aged 19-33 (mean 24.3), 6 men aged 26-63 (mean 44.5). Hours
depend on age only.

| Fact | Value |
|---|---|
| mean hours K, M | 5.50, 3.17 |
| `lm(godziny ~ plec)` | plecM −2.33, R² 0.471 |
| `lm(godziny ~ wiek)` | R² 0.908 |
| `lm(godziny ~ plec + wiek)` | plecM +0.081 (p 0.88), wiek −0.1197, R² 0.908 |

## 5. Engine work

The engine has no models today. The parser already reads `~` (it is used inside
`case_when()`), and evaluating a bare formula throws `err.formulaUnsupported`.

### New values

- **formula**: an object of class "formula" holding the expression unevaluated.
  Prints as `godziny ~ wiek`. Needed by `lm()` and, later, by nothing else.
- **lm**: a list with class "lm": coefficients, residuals, fitted values, the model
  frame (the rows used, with their original row names), the rows dropped for NA,
  the call, the terms. Its parts are what the pictures read.

### New functions

| Function | Scope |
|---|---|
| `lm(formula, data)` | Right side: numeric columns, factor or character columns (treatment contrasts, first level as base), `factor(x)` inside the formula, `+`. Intercept always. Rows with NA in any used column dropped (`na.omit`). Fit by QR (Householder) on the model matrix, not normal equations, for stability. |
| `print(<lm>)` | "Call:" and "Coefficients:", formatted exactly as R |
| `summary(<lm>)` and its print | Residual quantiles, the coefficient table with standard errors, t, p and stars, the signif. codes line, residual standard error, the deleted-rows line, R², adjusted R², F with its p |
| `coef`, `fitted`, `residuals`/`resid`, `nobs` | As in R, named by row |
| `predict(m, newdata)` | Point predictions only; `interval` refused with a sentence |
| `cor(x, y)` | Pearson; `use = "complete.obs"`; NA otherwise, as R |
| `relevel(f, ref)` | Base level for exercise 36 |
| `geom_smooth(method = "lm", se = )` | The model line per group; the band from the t quantile. Without `method` refused with the message R prints and a sentence (section 8) |

Distributions: `pt` and `pf` are needed for p-values (regularised incomplete beta),
`qt` for the band. They are written once, in `src/core/builtins/distributions.js`,
and tested against R over a grid of values, not only at the lesson's numbers.

### What a student gets wrong, and what they are told

At least these, each with its own sentence and a near-miss test:

- `lm(ankieta$godziny ~ ankieta$wiek)`: works in R, gives coefficient names
  `ankieta$wiek`. Accepted, with a quiet note that `data =` reads better.
- `lm(godziny ~ wiek)` without `data`: "object 'godziny' not found", with the fixed
  call.
- `lm(godziny, wiek)` (a comma instead of `~`): its own diagnosis.
- `lm(data = ankieta, godziny ~ wiek)`: valid, accepted.
- `godziny ~ wiek * plec`, `godziny ~ wiek:plec`, `I(wiek^2)`, `poly()`, `log(wiek)`
  in a formula: "exists in R, not in the trainer yet", never "typo".
- `predict(m, 40)`: R's own error, explained (newdata must be a table).
- `summary(m)$coefficients`, `m$coefficients`: work as in R.

### Oracle

Every snippet a lesson shows is an R case in `test/cases-*.txt`, compared line by
line: print, summary, coef, predict, cor, and the errors. Printing of numbers in
`summary()` (significant digits per column, `<2e-16`, stars) is the riskiest part;
it gets its own cases with p-values across the range, including tiny and large ones.

R on this PC (4.6.2) has dplyr, tidyr, ggplot2 and haven. So unlike lecture 4,
`geom_smooth()` can be compared with real ggplot2 through `layer_data()` here.
The R on the Mac has no tidyverse (handoff, section 9); the `diff-*` suites must say
which cases need a package and skip them there with a count, not silently.

### Step zero (planned)

Little new in the engine: `str()`, `summary()` of a table (now as R 4.6, D99), `na_if()`,
`cor(use = )` and the error for a category before `~` all exist. To build or check:

- the picture of `cor()`: the points with the number and its sign spelt out, and a
  caption that says NA when one answer is missing and names `use = "complete.obs"`;
- the picture of `str()` on a table: whether it already names the kind of each column
  (number, text, digits); if not, a label per row;
- the plot with the 99 point: ggplot2 scales the axis to 99, as R does; the caption of
  the points says one value lies far above the rest;
- an error sentence for `cor()` on a text column (R: "'x' must be numeric");
- oracle cases for every number in the table of section 4, and `cor()` with NA, `use`
  and text.

## 6. Pictures

One new picture family, "model", drawn from the fitted `lm` object, never from a
hand-made illustration. It reuses the point plot of exercise 29 as its base.

| Click on | Picture | Caption (draft, real numbers) |
|---|---|---|
| `lm(...)` | points and the line; rows dropped for NA struck out beside it | "20 osób → linia: 8,25 − 0,12 × wiek." |
| the `wiek` coefficient | the slope triangle: one year right, 0.12 h down | "Każdy rok więcej to 0,12 h (7 min) mniej." |
| `(Intercept)` | the line extended to age 0, dashed outside the data | "Przy wieku 0 linia daje 8,25 h. Nikt w danych nie ma 0 lat." |
| `residuals(m)` | a vertical segment from each point to the line, the longest named | "Najdalej od linii: wiersz 1 (19 lat, 10 h), +4,08." |
| a sum of squared residuals | the squares on the segments, and the total | "Suma kwadratów: 41,6. Każda inna linia ma większą." |
| `predict(m, nowe)` | new points on the line; outside the data dashed, in a grey "brak danych" zone | "90 lat → −2,8 h. Takiej osoby w danych nie ma." |
| a category coefficient | group means as points, the arrow from the base group | "plecM: mężczyźni o 0,5 h więcej niż kobiety (grupa bazowa)." |
| a numeric code used as category | the forced straight line over the three real group means | "Cyfry jak liczby: jedna prosta przez trzy grupy." |
| `+ wiek` in a two-variable model | two parallel lines, one per group | "W tym samym wieku różnica to 0,08 h." |
| a line in `summary()` | that line lit, and its meaning in one sentence | (one per lit line) |

The sum-of-squares picture is the one that carries "why this line". It needs a
hand-made line beside the fitted one in the same frame, so the student compares two
totals, not one.

In a task the goal is drawn the same way: the expected coefficients as a slope
triangle or as arrows between group means, with the answer beside it.

## 7. Lab 2 in RStudio

Lab 1 (D89) took lectures 2-4 to ESS Poland. Lab 2 does the same for this lecture,
on the same file, so students meet no new data format.

The current extract (`lab/ess_polska.sav`, 18 variables) has age, sex, trust, life
satisfaction and internet minutes. That is enough for:

- `netustm ~ agea`: the trainer's exercise 33 on real data (rounds 8-11).
- `stflife ~ gndr`, as a factor: exercise 36.
- `trstprl ~ trstplt`: trust in parliament from trust in politicians.
- `summary()` with real NA: how many of 19 131 answers the model really used.

For "controlling for" (exercise 38) on real data the lab needs one or two more
variables. The full download in `lab/data/` has them: `eduyrs` (years of
education), `hinctnta` (income decile), `health`, `happy`, `ppltrst`, `rlgdgr`. A new
extract would change the published `.sav` (licence settled in D90: CC BY-NC-SA 4.0
allows it). Question 9.3.

Logistic regression ("rozwinięcia") fits the lab naturally: "ufa Sejmowi" (6-10) as
yes/no, `glm(..., family = binomial)`. Question 9.2.

The lab is designed after exercises 33-39 exist, solved once from the page alone
and once in a real RStudio, like lab 1 (pitfalls, section 9).

## 8. Honest limits and what stays out

- **Interactions, polynomials, transformations in a formula** (`*`, `:`, `I()`,
  `poly()`, `log()`): not in the trainer. Refused with "exists in R, not here yet".
- **Loess.** `geom_smooth()` without `method` draws a loess curve in R. Simulating
  loess would be a second fit nobody reads. The trainer shows R's message and asks
  for `method = "lm"`. This is the one place where valid R code does not draw.
- **Diagnostics** (`plot(m)`, residual plots, `car::vif`): lab material, not here.
- **`glm()`**: not in the trainer unless the author wants an extra task (9.2).
- **`broom`**: not installed in R here; `tidy(m)` stays out. The coefficient table
  is read from `summary()`.
- **Causality** is said, not modelled: one sentence in exercise 38 and in the report
  note of 39.
- **Numerical edge cases** (perfect collinearity, a constant column, fewer rows than
  coefficients): R gives NA coefficients or errors. The engine must do the same,
  tested, but no lesson shows them.

## 9. Questions for the author

1. **Seven exercises or fewer?** 34 (residuals) and 35 (predict) could merge into
   one exercise, "the line as a prediction", if seven is too many for the time.
2. **Logistic regression.** In the lab only, or also as an extra task "dla chętnych"
   after exercise 39?
3. **New variables in the ESS extract** for lab 2 (`eduyrs`, `hinctnta`, `health`)?
   It changes the published file.
4. **The Polish NA line.** On lab computers set to Polish, `summary()` says "3
   obserwacje zostały skasowane...". Show the English line in the trainer and name
   the Polish one on the bridge page (proposed), or show the Polish one?
5. **p-values.** One sentence ("how sure the slope is not zero, not how big it is"),
   or does the course teach significance testing elsewhere and the trainer should
   say less?

Step zero (2026-11-03):

6. **Where the two exercises go.** Before 33, renumbering 33-39 to 35-41 (proposed), or
   as 39a/39b-style extras after lecture 4? Proposed: before, so the lecture is one
   road.
7. **How much about assumptions.** The plan shows the three conditions a picture can
   show (a number without codes, a line not an arch, no point pulling the line) and
   says the formal ones in one sentence. More, such as residuals against fitted
   values, would be an exercise of its own.
8. **ESS codes.** The note of exercise 33 names 7777/8888/9999 as ESS writes them in
   SPSS; with `haven` they arrive as labelled values. Show `zap_labels()` in lab 2 only
   (proposed), or also in the trainer?

## 10. Order of work

One exercise at a time, shown before the next (skill rule).

1. Engine core: formula, `lm()` with numeric predictors, `print`, `coef`,
   `fitted`, `residuals`, `predict`, `cor`. Oracle cases first.
2. Exercise 33 with its pictures. Review "as a student".
3. Exercises 34, 35.
4. Factors in `lm()`, `relevel()`; exercise 36.
5. `summary()` with distributions; exercise 37. The heaviest oracle work.
6. Two predictors; exercise 38.
7. `geom_smooth()`; exercise 39, checked against real ggplot2 here.
8. The lecture as one story, as a student and as an expert. Then lab 2.

Each step ends with all suites green, the build, a browser walk at 1280 and 375 px
in both themes, and a D-record. Publishing only after "отправляй".

Step zero, after the author approves this plan:

9. Check that progress is kept by id, then renumber 33-39 to 35-41 in the lesson
   order, the curriculum and the README.
10. Exercise 33 (`model-data`): data, scenes, task, near-misses; the pictures of
    `str()` and of the 99 point. Review as a student.
11. Exercise 34 (`model-cor`): the `cor()` picture, the arch, the bridge to R².
12. The first three exercises of the lecture walked as a student and as an expert,
    then the whole lecture once more.
