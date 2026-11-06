"use client";

import { createContext, useContext, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { useToast } from "./toast";
import { btnClass, type BtnSize, type BtnVariant } from "./ui";

const PendingCtx = createContext(false);

/**
 * Formulaire relié à une action serveur : affiche « Enregistré » ou l'erreur,
 * puis actualise la page. Pas de rechargement complet.
 */
export function ActionForm({
  action,
  children,
  className,
  success = "Enregistré ✓",
  reset,
  onDone,
  confirm,
}: {
  action: (fd: FormData) => Promise<ActionResult<unknown>>;
  children: React.ReactNode;
  className?: string;
  success?: string | null;
  reset?: boolean;
  onDone?: (r: ActionResult<unknown>) => void;
  confirm?: string;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  return (
    <PendingCtx.Provider value={pending}>
      <form
        ref={ref}
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          if (confirm && !window.confirm(confirm)) return;
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const r = await action(fd);
            if (!r) return; // redirection effectuée par le serveur
            if (r.ok) {
              if (r.message || success) toast("success", r.message ?? success!);
              if (reset) ref.current?.reset();
              router.refresh();
            } else toast("error", r.error);
            onDone?.(r);
          });
        }}
      >
        {children}
      </form>
    </PendingCtx.Provider>
  );
}

export function SubmitButton({
  children,
  variant = "secondary",
  size = "md",
  className,
}: {
  children: React.ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  className?: string;
}) {
  const pending = useContext(PendingCtx);
  return (
    <button type="submit" disabled={pending} className={btnClass(variant, size, className)}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

/** Bouton qui déclenche une action serveur (avec confirmation optionnelle). */
export function ActionButton({
  action,
  children,
  variant = "outline",
  size = "md",
  className,
  confirm,
  success = null,
  title,
}: {
  action: () => Promise<ActionResult<unknown>>;
  children: React.ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  className?: string;
  confirm?: string;
  success?: string | null;
  title?: string;
}) {
  const [pending, start] = useTransition();
  const [clicked, setClicked] = useState(false);
  const toast = useToast();
  const router = useRouter();
  return (
    <button
      type="button"
      title={title}
      disabled={pending || clicked}
      className={btnClass(variant, size, className)}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        setClicked(true);
        start(async () => {
          const r = await action();
          if (!r) return;
          if (r.ok) {
            if (r.message || success) toast("success", r.message ?? success!);
          } else toast("error", r.error);
          router.refresh();
          setClicked(false);
        });
      }}
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
