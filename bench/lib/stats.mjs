export const sum = (a) => a.reduce((x, y) => x + y, 0);
export const mean = (a) => (a.length ? sum(a) / a.length : NaN);
export function percentile(a, p) {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const i = (s.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}
export const median = (a) => percentile(a, 0.5);
export function stdev(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / (a.length - 1));
}

// Abramowitz-Stegun erf approximation
function erf(x) {
  const s = Math.sign(x);
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return s * y;
}
const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

/** Two-sided Mann-Whitney U test (normal approximation, tie-corrected). */
export function mannWhitneyP(a, b) {
  const n1 = a.length;
  const n2 = b.length;
  if (n1 < 3 || n2 < 3) return 1;
  const all = [...a.map((v) => ({ v, g: 0 })), ...b.map((v) => ({ v, g: 1 }))].sort(
    (x, y) => x.v - y.v,
  );
  const N = all.length;
  let r1 = 0;
  let tie = 0;
  for (let i = 0; i < N; ) {
    let j = i;
    while (j + 1 < N && all[j + 1].v === all[i].v) j++;
    const rank = (i + j) / 2 + 1;
    const t = j - i + 1;
    tie += t ** 3 - t;
    for (let k = i; k <= j; k++) if (all[k].g === 0) r1 += rank;
    i = j + 1;
  }
  const u1 = r1 - (n1 * (n1 + 1)) / 2;
  const mu = (n1 * n2) / 2;
  const sigma2 = ((n1 * n2) / 12) * (N + 1 - tie / (N * (N - 1)));
  if (sigma2 <= 0) return 1;
  const z = (Math.abs(u1 - mu) - 0.5) / Math.sqrt(sigma2);
  return Math.min(1, 2 * (1 - phi(Math.max(0, z))));
}

export function summarize(a) {
  return {
    n: a.length,
    median: median(a),
    mean: mean(a),
    p75: percentile(a, 0.75),
    p95: percentile(a, 0.95),
    min: Math.min(...a),
    max: Math.max(...a),
    stdev: stdev(a),
  };
}
