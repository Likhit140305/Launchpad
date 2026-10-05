import type { NextRequest } from "next/server";
import { getCampaign, maskName } from "@/lib/campaign";
import { referralLeaders } from "@/lib/analytics";
import { db } from "@/lib/db";
import { HttpError, json, rateLimit, route } from "@/lib/http";
import { originOf, referralKit } from "@/lib/kit";

/** Everything the personal tracker at /me/<code> shows. */
export const GET = route(async (req: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
  await rateLimit(req, "tracker", 60, 60);
  const { code: raw } = await ctx.params;
  const code = raw.toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(code)) throw new HttpError(404, "No referral link with that code.");
  const campaign = await getCampaign();
  const me = await db.registration.findFirst({
    where: { campaignId: campaign.id, code },
    include: {
      referralsMade: { include: { referred: { select: { name: true, college: true, createdAt: true, attendance: { select: { minutes: true } } } } }, orderBy: { createdAt: "desc" } },
      rewards: { orderBy: { createdAt: "asc" } },
      attendance: true,
    },
  });
  if (!me) throw new HttpError(404, "No referral link with that code.");

  const { cfg } = campaign;
  const qualified = me.referralsMade.filter((r) => r.status === "qualified").length;
  const joined = me.referralsMade.length;
  const leaders = await referralLeaders(campaign.id, 100);
  const rank = leaders.find((l) => l.id === me.id)?.rank ?? null;
  const nextTier = cfg.tiers.find((t) => t.refs > qualified) ?? null;

  return json({
    name: me.name.split(" ")[0],
    college: me.college,
    attended: me.attendance ? me.attendance.minutes >= cfg.minAttendanceMinutes : false,
    workshop: { title: cfg.workshopTitle, startsAt: cfg.startsAt, minAttendanceMinutes: cfg.minAttendanceMinutes },
    kit: referralKit(originOf(req), cfg, me.code),
    counts: {
      joined,
      qualified,
      pending: me.referralsMade.filter((r) => r.status === "pending").length,
      flagged: me.referralsMade.filter((r) => r.status === "flagged").length,
    },
    rank,
    tiers: cfg.tiers.map((t) => ({ ...t, joinedReached: joined >= t.refs, qualifiedReached: qualified >= t.refs })),
    nextTier: nextTier && { ...nextTier, toGo: nextTier.refs - qualified },
    leaderboardPrizes: cfg.leaderboardPrizes,
    friends: me.referralsMade.slice(0, 30).map((r) => ({
      name: maskName(r.referred.name),
      college: r.referred.college,
      joinedAt: r.referred.createdAt,
      status: r.status,
      attended: (r.referred.attendance?.minutes ?? 0) >= cfg.minAttendanceMinutes,
    })),
    rewards: me.rewards.map((r) => ({ label: r.label, amountInr: r.amountInr, status: r.status, kind: r.kind })),
  });
});
