import Link from "next/link";
import { btnClass } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <div className="font-display text-7xl font-bold text-terracotta">404</div>
        <h1 className="mt-2 text-2xl font-bold">Cette page n’existe pas</h1>
        <p className="mt-1 text-muted">Le lien est peut-être incorrect ou la page a été déplacée.</p>
        <Link href="/" className={btnClass("primary", "lg", "mt-6")}>
          Retour à l’accueil
        </Link>
      </div>
    </div>
  );
}
