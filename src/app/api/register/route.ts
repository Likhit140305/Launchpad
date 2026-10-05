import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCampaign, logEvent, makeCode, normaliseChannel, activeExperiment } from "@/lib/campaign";
import { body, HttpError, ipHash, json, rateLimit, route } from "@/lib/http";
import { originOf, referralKit } from "@/lib/kit";
import { referralFlag } from "@/lib/rewards";
import { registerSchema } from "@/lib/validation";

export const POST = route(async (req) => {
  await rateLimit(req, "register", 8, 600);
  const input = await body(req, registerSchema);
  const campaign = await getCampaign();
  const { cfg } = campaign;

  if (Date.now() > new Date(cfg.startsAt).getTime() + 30 * 60_000) {
    throw new HttpError(410, "Registrations for this workshop have closed.");
  }
  if (!cfg.gradYears.includes(input.gradYear)) {
    throw new HttpError(400, "Please fix the highlighted fields.", { fields: { gradYear: `This workshop is for the ${cfg.gradYears.join(", ")} batches` } });
  }

  const origin = originOf(req);
  const existing = await db.registration.findMany({
    where: { campaignId: campaign.id, OR: [{ email: input.email }, { phone: input.phone }] },
  });
  const same = existing.find((r) => r.email === input.email && r.phone === input.phone);
  if (same) {
    // Same person submitting again (double tap, back button): idempotent, hand back their kit.
    return json({ ok: true, again: true, name: same.name, ...referralKit(origin, cfg, same.code) }, 200);
  }
  if (existing.length) {
    const fields: Record<string, string> = {};
    if (existing.some((r) => r.email === input.email)) fields.email = "This email is already registered with a different phone number";
    if (existing.some((r) => r.phone === input.phone)) fields.phone = "This number is already registered with a different email";
    throw new HttpError(409, "You may already be registered.", { fields });
  }

  let channel = normaliseChannel(input.channel);
  const referrer = input.ref ? await db.registration.findFirst({ where: { campaignId: campaign.id, code: input.ref } }) : null;
  if (referrer && channel === "direct") channel = "referral";
  const ambassador = channel.startsWith("amb_") ? await db.ambassador.findFirst({ where: { campaignId: campaign.id, tag: channel } }) : null;

  let variantId: string | null = null;
  if (input.visitorId) {
    const exp = await activeExperiment(campaign.id);
    if (exp) {
      const a = await db.experimentAssignment.findUnique({ where: { experimentId_visitorId: { experimentId: exp.id, visitorId: input.visitorId } } });
      variantId = a?.variantId ?? null;
    }
  }

  const hash = ipHash(req);
  let reg = null;
  for (let attempt = 0; attempt < 4 && !reg; attempt++) {
    try {
      reg = await db.registration.create({
        data: {
          campaignId: campaign.id,
          name: input.name,
          email: input.email,
          phone: input.phone,
          college: input.college,
          gradYear: input.gradYear,
          branch: input.branch || null,
          code: makeCode(input.name),
          channel,
          visitorId: input.visitorId ?? null,
          variantId,
          ipHash: hash,
          referredById: referrer?.id ?? null,
          ambassadorId: ambassador?.id ?? null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const target = String((err.meta as { target?: unknown })?.target ?? "");
        if (target.includes("code")) continue; // referral code collision: roll a new one
        throw new HttpError(409, "You may already be registered.", { fields: { email: "This email or phone was just registered" } });
      }
      throw err;
    }
  }
  if (!reg) throw new HttpError(503, "Could not create your referral code. Please try again.");

  if (referrer) {
    const flag = await referralFlag({ referrerId: referrer.id, referrerIpHash: referrer.ipHash, ipHash: hash, phone: reg.phone, referrerPhone: referrer.phone });
    await db.referral.create({ data: { referrerId: referrer.id, referredId: reg.id, status: flag ? "flagged" : "pending", flagReason: flag } });
  }
  await logEvent(campaign.id, "registration_completed", {
    visitorId: input.visitorId,
    registrationId: reg.id,
    variantId,
    channel,
    dedupeKey: `rc:${reg.id}`,
  });

  return json({ ok: true, again: false, name: reg.name, ...referralKit(origin, cfg, reg.code) }, 201);
});
