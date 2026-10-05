import { Prisma } from "@prisma/client";
import { db } from "./db";
import { activeExperiment, channelFamily, maskName, type Campaign } from "./campaign";
import { requiredSamplePerArm, twoProportionTest } from "./stats";

const DAY = 86_400_000;

function istDay(d: Date) {
  return new Date(d.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
}

export async function summary(campaign: Campaign) {
  const cid = campaign.id;
  const { cfg } = campaign;
  const start = new Date(cfg.campaignStart);
  const end = new Date(cfg.campaignEnd);
  const now = new Date();

  const [total, byDayRaw, distinct, channelVisits, channelRegs, colleges, gradYears, referralStats, attendedCount, demoCount] = await Promise.all([
    db.registration.count({ where: { campaignId: cid } }),
    db.$queryRaw<{ day: string; n: bigint }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day, count(*) AS n
      FROM "Registration" WHERE "campaignId" = ${cid} GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ type: string; n: bigint }[]>`
      SELECT type, count(DISTINCT COALESCE("visitorId", "registrationId")) AS n
      FROM "Event" WHERE "campaignId" = ${cid}
        AND type IN ('page_view','registration_started','whatsapp_shared','link_copied')
      GROUP BY type`,
    db.$queryRaw<{ channel: string; n: bigint }[]>`
      SELECT COALESCE(channel, 'direct') AS channel, count(DISTINCT "visitorId") AS n
      FROM "Event" WHERE "campaignId" = ${cid} AND type = 'page_view' GROUP BY 1`,
    db.registration.groupBy({ by: ["channel"], where: { campaignId: cid }, _count: { _all: true } }),
    db.$queryRaw<{ college: string; n: bigint; attended: bigint }[]>`
      SELECT r.college, count(*) AS n, count(a.id) AS attended
      FROM "Registration" r LEFT JOIN "Attendance" a ON a."registrationId" = r.id
      WHERE r."campaignId" = ${cid} GROUP BY r.college ORDER BY n DESC LIMIT 8`,
    db.registration.groupBy({ by: ["gradYear"], where: { campaignId: cid }, _count: { _all: true }, orderBy: { gradYear: "asc" } }),
    db.referral.groupBy({ by: ["status"], where: { referrer: { campaignId: cid } }, _count: { _all: true } }),
    db.attendance.count({ where: { registration: { campaignId: cid }, minutes: { gte: cfg.minAttendanceMinutes } } }),
    db.registration.count({ where: { campaignId: cid, isDemo: true } }),
  ]);

  // Daily series with the pace line the goal needs.
  const counts = new Map(byDayRaw.map((r) => [r.day, Number(r.n)]));
  const days: { day: string; registrations: number; cumulative: number | null; pace: number }[] = [];
  const today = istDay(now);
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY));
  let cum = 0;
  for (let i = 0; i < totalDays; i++) {
    const day = istDay(new Date(start.getTime() + i * DAY + 6 * 3_600_000));
    const n = counts.get(day) ?? 0;
    cum += n;
    days.push({ day, registrations: n, cumulative: day <= today ? cum : null, pace: Math.round((cfg.goal * (i + 1)) / totalDays) });
  }
  const elapsedDays = Math.min(totalDays, Math.max(0, (now.getTime() - start.getTime()) / DAY));
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY));
  const remaining = Math.max(0, cfg.goal - total);
  const dailyAvg = elapsedDays > 0.25 ? total / elapsedDays : 0;

  const d = Object.fromEntries(distinct.map((r) => [r.type, Number(r.n)]));
  const referralsBy = Object.fromEntries(referralStats.map((r) => [r.status, r._count._all]));
  const referralTotal = Object.values(referralsBy).reduce((s, n) => s + n, 0);
  const referrersCount = await db.registration.count({ where: { campaignId: cid, referralsMade: { some: {} } } });
  const sharedRegs = await db.event.findMany({
    where: { campaignId: cid, type: { in: ["whatsapp_shared", "link_copied"] }, registrationId: { not: null } },
    distinct: ["registrationId"],
    select: { registrationId: true },
  });

  // Channel table grouped by family.
  const fam = new Map<string, { channel: string; visitors: number; registrations: number; tags: Set<string> }>();
  const bump = (channel: string, k: "visitors" | "registrations", n: number) => {
    const f = channelFamily(channel);
    const row = fam.get(f) ?? { channel: f, visitors: 0, registrations: 0, tags: new Set<string>() };
    row[k] += n;
    row.tags.add(channel);
    fam.set(f, row);
  };
  channelVisits.forEach((r) => bump(r.channel, "visitors", Number(r.n)));
  channelRegs.forEach((r) => bump(r.channel, "registrations", r._count._all));
  const channels = [...fam.values()]
    .map((r) => ({ channel: r.channel, visitors: r.visitors, registrations: r.registrations, tags: [...r.tags].slice(0, 6), rate: r.visitors ? r.registrations / r.visitors : null }))
    .sort((a, b) => b.registrations - a.registrations);

  return {
    goal: cfg.goal,
    total,
    remaining,
    daysLeft,
    neededPerDay: daysLeft ? Math.ceil(remaining / daysLeft) : remaining,
    dailyAvg: Math.round(dailyAvg * 10) / 10,
    forecast: Math.round(dailyAvg * totalDays),
    days,
    funnel: [
      { step: "Visited", n: d.page_view ?? 0 },
      { step: "Started form", n: d.registration_started ?? 0 },
      { step: "Registered", n: total },
      { step: "Shared link", n: sharedRegs.length },
      { step: "Referred a friend", n: referrersCount },
      { step: "Attended", n: attendedCount },
    ],
    channels,
    colleges: colleges.map((c) => ({ college: c.college, registrations: Number(c.n), attended: Number(c.attended) })),
    gradYears: gradYears.map((g) => ({ year: g.gradYear, n: g._count._all, target: g.gradYear === cfg.targetGradYear })),
    referrals: {
      total: referralTotal,
      qualified: referralsBy.qualified ?? 0,
      pending: referralsBy.pending ?? 0,
      flagged: referralsBy.flagged ?? 0,
      // Share of all registrations that came in through a friend's link.
      viralShare: total ? referralTotal / total : 0,
      // Average referrals per registrant: the k in "each student brings k more".
      k: total ? referralTotal / total : 0,
      referrers: referrersCount,
    },
    attendance: { attended: attendedCount, showRate: total ? attendedCount / total : 0 },
    demoRecords: demoCount,
  };
}

export async function experimentReport(campaign: Campaign) {
  const exps = await db.experiment.findMany({
    where: { campaignId: campaign.id },
    orderBy: { createdAt: "desc" },
    include: { variants: { orderBy: { key: "asc" } } },
  });
  const active = await activeExperiment(campaign.id);
  const report = [];
  for (const exp of exps) {
    const arms = await Promise.all(
      exp.variants.map(async (v) => ({
        id: v.id,
        key: v.key,
        headline: v.headline,
        subhead: v.subhead,
        cta: v.cta,
        isControl: v.isControl,
        weight: v.weight,
        visitors: await db.experimentAssignment.count({ where: { variantId: v.id } }),
        conversions: await db.registration.count({ where: { variantId: v.id } }),
      })),
    );
    const control = arms.find((a) => a.isControl) ?? arms[0];
    const challengers = arms
      .filter((a) => a.id !== control?.id)
      .map((a) => ({ id: a.id, key: a.key, test: twoProportionTest(control, a, exp.minSamplePerArm) }));
    const base = control && control.visitors ? control.conversions / control.visitors : 0.12;
    report.push({
      id: exp.id,
      key: exp.key,
      name: exp.name,
      hypothesis: exp.hypothesis,
      status: exp.status,
      isActive: active?.id === exp.id,
      minSamplePerArm: exp.minSamplePerArm,
      suggestedSamplePerArm: requiredSamplePerArm(Math.min(Math.max(base, 0.02), 0.6), 0.25),
      winnerVariantId: exp.winnerVariantId,
      promotedAt: exp.promotedAt,
      arms,
      challengers,
    });
  }
  return report;
}

export async function referralLeaders(campaignId: string, limit = 10) {
  const rows = await db.$queryRaw<{ id: string; name: string; college: string; code: string; refs: bigint; qualified: bigint; flagged: bigint }[]>`
    SELECT r.id, r.name, r.college, r.code,
      count(f.id) AS refs,
      count(f.id) FILTER (WHERE f.status = 'qualified') AS qualified,
      count(f.id) FILTER (WHERE f.status = 'flagged') AS flagged
    FROM "Registration" r JOIN "Referral" f ON f."referrerId" = r.id
    WHERE r."campaignId" = ${campaignId}
    GROUP BY r.id ORDER BY qualified DESC, refs DESC, min(f."createdAt") ASC
    LIMIT ${Prisma.raw(String(Math.max(1, Math.min(100, limit))))}`;
  return rows.map((r, i) => ({
    rank: i + 1,
    id: r.id,
    name: r.name,
    display: maskName(r.name),
    college: r.college,
    code: r.code,
    refs: Number(r.refs),
    qualified: Number(r.qualified),
    flagged: Number(r.flagged),
  }));
}
