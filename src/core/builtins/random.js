/**
 * set.seed(), sample() and runif() on R's own generator (src/core/rng.js).
 *
 * sample() follows R's R-level definition: a single number x >= 1 means 1:x, anything
 * else is a vector to draw from, and the draw itself is sample.int(). Weighted
 * sampling (`prob =`) is not offered: the lessons never need it, and R's Walker alias
 * method would be a second algorithm to keep exact.
 */

import { mkDouble, mkInteger, R_NULL, isNull, isAtomic, rLength, NA, isNA } from '../rvalue.js';
import { coerceVector, RError } from '../coerce.js';
import { singleBracket } from '../subset.js';
import { rngOf } from '../rng.js';
import { arg, namedArg, asFlag } from './base.js';

const num = (v) => {
  if (!v || !isAtomic(v) || rLength(v) === 0) return null;
  const x = coerceVector(v, 'double').values[0];
  return x === NA || Number.isNaN(x) ? null : x;
};

export function registerRandom(reg) {
  reg('set.seed', ({ args, node, interp }) => {
    const seed = num(arg(args, 0, 'seed'));
    if (seed === null || !Number.isFinite(seed)) throw new RError('err.seedNotNumber', node);
    rngOf(interp).setSeed(Math.trunc(seed) | 0);
    return R_NULL;
  });

  reg('sample', ({ args, node, interp }) => {
    const x = arg(args, 0, 'x');
    if (!x || isNull(x)) throw new RError('err.sampleEmpty', node);
    const probArg = namedArg(args, 'prob');
    if (probArg && !isNull(probArg)) throw new RError('err.sampleProb', node);
    const replace = asFlag(arg(args, 2, 'replace'), false);
    // A single number >= 1 stands for 1:x, as in R's sample().
    const single = isAtomic(x) && rLength(x) === 1 && (x.type === 'double' || x.type === 'integer');
    const xv = single ? num(x) : null;
    const asRange = single && xv !== null && Number.isFinite(xv) && xv >= 1;
    const n = asRange ? Math.floor(xv) : rLength(x);
    const sizeArg = arg(args, 1, 'size');
    const sizeNum = sizeArg && !isNull(sizeArg) ? num(sizeArg) : n;
    if (sizeNum === null || sizeNum < 0) throw new RError('err.sampleSize', node);
    const size = Math.floor(sizeNum);
    if (!replace && size > n) throw new RError('err.sampleTooBig', node, { size, n });
    const pos = rngOf(interp).sampleInt(n, size, replace);
    const idx = mkInteger(pos);
    return asRange ? idx : singleBracket(x, idx);
  });

  reg('runif', ({ args, node, interp }) => {
    const n = num(arg(args, 0, 'n'));
    if (n === null || n < 0) throw new RError('err.needNumber', node, { what: 'n' });
    const a = num(arg(args, 1, 'min')) ?? 0;
    const b = num(arg(args, 2, 'max')) ?? 1;
    return mkDouble(rngOf(interp).runif(Math.floor(n), a, b).map((v) => (isNA(v) ? NA : v)));
  });
}
