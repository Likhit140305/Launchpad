"use client";

import { motion } from "motion/react";
import { CalendarPlus, Check, Clock, Copy, Flag, Loader2, Send, Trophy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { istLabel, track } from "@/lib/client";
import { Wordmark } from "./brand";

type Data = {
  name: string;
  college: string;
  attended: boolean;
  workshop: { title: string; startsAt: string; minAttendanceMinutes: number };
  kit: { code: string; shareUrl: string; whatsapp: string; telegram: string; linkedin: string; google: string; ics: string };
  counts: { joined: number; qualified: number; pending: number; flagged: number };
  rank: number | null;
  tiers: { refs: number; label: string; amountInr: number; joinedReached: boolean; qualifiedReached: boolean }[];
  nextTier: { refs: number; label: string; toGo: number } | null;
  leaderboardPrizes: number[];
  friends: { name: string; college: string; joinedAt: string; status: string; attended: boolean }[];
  rewards: { label: string; amountInr: number; status: string; kind: string }[];
};

export default function Tracker({ code }: { code: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/referral/${code}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "Could not load your referrals.");
        setData(j);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [code]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000); // friends joining show up without a refresh
    return () => clearInterval(t);
  }, [load]);

  if (error && !data) {
    return (
      <Shell>
        <div className="mx-auto max-w-md py-24 text-center">
          <h1 className="font-display text-3xl font-extrabold text-ink">We couldn&apos;t find that link</h1>
          <p className="mt-3 text-ink-soft">{error} Check the code in your confirmation message, or register to get your own.</p>
          <Link href="/#register" className="mt-6 inline-block rounded-[10px] bg-marigold-400 px-5 py-3 font-display font-bold text-navy-950">
            Register for the workshop
          </Link>
        </div>
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 py-32 text-ink-soft">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Loading your referrals...
        </div>
      </Shell>
    );
  }

  const top = data.tiers[data.tiers.length - 1]?.refs ?? 1;
  const progress = Math.min(1, data.counts.qualified / top);
  const share = (target: string) => track(target === "copy" ? "link_copied" : "whatsapp_shared", { code: data.kit.code, channel: "referral", meta: { target } });

  async function copy() {
    try {
      await navigator.clipboard.writeText(data!.kit.shareUrl);
      setCopied(true);
      share("copy");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy your link", data!.kit.shareUrl);
    }
  }

  return (
    <Shell>
      <section className="on-navy bg-navy-900 text-white">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 pb-10 pt-4 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:pb-14">
          <div>
            <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.025em] sm:text-5xl">
              {data.counts.joined === 0 ? `Your link is ready, ${data.name}.` : `${data.counts.joined} ${data.counts.joined === 1 ? "friend has" : "friends have"} joined, ${data.name}.`}
            </h1>
            <p className="mt-3 max-w-[50ch] text-lg text-navy-100">
              {data.nextTier
                ? `${data.nextTier.toGo} more ${data.nextTier.toGo === 1 ? "friend" : "friends"} attending unlocks: ${data.nextTier.label}.`
                : "Every reward tier is unlocked. Keep going for the leaderboard prizes."}
            </p>
            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <Stat value={data.counts.joined} label="registered" />
              <Stat value={data.counts.qualified} label="attended (counts for rewards)" />
              <Stat value={data.rank ? `#${data.rank}` : "–"} label="on the leaderboard" />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 text-ink">
            <p className="text-sm font-semibold text-ink-soft">Your invite link</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate font-sans text-lg font-bold text-blue-700">{data.kit.shareUrl.replace(/^https?:\/\//, "")}</code>
              <button onClick={copy} className="flex items-center gap-1.5 rounded-lg border border-navy-200 px-3 py-1.5 text-sm font-semibold hover:border-blue-600">
                {copied ? <Check className="h-4 w-4 text-mint-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <a
              href={data.kit.whatsapp}
              target="_blank"
              rel="noopener"
              onClick={() => share("whatsapp")}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#1fa855] px-5 py-3 font-display text-lg font-bold text-white hover:bg-[#178a45]"
            >
              <Send className="h-5 w-5" aria-hidden /> Share on WhatsApp
            </a>
            <div className="mt-2 grid grid-cols-3 gap-2 text-sm font-semibold">
              <a href={data.kit.telegram} target="_blank" rel="noopener" onClick={() => share("telegram")} className="rounded-lg border border-navy-200 py-2 text-center hover:border-blue-600">
                Telegram
              </a>
              <a href={data.kit.linkedin} target="_blank" rel="noopener" onClick={() => share("linkedin")} className="rounded-lg border border-navy-200 py-2 text-center hover:border-blue-600">
                LinkedIn
              </a>
              <a href={data.kit.google} target="_blank" rel="noopener" className="flex items-center justify-center gap-1 rounded-lg border border-navy-200 py-2 hover:border-blue-600">
                <CalendarPlus className="h-4 w-4" aria-hidden /> Calendar
              </a>
            </div>
            <p className="mt-3 text-xs text-ink-soft">
              Workshop: {istLabel(data.workshop.startsAt, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} IST
            </p>
          </div>
        </div>
      </section>

      <main className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1fr]">
        <section>
          <h2 className="font-display text-2xl font-bold text-ink">Your reward ladder</h2>
          <p className="mt-1 text-sm text-ink-soft">A friend counts once they attend the live session for {data.workshop.minAttendanceMinutes}+ minutes.</p>
          <div className="relative mt-6 h-2 rounded-full bg-navy-100" aria-hidden>
            <motion.div className="absolute inset-y-0 left-0 rounded-full bg-marigold-400" initial={{ width: 0 }} animate={{ width: `${progress * 100}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} />
          </div>
          <ol className="mt-5 space-y-3">
            {data.tiers.map((t) => (
              <li key={t.refs} className={`flex items-center gap-3 rounded-[10px] border p-3 ${t.qualifiedReached ? "border-mint-600/40 bg-mint-100" : t.joinedReached ? "border-marigold-400 bg-marigold-100" : "border-navy-200 bg-white"}`}>
                <span className={`tabular flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display font-bold ${t.qualifiedReached ? "bg-mint-600 text-white" : "bg-navy-900 text-marigold-400"}`}>
                  {t.qualifiedReached ? <Check className="h-5 w-5" aria-hidden /> : t.refs}
                </span>
                <span className="flex-1">
                  <span className="block font-semibold text-ink">{t.label}</span>
                  <span className="block text-xs text-ink-soft">
                    {t.qualifiedReached ? `Unlocked: ${data.counts.qualified} friends attended` : `${Math.min(data.counts.qualified, t.refs)} of ${t.refs} attended so far${t.joinedReached ? " · enough have registered" : ""}`}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          {data.leaderboardPrizes.length > 0 && (
            <p className="mt-5 flex items-center gap-2 rounded-[10px] bg-navy-900 p-3 text-sm text-white">
              <Trophy className="h-4 w-4 shrink-0 text-marigold-400" aria-hidden />
              Top {data.leaderboardPrizes.length} referrers win {data.leaderboardPrizes.map((p) => `₹${p}`).join(", ")}.
            </p>
          )}
          {data.rewards.length > 0 && (
            <div className="mt-6">
              <h3 className="font-display text-lg font-bold text-ink">Rewards earned</h3>
              <ul className="mt-2 space-y-2">
                {data.rewards.map((r) => (
                  <li key={r.label} className="flex items-center justify-between rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm">
                    <span className="font-semibold">{r.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.status === "issued" ? "bg-mint-100 text-mint-600" : "bg-blue-100 text-blue-700"}`}>{r.status === "issued" ? "Sent" : "On its way"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-ink">Friends who joined</h2>
          {data.friends.length === 0 ? (
            <div className="mt-4 rounded-[10px] border border-dashed border-navy-300 bg-white p-6 text-ink-soft">
              Nobody yet. Drop your link in your class WhatsApp group: most sign-ups come in the first hour after a share.
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-navy-100 rounded-[10px] border border-navy-200 bg-white">
              {data.friends.map((f, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 font-display font-bold text-blue-700">{f.name[0]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{f.name}</span>
                    <span className="block truncate text-xs text-ink-soft">{f.college}</span>
                  </span>
                  <FriendStatus status={f.status} attended={f.attended} />
                </li>
              ))}
            </ul>
          )}
          {data.counts.flagged > 0 && (
            <p className="mt-3 flex items-start gap-2 text-xs text-ink-soft">
              <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" aria-hidden />
              {data.counts.flagged} sign-up{data.counts.flagged > 1 ? "s are" : " is"} under review (for example, the same network as you). Our team checks these by hand.
            </p>
          )}
        </section>
      </main>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <div className="on-navy bg-navy-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
          <Wordmark />
          <Link href="/" className="text-sm font-semibold text-navy-200 hover:text-white">
            Workshop details
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <span className="tabular block font-display text-3xl font-extrabold text-marigold-400">{value}</span>
      <span className="text-navy-200">{label}</span>
    </div>
  );
}

function FriendStatus({ status, attended }: { status: string; attended: boolean }) {
  if (status === "flagged")
    return <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-600"><Flag className="h-3 w-3" aria-hidden /> Review</span>;
  if (status === "qualified" || attended)
    return <span className="flex items-center gap-1 rounded-full bg-mint-100 px-2 py-0.5 text-xs font-bold text-mint-600"><Check className="h-3 w-3" aria-hidden /> Attended</span>;
  return <span className="flex items-center gap-1 rounded-full bg-navy-100 px-2 py-0.5 text-xs font-bold text-navy-700"><Clock className="h-3 w-3" aria-hidden /> Registered</span>;
}
