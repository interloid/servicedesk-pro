import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Only endpoints that aren't pages. Private pages are kept out of search
      // by their noindex tag, which a crawler can't read on a path blocked here;
      // Google can still list a blocked URL it finds linked elsewhere. Listing
      // them would also advertise /platform, which 404s to non-admins.
      disallow: ["/api/", "/auth/"],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
