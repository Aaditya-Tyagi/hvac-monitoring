// Pure numeric helpers. No RN imports. Used in both the runtime engine and the
// vitest suite — keep allocations modest, accept arrays/numbers, return numbers.

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i];
  return s / xs.length;
}

export function std(xs: readonly number[], mu?: number): number {
  if (xs.length < 2) return 0;
  const m = mu ?? mean(xs);
  let v = 0;
  for (let i = 0; i < xs.length; i++) {
    const d = xs[i] - m;
    v += d * d;
  }
  return Math.sqrt(v / (xs.length - 1));
}

export function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const a = [...xs].sort((p, q) => p - q);
  const mid = a.length >> 1;
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

// Median absolute deviation, scaled by 1.4826 to be a robust σ-estimate
// under a normal distribution. Used for peer comparison — resists outliers
// (e.g. one bad unit pulling the median).
export function mad(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const m = median(xs);
  const abs = xs.map((x) => Math.abs(x - m));
  return median(abs) * 1.4826;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

// Robust z-score: |value - center| / max(scale, floor).
// `floor` prevents divide-by-tiny which is THE failure mode of threshold-style
// detection — a quiet sensor with std ≈ 0 sees infinite z on any wiggle.
export function safeZ(value: number, center: number, scale: number, floor: number): number {
  const denom = Math.max(scale, floor);
  return (value - center) / denom;
}
