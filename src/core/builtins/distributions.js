/**
 * Student's t and Fisher's F, for the p-values of summary() (D96).
 *
 * Both tails come from the regularised incomplete beta function, evaluated by its
 * continued fraction (modified Lentz), with log-gamma by the Lanczos approximation.
 * That is accurate to about 1e-14 relative over the range a model's p-values take,
 * which is far more than the three significant digits R prints. The functions are
 * also offered as `pt()` and `pf()` so the oracle can compare them with R directly.
 */

import { NA, isNA, mkDouble } from '../rvalue.js';
import { coerceVector, RError } from '../coerce.js';

const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

/** log(Gamma(x)) for x > 0. */
export function lgamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  const z = x - 1;
  let a = LANCZOS[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** The continued fraction of the incomplete beta (Numerical Recipes' betacf, Lentz). */
function betacf(x, a, b) {
  const TINY = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 1000; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return h;
}

/** The regularised incomplete beta I_x(a, b). */
export function ibeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = lgamma(a + b) - lgamma(a) - lgamma(b);
  const front = Math.exp(lbeta + a * Math.log(x) + b * Math.log(1 - x));
  // The fraction converges fast on one side of the mean; the other side by symmetry.
  if (x < (a + 1) / (a + b + 2)) return (front * betacf(x, a, b)) / a;
  return 1 - (front * betacf(1 - x, b, a)) / b;
}

/** P(T > t) for Student's t with df degrees of freedom. */
export function ptUpper(t, df) {
  if (Number.isNaN(t) || Number.isNaN(df)) return NaN;
  if (t === Infinity) return 0;
  if (t === -Infinity) return 1;
  const tail = 0.5 * ibeta(df / (df + t * t), df / 2, 0.5);
  return t > 0 ? tail : 1 - tail;
}

/** P(F > f) for Fisher's F with d1 and d2 degrees of freedom. */
export function pfUpper(f, d1, d2) {
  if (Number.isNaN(f)) return NaN;
  if (f <= 0) return 1;
  if (f === Infinity) return 0;
  return ibeta(d2 / (d2 + d1 * f), d2 / 2, d1 / 2);
}

/** pt(q, df, lower.tail = TRUE) and pf(q, df1, df2, lower.tail = TRUE), vectorised over q. */
export function registerDistributions(reg, { arg, namedArg, asFlag }) {
  const numbers = (v, node) => {
    if (!v) throw new RError('err.distArgs', node);
    return coerceVector(v, 'double').values;
  };
  // Every argument is recycled to the longest, as in R: qt(0.975, c(1, 5, 100)).
  const vectorised = (names, fn) => ({ args, node }) => {
    const vs = names.map((nm, i) => numbers(arg(args, i, nm), node));
    const lower = asFlag(namedArg(args, 'lower.tail'), true);
    const n = Math.max(...vs.map((v) => v.length));
    const out = Array.from({ length: n }, (_, k) => {
      const xs = vs.map((v) => v[k % v.length]);
      return xs.some(isNA) ? NA : fn(xs, lower);
    });
    return mkDouble(out);
  };
  reg('pt', vectorised(['q', 'df'], ([x, df], lower) => (lower ? ptUpper(-x, df) : ptUpper(x, df))));
  reg('qt', vectorised(['p', 'df'], ([x, df], lower) => qt(lower ? x : 1 - x, df)));
  reg('pf', vectorised(['q', 'df1', 'df2'], ([x, d1, d2], lower) => (lower ? 1 - pfUpper(x, d1, d2) : pfUpper(x, d1, d2))));
}

/** The quantile of Student's t: the q with P(T <= q) = p, by bisection on ptUpper. */
export function qt(p, df) {
  if (!(p > 0 && p < 1)) return p === 0 ? -Infinity : p === 1 ? Infinity : NaN;
  if (p === 0.5) return 0;
  const upper = 1 - p;               // P(T > q)
  let lo = -1e3;
  let hi = 1e3;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (ptUpper(mid, df) > upper) lo = mid; else hi = mid;
    if (hi - lo < 1e-13 * Math.max(1, Math.abs(mid))) break;
  }
  return (lo + hi) / 2;
}
