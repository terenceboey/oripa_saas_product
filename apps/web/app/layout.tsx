import "./globals.css";
import type { Metadata } from "next";
import { Inter, Rajdhani } from "next/font/google";
import { CsrfBootstrap } from "../components/csrf-bootstrap";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Oripa SaaS Starter",
  description: "Multi-tenant mystery-pack SaaS starter",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${rajdhani.variable}`}>
      <body>
        <CsrfBootstrap />
        {children}
      </body>
    </html>
  );
}




