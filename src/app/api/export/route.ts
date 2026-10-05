import { getCampaign, maskName } from "@/lib/campaign";
import { csvResponse, toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { HttpError, requireAdmin, route } from "@/lib/http";
import { originOf, referralKit } from "@/lib/kit";

/** GET /api/export?type=registrations | reminders | rewards */
export const GET = route(async (req) => {
  requireAdmin(req);
  const type = req.nextUrl.searchParams.get("type") ?? "registrations";
  const campaign = await getCampaign();
  const { cfg } = campaign;
  const stamp = new Date().toISOString().slice(0, 10);

  if (type === "registrations") {
    const rows = await db.registration.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: "asc" },
      include: { variant: { select: { key: true } }, referredBy: { select: { code: true } }, attendance: { select: { minutes: true } }, _count: { select: { referralsMade: true } } },
    });
    return csvResponse(
      `registrations-${stamp}.csv`,
      toCsv(
        ["registered_at", "name", "email", "phone", "college", "grad_year", "branch", "channel", "variant", "referred_by", "own_code", "friends_referred", "attended_minutes", "demo"],
        rows.map((r) => [r.createdAt, r.name, r.email, r.phone, r.college, r.gradYear, r.branch, r.channel, r.variant?.key, r.referredBy?.code, r.code, r._count.referralsMade, r.attendance?.minutes ?? "", r.isDemo ? "yes" : ""]),
      ),
    );
  }

  if (type === "reminders") {
    // One click-to-send WhatsApp message per registrant: works today, no Business API approval.
    const origin = originOf(req);
    const rows = await db.registration.findMany({ where: { campaignId: campaign.id }, orderBy: { createdAt: "asc" } });
    const when = new Date(cfg.startsAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
    return csvResponse(
      `whatsapp-reminders-${stamp}.csv`,
      toCsv(
        ["name", "phone", "college", "message_link"],
        rows.map((r) => {
          const kit = referralKit(origin, cfg, r.code);
          const msg = `Hi ${r.name.split(" ")[0]}! Your NxtWave AI workshop is on ${when} IST. Keep your laptop ready: you will ship a live AI project in 60 minutes. Add it to your calendar: ${kit.google}\nBring a friend with your link: ${kit.shareUrl}`;
          return [r.name, r.phone, r.college, `https://wa.me/91${r.phone}?text=${encodeURIComponent(msg)}`];
        }),
      ),
    );
  }

  if (type === "rewards") {
    const rows = await db.reward.findMany({
      where: { registration: { campaignId: campaign.id } },
      orderBy: [{ status: "asc" }, { amountInr: "desc" }],
      include: { registration: true },
    });
    return csvResponse(
      `rewards-${stamp}.csv`,
      toCsv(
        ["status", "reward", "amount_inr", "qualified_referrals", "name", "public_name", "phone", "email", "college", "code"],
        rows.map((r) => [r.status, r.label, r.amountInr, r.qualifiedRefs, r.registration.name, maskName(r.registration.name), r.registration.phone, r.registration.email, r.registration.college, r.registration.code]),
      ),
    );
  }

  throw new HttpError(400, "Unknown export type. Use registrations, reminders or rewards.");
});
