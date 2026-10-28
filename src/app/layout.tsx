import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Annapurna Rebuilt — Cold-Chain Integrity & Cargo-Rescue Platform",
  description:
    "Original implementation of cold-chain monitoring, deterministic thermal anomaly alerts, and multi-tenant cargo-rescue coordination.",
  authors: [{ name: "Kenkei69" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="min-h-screen antialiased bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
