import Link from "next/link";
import type { Metadata } from "next";
import { Card, Field, Input } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action";
import { customerRegister } from "../actions";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ retour?: string }> }) {
  const { retour } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 pt-10">
      <h1 className="text-center text-3xl font-bold">Créer un compte</h1>
      <p className="mt-1 text-center text-muted">Suivez vos commandes et recommandez en un clic.</p>
      <Card className="mt-6">
        <ActionForm action={customerRegister} success={null} className="space-y-4">
          <input type="hidden" name="retour" value={retour ?? "/compte"} />
          <Field label="Nom et prénom" htmlFor="name">
            <Input id="name" name="name" autoComplete="name" required />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Téléphone" htmlFor="phone">
            <Input id="phone" name="phone" type="tel" autoComplete="tel" required />
          </Field>
          <Field label="Mot de passe" hint="10 caractères minimum, avec des lettres et des chiffres." htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
          </Field>
          <label className="flex items-start gap-3 text-[15px]">
            <input type="checkbox" name="consent" className="mt-0.5 size-5 accent-forest" required />
            <span>
              J’accepte la <Link href="/confidentialite" target="_blank" className="underline">politique de confidentialité</Link>.
            </span>
          </label>
          <SubmitButton variant="primary" size="lg" className="w-full">
            Créer mon compte
          </SubmitButton>
        </ActionForm>
      </Card>
      <p className="mt-6 text-center">
        Déjà un compte ? <Link href="/compte/connexion" className="font-semibold text-terracotta underline">Se connecter</Link>
      </p>
    </div>
  );
}
