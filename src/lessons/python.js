/**
 * The same work in Python, for the sandbox of the linear-model exercises (D93).
 *
 * Shown beside R, never run by the trainer. Every line here is run in real Python by
 * test/diff-python.mjs and its result compared with `out` (or `outPy` where Python
 * gives another answer, such as a row counted from 0); every R line is run by the
 * engine in test/lessons.mjs and compared with `out` too.
 *
 * Each column is read on its own: the statsmodels lines run one after another in one
 * session, the scikit-learn lines in another, both after `PY_SETUP`.
 */

/** The table of exercises 29, 33 and 34 as a pandas DataFrame, with the imports. */
export const PY_SETUP = `import pandas as pd
import statsmodels.formula.api as smf
from sklearn.linear_model import LinearRegression

ankieta = pd.DataFrame({
    "wiek": [19, 20, 21, 21, 22, 22, 23, 23, 24, 25,
             26, 28, 31, 34, 38, 43, 49, 55, 61, 67],
    "plec": ["K", "M"] * 10,
    "godziny": [10, 7, 5, 6, 4, 8, 5, 6, 4, 5,
                3, 4, 3, 4, 2, 3, 2, 1, 2, 1],
})`;

const MODEL_ROW = {
  r: 'm <- lm(godziny ~ wiek, data = ankieta)',
  statsmodels: 'm = smf.ols("godziny ~ wiek", data=ankieta).fit()',
  sklearn: 'm = LinearRegression().fit(\n    ankieta[["wiek"]], ankieta["godziny"])',
};

/** Exercise 33: the line, its two numbers, the formula turned round, the correlation. */
export const PY_LINE = {
  setup: PY_SETUP,
  notes: [
    'Formuła `godziny ~ wiek` jest ta sama w R i w statsmodels. scikit-learn formuł nie zna: bierze osobno tabelę X i kolumnę y.',
    'Wyraz wolny to `(Intercept)` w R, `Intercept` w statsmodels i `intercept_` w scikit-learn.',
    'X w scikit-learn ma dwa nawiasy, `ankieta[["wiek"]]`: to tabela, nawet z jedną kolumną.',
  ],
  rows: [
    MODEL_ROW,
    { r: 'coef(m)', statsmodels: 'm.params', sklearn: '(m.intercept_, m.coef_)', out: '8.253 -0.1228' },
    { r: 'coef(m)["wiek"] * 60', statsmodels: 'm.params["wiek"] * 60', sklearn: 'm.coef_[0] * 60', out: '-7.368' },
    {
      r: 'coef(lm(wiek ~ godziny, data = ankieta))',
      statsmodels: 'smf.ols("wiek ~ godziny", data=ankieta).fit().params',
      sklearn: 'm2 = LinearRegression().fit(\n    ankieta[["godziny"]], ankieta["wiek"])\n(m2.intercept_, m2.coef_)',
      out: '53.33 -4.877',
    },
    {
      r: 'cor(ankieta$wiek, ankieta$godziny)',
      statsmodels: 'ankieta["wiek"].corr(ankieta["godziny"])',
      sklearn: 'ankieta["wiek"].corr(ankieta["godziny"])',
      out: '-0.7739',
    },
  ],
};

/** Exercise 34: residuals, fitted values, the sum of squares, and rows counted from 0. */
export const PY_RESIDUALS = {
  setup: PY_SETUP,
  notes: [
    'statsmodels pamięta reszty i sumę kwadratów: `m.resid`, `m.ssr`. W scikit-learn liczy się je samemu z `predict()`.',
    'Python liczy wiersze od 0. Osoba z wiersza 1 w R ma w pandas indeks 0: ta sama osoba, inny numer.',
  ],
  rows: [
    MODEL_ROW,
    {
      r: 'residuals(m)',
      statsmodels: 'm.resid',
      sklearn: 'ankieta["godziny"] - m.predict(ankieta[["wiek"]])',
      out: '4.080 1.203 -0.6744 …',
    },
    { r: 'fitted(m)', statsmodels: 'm.fittedvalues', sklearn: 'm.predict(ankieta[["wiek"]])', out: '5.920 5.797 5.674 …' },
    {
      r: 'sum(residuals(m)^2)',
      statsmodels: 'm.ssr',
      sklearn: '((ankieta["godziny"]\n  - m.predict(ankieta[["wiek"]])) ** 2).sum()',
      out: '41.62',
    },
    {
      r: 'which.max(residuals(m))',
      statsmodels: 'm.resid.idxmax()',
      sklearn: '(ankieta["godziny"]\n - m.predict(ankieta[["wiek"]])).idxmax()',
      out: '1',
      outPy: '0',
    },
  ],
};
