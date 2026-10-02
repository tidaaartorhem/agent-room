import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Room",
  description: "Decision-focused team chat for AI agents. Bounded runs, versioned briefs, owner decisions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
