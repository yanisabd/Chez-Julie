import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSettings } from "@/server/settings";
import { emailsEnabled } from "@/server/notifications";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/format";
import { PageHeader, Help, Card, Field, Input, Check, Badge, Notice, btnClass } from "@/components/ui";
import { ActionForm, SubmitButton, ActionButton } from "@/components/action";
import { saveNotificationSettings, retryEmail, retryAllFailed } from "../actions/settings";

export const metadata = { title: "Emails envoyés" };

const STATUS: Record<string, { label: string; cls: string }> = {
  sent: { label: "Envoyé", cls: "bg-emerald-100 text-emerald-800 ring-emerald-300" },
  simulated: { label: "Simulé (démo)", cls: "bg-sky-100 text-sky-800 ring-sky-300" },
  pending: { label: "En attente", cls: "bg-amber-100 text-amber-900 ring-amber-300" },
  sending: { label: "Envoi…", cls: "bg-amber-100 text-amber-900 ring-amber-300" },
  failed: { label: "Échec", cls: "bg-red-100 text-red-800 ring-red-300" },
};

export default async function EmailsPage({ searchParams }: { searchParams: Promise<{ statut?: string; voir?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const filter = sp.statut && sp.statut in STATUS ? sp.statut : null;
  const list = await db
    .select({ id: schema.notifications.id, type: schema.notifications.type, recipient: schema.notifications.recipient, subject: schema.notifications.subject, status: schema.notifications.status, attempts: schema.notifications.attempts, lastError: schema.notifications.lastError, createdAt: schema.notifications.createdAt, sentAt: schema.notifications.sentAt })
    .from(schema.notifications)
    .where(filter ? eq(schema.notifications.status, filter) : undefined)
    .orderBy(desc(schema.notifications.id))
    .limit(100);
  const preview = sp.voir ? await db.query.notifications.findFirst({ where: eq(schema.notifications.id, Number(sp.voir) || 0) }) : null;
  const failed = list.filter((n) => n.status === "failed").length;
  const c = s.notifications.customer;

  return (
    <div>
      <PageHeader title="Emails envoyés" subtitle="Les emails partent automatiquement. Cette page permet de vérifier qu’ils sont bien arrivés." />
      {!emailsEnabled() && <Notice tone="warn" className="mb-4">Mode démonstration : les emails ne sont pas réellement envoyés (statut « Simulé »). Vous pouvez quand même les prévisualiser.</Notice>}
      <Help>Si un envoi échoue (boîte mail pleine, panne passagère…), le site réessaie automatiquement 6 fois sur plusieurs heures. Un même email n’est jamais envoyé deux fois.</Help>

      {preview && (
        <Card className="mb-6">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">{preview.subject}</div>
              <div className="text-sm text-muted">À : {preview.recipient}</div>
            </div>
            <Link href="/admin/emails" className={btnClass("outline", "sm")}>Fermer</Link>
          </div>
          <iframe title="Aperçu de l’email" srcDoc={preview.html} sandbox="" className="h-[600px] w-full rounded-xl ring-1 ring-sand-dark" />
        </Card>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {[null, "sent", "simulated", "pending", "failed"].map((k) => (
          <Link key={k ?? "all"} href={k ? `/admin/emails?statut=${k}` : "/admin/emails"} className={btnClass(filter === k ? "secondary" : "outline", "sm")}>
            {k ? STATUS[k].label : "Tous"}
          </Link>
        ))}
        {failed > 0 && (
          <ActionButton action={retryAllFailed} size="sm" variant="primary" className="ml-auto">
            Relancer les {failed} échecs
          </ActionButton>
        )}
      </div>
      <div className="space-y-2">
        {list.map((n) => (
          <div key={n.id} className={cn("flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5 sm:flex-row sm:items-center", n.status === "failed" && "ring-red-200")}>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{n.subject}</div>
              <div className="truncate text-sm text-muted">
                {n.recipient} · {formatDateTime(n.createdAt)}
                {n.attempts > 1 && ` · ${n.attempts} essais`}
              </div>
              {n.lastError && n.status !== "sent" && <div className="truncate text-xs text-red-700">{n.lastError}</div>}
            </div>
            <div className="flex items-center gap-2">
              <Badge className={STATUS[n.status]?.cls ?? ""}>{STATUS[n.status]?.label ?? n.status}</Badge>
              <Link href={`/admin/emails?voir=${n.id}${filter ? `&statut=${filter}` : ""}`} className={btnClass("ghost", "sm")}>
                Voir
              </Link>
              {n.status === "failed" && (
                <ActionButton action={retryEmail.bind(null, n.id)} size="sm">
                  Renvoyer
                </ActionButton>
              )}
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="text-muted">Aucun email.</p>}
      </div>

      <h2 className="mb-3 mt-10 font-sans text-xl font-bold">Préférences</h2>
      <Card>
        <ActionForm action={saveNotificationSettings} className="space-y-5">
          <Field label="Votre email pour les alertes" hint="Nouvelles commandes, problèmes signalés par la cuisine, stocks bas, erreurs.">
            <Input name="adminEmail" type="email" defaultValue={s.notifications.adminEmail} />
          </Field>
          <div>
            <div className="mb-1 font-semibold">M’envoyer un email quand…</div>
            <div className="grid sm:grid-cols-3">
              <Check name="notifyAdminNewOrder" defaultChecked={s.notifications.notifyAdminNewOrder} label="Nouvelle commande" />
              <Check name="notifyAdminIssues" defaultChecked={s.notifications.notifyAdminIssues} label="Problème signalé" />
              <Check name="notifyAdminLowStock" defaultChecked={s.notifications.notifyAdminLowStock} label="Stock bas" />
            </div>
          </div>
          <div>
            <div className="mb-1 font-semibold">Emails envoyés aux clients</div>
            <p className="mb-2 text-sm text-muted">La confirmation de commande et de paiement, les annulations, remboursements et problèmes de paiement sont toujours envoyés.</p>
            <div className="grid sm:grid-cols-3">
              <Check name="c_accepted" defaultChecked={c.accepted} label="Commande acceptée" />
              <Check name="c_preparing" defaultChecked={c.preparing} label="En préparation" />
              <Check name="c_ready" defaultChecked={c.ready} label="Commande prête" />
              <Check name="c_out_for_delivery" defaultChecked={c.out_for_delivery} label="En livraison" />
              <Check name="c_completed" defaultChecked={c.completed} label="Commande terminée" />
            </div>
          </div>
          <SubmitButton>Enregistrer</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
