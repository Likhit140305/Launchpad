import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const campaign = await db.campaign.findUnique({ where: { slug: "launchpad" } });
  if (!campaign) {
    console.error("No launchpad campaign found.");
    return;
  }

  // Create experiment
  await db.experiment.upsert({
    where: { campaignId_key: { campaignId: campaign.id, key: "hero-messaging" } },
    create: {
      campaignId: campaign.id,
      key: "hero-messaging",
      name: "Hero Message Test",
      status: "running",
      minSamplePerArm: 300,
      variants: {
        create: [
          {
            key: "A",
            headline: "Walk into placements with a live AI project on your resume.",
            subhead: "One free hour with NxtWave. One working AI app, deployed and yours to show recruiters.",
            cta: "Reserve my free spot →",
            isControl: true,
            weight: 34
          },
          {
            key: "B",
            headline: "Your final year is coming. Build something worth showing recruiters.",
            subhead: "One free hour with NxtWave. One working AI app, deployed and yours to show recruiters.",
            cta: "Reserve my free spot →",
            isControl: false,
            weight: 33
          },
          {
            key: "C",
            headline: "Build and deploy your first AI project in 60 minutes.",
            subhead: "One free hour with NxtWave. One working AI app, deployed and yours to show recruiters.",
            cta: "Reserve my free spot →",
            isControl: false,
            weight: 33
          }
        ]
      }
    },
    update: {
      status: "running"
    }
  });
  console.log("Experiment created!");
}

main().catch(console.error).finally(() => db.$disconnect());
