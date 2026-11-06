import type { Metadata } from "next";
import { Card, Field, Input } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action";
import { resetPassword } from "../../actions";

export const metadata: Metadata = { title: "Nouveau mot de passe", robots: { index: false } };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="mx-auto max-w-md px-4 pt-10">
      <h1 className="text-center text-3xl font-bold">Nouveau mot de passe</h1>
      <Card className="mt-6">
        <ActionForm action={resetPassword} success={null} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <Field label="Nouveau mot de passe" hint="10 caractères minimum, avec des lettres et des chiffres." htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
          </Field>
          <SubmitButton variant="primary" size="lg" className="w-full">
            Enregistrer
          </SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
