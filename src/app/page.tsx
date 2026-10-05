import { getCampaign, publicConfig } from "@/lib/campaign";
import Landing from "@/components/landing";

export const dynamic = "force-dynamic";

export default async function Page() {
  const campaign = await getCampaign();
  return <Landing initialConfig={publicConfig(campaign.cfg)} />;
}
