import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import "katex/dist/katex.min.css";
import "../dashboard/styles.css";
import "../components/graph.css";
import "../components/export.css";
import "../components/print.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display-loaded",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans-loaded",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Open Research IDE",
  description:
    "A local-first, harness-agnostic Scientific Research IDE grounded in peer-reviewed literature, independent review panels, multi-modal validation, and reproducible exports.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, colorScheme: "light" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${instrumentSerif.variable} ${inter.variable} ${ibmPlexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
