import type { MetadataRoute } from "next";
import { appUrl } from "@/server/email-templates";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/cuisine", "/api", "/compte", "/commande/", "/commander", "/panier", "/paiement-demo"],
      },
    ],
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
