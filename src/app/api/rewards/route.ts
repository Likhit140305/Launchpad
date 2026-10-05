import { getCampaign } from "@/lib/campaign";
import { json, requireAdmin, route } from "@/lib/http";
import { computeRewards, qualifyReferrals } from "@/lib/rewards";

/** Re-run qualification and rebuild the reward list (issued rewards are never touched). */
export const POST = route(async (req) => {
  requireAdmin(req);
  const campaign = await getCampaign();
  const newlyQualified = await qualifyReferrals(campaign);
  const result = await computeRewards(campaign);
  return json({ ok: true, newlyQualified, ...result });
});
