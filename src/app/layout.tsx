import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { connection } from "next/server";
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
    // Private unless a page opts in: nearly every route is a workspace, portal
    // or console screen, and a new one shouldn't reach search by default.
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Renders every page per request. A prerendered page has no nonce on its
  // scripts, so the proxy's Content-Security-Policy would block them all.
  await connection();

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
        <PlatformBrandProvider brand={{ platformName, supportEmail }}>
          <Providers>{children}</Providers>
        </PlatformBrandProvider>
      </body>
    </html>
  );
}
