import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, loginWithPassword } from "@/server/auth";
import { rateLimit, clientIp } from "@/server/rate-limit";
import { getSettings } from "@/server/settings";
import { audit } from "@/server/log";
import type { ActionResult } from "@/lib/action-result";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Card, Field, Input, Notice } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action";

export const metadata: Metadata = { title: "Administration", robots: { index: false } };

async function adminLogin(fd: FormData): Promise<ActionResult> {
  "use server";
  const ip = await clientIp();
  if (!(await rateLimit(`alogin:${ip}`, 10, 900))) return { ok: false, error: "Trop de tentatives. Réessayez dans 15 minutes." };
  const r = await loginWithPassword(String(fd.get("email") ?? ""), String(fd.get("password") ?? ""), ["admin"]);
  if (!r.ok) {
    await audit({ id: null, label: `IP ${ip}` }, "admin.login_failed", "user", null, { email: String(fd.get("email") ?? "").slice(0, 100) });
    return r;
  }
  await audit({ id: r.user.id, label: r.user.name }, "admin.login", "user", r.user.id);
  redirect("/admin");
}

export default async function AdminLogin() {
  const u = await getCurrentUser();
  if (u?.role === "admin") redirect("/admin");
  const s = await getSettings();
  const anyAdmin = await db.query.users.findFirst({ where: eq(schema.users.role, "admin"), columns: { id: true } });
  return (
    <div className="pattern-african grid min-h-dvh place-items-center bg-forest px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="mx-auto size-14" />
          <h1 className="mt-3 text-3xl font-bold">{s.business.name}</h1>
          <p className="text-white/70">Espace responsable</p>
        </div>
        <Card className="p-6">
          {!anyAdmin && (
            <Notice tone="warn" className="mb-4">
              Aucun compte administrateur n’existe encore. Lancez <code>npm run db:seed</code> (voir README) pour créer le premier compte.
            </Notice>
          )}
          <ActionForm action={adminLogin} success={null} className="space-y-4">
            <Field label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" autoComplete="username" required />
            </Field>
            <Field label="Mot de passe" htmlFor="password">
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </Field>
            <SubmitButton size="lg" className="w-full">
              Se connecter
            </SubmitButton>
            <Link href="/compte/mot-de-passe-oublie" className="block text-center text-sm text-muted hover:text-ink">
              Mot de passe oublié ?
            </Link>
          </ActionForm>
        </Card>
        <p className="mt-6 text-center">
          <Link href="/cuisine/connexion" className="text-white/70 underline hover:text-white">
            Accès cuisine
          </Link>
        </p>
      </div>
    </div>
  );
}
