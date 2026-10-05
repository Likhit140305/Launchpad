import Link from "next/link";

export function Wordmark({ tone = "light" }: { tone?: "light" | "dark" }) {
  const isLight = tone === "light";
  const textColor = isLight ? "text-white" : "text-[#a41e22]";

  return (
    <Link href="/" className="flex items-center gap-3" aria-label="NIAT - NxtWave of Innovation in Advanced Technologies">
      <svg width="44" height="52" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
        <path d="M0 0H40V26C40 37 30 46 20 48C10 46 0 37 0 26V0Z" fill="#a41e22"/>
        <path d="M20 0V48" stroke="white" strokeWidth="1.5"/>
        <path d="M0 22H40" stroke="white" strokeWidth="1.5"/>
        <text x="10" y="16" fill="white" fontSize="14" fontFamily="Times New Roman, serif" textAnchor="middle" fontWeight="bold">N</text>
        <text x="30" y="16" fill="white" fontSize="14" fontFamily="Times New Roman, serif" textAnchor="middle" fontWeight="bold">I</text>
        <text x="10" y="38" fill="white" fontSize="14" fontFamily="Times New Roman, serif" textAnchor="middle" fontWeight="bold">A</text>
        <text x="30" y="38" fill="white" fontSize="14" fontFamily="Times New Roman, serif" textAnchor="middle" fontWeight="bold">T</text>
      </svg>
      <div className={`flex flex-col justify-center leading-tight font-semibold ${textColor}`}>
        <span className="text-[15px] tracking-wide">NxtWave of Innovation in</span>
        <span className="text-[15px] tracking-wide">Advanced Technologies</span>
      </div>
    </Link>
  );
}

export function DemoBanner() {
  return (
    <div role="note" className="bg-marigold-400 px-4 py-2 text-center text-sm font-semibold text-navy-950">
      Demo preview: registrations, referrals, attendance from a simulated earlier batch, and rewards on this site are simulated data.
    </div>
  );
}
