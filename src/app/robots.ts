import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Workspaces, portals and the console aren't for search engines.
      disallow: [
        "/api/",
        "/auth/",
        "/platform",
        "/maintenance",
        "/blocked",
        "/unauthorized",
        "/*/login",
        "/*/forgot-password",
        "/*/reset-password",
        "/*/portal",
        "/*/payment",
        "/*/account",
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
