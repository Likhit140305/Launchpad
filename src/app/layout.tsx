import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap", weight: ["500", "600", "700", "800"] });
const body = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "LaunchPad — AI Career Workshop",
  description: "A free, live workshop for final-year engineers. Leave with a working AI app on a public link.",
  openGraph: {
    title: "LaunchPad — AI Career Workshop",
    description: "Free live workshop for final-year engineering students.",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#0b1b3f", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
