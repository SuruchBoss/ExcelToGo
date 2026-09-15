import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Let crawlers index the pages but keep them out of the API, which returns data, not documents. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
