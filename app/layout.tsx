import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { VercelToolbar } from "@vercel/toolbar/next";
import { OutboundLinkTracker } from "@/components/OutboundLinkTracker";
import { MOTION_CSS_VARIABLES } from "@/constants/motion";
import {
  createPersonJsonLd,
  createWebSiteJsonLd,
  SeoJsonLd,
} from "@/lib/seo/json-ld";
import { createSeoMetadata } from "@/lib/seo/metadata";
import { staticSeo } from "@/lib/seo/routes";
import { siteConfig } from "@/lib/seo/site";
import Providers from "../components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: siteConfig.url,
  ...createSeoMetadata(staticSeo.home),
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const shouldInjectToolbar = process.env.NODE_ENV === "development";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={MOTION_CSS_VARIABLES}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col relative">
        <SeoJsonLd data={[createPersonJsonLd(), createWebSiteJsonLd()]} />
        <Providers>{children}</Providers>
        <OutboundLinkTracker />
        <Analytics />
        {shouldInjectToolbar && <VercelToolbar />}
      </body>
    </html>
  );
}
