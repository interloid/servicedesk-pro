import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { siteConfig } from "@/config/site";
import { Providers } from "./providers";
import { PlatformBrandProvider } from "@/components/shared/platform-brand";
import { getCachedPlatformSettings } from "@/features/platform-admin/services/platform-settings.service";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export async function generateMetadata(): Promise<Metadata> {
  const { platformName } = await getCachedPlatformSettings();

  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: platformName,
      template: `%s | ${platformName}`,
    },
    description: siteConfig.description,
    applicationName: platformName,
    // No canonical or og:url here: every route inherits the root metadata, so
    // they would name the home page for /setup and the rest. app/page.tsx sets
    // its own.
    openGraph: {
      type: "website",
      siteName: platformName,
      title: platformName,
      description: siteConfig.description,
    },
    twitter: {
      card: "summary_large_image",
      title: platformName,
      description: siteConfig.description,
      ...(siteConfig.twitterHandle ? { site: siteConfig.twitterHandle } : {}),
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { platformName, supportEmail } = await getCachedPlatformSettings();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-dvh",
        "antialiased",
        "font-sans",
        inter.variable,
        jetbrainsMono.variable,
      )}
    >
      <body className="h-full">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: platformName,
              description: siteConfig.description,
              url: siteConfig.url,
            }).replace(/</g, "\\u003c"),
          }}
        />

        <PlatformBrandProvider brand={{ platformName, supportEmail }}>
          <Providers>{children}</Providers>
        </PlatformBrandProvider>
      </body>
    </html>
  );
}
