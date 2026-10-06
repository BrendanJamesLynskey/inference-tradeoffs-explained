/**
 * Root layout for the App Router.
 *
 * Server Component, copied from transformer-explainer's layout (via the companion sites): HTML
 * scaffold, the global stylesheet and the site header. Dark mode follows
 * the system setting (`darkMode: "media"` in tailwind.config.ts).
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteHeader } from "@/components/ui/SiteHeader";
import { SITE_URL } from "@/lib/site";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Inference Trade-offs Explained",
    template: "%s · Inference Trade-offs Explained",
  },
  description:
    "Which serving lever helps which metric, for which workload: architectural trade-offs in LLM inference, measured by a simulator sweep. A Pareto explorer, a lever-by-metric matrix and a live what-if.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
