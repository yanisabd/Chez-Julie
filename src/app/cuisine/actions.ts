"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { loginKitchen, logout } from "@/server/auth";
import { rateLimit, clientIp } from "@/server/rate-limit";
import { guarded } from "@/server/action";
import { changeStatus, reportIssue } from "@/server/orders";
import type { OrderStatus } from "@/lib/constants";
import { ISSUE_REASONS } from "@/lib/constants";
import type { ActionResult } from "@/lib/action-result";

export async function kitchenLogin(userId: string, pin: string): Promise<ActionResult> {
  if (!(await rateLimit(`kpin:${await clientIp()}`, 20, 900))) return { ok: false, error: "Trop d’essais. Patientez 15 minutes." };
  if (!/^\d{4}$/.test(pin)) return { ok: false, error: "Le code contient 4 chiffres." };
  const r = await loginKitchen(userId, pin);
  if (!r.ok) return r;
  redirect("/cuisine");
}

export async function kitchenLogout() {
  await logout();
  redirect("/cuisine/connexion");
}

const VALID: OrderStatus[] = ["new", "accepted", "preparing", "ready", "out_for_delivery", "completed"];

/** Changement de statut depuis la cuisine (ou l'admin). Les règles sont vérifiées côté serveur. */
export async function setOrderStatus(orderId: string, from: OrderStatus, to: OrderStatus) {
  return guarded(["kitchen", "admin"], async ({ user, actor }) => {
    if (!VALID.includes(from) || !VALID.includes(to)) return { ok: false, error: "Statut invalide." };
    const r = await changeStatus(orderId, from, to, actor, user.role === "admin" ? "admin" : "kitchen");
    return r.ok ? { ok: true } : r;
  });
}

export async function kitchenReportIssue(orderId: string, reason: string, message: string) {
  return guarded(["kitchen", "admin"], async ({ actor }) => {
    if (!ISSUE_REASONS.includes(reason)) return { ok: false, error: "Motif invalide." };
    const exists = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId), columns: { id: true } });
    if (!exists) return { ok: false, error: "Commande introuvable." };
    const r = await reportIssue(orderId, reason, String(message ?? "").slice(0, 500), actor);
    return r.ok ? { ok: true, message: "Le responsable a été prévenu ✓" } : r;
  });
}
