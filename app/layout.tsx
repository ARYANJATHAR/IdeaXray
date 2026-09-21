import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const bodyFont = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const displayFont = Inter_Tight({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: { default: "IdeaXray | See what happened to your idea", template: "%s | IdeaXray" },
  description: "Explore the patents, research, products, and history surrounding your idea before you build it.",
};

const themeInit = `(function(){try{var s=localStorage.getItem("ideaxray-theme");var d=window.matchMedia("(prefers-color-scheme: dark)").matches;var t=s||(d?"dark":"light");document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`} suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">{themeInit}</Script>
      </head>
      <body>
        <a href="#main-content" className="skip-link">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
