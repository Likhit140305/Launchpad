// Two-proportion z-test for A/B conversion, plus the helpers the dashboard needs.

/** Standard normal CDF via Abramowitz–Stegun 7.1.26 (error < 1.5e-7). */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

export type ArmStats = { visitors: number; conversions: number };

export type TestResult = {
  rateA: number;
  rateB: number;
  lift: number | null; // relative lift of B over A
  z: number | null;
  pValue: number | null;
  ready: boolean; // both arms reached the minimum sample
  significant: boolean; // ready && p < alpha
  winner: "A" | "B" | null;
};

/** A is the control. No verdict is ever returned before both arms reach minSample. */
export function twoProportionTest(a: ArmStats, b: ArmStats, minSample: number, alpha = 0.05): TestResult {
  const rateA = a.visitors ? a.conversions / a.visitors : 0;
  const rateB = b.visitors ? b.conversions / b.visitors : 0;
  const lift = rateA > 0 ? (rateB - rateA) / rateA : null;
  const ready = a.visitors >= minSample && b.visitors >= minSample;
  const pooled = a.visitors + b.visitors ? (a.conversions + b.conversions) / (a.visitors + b.visitors) : 0;
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / Math.max(a.visitors, 1) + 1 / Math.max(b.visitors, 1)));
  if (!a.visitors || !b.visitors || se === 0) {
    return { rateA, rateB, lift, z: null, pValue: null, ready, significant: false, winner: null };
  }
  const z = (rateB - rateA) / se;
  const pValue = 2 * (1 - normCdf(Math.abs(z)));
  const significant = ready && pValue < alpha;
  return { rateA, rateB, lift, z, pValue, ready, significant, winner: significant ? (z > 0 ? "B" : "A") : null };
}

/** Visitors needed per arm to detect `mde` relative lift at 95% / 80% power. */
export function requiredSamplePerArm(baseRate: number, mde: number): number {
  const p1 = baseRate;
  const p2 = baseRate * (1 + mde);
  const zA = 1.96;
  const zB = 0.8416;
  const pBar = (p1 + p2) / 2;
  const n = (zA * Math.sqrt(2 * pBar * (1 - pBar)) + zB * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2 / (p2 - p1) ** 2;
  return Math.ceil(n);
}
