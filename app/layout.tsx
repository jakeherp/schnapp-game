import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LocaleProvider } from "@/lib/i18n";
import { PwaRegister } from "@/lib/pwa-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Schnapp",
  description: "Amelie's emoji reflex game — tap the emoji before your opponent does.",
  icons: {
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    title: "Schnapp",
    statusBarStyle: "black-translucent",
  },
  other: {
    // Belt-and-suspenders alongside appleWebApp's auto-emitted
    // "mobile-web-app-capable": older iOS Safari only honors the
    // apple-prefixed tag for hiding browser chrome in standalone mode.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#059669",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <LocaleProvider>{children}</LocaleProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
