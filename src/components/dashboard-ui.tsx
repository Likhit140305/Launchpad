"use client";

import { Loader2 } from "lucide-react";

export const pct = (n: number | null | undefined, digits = 1) => (n === null || n === undefined || Number.isNaN(n) ? "–" : `${(n * 100).toFixed(digits)}%`);
export const num = (n: number) => n.toLocaleString("en-IN");

export function Panel({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-xl border border-navy-100 bg-white p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Button({
  children,
  onClick,
  busy,
  variant = "primary",
  disabled,
  type = "button",
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  busy?: boolean;
  variant?: "primary" | "secondary" | "act" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
}) {
  const styles = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "border border-navy-200 bg-white text-ink hover:border-blue-600",
    act: "bg-marigold-400 text-navy-950 hover:bg-marigold-500",
    danger: "border border-rose-600/30 bg-white text-rose-600 hover:bg-rose-100",
  }[variant];
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Pill({ tone, children }: { tone: "mint" | "rose" | "blue" | "navy" | "marigold"; children: React.ReactNode }) {
  const map = {
    mint: "bg-mint-100 text-mint-600",
    rose: "bg-rose-100 text-rose-600",
    blue: "bg-blue-100 text-blue-700",
    navy: "bg-navy-100 text-navy-700",
    marigold: "bg-marigold-100 text-navy-900",
  };
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${map[tone]}`}>{children}</span>;
}

export function Table({ head, children, empty }: { head: React.ReactNode[]; children: React.ReactNode; empty?: string }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="tabular w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-navy-100 text-xs uppercase tracking-[0.05em] text-ink-soft">
            {head.map((h, i) => (
              <th key={i} className={`py-2 pr-3 font-semibold ${i > 0 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-50">{children}</tbody>
      </table>
      {!hasRows && <p className="py-6 text-center text-sm text-ink-soft">{empty ?? "Nothing here yet."}</p>}
    </div>
  );
}

export function Td({ children, right, strong }: { children: React.ReactNode; right?: boolean; strong?: boolean }) {
  return <td className={`py-2.5 pr-3 ${right ? "text-right" : ""} ${strong ? "font-semibold text-ink" : "text-ink-soft"}`}>{children}</td>;
}

export const INPUT = "w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-ink placeholder:text-navy-600/60 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";
