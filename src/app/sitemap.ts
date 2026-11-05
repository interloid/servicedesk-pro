import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { APP_ROUTES } from "@/lib/routes";

/** Every page that opts in to indexing; the rest inherit noindex from the root layout. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteConfig.url },
    { url: new URL(APP_ROUTES.SETUP, siteConfig.url).toString() },
  ];
}
