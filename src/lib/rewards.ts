import { db } from "./db";
import { logEvent, type Campaign } from "./campaign";

/**
 * Referral → Registration → Attendance → Qualified → Reward.
 * A referral only qualifies when the referred student attended for at least
 * `minAttendanceMinutes`. Flagged referrals never qualify until an admin approves them.
 */
export async function qualifyReferrals(campaign: Campaign) {
  const min = campaign.cfg.minAttendanceMinutes;
  const ready = await db.referral.findMany({
    where: {
      status: "pending",
      referred: { campaignId: campaign.id, attendance: { minutes: { gte: min } } },
    },
    select: { id: true, referrerId: true, referredId: true, referred: { select: { isDemo: true } } },
  });
  if (ready.length) {
    await db.referral.updateMany({ where: { id: { in: ready.map((r) => r.id) } }, data: { status: "qualified", qualifiedAt: new Date() } });
    for (const r of ready) {
      await logEvent(campaign.id, "conversion_completed", {
        registrationId: r.referrerId,
        meta: { referredId: r.referredId },
        dedupeKey: `conv:${r.id}`,
        isDemo: r.referred.isDemo,
      });
    }
  }
  // A referral whose attendance was removed or reduced goes back to pending.
  await db.referral.updateMany({
    where: {
      status: "qualified",
      referred: { campaignId: campaign.id, OR: [{ attendance: null }, { attendance: { minutes: { lt: min } } }] },
    },
    data: { status: "pending", qualifiedAt: null },
  });
  return ready.length;
}

type Plan = { registrationId: string; kind: string; label: string; amountInr: number; status: string; qualifiedRefs: number; isDemo: boolean };

/** Rebuilds every un-issued reward from the current qualified referrals, inside the budget. */
export async function computeRewards(campaign: Campaign) {
  const { cfg } = campaign;
  const counts = await db.referral.groupBy({
    by: ["referrerId"],
    where: { status: "qualified", referrer: { campaignId: campaign.id } },
    _count: { _all: true },
    _max: { qualifiedAt: true },
  });
  const referrers = await db.registration.findMany({
    where: { id: { in: counts.map((c) => c.referrerId) } },
    select: { id: true, isDemo: true },
  });
  const demoById = new Map(referrers.map((r) => [r.id, r.isDemo]));
  // Rank: most qualified referrals first; ties go to whoever got there first.
  const ranked = counts
    .map((c) => ({ id: c.referrerId, n: c._count._all, last: c._max.qualifiedAt?.getTime() ?? 0 }))
    .sort((a, b) => b.n - a.n || a.last - b.last);

  const issued = await db.reward.findMany({ where: { registration: { campaignId: campaign.id }, status: "issued" } });
  const issuedKeys = new Set(issued.map((r) => `${r.registrationId}|${r.kind}|${r.label}`));
  let spent = issued.reduce((s, r) => s + r.amountInr, 0);
  const plans: Plan[] = [];

  cfg.leaderboardPrizes.forEach((amount, i) => {
    const who = ranked[i];
    if (!who || amount <= 0) return;
    const label = `#${i + 1} referrer prize`;
    if (issuedKeys.has(`${who.id}|leaderboard|${label}`)) return;
    plans.push({ registrationId: who.id, kind: "leaderboard", label, amountInr: amount, status: "eligible", qualifiedRefs: who.n, isDemo: demoById.get(who.id) ?? false });
  });
  spent += plans.reduce((s, p) => s + p.amountInr, 0);

  for (const who of ranked) {
    for (const tier of cfg.tiers) {
      if (who.n < tier.refs || issuedKeys.has(`${who.id}|tier|${tier.label}`)) continue;
      const fits = spent + tier.amountInr <= cfg.budgetInr;
      if (fits) spent += tier.amountInr;
      plans.push({
        registrationId: who.id,
        kind: "tier",
        label: tier.label,
        amountInr: tier.amountInr,
        status: fits ? "eligible" : "over_budget",
        qualifiedRefs: who.n,
        isDemo: demoById.get(who.id) ?? false,
      });
    }
  }

  await db.$transaction([
    db.reward.deleteMany({ where: { registration: { campaignId: campaign.id }, status: { in: ["eligible", "over_budget"] } } }),
    db.reward.createMany({ data: plans, skipDuplicates: true }),
  ]);
  return { created: plans.length, committedInr: spent, budgetInr: cfg.budgetInr };
}

/** Fraud signals checked at registration time (borrowed from the operations layer). */
export async function referralFlag(opts: { referrerId: string; referrerIpHash: string | null; ipHash: string; phone: string; referrerPhone: string }) {
  if (opts.referrerIpHash && opts.referrerIpHash === opts.ipHash) return "Same network as the referrer";
  if (opts.phone.slice(0, 7) === opts.referrerPhone.slice(0, 7)) return "Phone number close to the referrer's";
  const burst = await db.referral.count({ where: { referrerId: opts.referrerId, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
  if (burst >= 5) return "Burst: 5+ referrals in 10 minutes";
  return null;
}
