import { z } from "zod";

// Everything a growth person changes between campaigns lives here and is
// editable live from /admin. Code never hard-codes campaign copy or numbers.
export const tierSchema = z.object({
  refs: z.number().int().min(1).max(100),
  label: z.string().trim().min(2).max(80),
  amountInr: z.number().int().min(0).max(2000),
});

export const campaignConfigSchema = z
  .object({
    workshopTitle: z.string().trim().min(4).max(90),
    workshopTagline: z.string().trim().min(4).max(200),
    startsAt: z.iso.datetime({ offset: true }),
    campaignStart: z.iso.datetime({ offset: true }),
    campaignEnd: z.iso.datetime({ offset: true }),
    goal: z.number().int().min(10).max(1_000_000),
    budgetInr: z.number().int().min(0).max(10_000_000),
    gradYears: z.array(z.number().int().min(2024).max(2032)).min(1).max(6),
    targetGradYear: z.number().int().min(2024).max(2032),
    showCounterAfter: z.number().int().min(0).max(100_000),
    minAttendanceMinutes: z.number().int().min(1).max(240),
    tiers: z.array(tierSchema).min(1).max(6),
    leaderboardPrizes: z.array(z.number().int().min(0).max(2000)).max(5),
    whatsappShareText: z.string().trim().min(10).max(400),
    agenda: z
      .array(z.object({ minute: z.number().int().min(0).max(240), title: z.string().trim().min(2).max(60), detail: z.string().trim().min(2).max(160) }))
      .min(2)
      .max(10),
    faq: z.array(z.object({ q: z.string().trim().min(4).max(140), a: z.string().trim().min(4).max(500) })).max(10),
  })
  .refine((c) => new Date(c.campaignStart) < new Date(c.campaignEnd), {
    message: "Campaign start must be before campaign end",
    path: ["campaignEnd"],
  })
  .refine((c) => c.gradYears.includes(c.targetGradYear), {
    message: "Target graduation year must be one of the accepted years",
    path: ["targetGradYear"],
  })
  .refine((c) => c.tiers.every((t, i, a) => i === 0 || t.refs > a[i - 1].refs), {
    message: "Reward tiers must be in increasing order of referrals",
    path: ["tiers"],
  })
  .refine(
    (c) => c.leaderboardPrizes.reduce((s, n) => s + n, 0) <= c.budgetInr,
    { message: "Leaderboard prizes exceed the budget", path: ["leaderboardPrizes"] },
  );

export type CampaignConfig = z.infer<typeof campaignConfigSchema>;

const IST = "+05:30";

function istDate(base: Date, addDays: number, hh: number, mm = 0) {
  const d = new Date(base.getTime() + addDays * 86_400_000);
  const ist = new Date(d.getTime() + 5.5 * 3_600_000);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const day = String(ist.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00${IST}`;
}

/** Default 7-day campaign anchored to `start`, workshop the morning after it ends. */
export function defaultConfig(start = new Date()): CampaignConfig {
  const year = new Date(start.getTime() + 5.5 * 3_600_000).getUTCFullYear();
  const target = start.getUTCMonth() >= 6 ? year + 1 : year;
  return {
    workshopTitle: "Build Your First AI Project in 60 Minutes",
    workshopTagline:
      "A free, live NxtWave workshop for final-year engineers. You leave with a working AI app on a public link, ready for your resume and your placement interviews.",
    startsAt: istDate(start, 7, 11),
    campaignStart: istDate(start, 0, 0),
    campaignEnd: istDate(start, 6, 23, 59),
    goal: 500,
    budgetInr: 2000,
    gradYears: [target - 1, target, target + 1],
    targetGradYear: target,
    showCounterAfter: 50,
    minAttendanceMinutes: 30,
    tiers: [
      { refs: 1, label: "Workshop project template pack", amountInr: 0 },
      { refs: 3, label: "Certificate of community leadership", amountInr: 0 },
      { refs: 5, label: "₹100 Amazon voucher", amountInr: 100 },
    ],
    leaderboardPrizes: [500, 300, 200],
    whatsappShareText:
      "I just signed up for NxtWave's free live workshop: build your first AI project in 60 minutes and leave with a live link for your resume. Join with my link:",
    agenda: [
      { minute: 0, title: "Pick a problem", detail: "Choose one of five campus-sized ideas: notes summariser, placement Q&A bot, timetable helper, resume reviewer or fest FAQ bot." },
      { minute: 10, title: "Prompt it", detail: "Write and test the system prompt that makes the model behave like your product." },
      { minute: 25, title: "Wire the API", detail: "Call a real LLM API from a small web app, with your key kept server-side." },
      { minute: 40, title: "Give it a face", detail: "Add a clean interface using an AI coding assistant, then fix what it gets wrong." },
      { minute: 50, title: "Ship it live", detail: "Deploy to a public URL you can paste into your resume and LinkedIn." },
      { minute: 60, title: "Show it off", detail: "Share your link in the live chat. Best three projects get a shout-out from the NxtWave team." },
    ],
    faq: [
      { q: "Is it really free?", a: "Yes. The workshop, the starter code and the certificate of participation cost nothing." },
      { q: "Do I need to know AI or machine learning?", a: "No. If you can write a basic program in any language, you can finish. We use an AI assistant to write the parts you have not learned yet." },
      { q: "What do I need on the day?", a: "A laptop with a browser and a stable internet connection. We send setup steps on WhatsApp the day before." },
      { q: "Who is it for?", a: "Final-year engineering students of any branch. Pre-final-year students are welcome too." },
      { q: "Will there be a recording?", a: "Only live attendees get the project template and the participation certificate, so plan to join live." },
    ],
  };
}

export function parseConfig(raw: unknown): CampaignConfig {
  const parsed = campaignConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : defaultConfig();
}
