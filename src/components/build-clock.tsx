"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useState } from "react";

type Stop = { minute: number; title: string; detail: string };

/**
 * The workshop as a 60-minute track. The playhead sweeps once on load,
 * then every stop is a button: hover, focus or tap shows what you build there.
 */
export function BuildClock({ agenda }: { agenda: Stop[] }) {
  const last = Math.max(60, ...agenda.map((a) => a.minute));
  const reduce = useReducedMotion();
  const minute = useMotionValue(reduce ? last : 0);
  const left = useTransform(minute, (m) => `${(m / last) * 100}%`);
  const label = useTransform(minute, (m) => `${String(Math.round(m)).padStart(2, "0")}:00`);
  const [active, setActive] = useState(reduce ? agenda.length - 1 : 0);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (reduce) return;
    const controls = animate(minute, last, {
      duration: 5.2,
      delay: 0.6,
      ease: [0.45, 0, 0.2, 1],
      onUpdate: (m) => {
        if (touched) return;
        let idx = 0;
        agenda.forEach((a, i) => {
          if (m >= a.minute) idx = i;
        });
        setActive(idx);
      },
    });
    return () => controls.stop();
  }, [agenda, last, minute, reduce, touched]);

  const pick = (i: number) => {
    setTouched(true);
    setActive(i);
    minute.stop();
    animate(minute, agenda[i].minute, { duration: 0.5, ease: [0.16, 1, 0.3, 1] });
  };

  const current = agenda[active];

  return (
    <div className="on-navy">
      <div className="mb-3 flex items-baseline justify-between text-sm text-navy-200">
        <span className="font-semibold">What you build, minute by minute</span>
        <motion.span className="tabular font-display text-base font-semibold text-marigold-400" aria-hidden>
          {label}
        </motion.span>
      </div>

      <div className="relative mx-3 pb-2 pt-6 sm:mx-2">
        <div className="absolute inset-x-0 top-[2.1rem] h-[5px] rounded-full bg-navy-700" />
        <motion.div className="absolute left-0 top-[2.1rem] h-[5px] rounded-full bg-marigold-400" style={{ width: left }} />
        <motion.div
          aria-hidden
          className="absolute top-[1.45rem] -ml-[9px] h-[19px] w-[19px] rounded-full border-[3px] border-navy-900 bg-marigold-400 shadow-[0_2px_10px_rgba(255,201,60,0.35)]"
          style={{ left }}
        />
        <ol className="relative flex justify-between" aria-label="Workshop agenda">
          {agenda.map((a, i) => {
            const on = i <= active;
            return (
              <li key={a.minute} className="flex w-0 flex-col items-center">
                <button
                  type="button"
                  onMouseEnter={() => pick(i)}
                  onFocus={() => pick(i)}
                  onClick={() => pick(i)}
                  aria-pressed={i === active}
                  aria-label={`Minute ${a.minute}: ${a.title}`}
                  className="group flex flex-col items-center gap-2 rounded-md px-1"
                >
                  <span className={`h-3.5 w-3.5 rounded-full border-[3px] transition-colors duration-300 ${on ? "border-marigold-400 bg-navy-900" : "border-navy-600 bg-navy-900"}`} />
                  <span className={`tabular whitespace-nowrap text-xs font-semibold transition-colors ${i === active ? "text-white" : "text-navy-300 group-hover:text-navy-100"}`}>
                    {a.minute}m
                  </span>
                  <span className={`hidden w-[6.5rem] text-center text-xs font-semibold leading-tight transition-colors sm:block ${i === active ? "text-marigold-400" : on ? "text-navy-100" : "text-navy-300"}`}>{a.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-4 min-h-[5.5rem] rounded-[10px] border border-navy-700 bg-navy-800/60 p-4" aria-live="polite">
        <p className="font-display text-lg font-bold text-white">
          <span className="tabular mr-2 text-marigold-400">{String(current?.minute ?? 0).padStart(2, "0")}m</span>
          {current?.title}
        </p>
        <p className="mt-1 max-w-[60ch] text-[0.95rem] leading-relaxed text-navy-200">{current?.detail}</p>
      </div>
    </div>
  );
}
