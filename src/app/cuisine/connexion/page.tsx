import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSettings } from "@/server/settings";
import { PinLogin } from "./pin-login";

export const metadata: Metadata = {
  title: "Connexion cuisine",
  robots: { index: false },
  manifest: "/cuisine/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Cuisine", statusBarStyle: "black-translucent" },
};

export default async function KitchenLogin() {
  const s = await getSettings();
  const staff = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(and(eq(schema.users.role, "kitchen"), eq(schema.users.active, true)))
    .orderBy(asc(schema.users.name));
  return (
    <div className="pattern-african min-h-dvh bg-forest px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="text-center text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="mx-auto size-16" />
          <h1 className="mt-3 text-3xl font-bold">{s.business.name} – Cuisine</h1>
        </div>
        <PinLogin staff={staff} />
        <p className="mt-8 text-center">
          <Link href="/admin/connexion" className="text-white/70 underline hover:text-white">
            Accès responsable (administration)
          </Link>
        </p>
      </div>
    </div>
  );
}
