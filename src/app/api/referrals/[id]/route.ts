import type { NextRequest } from "next/server";
import { getCampaign } from "@/lib/campaign";
import { db } from "@/lib/db";
import { body, HttpError, json, requireAdmin, route } from "@/lib/http";
import { computeRewards, qualifyReferrals } from "@/lib/rewards";
import { referralActionSchema } from "@/lib/validation";

/** Review queue: approve a flagged referral (back to pending, may qualify) or flag one by hand. */
export const PATCH = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireAdmin(req);
  const { id } = await ctx.params;
  const input = await body(req, referralActionSchema);
  const campaign = await getCampaign();
  const ref = await db.referral.findFirst({ where: { id, referrer: { campaignId: campaign.id } } });
  if (!ref) throw new HttpError(404, "Referral not found.");
  await db.referral.update({
    where: { id },
    data: input.action === "approve" ? { status: "pending", flagReason: null } : { status: "flagged", flagReason: input.reason || "Flagged by reviewer", qualifiedAt: null },
  });
  await qualifyReferrals(campaign);
  await computeRewards(campaign);
  return json({ ok: true });
});
