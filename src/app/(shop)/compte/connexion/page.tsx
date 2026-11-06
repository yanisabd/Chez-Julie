import Link from "next/link";
import type { Metadata } from "next";
import { Card, Field, Input } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action";
import { customerLogin } from "../actions";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ retour?: string }> }) {
  const { retour } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 pt-10">
      <h1 className="text-center text-3xl font-bold">Connexion</h1>
      <p className="mt-1 text-center text-muted">Retrouvez vos commandes et commandez plus vite.</p>
      <Card className="mt-6">
        <ActionForm action={customerLogin} success={null} className="space-y-4">
          <input type="hidden" name="retour" value={retour ?? "/compte"} />
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Mot de passe" htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>
          <SubmitButton variant="primary" size="lg" className="w-full">
            Se connecter
          </SubmitButton>
          <Link href="/compte/mot-de-passe-oublie" className="block text-center text-sm font-medium text-muted hover:text-ink">
            Mot de passe oublié ?
          </Link>
        </ActionForm>
      </Card>
      <p className="mt-6 text-center">
        Pas encore de compte ?{" "}
        <Link href={`/compte/inscription${retour ? `?retour=${encodeURIComponent(retour)}` : ""}`} className="font-semibold text-terracotta underline">
          Créer un compte
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-muted">Le compte est facultatif : vous pouvez commander sans.</p>
    </div>
  );
}
