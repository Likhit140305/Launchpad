import type { NextRequest } from "next/server";
import { getCampaign, logEvent } from "@/lib/campaign";
import { db } from "@/lib/db";
import { body, HttpError, json, requireAdmin, route } from "@/lib/http";
import { rewardActionSchema } from "@/lib/validation";

export const PATCH = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireAdmin(req);
  const { id } = await ctx.params;
  const { action } = await body(req, rewardActionSchema);
  const campaign = await getCampaign();
  const reward = await db.reward.findFirst({ where: { id, registration: { campaignId: campaign.id } } });
  if (!reward) throw new HttpError(404, "Reward not found.");
  if (action === "issue") {
    if (reward.status === "over_budget") throw new HttpError(409, "This reward is over budget. Raise the budget in Settings first.");
    if (reward.status === "issued") return json({ ok: true, status: "issued" });
    await db.reward.update({ where: { id }, data: { status: "issued", issuedAt: new Date() } });
    await logEvent(campaign.id, "reward_issued", { registrationId: reward.registrationId, meta: { label: reward.label, amountInr: reward.amountInr }, dedupeKey: `ri:${id}` });
    return json({ ok: true, status: "issued" });
  }
  const status = action === "reject" ? "rejected" : "eligible";
  await db.reward.update({ where: { id }, data: { status, issuedAt: null } });
  return json({ ok: true, status });
});
