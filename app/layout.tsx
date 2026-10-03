import type { Metadata } from "next";
import { Lato } from "next/font/google";
import "./globals.css";

const lato = Lato({
  weight: ["400", "700", "900"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-lato",
});

export const metadata: Metadata = {
  title: "Agent Room",
  description: "Team chat where you and your AI agents work tickets together.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={lato.variable}>
      <body>{children}</body>
    </html>
  );
}
