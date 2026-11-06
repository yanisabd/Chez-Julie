"use server";

import { redirect } from "next/navigation";
import { logout } from "@/server/auth";

export async function adminLogout() {
  await logout();
  redirect("/admin/connexion");
}
