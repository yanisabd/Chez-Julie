import type { Metadata } from "next";
import { Card, Field, Input } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action";
import { requestPasswordReset } from "../actions";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPage() {
  return (
    <div className="mx-auto max-w-md px-4 pt-10">
      <h1 className="text-center text-3xl font-bold">Mot de passe oublié</h1>
      <p className="mt-1 text-center text-muted">Indiquez votre email, nous vous envoyons un lien pour en choisir un nouveau.</p>
      <Card className="mt-6">
        <ActionForm action={requestPasswordReset} reset className="space-y-4">
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <SubmitButton variant="primary" size="lg" className="w-full">
            Envoyer le lien
          </SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
