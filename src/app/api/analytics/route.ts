import { experimentReport, referralLeaders, summary } from "@/lib/analytics";
import { getCampaign } from "@/lib/campaign";
import { db } from "@/lib/db";
import { adminKeyIsDefault, json, requireAdmin, route } from "@/lib/http";

/** One call feeds the whole growth dashboard. */
export const GET = route(async (req) => {
  requireAdmin(req);
  const campaign = await getCampaign();
  const [s, experiments, leaders, ambassadors, flagged, rewards, workshops] = await Promise.all([
    summary(campaign),
    experimentReport(campaign),
    referralLeaders(campaign.id, 15),
    db.ambassador.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: "asc" },
      include: { registrations: { select: { id: true, attendance: { select: { minutes: true } } } } },
    }),
    db.referral.findMany({
      where: { status: "flagged", referrer: { campaignId: campaign.id } },
      take: 25,
      orderBy: { createdAt: "desc" },
      include: { referrer: { select: { name: true, code: true } }, referred: { select: { name: true, college: true, phone: true } } },
    }),
    db.reward.findMany({
      where: { registration: { campaignId: campaign.id } },
      orderBy: [{ status: "asc" }, { amountInr: "desc" }],
      include: { registration: { select: { name: true, phone: true, college: true, code: true } } },
    }),
    db.workshop.findMany({ where: { campaignId: campaign.id }, orderBy: { startsAt: "asc" }, include: { _count: { select: { attendance: true } } } }),
  ]);
  const min = campaign.cfg.minAttendanceMinutes;
  return json({
    campaign: { name: campaign.name, config: campaign.cfg },
    summary: s,
    experiments,
    leaders,
    ambassadors: ambassadors
      .map((a) => ({
        id: a.id,
        name: a.name,
        college: a.college,
        tag: a.tag,
        registrations: a.registrations.length,
        attended: a.registrations.filter((r) => (r.attendance?.minutes ?? 0) >= min).length,
      }))
      .sort((a, b) => b.registrations - a.registrations),
    flagged: flagged.map((f) => ({
      id: f.id,
      reason: f.flagReason,
      referrer: `${f.referrer.name} (${f.referrer.code})`,
      referred: `${f.referred.name}, ${f.referred.college}`,
      createdAt: f.createdAt,
    })),
    rewards: rewards.map((r) => ({
      id: r.id,
      kind: r.kind,
      label: r.label,
      amountInr: r.amountInr,
      status: r.status,
      qualifiedRefs: r.qualifiedRefs,
      name: r.registration.name,
      college: r.registration.college,
      code: r.registration.code,
      phone: r.registration.phone,
    })),
    workshops: workshops.map((w) => ({ id: w.id, title: w.title, startsAt: w.startsAt, attendance: w._count.attendance })),
    security: { defaultAdminKey: adminKeyIsDefault() },
  });
});
