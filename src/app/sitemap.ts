import type { MetadataRoute } from "next";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { appUrl } from "@/server/email-templates";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const products = await db
    .select({ slug: schema.products.slug, updatedAt: schema.products.updatedAt })
    .from(schema.products)
    .where(and(eq(schema.products.active, true), isNull(schema.products.deletedAt)));
  const pages = [
    { path: "/", priority: 1 },
    { path: "/menu", priority: 0.9 },
    { path: "/infos", priority: 0.6 },
    { path: "/allergenes", priority: 0.4 },
    { path: "/cgv", priority: 0.2 },
    { path: "/mentions-legales", priority: 0.2 },
    { path: "/confidentialite", priority: 0.2 },
  ];
  return [
    ...pages.map((p) => ({ url: `${base}${p.path}`, changeFrequency: "weekly" as const, priority: p.priority })),
    ...products.map((p) => ({ url: `${base}/plat/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
