import type { Metadata, Viewport } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import "./globals.css";
import { getSettings } from "@/server/settings";
import { ToastProvider } from "@/components/toast";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
    title: { default: `${s.business.name} – ${s.business.tagline}`, template: `%s · ${s.business.name}` },
    description: s.business.about,
    applicationName: s.business.name,
    icons: { icon: "/icon.svg" },
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: s.business.name, statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false },
    openGraph: {
      type: "website",
      locale: "fr_FR",
      siteName: s.business.name,
      title: `${s.business.name} – ${s.business.tagline}`,
      description: s.business.about,
    },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = { themeColor: "#1F4D3A", width: "device-width", initialScale: 1 };

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${dmSans.variable}`}>
      <body className="min-h-dvh">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
