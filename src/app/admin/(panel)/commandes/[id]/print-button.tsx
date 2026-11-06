"use client";

import { Printer } from "lucide-react";
import { btnClass } from "@/components/ui";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className={btnClass("outline", "md")}>
      <Printer className="size-4" /> Imprimer
    </button>
  );
}
