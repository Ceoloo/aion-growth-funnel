import type { Metadata, Viewport } from "next";
import { metadata as siteCopy, brand } from "@/content/site";
import { publicConfig } from "@/lib/public-config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicConfig.siteUrl),
  title: {
    default: siteCopy.title,
    template: siteCopy.titleTemplate,
  },
  description: siteCopy.description,
  applicationName: brand.name,
  authors: [{ name: brand.name }],
  keywords: [
    "marketing systems",
    "sales follow-up",
    "CRM for contractors",
    "home services marketing",
    "real estate lead follow-up",
    "local business marketing",
  ],
  openGraph: {
    type: "website",
    siteName: brand.name,
    title: siteCopy.title,
    description: siteCopy.description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: siteCopy.title,
    description: siteCopy.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays available: capping it would fail WCAG 1.4.4.
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0a1726",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
