/**
 * R's default random numbers, written out (lecture 6 plan, section 5).
 *
 * A student types `set.seed(2); sample(nrow(ess), 20)` in RStudio and must get the
 * same 20 rows here, or the lecture would teach that results cannot be repeated. So
 * this is R's own algorithm, not "a" random generator:
 *
 * - Mersenne-Twister (MT19937), seeded as R's RNG_Init does: the integer is scrambled
 *   by 50 steps of the congruential seed = 69069 * seed + 1, then 625 more steps fill
 *   the state, whose first word becomes the position (624: regenerate on first use).
 * - unif_rand() is MT_genrand() pushed inside (0, 1) by R's fixup.
 * - sample() uses R >= 3.6's "Rejection" sampling: R_unif_index draws 16-bit chunks
 *   until the value falls below n. Without replacement it is SampleNoReplace.
 *
 * As in R, the state lives in the global environment (R keeps `.Random.seed` there),
 * so it carries over between runs of one session and starts afresh in a new one.
 * Without set.seed() the generator is seeded from the clock, as R does: another run,
 * another draw.
 */

const N = 624;
const M = 397;
const MATRIX_A = 0x9908b0df;
const UPPER_MASK = 0x80000000;
const LOWER_MASK = 0x7fffffff;
const I2_32M1 = 2.328306437080797e-10; // 1 / (2^32 - 1)

export class RRng {
  constructor(seed = null) {
    this.mt = new Uint32Array(N);
    this.mti = N + 1;
    this.setSeed(seed ?? (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)));
  }

  /** set.seed(seed): R's RNG_Init for Mersenne-Twister. */
  setSeed(seed) {
    let s = seed >>> 0;
    for (let j = 0; j < 50; j++) s = (Math.imul(69069, s) + 1) >>> 0;
    // 625 words: the first is the position, overwritten by FixupSeeds below.
    s = (Math.imul(69069, s) + 1) >>> 0;
    for (let j = 0; j < N; j++) {
      s = (Math.imul(69069, s) + 1) >>> 0;
      this.mt[j] = s;
    }
    this.mti = N;
  }

  /** MT_genrand(): a double in [0, 1). */
  genrand() {
    const mt = this.mt;
    let y;
    if (this.mti >= N) {
      let kk;
      for (kk = 0; kk < N - M; kk++) {
        y = (mt[kk] & UPPER_MASK) | (mt[kk + 1] & LOWER_MASK);
        mt[kk] = mt[kk + M] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
      }
      for (; kk < N - 1; kk++) {
        y = (mt[kk] & UPPER_MASK) | (mt[kk + 1] & LOWER_MASK);
        mt[kk] = mt[kk + (M - N)] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
      }
      y = (mt[N - 1] & UPPER_MASK) | (mt[0] & LOWER_MASK);
      mt[N - 1] = mt[M - 1] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
      this.mti = 0;
    }
    y = mt[this.mti++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return (y >>> 0) * 2.3283064365386963e-10;
  }

  /** unif_rand(): strictly inside (0, 1). */
  unifRand() {
    const x = this.genrand();
    if (x <= 0) return 0.5 * I2_32M1;
    if (1 - x <= 0) return 1 - 0.5 * I2_32M1;
    return x;
  }

  /** rbits(bits): `bits` random bits from 16-bit chunks, as R builds them. */
  rbits(bits) {
    let v = 0;
    for (let n = 0; n <= bits; n += 16) {
      const v1 = Math.floor(this.unifRand() * 65536);
      v = 65536 * v + v1;
    }
    return v % 2 ** bits;
  }

  /** R_unif_index(dn): a whole number in [0, dn), by rejection. */
  unifIndex(dn) {
    if (dn <= 0) return 0;
    const bits = Math.ceil(Math.log2(dn));
    let dv;
    do { dv = this.rbits(bits); } while (dn <= dv);
    return dv;
  }

  /** sample.int(n, size, replace): 1-based positions. */
  sampleInt(n, size, replace) {
    const out = new Array(size);
    if (replace) {
      for (let i = 0; i < size; i++) out[i] = this.unifIndex(n) + 1;
      return out;
    }
    const x = Array.from({ length: n }, (_, i) => i);
    let left = n;
    for (let i = 0; i < size; i++) {
      const j = this.unifIndex(left);
      out[i] = x[j] + 1;
      x[j] = x[--left];
    }
    return out;
  }

  /** runif(n, a, b). */
  runif(count, a, b) {
    const out = new Array(count);
    for (let i = 0; i < count; i++) {
      if (a === b) { out[i] = a; continue; }
      out[i] = a + (b - a) * this.unifRand();
    }
    return out;
  }
}

/** The session's generator, kept on the global environment like `.Random.seed`. */
export function rngOf(interp) {
  const g = interp.global;
  if (!g.__rng) Object.defineProperty(g, '__rng', { value: new RRng(), writable: true, enumerable: false });
  return g.__rng;
}
