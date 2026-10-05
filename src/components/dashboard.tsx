"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Beaker, Download, FlaskConical, Gauge, KeyRound, LogOut, RefreshCw, Settings2, Share2, Ticket, Upload, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Wordmark } from "./brand";
import { Button, INPUT, Panel, Pill, Table, Td, num, pct } from "./dashboard-ui";
import { GrowthCopilot, GrowthMissions, WhatIfSimulator } from "./growth";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Data = any;

const TABS = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "growth", label: "Growth AI", icon: Zap },
  { id: "experiments", label: "Experiments", icon: FlaskConical },
  { id: "referrals", label: "Referrals", icon: Share2 },
  { id: "attendance", label: "Attendance & rewards", icon: Ticket },
  { id: "settings", label: "Settings", icon: Settings2 },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function Dashboard() {
  const [key, setKey] = useState<string | null>("guest");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    try {
      // Browser-only storage read after hydration; the page is prerendered without it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setKey(sessionStorage.getItem("lp_admin") ?? "guest");
      const t = new URLSearchParams(location.hash.slice(1)).get("tab") as Tab | null;
      if (t && TABS.some((x) => x.id === t)) setTab(t);
    } catch {}
  }, []);

  const api = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", "x-admin-key": key ?? "", ...(init.headers ?? {}) } });
      if (res.status === 401) {
        try {
          sessionStorage.removeItem("lp_admin");
        } catch {}
        setKey(null);
        throw new Error("Admin key is missing or wrong.");
      }
      return res;
    },
    [key],
  );

  const load = useCallback(async () => {
    if (!key) return;
    setLoading(true);
    try {
      const res = await api("/api/analytics");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not load the dashboard.");
      setData(j);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, key]);

  useEffect(() => {
    // Fetch-on-mount plus a 60s poll: state is set when the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const act = useCallback(
    async (path: string, init: RequestInit, ok: string) => {
      try {
        const res = await api(path, init);
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          const detail = j.fields ? ` ${Object.entries(j.fields).map(([k, v]) => `${k}: ${v}`).join("; ")}` : "";
          throw new Error(`${j.error ?? "Request failed."}${detail}`);
        }
        setToast({ tone: "ok", text: ok });
        await load();
        return j;
      } catch (e) {
        setToast({ tone: "err", text: (e as Error).message });
        return null;
      }
    },
    [api, load],
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const download = useCallback(
    async (type: string) => {
      try {
        const res = await api(`/api/export?type=${type}`);
        if (!res.ok) throw new Error("Export failed.");
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] ?? `${type}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      } catch (e) {
        setToast({ tone: "err", text: (e as Error).message });
      }
    },
    [api],
  );

  if (!key) return <KeyGate onKey={(k) => { try { sessionStorage.setItem("lp_admin", k); } catch {} setKey(k); }} />;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="on-navy bg-navy-900 text-white lg:sticky lg:top-0 lg:h-dvh">
        <div className="flex items-center justify-between px-5 py-5 lg:block">
          <div>
            <Wordmark />
            <p className="mt-0.5 text-xs font-semibold text-navy-300">LaunchPad Growth OS</p>
          </div>
          <button onClick={() => { try { sessionStorage.removeItem("lp_admin"); } catch {} setKey(null); setData(null); }} className="flex items-center gap-1.5 text-xs font-semibold text-navy-300 hover:text-white lg:hidden">
            <LogOut className="h-4 w-4" aria-hidden /> Lock
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0" aria-label="Dashboard sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); history.replaceState(null, "", `#tab=${t.id}`); }}
              aria-current={tab === t.id ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${tab === t.id ? "bg-navy-700 text-white" : "text-navy-200 hover:bg-navy-800 hover:text-white"}`}
            >
              <t.icon className={`h-4 w-4 ${tab === t.id ? "text-marigold-400" : ""}`} aria-hidden />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="hidden px-5 pt-8 lg:block">
          <button onClick={() => { try { sessionStorage.removeItem("lp_admin"); } catch {} setKey(null); setData(null); }} className="flex items-center gap-1.5 text-xs font-semibold text-navy-300 hover:text-white">
            <LogOut className="h-4 w-4" aria-hidden /> Lock dashboard
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        {data?.summary?.demoRecords > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-marigold-400 px-5 py-2 text-sm font-semibold text-navy-950">
            <span>Demo mode: {num(data.summary.demoRecords)} simulated registrations, plus a simulated attendance report from an earlier Batch 1 session. Real sign-ups are kept separately.</span>
            <button onClick={() => act("/api/demo", { method: "POST", body: JSON.stringify({ action: "clear" }) }, "Demo data removed.")} className="underline underline-offset-2">
              Remove demo data
            </button>
          </div>
        )}
        {data?.security?.defaultAdminKey && (
          <div className="flex items-center gap-2 bg-rose-100 px-5 py-2 text-sm font-semibold text-rose-600">
            <AlertTriangle className="h-4 w-4" aria-hidden /> The default admin key is in use. Set ADMIN_KEY in your Vercel environment before sharing this link.
          </div>
        )}

        <header className="flex flex-wrap items-end justify-between gap-3 px-5 pb-2 pt-6 lg:px-8">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-ink">{TABS.find((t) => t.id === tab)?.label}</h1>
            <p className="text-sm text-ink-soft">{data?.campaign?.config?.workshopTitle ?? "Loading campaign..."}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={load} busy={loading}>
              <RefreshCw className="h-4 w-4" aria-hidden /> Refresh
            </Button>
          </div>
        </header>

        <main className="space-y-5 px-5 pb-16 pt-4 lg:px-8">
          {error && <p className="rounded-lg bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-600">{error}</p>}
          {!data ? (
            <p className="py-24 text-center text-ink-soft">Loading the growth dashboard...</p>
          ) : tab === "overview" ? (
            <Overview d={data} />
          ) : tab === "growth" ? (
            <div className="grid gap-5 xl:grid-cols-2">
              <div className="space-y-5">
                <GrowthCopilot d={data} act={act} />
                <WhatIfSimulator d={data} />
              </div>
              <div className="space-y-5">
                <GrowthMissions d={data} />
              </div>
            </div>
          ) : tab === "experiments" ? (
            <Experiments d={data} act={act} />
          ) : tab === "referrals" ? (
            <Referrals d={data} act={act} />
          ) : tab === "attendance" ? (
            <Attendance d={data} act={act} download={download} />
          ) : (
            <Settings d={data} act={act} download={download} />
          )}
        </main>
      </div>

      {toast && (
        <div role="status" className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-xl px-4 py-3 text-sm font-semibold shadow-[0_12px_30px_-10px_rgba(7,18,48,0.45)] ${toast.tone === "ok" ? "bg-navy-900 text-white" : "bg-rose-600 text-white"}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}

function KeyGate({ onKey }: { onKey: (k: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="on-navy flex min-h-dvh items-center justify-center bg-navy-900 px-4">
      <form onSubmit={(e) => { e.preventDefault(); if (value.trim()) onKey(value.trim()); }} className="w-full max-w-sm rounded-2xl bg-white p-6">
        <Wordmark tone="dark" />
        <h1 className="mt-4 font-display text-2xl font-extrabold text-ink">Growth dashboard</h1>
        <p className="mt-1 text-sm text-ink-soft">Enter the admin key to see registrations, experiments and rewards.</p>
        <label htmlFor="key" className="mt-5 block text-sm font-semibold text-ink">Admin key</label>
        <div className="relative mt-1">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-600" aria-hidden />
          <input id="key" type="password" autoComplete="current-password" value={value} onChange={(e) => setValue(e.target.value)} className={`${INPUT} pl-9`} />
        </div>
        <button type="submit" className="mt-4 w-full rounded-lg bg-blue-600 py-2.5 font-semibold text-white hover:bg-blue-700">Open dashboard</button>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------- overview */

function GrowthLoop({ s }: { s: Data }) {
  // Signature move: the growth loop as a ring, each stage carrying its live count.
  const f = Object.fromEntries(s.funnel.map((x: { step: string; n: number }) => [x.step, x.n]));
  const nodes = [
    { label: "Acquire", sub: "visitors", n: f["Visited"] },
    { label: "Register", sub: "sign-ups", n: f["Registered"] },
    { label: "Refer", sub: "referrers", n: f["Referred a friend"] },
    { label: "Attend", sub: "attended", n: f["Attended"] },
    { label: "Reward", sub: "qualified refs", n: s.referrals.qualified },
  ];
  const R = 96;
  const C = 130;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg viewBox="0 0 260 260" className="h-56 w-56 shrink-0" role="img" aria-label="Growth loop: acquire, register, refer, attend, reward">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#2f6bff" />
          </marker>
        </defs>
        <circle cx={C} cy={C} r={R} fill="none" stroke="#e6ecf8" strokeWidth="14" />
        {nodes.map((_, i) => {
          const a0 = (-90 + i * 72 + 14) * (Math.PI / 180);
          const a1 = (-90 + (i + 1) * 72 - 14) * (Math.PI / 180);
          return <path key={i} d={`M ${C + R * Math.cos(a0)} ${C + R * Math.sin(a0)} A ${R} ${R} 0 0 1 ${C + R * Math.cos(a1)} ${C + R * Math.sin(a1)}`} fill="none" stroke="#2f6bff" strokeWidth="2.5" markerEnd="url(#arrow)" />;
        })}
        {nodes.map((n, i) => {
          const a = (-90 + i * 72) * (Math.PI / 180);
          const x = C + R * Math.cos(a);
          const y = C + R * Math.sin(a);
          return (
            <g key={n.label}>
              <circle cx={x} cy={y} r="24" fill="#0b1b3f" />
              <text x={x} y={y + 5} textAnchor="middle" className="tabular" fill="#ffc93c" fontSize="13" fontWeight="700">
                {n.n >= 1000 ? `${(n.n / 1000).toFixed(1)}k` : n.n}
              </text>
            </g>
          );
        })}
        <text x={C} y={C - 4} textAnchor="middle" fill="#0b1b3f" fontSize="22" fontWeight="800">{pct(s.referrals.k, 0)}</text>
        <text x={C} y={C + 16} textAnchor="middle" fill="#3c4c70" fontSize="11" fontWeight="600">came via a friend</text>
      </svg>
      <ol className="grid w-full grid-cols-1 gap-1.5 text-sm">
        {nodes.map((n, i) => (
          <li key={n.label} className="flex items-baseline justify-between gap-3 border-b border-navy-50 pb-1.5">
            <span className="font-semibold text-ink">{i + 1}. {n.label}</span>
            <span className="tabular text-ink-soft"><b className="text-ink">{num(n.n)}</b> {n.sub}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Overview({ d }: { d: Data }) {
  const s = d.summary;
  const progress = Math.min(1, s.total / s.goal);
  const onPace = s.forecast >= s.goal;
  const funnelMax = Math.max(1, ...s.funnel.map((f: { n: number }) => f.n));
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <Panel title="Progress to goal">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
            <p className="tabular font-display text-5xl font-extrabold tracking-[-0.03em] text-ink">{num(s.total)}</p>
            <p className="pb-1.5 text-lg text-ink-soft">of {num(s.goal)} registrations</p>
            <Pill tone={onPace ? "mint" : "rose"}>{onPace ? "On pace" : "Behind pace"}</Pill>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-navy-100">
            <div className="h-full rounded-full bg-blue-600 transition-[width] duration-700" style={{ width: `${progress * 100}%` }} />
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Fact label="Need per day" value={s.daysLeft ? num(s.neededPerDay) : "–"} hint={`${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} left`} />
            <Fact label="Current daily avg" value={s.dailyAvg} />
            <Fact label="Forecast at close" value={num(s.forecast)} hint={onPace ? "beats the goal" : `${num(Math.max(0, s.goal - s.forecast))} short`} />
            <Fact label="Show-up rate" value={pct(s.attendance.showRate, 0)} hint={`${num(s.attendance.attended)} attended`} />
          </dl>
          <div className="mt-6 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={s.days} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="cum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2f6bff" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#2f6bff" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e6ecf8" vertical={false} />
                <XAxis dataKey="day" tickFormatter={(v: string) => v.slice(5)} tick={{ fontSize: 12, fill: "#3c4c70" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#3c4c70" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #c9d5ee", fontSize: 13 }} />
                <Area isAnimationActive={false} type="monotone" dataKey="cumulative" name="Registrations (total)" stroke="#2f6bff" strokeWidth={2.5} fill="url(#cum)" />
                <Area isAnimationActive={false} type="monotone" dataKey="pace" name="Pace needed" stroke="#f5b400" strokeDasharray="5 4" strokeWidth={2} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Growth loop">
          <GrowthLoop s={s} />
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Funnel">
          <ol className="space-y-2.5">
            {s.funnel.map((f: { step: string; n: number }, i: number) => {
              // Before registration each step is a share of the previous one; after it, a share of registrations.
              const prev = i === 0 ? null : i <= 2 ? s.funnel[i - 1].n : s.funnel[2].n;
              const of = i <= 2 ? "of previous" : "of registered";
              return (
                <li key={f.step}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold text-ink">{f.step}</span>
                    <span className="tabular text-ink-soft">
                      <b className="text-ink">{num(f.n)}</b>
                      {prev ? <span className="ml-2">{pct(f.n / prev, 0)} {of}</span> : null}
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 rounded-full bg-navy-50">
                    <div className="h-full rounded-full bg-navy-700" style={{ width: `${(f.n / funnelMax) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>
        <Panel title="Channels">
          <Table head={["Channel", "Visitors", "Registrations", "Conversion"]} empty="No traffic yet. Share tagged links like /?utm_source=wa_cbit.">
            {s.channels.map((c: Data) => (
              <tr key={c.channel}>
                <Td strong>
                  {c.channel}
                  <span className="block text-xs font-normal text-ink-soft">{c.tags.join(", ")}</span>
                </Td>
                <Td right>{num(c.visitors)}</Td>
                <Td right strong>{num(c.registrations)}</Td>
                <Td right>{pct(c.rate)}</Td>
              </tr>
            ))}
          </Table>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Top colleges">
          <Table head={["College", "Registered", "Attended"]}>
            {s.colleges.map((c: Data) => (
              <tr key={c.college}>
                <Td strong>{c.college}</Td>
                <Td right strong>{num(c.registrations)}</Td>
                <Td right>{num(c.attended)}</Td>
              </tr>
            ))}
          </Table>
        </Panel>
        <Panel title="Graduation year">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.gradYears} margin={{ left: -18, right: 8, top: 8 }}>
                <CartesianGrid stroke="#e6ecf8" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#3c4c70" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#3c4c70" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #c9d5ee", fontSize: 13 }} />
                <Bar isAnimationActive={false} dataKey="n" name="Registrations" fill="#1b3a78" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-ink-soft">Final-year target batch: {d.campaign.config.targetGradYear}.</p>
        </Panel>
      </div>
    </>
  );
}

function Fact({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.05em] text-ink-soft">{label}</dt>
      <dd className="tabular mt-0.5 font-display text-2xl font-bold text-ink">{value}</dd>
      {hint && <dd className="text-xs text-ink-soft">{hint}</dd>}
    </div>
  );
}

/* ------------------------------------------------------------- experiments */

type Act = (path: string, init: RequestInit, ok: string) => Promise<Data | null>;

function Experiments({ d, act }: { d: Data; act: Act }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    hypothesis: "",
    minSamplePerArm: 300,
    variants: [
      { headline: "", subhead: "", cta: "" },
      { headline: "", subhead: "", cta: "" },
    ],
  });
  const active = d.experiments.find((e: Data) => e.isActive);

  const promote = async (expId: string, variantId: string) => {
    setBusy(variantId);
    await act(`/api/experiments/${expId}/promote`, { method: "POST", body: JSON.stringify({ variantId }) }, "Winner promoted: 100% of new visitors now see it.");
    setBusy(null);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("create");
    const ok = await act(
      "/api/experiments",
      { method: "POST", body: JSON.stringify({ ...form, hypothesis: form.hypothesis || undefined, variants: form.variants.map((v) => ({ ...v, weight: 50 })) }) },
      "Experiment started. The previous one was stopped and kept in history.",
    );
    if (ok) setForm({ name: "", hypothesis: "", minSamplePerArm: 300, variants: [{ headline: "", subhead: "", cta: "" }, { headline: "", subhead: "", cta: "" }] });
    setBusy(null);
  };

  return (
    <>
      {d.experiments.map((exp: Data) => {
        const control = exp.arms.find((a: Data) => a.isControl) ?? exp.arms[0];
        return (
          <Panel
            key={exp.id}
            title={exp.name}
            action={exp.status === "running" ? <Pill tone="blue"><Beaker className="h-3 w-3" aria-hidden /> Running</Pill> : exp.status === "promoted" ? <Pill tone="mint">Winner promoted</Pill> : <Pill tone="navy">Stopped</Pill>}
          >
            {exp.hypothesis && <p className="-mt-2 mb-4 max-w-[75ch] text-sm text-ink-soft">Hypothesis: {exp.hypothesis}</p>}
            <Table head={["Variant", "Visitors", "Registered", "Conversion", "Lift vs A", "p-value", ""]}>
              {exp.arms.map((arm: Data) => {
                const t = exp.challengers.find((c: Data) => c.id === arm.id)?.test;
                const isWinner = exp.winnerVariantId === arm.id;
                const canPromote =
                  exp.status === "running" &&
                  exp.challengers.every((c: Data) => c.test.ready) &&
                  (arm.isControl ? !exp.challengers.some((c: Data) => c.test.significant && c.test.winner === "B") : t?.significant && t.winner === "B");
                return (
                  <tr key={arm.id} className={isWinner ? "bg-mint-100/60" : ""}>
                    <Td strong>
                      <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-navy-900 text-xs font-bold text-marigold-400">{arm.key}</span>
                      {arm.headline}
                      <span className="block pl-8 text-xs font-normal text-ink-soft">{arm.isControl ? "Control" : `Challenger · CTA “${arm.cta}”`}</span>
                    </Td>
                    <Td right>
                      {num(arm.visitors)}
                      <span className="block text-xs">of {num(exp.minSamplePerArm)} needed</span>
                    </Td>
                    <Td right strong>{num(arm.conversions)}</Td>
                    <Td right strong>{pct(arm.visitors ? arm.conversions / arm.visitors : 0)}</Td>
                    <Td right>{arm.isControl ? "–" : t?.lift === null || t?.lift === undefined ? "–" : `${t.lift > 0 ? "+" : ""}${(t.lift * 100).toFixed(1)}%`}</Td>
                    <Td right>{arm.isControl ? "–" : t?.pValue === null || t?.pValue === undefined ? "–" : t.pValue < 0.001 ? "<0.001" : t.pValue.toFixed(3)}</Td>
                    <Td right>
                      {isWinner ? (
                        <Pill tone="mint">Serving 100%</Pill>
                      ) : canPromote ? (
                        <Button variant="act" busy={busy === arm.id} onClick={() => promote(exp.id, arm.id)}>Send 100% here</Button>
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </Table>
            <Verdict exp={exp} control={control} />
          </Panel>
        );
      })}

      <Panel title={active ? "Start the next experiment" : "Start an experiment"}>
        <form onSubmit={create} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
            <label className="text-sm font-semibold text-ink">
              Name
              <input required minLength={4} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="CTA: 'Save my seat' vs 'Get my AI project'" className={`${INPUT} mt-1`} />
            </label>
            <label className="text-sm font-semibold text-ink">
              Visitors per arm before a verdict
              <input type="number" min={50} max={100000} required value={form.minSamplePerArm} onChange={(e) => setForm({ ...form, minSamplePerArm: Number(e.target.value) })} className={`${INPUT} mt-1`} />
            </label>
          </div>
          <label className="block text-sm font-semibold text-ink">
            Hypothesis <span className="font-normal text-ink-soft">(optional)</span>
            <input value={form.hypothesis} onChange={(e) => setForm({ ...form, hypothesis: e.target.value })} placeholder="A concrete outcome beats a generic invitation" className={`${INPUT} mt-1`} />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            {form.variants.map((v, i) => (
              <fieldset key={i} className="space-y-2 rounded-lg border border-navy-100 p-3">
                <legend className="px-1 text-sm font-bold text-ink">{i === 0 ? "A · control" : "B · challenger"}</legend>
                {(["headline", "subhead", "cta"] as const).map((field) => (
                  <input
                    key={field}
                    required
                    minLength={field === "cta" ? 3 : 8}
                    value={v[field]}
                    placeholder={field === "headline" ? "Headline" : field === "subhead" ? "Subheading" : "Button text"}
                    onChange={(e) => setForm({ ...form, variants: form.variants.map((x, j) => (j === i ? { ...x, [field]: e.target.value } : x)) })}
                    className={INPUT}
                    aria-label={`Variant ${i === 0 ? "A" : "B"} ${field}`}
                  />
                ))}
              </fieldset>
            ))}
          </div>
          <p className="text-xs text-ink-soft">
            Guide: about {num(active?.suggestedSamplePerArm ?? 1200)} visitors per arm detects a 25% lift at 95% confidence and 80% power; 300 per arm only catches large lifts (40%+), which is what a 7-day campaign can afford. Starting a new experiment stops the current one.
          </p>
          <Button type="submit" busy={busy === "create"}>Start experiment</Button>
        </form>
      </Panel>
    </>
  );
}

function Verdict({ exp, control }: { exp: Data; control: Data }) {
  const tests = exp.challengers.map((c: Data) => c.test);
  const ready = tests.every((t: Data) => t.ready);
  const minArm = Math.min(...exp.arms.map((a: Data) => a.visitors));
  let text: string;
  let tone: "blue" | "mint" | "navy" = "blue";
  if (exp.status === "promoted") {
    const w = exp.arms.find((a: Data) => a.id === exp.winnerVariantId);
    text = `Variant ${w?.key} was promoted on ${new Date(exp.promotedAt).toLocaleDateString("en-IN")}. Every new visitor sees it; earlier assignments are kept for the record.`;
    tone = "mint";
  } else if (!ready) {
    text = `Collecting data: no verdict until every arm reaches ${num(exp.minSamplePerArm)} visitors (smallest arm: ${num(minArm)}). Early leads at small samples are usually noise.`;
  } else if (tests.some((t: Data) => t.significant && t.winner === "B")) {
    text = "A challenger beat the control with p < 0.05. Promote it to send all new traffic there.";
    tone = "mint";
  } else if (tests.some((t: Data) => t.significant && t.winner === "A")) {
    text = `The control (${control.key}) won. Keep it, or promote it to end the test.`;
    tone = "navy";
  } else {
    text = "Sample reached, no significant difference. Keep the control and test a bolder change.";
    tone = "navy";
  }
  return <p className={`mt-4 rounded-lg px-3 py-2.5 text-sm font-medium ${tone === "mint" ? "bg-mint-100 text-mint-600" : tone === "navy" ? "bg-navy-50 text-ink" : "bg-blue-100 text-blue-700"}`}>{text}</p>;
}

/* --------------------------------------------------------------- referrals */

function Referrals({ d, act }: { d: Data; act: Act }) {
  const r = d.summary.referrals;
  const [amb, setAmb] = useState({ name: "", college: "", phone: "" });
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const addAmbassador = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("amb");
    const j = await act("/api/ambassadors", { method: "POST", body: JSON.stringify(amb) }, "Ambassador added.");
    if (j) {
      setLink(j.link);
      setAmb({ name: "", college: "", phone: "" });
    }
    setBusy(null);
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Referred sign-ups" value={num(r.total)} hint={`${pct(r.viralShare, 0)} of all registrations`} />
        <MiniStat label="Qualified (attended)" value={num(r.qualified)} hint="these earn rewards" />
        <MiniStat label="Active referrers" value={num(r.referrers)} hint={`k = ${r.k.toFixed(2)} referred per registrant`} />
        <MiniStat label="Flagged for review" value={num(r.flagged)} hint="excluded until approved" tone={r.flagged ? "rose" : undefined} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Referral leaderboard">
          <Table head={["#", "Referrer", "Joined", "Attended", "Flagged"]}>
            {d.leaders.map((l: Data) => (
              <tr key={l.id}>
                <Td strong>{l.rank}</Td>
                <Td strong>
                  {l.name} <span className="font-normal text-ink-soft">· {l.code}</span>
                  <span className="block text-xs font-normal text-ink-soft">{l.college}</span>
                </Td>
                <Td right strong>{l.refs}</Td>
                <Td right>{l.qualified}</Td>
                <Td right>{l.flagged || "–"}</Td>
              </tr>
            ))}
          </Table>
        </Panel>

        <Panel title="Review queue">
          {d.flagged.length === 0 ? (
            <p className="text-sm text-ink-soft">No flagged referrals. Sign-ups from the referrer&apos;s own network, look-alike phone numbers and bursts of 5+ in 10 minutes land here.</p>
          ) : (
            <ul className="divide-y divide-navy-50">
              {d.flagged.map((f: Data) => (
                <li key={f.id} className="py-3">
                  <p className="text-sm font-semibold text-ink">{f.referred}</p>
                  <p className="text-xs text-ink-soft">Referred by {f.referrer} · {f.reason}</p>
                  <div className="mt-2 flex gap-2">
                    <Button variant="secondary" busy={busy === f.id} onClick={async () => { setBusy(f.id); await act(`/api/referrals/${f.id}`, { method: "PATCH", body: JSON.stringify({ action: "approve" }) }, "Referral approved."); setBusy(null); }}>
                      Approve
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Campus ambassadors">
        <Table head={["Ambassador", "Tagged link", "Registrations", "Attended"]} empty="No ambassadors yet. Add club leads and class reps below.">
          {d.ambassadors.map((a: Data) => (
            <tr key={a.id}>
              <Td strong>
                {a.name}
                <span className="block text-xs font-normal text-ink-soft">{a.college}</span>
              </Td>
              <Td right><code className="text-xs">/?utm_source={a.tag}</code></Td>
              <Td right strong>{num(a.registrations)}</Td>
              <Td right>{num(a.attended)}</Td>
            </tr>
          ))}
        </Table>
        <form onSubmit={addAmbassador} className="mt-5 grid gap-3 border-t border-navy-50 pt-5 md:grid-cols-[1fr_1.4fr_1fr_auto] md:items-end">
          <label className="text-sm font-semibold text-ink">Name<input required minLength={2} value={amb.name} onChange={(e) => setAmb({ ...amb, name: e.target.value })} className={`${INPUT} mt-1`} /></label>
          <label className="text-sm font-semibold text-ink">College<input required minLength={3} value={amb.college} onChange={(e) => setAmb({ ...amb, college: e.target.value })} className={`${INPUT} mt-1`} /></label>
          <label className="text-sm font-semibold text-ink">Phone <span className="font-normal text-ink-soft">(optional)</span><input value={amb.phone} onChange={(e) => setAmb({ ...amb, phone: e.target.value })} inputMode="numeric" className={`${INPUT} mt-1`} /></label>
          <Button type="submit" busy={busy === "amb"}>Add ambassador</Button>
        </form>
        {link && (
          <p className="mt-3 rounded-lg bg-blue-100 px-3 py-2 text-sm text-blue-700">
            Send this link to the ambassador: <code className="font-bold">{link}</code>
          </p>
        )}
      </Panel>
    </>
  );
}

function MiniStat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "rose" }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.05em] text-ink-soft">{label}</p>
      <p className={`tabular mt-1 font-display text-3xl font-extrabold ${tone === "rose" ? "text-rose-600" : "text-ink"}`}>{value}</p>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

/* -------------------------------------------------------------- attendance */

const SAMPLE_CSV = "Name (Original Name),User Email,Join Time,Leave Time,Duration (Minutes)\nSneha Reddy,sneha@example.com,10/11/2026 11:01,10/11/2026 11:58,57\nRahul Rao,rahul@example.com,10/11/2026 11:05,10/11/2026 11:20,15";

function Attendance({ d, act, download }: { d: Data; act: Act; download: (t: string) => void }) {
  const [csv, setCsv] = useState("");
  const [workshopId, setWorkshopId] = useState<string>("");
  const [result, setResult] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const cfg = d.campaign.config;
  const committed = useMemo(() => d.rewards.filter((r: Data) => r.status !== "rejected" && r.status !== "over_budget").reduce((s: number, r: Data) => s + r.amountInr, 0), [d.rewards]);

  const importCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("import");
    const j = await act("/api/attendance", { method: "POST", body: JSON.stringify({ csv, workshopId: workshopId || undefined }) }, "Attendance imported and rewards recalculated.");
    if (j) setResult(j);
    setBusy(null);
  };

  const onFile = async (file: File | undefined) => {
    if (file) setCsv(await file.text());
  };

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Panel title="Import attendance">
          <p className="-mt-2 mb-4 text-sm text-ink-soft">
            Paste or upload the participant report from Zoom, Google Meet or Teams. Students are matched by email or phone; joins are summed, and a friend counts after {cfg.minAttendanceMinutes} minutes.
          </p>
          <form onSubmit={importCsv} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <select value={workshopId} onChange={(e) => setWorkshopId(e.target.value)} className={`${INPUT} w-auto`} aria-label="Workshop session">
                <option value="">Latest session</option>
                {d.workshops.map((w: Data) => (
                  <option key={w.id} value={w.id}>{w.title} · {new Date(w.startsAt).toLocaleDateString("en-IN")} ({w.attendance} imported)</option>
                ))}
              </select>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-blue-600">
                <Upload className="h-4 w-4" aria-hidden /> Upload CSV
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
              </label>
              <button type="button" onClick={() => setCsv(SAMPLE_CSV)} className="text-sm font-semibold text-blue-700 underline decoration-blue-600/40">Paste a sample</button>
            </div>
            <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={7} placeholder="Name,Email,Duration (Minutes)" className={`${INPUT} font-mono text-xs`} aria-label="Attendance CSV" />
            <Button type="submit" busy={busy === "import"} disabled={csv.trim().length < 5}>Import and qualify referrals</Button>
          </form>
          {result && (
            <div className="mt-4 rounded-lg bg-navy-50 p-3 text-sm text-ink">
              <p><b>{result.matched}</b> of {result.people} attendees matched to registrations · <b>{result.newlyQualified}</b> referrals newly qualified.</p>
              {result.unmatchedCount > 0 && <p className="mt-1 text-ink-soft">Not registered: {result.unmatched.slice(0, 8).join(", ")}{result.unmatchedCount > 8 ? ` and ${result.unmatchedCount - 8} more` : ""}</p>}
              {result.skipped > 0 && <p className="mt-1 text-ink-soft">{result.skipped} rows skipped (no email/phone or no duration).</p>}
            </div>
          )}
        </Panel>

        <Panel title="Reward budget">
          <p className="tabular font-display text-4xl font-extrabold text-ink">₹{num(committed)} <span className="text-lg font-semibold text-ink-soft">of ₹{num(cfg.budgetInr)}</span></p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-navy-100">
            <div className="h-full rounded-full bg-marigold-400" style={{ width: `${Math.min(100, (committed / Math.max(1, cfg.budgetInr)) * 100)}%` }} />
          </div>
          <ul className="mt-4 space-y-1.5 text-sm text-ink-soft">
            <li>Leaderboard prizes: {cfg.leaderboardPrizes.map((p: number) => `₹${p}`).join(", ")}</li>
            {cfg.tiers.map((t: Data) => <li key={t.refs}>{t.refs} attended friend{t.refs > 1 ? "s" : ""}: {t.label}</li>)}
            <li>Rewards beyond the budget are marked over budget, never paid silently.</li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="secondary" busy={busy === "recompute"} onClick={async () => { setBusy("recompute"); await act("/api/rewards", { method: "POST", body: "{}" }, "Rewards recalculated."); setBusy(null); }}>
              <RefreshCw className="h-4 w-4" aria-hidden /> Recalculate
            </Button>
            <Button variant="secondary" onClick={() => download("rewards")}><Download className="h-4 w-4" aria-hidden /> Rewards CSV</Button>
          </div>
        </Panel>
      </div>

      <Panel title="Rewards">
        <Table head={["Student", "Reward", "Qualified refs", "Amount", "Status", ""]} empty="No rewards yet. They appear once referred friends attend.">
          {d.rewards.map((r: Data) => (
            <tr key={r.id}>
              <Td strong>
                {r.name}
                <span className="block text-xs font-normal text-ink-soft">{r.college} · {r.phone}</span>
              </Td>
              <Td right strong>{r.label}</Td>
              <Td right>{r.qualifiedRefs}</Td>
              <Td right strong>{r.amountInr ? `₹${r.amountInr}` : "–"}</Td>
              <Td right>
                <Pill tone={r.status === "issued" ? "mint" : r.status === "rejected" ? "rose" : r.status === "over_budget" ? "marigold" : "blue"}>{r.status.replace("_", " ")}</Pill>
              </Td>
              <Td right>
                <span className="inline-flex gap-1.5">
                  {r.status === "eligible" && (
                    <>
                      <Button busy={busy === r.id} onClick={async () => { setBusy(r.id); await act(`/api/rewards/${r.id}`, { method: "PATCH", body: JSON.stringify({ action: "issue" }) }, "Marked as issued."); setBusy(null); }}>Issue</Button>
                      <Button variant="danger" onClick={() => act(`/api/rewards/${r.id}`, { method: "PATCH", body: JSON.stringify({ action: "reject" }) }, "Reward rejected.")}>Reject</Button>
                    </>
                  )}
                  {(r.status === "rejected" || r.status === "issued") && (
                    <Button variant="secondary" onClick={() => act(`/api/rewards/${r.id}`, { method: "PATCH", body: JSON.stringify({ action: "reopen" }) }, "Reward reopened.")}>Reopen</Button>
                  )}
                </span>
              </Td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}

/* ---------------------------------------------------------------- settings */

function Settings({ d, act, download }: { d: Data; act: Act; download: (t: string) => void }) {
  const [text, setText] = useState(() => JSON.stringify(d.campaign.config, null, 2));
  const [busy, setBusy] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const save = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
      setParseError(null);
    } catch (e) {
      setParseError(`Not valid JSON: ${(e as Error).message}`);
      return;
    }
    setBusy("save");
    await act("/api/campaign", { method: "PUT", body: JSON.stringify(parsed) }, "Campaign settings saved. The landing page uses them immediately.");
    setBusy(null);
  };

  return (
    <>
      <Panel title="Exports">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => download("registrations")}><Download className="h-4 w-4" aria-hidden /> Registrations CSV</Button>
          <Button variant="secondary" onClick={() => download("reminders")}><Download className="h-4 w-4" aria-hidden /> WhatsApp reminder links</Button>
          <Button variant="secondary" onClick={() => download("rewards")}><Download className="h-4 w-4" aria-hidden /> Rewards CSV</Button>
        </div>
        <p className="mt-3 text-sm text-ink-soft">The reminder file has one personalised click-to-send WhatsApp message per student, with their calendar link and invite link. No WhatsApp Business API needed.</p>
      </Panel>

      <Panel title="Campaign settings" action={<Button variant="act" busy={busy === "save"} onClick={save}>Save settings</Button>}>
        <p className="-mt-2 mb-3 text-sm text-ink-soft">Workshop copy, dates (ISO with +05:30), goal, budget, reward tiers, agenda and FAQ. Every save is validated in full; nothing is half-saved. Reuse the same engine for the next bootcamp by changing this.</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={22} spellCheck={false} className={`${INPUT} font-mono text-xs leading-relaxed`} aria-label="Campaign settings JSON" />
        {parseError && <p className="mt-2 text-sm font-semibold text-rose-600">{parseError}</p>}
      </Panel>

      <Panel title="Demo data">
        <p className="text-sm text-ink-soft">Load five days of simulated traffic (about 340 registrations, referrals, an A/B test past its sample and a first attendance batch) to explore the dashboard, or remove it. Simulated rows are flagged and every page says so. Real registrations are never touched. Loading demo data re-anchors the campaign dates so the demo sits on day 5 of 7.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button busy={busy === "seed"} onClick={async () => { setBusy("seed"); await act("/api/demo", { method: "POST", body: JSON.stringify({ action: "seed" }) }, "Demo data loaded."); setBusy(null); }}>Load demo data</Button>
          <Button variant="danger" busy={busy === "clear"} onClick={async () => { setBusy("clear"); await act("/api/demo", { method: "POST", body: JSON.stringify({ action: "clear" }) }, "Demo data removed."); setBusy(null); }}>Remove demo data</Button>
        </div>
      </Panel>
    </>
  );
}
