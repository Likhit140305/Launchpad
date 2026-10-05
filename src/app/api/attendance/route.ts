import { getCampaign, logEvent } from "@/lib/campaign";
import { parseCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { body, HttpError, json, requireAdmin, route } from "@/lib/http";
import { computeRewards, qualifyReferrals } from "@/lib/rewards";
import { attendanceImportSchema } from "@/lib/validation";

/**
 * Bulk attendance import from a Zoom / Google Meet / Teams participant report.
 * Columns are found by name (email, phone/mobile, duration/minutes), so the raw
 * export can be pasted as-is. Re-importing is safe: each student keeps their longest time.
 */
export const POST = route(async (req) => {
  requireAdmin(req);
  const input = await body(req, attendanceImportSchema, 2_100_000);
  const campaign = await getCampaign();
  const workshop = input.workshopId
    ? await db.workshop.findFirst({ where: { id: input.workshopId, campaignId: campaign.id } })
    : await db.workshop.findFirst({ where: { campaignId: campaign.id }, orderBy: { startsAt: "desc" } });
  if (!workshop) throw new HttpError(404, "Workshop not found.");

  const rows = parseCsv(input.csv);
  if (rows.length < 2) throw new HttpError(400, "The CSV needs a header row and at least one attendee.");
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (re: RegExp) => header.findIndex((h) => re.test(h));
  const iEmail = col(/e-?mail/);
  const iPhone = col(/phone|mobile|whatsapp/);
  const iMinutes = col(/duration|minutes|time in/);
  if (iEmail < 0 && iPhone < 0) throw new HttpError(400, "Could not find an email or phone column in the header row.");
  if (iMinutes < 0) throw new HttpError(400, "Could not find a duration / minutes column in the header row.");

  // Meeting reports list one row per join; a student who rejoined appears twice. Sum per person.
  const byKey = new Map<string, { email?: string; phone?: string; minutes: number }>();
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const email = iEmail >= 0 ? row[iEmail]?.trim().toLowerCase() : undefined;
    const phone = iPhone >= 0 ? row[iPhone]?.replace(/\D/g, "").slice(-10) : undefined;
    const minutes = Math.round(Number.parseFloat((row[iMinutes] ?? "").replace(/[^\d.]/g, "")));
    if ((!email && !phone) || !Number.isFinite(minutes) || minutes < 0) {
      skipped++;
      continue;
    }
    const key = email || phone!;
    const prev = byKey.get(key);
    byKey.set(key, { email, phone, minutes: Math.min(600, (prev?.minutes ?? 0) + minutes) });
  }

  const people = [...byKey.values()];
  const regs = await db.registration.findMany({
    where: {
      campaignId: campaign.id,
      OR: [{ email: { in: people.map((p) => p.email).filter(Boolean) as string[] } }, { phone: { in: people.map((p) => p.phone).filter(Boolean) as string[] } }],
    },
    include: { attendance: true },
  });
  const byEmail = new Map(regs.map((r) => [r.email, r]));
  const byPhone = new Map(regs.map((r) => [r.phone, r]));
  let matched = 0;
  const unmatched: string[] = [];
  for (const p of people) {
    const reg = (p.email && byEmail.get(p.email)) || (p.phone && byPhone.get(p.phone));
    if (!reg) {
      unmatched.push(p.email || p.phone || "?");
      continue;
    }
    matched++;
    const minutes = Math.max(p.minutes, reg.attendance?.minutes ?? 0);
    await db.attendance.upsert({
      where: { registrationId: reg.id },
      create: { registrationId: reg.id, workshopId: workshop.id, minutes, source: "import" },
      update: { minutes, workshopId: workshop.id },
    });
    if (minutes >= campaign.cfg.minAttendanceMinutes) {
      await logEvent(campaign.id, "workshop_attended", { registrationId: reg.id, meta: { minutes }, dedupeKey: `wa:${reg.id}` });
    }
  }

  const newlyQualified = await qualifyReferrals(campaign);
  const rewards = await computeRewards(campaign);
  return json({ ok: true, workshop: workshop.title, rows: rows.length - 1, people: people.length, matched, unmatched: unmatched.slice(0, 50), unmatchedCount: unmatched.length, skipped, newlyQualified, rewards });
});
