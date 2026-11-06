"use client";

import { btnClass } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid min-h-[70vh] place-items-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Oups, un problème est survenu</h1>
        <p className="mt-2 text-muted">L’erreur a été enregistrée. Aucune commande ni aucun paiement n’a été perdu. Réessayez dans un instant.</p>
        <button onClick={reset} className={btnClass("primary", "lg", "mt-6")}>
          Réessayer
        </button>
      </div>
    </div>
  );
}
