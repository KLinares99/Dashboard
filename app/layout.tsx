import type { Metadata, Viewport } from "next";
import "@fontsource/bodoni-moda/latin-500.css";
import "@fontsource/bodoni-moda/latin-500-italic.css";
import "@fontsource/bodoni-moda/latin-600.css";
import "@fontsource/jost/latin-400.css";
import "@fontsource/jost/latin-500.css";
import "@fontsource/jost/latin-600.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/jetbrains-mono/latin-600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Elevate Command Center", template: "%s · Elevate" },
  description: "Elevate Business Solutions client workspace.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
