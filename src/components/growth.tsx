"use client";

import { useState } from "react";
import { Zap, Target, Sparkles, TrendingUp, AlertCircle, Play } from "lucide-react";
import { Button, Panel, num, pct, Pill } from "./dashboard-ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Data = any;

export function GrowthCopilot({ d, act }: { d: Data; act: any }) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setBusy(true);
    setError(null);
    try {
      const j = await act("/api/ai/analyze", {
        method: "POST",
        body: JSON.stringify({ summary: d.summary, experiments: d.experiments }),
      }, "Analysis complete.");
      if (j && j.analysis) {
        setAnalysis(j.analysis);
      } else if (j && j.error) {
        setError(j.error);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="⚡ AI Growth Copilot">
      {!analysis && !error && (
        <div className="py-4 text-center">
          <p className="text-sm text-ink-soft mb-4">Turn campaign analytics into actionable growth decisions.</p>
          <Button onClick={analyze} busy={busy}><Sparkles className="h-4 w-4 mr-1.5" /> Analyze Campaign</Button>
        </div>
      )}
      {error && (
        <div className="py-4 text-center">
          <p className="text-sm text-rose-600 mb-4">{error}</p>
          <Button onClick={analyze} busy={busy}><Sparkles className="h-4 w-4 mr-1.5" /> Try Again</Button>
        </div>
      )}
      {analysis && (
        <div className="space-y-4 text-sm text-ink">
          {analysis.split("###").filter(Boolean).map((section, i) => {
            const [title, ...content] = section.split("\\n");
            return (
              <div key={i} className="mb-4">
                <h4 className="font-bold text-ink mb-1">{title.trim()}</h4>
                <p className="text-ink-soft whitespace-pre-wrap">{content.join("\\n").trim()}</p>
              </div>
            );
          })}
          <div className="pt-4 border-t border-navy-50 text-right">
            <Button variant="secondary" onClick={analyze} busy={busy}><RefreshCw className="h-4 w-4 mr-1.5" /> Re-analyze</Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

function RefreshCw(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

export function GrowthMissions({ d }: { d: Data }) {
  const s = d.summary;
  const missions = [];

  const avgRate = s.total > 0 && s.funnel[0].n > 0 ? s.total / s.funnel[0].n : 0;
  for (const c of s.channels) {
    if (c.rate && c.rate < avgRate && c.visitors > 50) {
      missions.push({
        priority: "High",
        title: `Fix ${c.channel} conversion`,
        evidence: `${c.channel} brings significant traffic but converts at ${(c.rate * 100).toFixed(1)}% vs campaign average of ${(avgRate * 100).toFixed(1)}%.`,
        action: "Create an experiment targeting this audience",
      });
    }
    if (c.rate && c.rate > avgRate * 1.5 && c.visitors > 20) {
      missions.push({
        priority: "High",
        title: `Scale ${c.channel}`,
        evidence: `${c.channel} is converting at ${(c.rate * 100).toFixed(1)}%, well above average.`,
        action: `Double down on ${c.channel} acquisition`,
      });
    }
  }

  if (s.attendance.showRate < 0.3 && s.total > 10) {
    missions.push({
      priority: "Medium",
      title: "Recover Attendance",
      evidence: "A significant number of registered students have not attended.",
      action: "Generate reminder campaign (use CSV export)",
    });
  }

  for (const exp of d.experiments) {
    if (exp.status === "running") {
      const ready = exp.challengers.every((c: any) => c.test.ready);
      if (ready && exp.challengers.some((c: any) => c.test.significant && c.test.winner === "B")) {
        missions.push({
          priority: "Urgent",
          title: `Promote winning experiment`,
          evidence: `Experiment "${exp.name}" has a statistically significant winner.`,
          action: "Promote challenger to 100% of traffic",
        });
      }
    }
  }

  if (s.forecast < s.goal) {
    missions.push({
      priority: "Urgent",
      title: "Pace Warning",
      evidence: `Forecast is ${s.forecast} against a goal of ${s.goal}.`,
      action: "Increase acquisition efforts immediately",
    });
  }

  const topMissions = missions.slice(0, 5);

  return (
    <Panel title="🚀 Today's Growth Missions">
      {topMissions.length === 0 ? (
        <p className="text-sm text-ink-soft">No active missions right now. Keep an eye on your metrics!</p>
      ) : (
        <ul className="divide-y divide-navy-50">
          {topMissions.map((m, i) => (
            <li key={i} className="py-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold ${m.priority === 'Urgent' ? 'text-rose-600' : m.priority === 'High' ? 'text-marigold-600' : 'text-blue-600'}`}>{m.priority}</span>
                    <h4 className="font-semibold text-ink text-sm">{m.title}</h4>
                  </div>
                  <p className="text-xs text-ink-soft">{m.evidence}</p>
                </div>
              </div>
              <div className="mt-2 text-sm font-medium text-ink bg-navy-50 rounded-md px-3 py-2 inline-block">
                Action: {m.action}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function WhatIfSimulator({ d }: { d: Data }) {
  const s = d.summary;
  const [ambBoost, setAmbBoost] = useState(0);
  const [refBoost, setRefBoost] = useState(0);
  const [chanBoost, setChanBoost] = useState(0);

  const ambRatio = s.total ? (s.channels.find((c: any) => c.channel === "Campus ambassadors")?.registrations || 0) / s.total : 0;
  const refRatio = s.referrals.viralShare || 0;
  
  const currentForecast = s.forecast;
  const extraAmb = currentForecast * ambRatio * (ambBoost / 100);
  const extraRef = currentForecast * refRatio * (refBoost / 100);
  const extraChan = currentForecast * (1 - ambRatio - refRatio) * (chanBoost / 100);
  
  const projected = Math.round(currentForecast + extraAmb + extraRef + extraChan);
  const canHit = projected >= s.goal;

  return (
    <Panel title="🔮 What-If Simulator">
      <p className="text-xs text-ink-soft mb-4">Can we still reach {s.goal} registrations? Adjust variables below.</p>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold text-ink-soft uppercase">Current Forecast</p>
          <p className="text-2xl font-bold text-ink tabular">{num(currentForecast)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-ink-soft uppercase">Projected Forecast</p>
          <p className={`text-2xl font-bold tabular ${canHit ? 'text-mint-600' : 'text-ink'}`}>{num(projected)}</p>
        </div>
      </div>

      <div className="space-y-4">
        <Slider label="Ambassador registrations" value={ambBoost} setValue={setAmbBoost} />
        <Slider label="Referral conversion" value={refBoost} setValue={setRefBoost} />
        <Slider label="Channel conversion" value={chanBoost} setValue={setChanBoost} />
      </div>

      <div className="mt-6 pt-4 border-t border-navy-50">
        <p className="text-xs text-ink-soft text-center font-medium">
          {canHit ? "🟢 Target potentially achievable" : "🔴 Still falling short of target"}
        </p>
        <p className="text-[10px] text-ink-soft/70 text-center mt-1">Simulation / projection — not actual campaign data.</p>
      </div>
    </Panel>
  );
}

function Slider({ label, value, setValue }: { label: string, value: number, setValue: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-semibold text-ink">{label}</span>
        <span className="text-xs font-medium text-ink-soft">+{value}%</span>
      </div>
      <div className="flex items-center gap-2">
        <input 
          type="range" 
          min="0" max="50" step="5" 
          value={value} 
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-full accent-blue-600 h-2 bg-navy-100 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  );
}
