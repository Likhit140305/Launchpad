import { referralLeaders } from "@/lib/analytics";
import { getCampaign } from "@/lib/campaign";
import { json, rateLimit, route } from "@/lib/http";

/** Public top-10. Names are masked ("Sneha R."); codes and contact details never leave the server. */
export const GET = route(async (req) => {
  await rateLimit(req, "leaderboard", 60, 60);
  const campaign = await getCampaign();
  const leaders = await referralLeaders(campaign.id, 10);
  return json({
    leaders: leaders.map((l) => ({ rank: l.rank, name: l.display, college: l.college, joined: l.refs, qualified: l.qualified })),
    prizes: campaign.cfg.leaderboardPrizes,
  });
});
