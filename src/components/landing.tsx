"use client";

import { motion } from "motion/react";
import { ArrowUpRight, ChevronDown, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import type { CampaignConfig } from "@/lib/config";
import { firstTouch, istLabel, track, visitorId } from "@/lib/client";
import { BuildClock } from "./build-clock";
import { DemoBanner, Wordmark } from "./brand";
import { RegisterForm } from "./register-form";
import { PlacementChecker } from "./checker";

type PublicConfig = Omit<CampaignConfig, "budgetInr">;
type Variant = { id: string; key: string; headline: string; subhead: string; cta: string } | null;
type Leader = { rank: number; name: string; college: string; joined: number; qualified: number };

export default function Landing({ initialConfig }: { initialConfig: PublicConfig }) {
  const [cfg, setCfg] = useState(initialConfig);
  const [variant, setVariant] = useState<Variant>(null);
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [demo, setDemo] = useState(false);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [prizes, setPrizes] = useState<number[]>([]);
  const [formVisible, setFormVisible] = useState(true);
  const [utmSource, setUtmSource] = useState<string | null>(null);
  const [hasRef, setHasRef] = useState(false);

  useEffect(() => {
    // Mobile: the form sits below the clock, so a sticky bar keeps the action one tap away until the form is on screen.
    const el = document.getElementById("register");
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setFormVisible(e.isIntersecting || e.boundingClientRect.top < 0), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const vid = visitorId();
    const touch = firstTouch();
    
    const sp = new URLSearchParams(window.location.search);
    setUtmSource(sp.get("utm_source"));
    setHasRef(!!sp.get("ref"));

    const timeout = setTimeout(() => setReady(true), 1500); // never hold the headline hostage to a slow network
    fetch(`/api/config?vid=${vid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setCfg(d.config);
        setVariant(d.variant);
        setCount(d.registrations);
        setDemo(d.demo);
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeout);
        setReady(true);
        track("page_view", { channel: touch.channel ?? (touch.ref ? "referral" : undefined) });
      });
    fetch("/api/leaderboard")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setLeaders(d.leaders);
          setPrizes(d.prizes);
        }
      })
      .catch(() => {});
    return () => clearTimeout(timeout);
  }, []);

  const headline = variant?.headline ?? "Walk into placements with a live AI project on your resume.";
  const subhead = variant?.subhead ?? "One free hour with NxtWave. One working AI app, deployed and yours to show recruiters.";
  const cta = variant?.cta ?? "Reserve my free spot →";
  const when = istLabel(cfg.startsAt, { weekday: "long", day: "numeric", month: "long" });
  const time = istLabel(cfg.startsAt, { hour: "numeric", minute: "2-digit" });

  const target = cfg.goal ?? 500;
  const progress = count !== null ? Math.min(count, target) : 0;
  const remaining = Math.max(0, target - progress);
  const progressPct = count !== null ? (progress / target) * 100 : 0;
  
  const faqs = [
    { q: "What will I actually build?", a: "You'll build and deploy a working AI application during the session and leave with a public project you can add to your portfolio and discuss in interviews." },
    ...cfg.faq
  ];

  return (
    <div className="min-h-dvh">
      <header className="on-navy relative overflow-hidden bg-navy-900 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <nav className="flex items-center justify-between py-5">
            <Wordmark />
            <div className="flex items-center gap-5 text-sm font-semibold text-navy-200">
              <a href="#bring-friends" className="hidden hover:text-white sm:inline">
                Referral rewards
              </a>
              <a href="#faq" className="hidden hover:text-white sm:inline">
                FAQ
              </a>
              <a href="#register" className="rounded-lg border border-navy-600 px-3 py-1.5 text-white hover:border-marigold-400">
                Register
              </a>
            </div>
          </nav>

          <div className="grid gap-10 pb-14 pt-6 lg:grid-cols-12 lg:gap-12 lg:pb-20 lg:pt-10">
            <div className="lg:col-span-7">
              {hasRef && <span className="inline-block px-3 py-1 bg-marigold-400/20 text-marigold-400 text-xs font-bold rounded-full mb-4">Your friend invited you to LaunchPad</span>}
              {utmSource?.startsWith('amb_') && !hasRef && <span className="inline-block px-3 py-1 bg-marigold-400/20 text-marigold-400 text-xs font-bold rounded-full mb-4">Students from your campus are joining LaunchPad</span>}
              {utmSource === 'whatsapp' && !hasRef && <span className="inline-block px-3 py-1 bg-marigold-400/20 text-marigold-400 text-xs font-bold rounded-full mb-4">Your college community sent you here</span>}
              <motion.h1
                key={headline}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 12 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="mt-2 font-display text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-[4.1rem]"
              >
                {headline}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: ready ? 1 : 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="mt-5 max-w-[46ch] text-lg leading-relaxed text-navy-100 sm:text-xl"
              >
                {subhead}
              </motion.p>
              <p className="mt-4 text-base font-semibold text-white">
                {when} · {time} IST · Live online · Free
              </p>
              <p className="mt-1 text-sm text-navy-200">For final-year engineering students. Bring a laptop.</p>
              
              {count !== null && (
                <div className="mt-8 max-w-md">
                  <div className="flex justify-between text-sm font-semibold mb-2">
                    <span><span className="text-white">{count.toLocaleString("en-IN")}</span> / {target} students registered</span>
                    <span className="text-marigold-400">{remaining} spots remaining</span>
                  </div>
                  <div className="h-2 bg-navy-800 rounded-full overflow-hidden">
                    <div className="h-full bg-marigold-400 transition-all duration-1000" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
              )}

              <div className="mt-10 lg:mt-12">
                <p className="font-display font-bold text-[15px] mb-5 text-white bg-navy-800/50 p-3 rounded-lg border border-navy-700 inline-block">START: No AI/ML background <span className="text-navy-400 mx-2">→</span> BUILD: Pick, Prompt, API, UI <span className="text-navy-400 mx-2">→</span> END: Deployed AI project</p>
                <BuildClock agenda={cfg.agenda} />
              </div>
            </div>

            <div id="register" className="scroll-mt-6 lg:col-span-5">
              <div className="rounded-2xl bg-white p-5 text-ink shadow-[0_24px_60px_-20px_rgba(3,10,30,0.6)] sm:p-6">
                <Countdown startsAt={cfg.startsAt} />
                <div className="mt-5">
                  <RegisterForm cta={cta} gradYears={cfg.gradYears} targetYear={cfg.targetGradYear} />
                </div>
              </div>
              {count !== null && (
                <p className="mt-4 text-center text-sm text-navy-200">
                  <span className="tabular font-bold text-white">{count.toLocaleString("en-IN")}</span> students have registered{demo ? " (simulated)" : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main>
        <PlacementChecker />
        
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:py-28">
          <h2 className="font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.025em] text-ink lg:col-span-5 lg:text-5xl">
            Placement season wants proof, not a list of courses.
          </h2>
          <div className="space-y-8 lg:col-span-6 lg:col-start-7">
            <Reason title="You ship something real" body="Not a certificate for watching. A working AI app on a public URL that you built with your own hands, ready to paste into your resume and LinkedIn tonight." />
            <Reason title="No AI or ML background needed" body="If you can write a basic program in any language, you can finish. The AI assistant writes the parts you have not learned yet, and we show you how to check its work." />
            <Reason title="One hour, then it's yours" body="Starter code, the prompt you wrote and the deployed link stay with you. Interviewers ask about projects: you will have one to talk about." />
          </div>
        </section>

        <section id="bring-friends" className="scroll-mt-6 bg-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:py-24">
            <div className="lg:col-span-5">
              <h2 className="font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.025em] text-ink">Register once. Share your link. Earn when your friends actually show up.</h2>
              <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-ink-soft">
                Every registration gets a personal invite link. A friend counts when they join the live session for at least {cfg.minAttendanceMinutes} minutes, so rewards go to people who bring real classmates.
              </p>
              <ol className="mt-8 border-l-2 border-navy-100">
                {cfg.tiers.map((t) => (
                  <li key={t.refs} className="relative pb-6 pl-6 last:pb-0">
                    <span className="tabular absolute -left-[13px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-marigold-400">{t.refs}</span>
                    <p className="font-semibold text-ink">
                      {t.refs} {t.refs === 1 ? "friend attends" : "friends attend"}
                    </p>
                    <p className="text-ink-soft">{t.label}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="lg:col-span-6 lg:col-start-7">
              <div className="rounded-2xl bg-navy-900 p-5 text-white sm:p-6">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-display text-xl font-bold">
                    <Trophy className="h-5 w-5 text-marigold-400" aria-hidden /> Top referrers
                  </h3>
                  {prizes.length > 0 && <p className="text-sm text-navy-200">Prizes: {prizes.map((p) => `₹${p}`).join(" · ")}</p>}
                </div>
                {leaders.length ? (
                  <ol className="mt-4 divide-y divide-navy-700">
                    {leaders.slice(0, 7).map((l) => (
                      <li key={l.rank} className="flex items-center gap-3 py-2.5">
                        <span className={`tabular w-6 text-center font-display text-lg font-bold ${l.rank <= 3 ? "text-marigold-400" : "text-navy-300"}`}>{l.rank}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{l.name}</span>
                          <span className="block truncate text-xs text-navy-300">{l.college}</span>
                        </span>
                        <span className="tabular text-right text-sm">
                          <span className="block">
                            <span className="font-bold text-marigold-400">{l.qualified}</span> <span className="text-navy-200">attended</span>
                          </span>
                          <span className="block text-xs text-navy-300">{l.joined} joined</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-4 rounded-lg border border-dashed border-navy-600 p-4 text-sm text-navy-200">No referrals yet. Register and share your link to take the first spot.</p>
                )}
                <p className="mt-4 text-xs text-navy-300">Names are shortened for privacy. Prizes are paid after attendance is verified.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-3xl scroll-mt-6 px-4 py-20 sm:px-6 lg:py-24">
          <h2 className="font-display text-4xl font-extrabold tracking-[-0.025em] text-ink">Questions students ask</h2>
          <div className="mt-8 divide-y divide-navy-200 border-y border-navy-200">
            {faqs.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-ink">
                  {f.q}
                  <ChevronDown className="h-5 w-5 shrink-0 text-blue-600 transition-transform duration-300 group-open:rotate-180" aria-hidden />
                </summary>
                <p className="mt-2 max-w-[65ch] leading-relaxed text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="on-navy bg-navy-900 text-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-display text-3xl font-extrabold tracking-[-0.02em] sm:text-4xl">
                {when}, {time} IST.
              </p>
              <p className="mt-2 text-navy-200">One hour. One working AI project. Zero cost.</p>
            </div>
            <a href="#register" className="flex items-center gap-2 rounded-[10px] bg-marigold-400 px-6 py-3.5 font-display text-lg font-bold text-navy-950 hover:bg-marigold-500">
              {cta} <ArrowUpRight className="h-5 w-5" aria-hidden />
            </a>
          </div>
        </section>
      </main>

      {!formVisible && (
        <div className="on-navy fixed inset-x-0 bottom-0 z-40 border-t border-navy-700 bg-navy-900/95 px-4 py-3 backdrop-blur lg:hidden">
          <a href="#register" className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-marigold-400 py-3 font-display text-lg font-bold text-navy-950">
            {cta} <ArrowUpRight className="h-5 w-5" aria-hidden />
          </a>
        </div>
      )}

      <footer className="bg-navy-950 pb-20 text-sm text-navy-300 lg:pb-0">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Wordmark />
          <p>
            Free online workshop for engineering students · Questions: reply to our WhatsApp message
            <span className="mx-2">·</span>
            <a href="/admin" className="hover:text-white">Admin</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

function Reason({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-t-2 border-navy-900 pt-4">
      <h3 className="font-display text-2xl font-bold text-ink">{title}</h3>
      <p className="mt-2 max-w-[60ch] text-lg leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

function Countdown({ startsAt }: { startsAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // The clock starts after hydration so server and client HTML match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = now === null ? null : Math.max(0, new Date(startsAt).getTime() - now);
  const parts = diff === null ? null : [Math.floor(diff / 86_400_000), Math.floor(diff / 3_600_000) % 24, Math.floor(diff / 60_000) % 60, Math.floor(diff / 1000) % 60];
  const labels = ["days", "hrs", "min", "sec"];
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-display text-lg font-bold text-ink">Reserve your seat</p>
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-navy-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-marigold-500" aria-hidden /> Live
        </span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2" aria-label="Time until the workshop starts">
        {labels.map((l, i) => (
          <div key={l} className="rounded-lg bg-navy-900 py-2 text-center">
            <span className="tabular block font-display text-2xl font-bold text-marigold-400">{parts ? String(parts[i]).padStart(2, "0") : "--"}</span>
            <span className="block text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-navy-200">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
