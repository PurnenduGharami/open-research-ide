import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "../dashboard/styles.css";
import "../components/graph.css";
import "../components/export.css";
import "../components/print.css";

export const metadata: Metadata = {
  title: "Open Research IDE",
  description: "A local-first, auditable scientific investigation workspace powered by OpenClaw.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, colorScheme: "light" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
