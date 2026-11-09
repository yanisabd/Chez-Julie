import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSettings } from "@/server/settings";
import { emailsEnabled, smsEnabled } from "@/server/notifications";
import { Mail, MessageSquare } from "lucide-react";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/format";
import { PageHeader, Help, Card, Field, Input, Check, Badge, Notice, btnClass } from "@/components/ui";
import { ActionForm, SubmitButton, ActionButton } from "@/components/action";
import { saveNotificationSettings, retryEmail, retryAllFailed } from "../actions/settings";

export const metadata = { title: "Emails & SMS" };

const STATUS: Record<string, { label: string; cls: string }> = {
  sent: { label: "Envoyé", cls: "bg-emerald-100 text-emerald-800 ring-emerald-300" },
  simulated: { label: "Simulé (démo)", cls: "bg-sky-100 text-sky-800 ring-sky-300" },
  pending: { label: "En attente", cls: "bg-amber-100 text-amber-900 ring-amber-300" },
  sending: { label: "Envoi…", cls: "bg-amber-100 text-amber-900 ring-amber-300" },
  failed: { label: "Échec", cls: "bg-red-100 text-red-800 ring-red-300" },
};

export default async function EmailsPage({ searchParams }: { searchParams: Promise<{ statut?: string; voir?: string; canal?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const filter = sp.statut && sp.statut in STATUS ? sp.statut : null;
  const canal = sp.canal === "sms" || sp.canal === "email" ? sp.canal : null;
  const conds = [filter ? eq(schema.notifications.status, filter) : undefined, canal ? eq(schema.notifications.channel, canal) : undefined].filter((x) => x !== undefined);
  const list = await db
    .select({ id: schema.notifications.id, channel: schema.notifications.channel, text: schema.notifications.text, type: schema.notifications.type, recipient: schema.notifications.recipient, subject: schema.notifications.subject, status: schema.notifications.status, attempts: schema.notifications.attempts, lastError: schema.notifications.lastError, createdAt: schema.notifications.createdAt, sentAt: schema.notifications.sentAt })
    .from(schema.notifications)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.notifications.id))
    .limit(100);
  const preview = sp.voir ? await db.query.notifications.findFirst({ where: eq(schema.notifications.id, Number(sp.voir) || 0) }) : null;
  const failed = list.filter((n) => n.status === "failed").length;
  const c = s.notifications.customer;
  const sms = s.notifications.sms;

  return (
    <div>
      <PageHeader title="Emails & SMS" subtitle="Les messages partent automatiquement. Cette page permet de vérifier qu’ils sont bien arrivés." />
      {(!emailsEnabled() || !smsEnabled()) && (
        <Notice tone="warn" className="mb-4">
          Mode démonstration : {[!emailsEnabled() && "les emails", !smsEnabled() && "les SMS"].filter(Boolean).join(" et ")} ne sont pas réellement envoyés (statut « Simulé »). Vous pouvez quand même les prévisualiser.
        </Notice>
      )}
      <Help>
        Le client reçoit un <b>email</b> détaillé à chaque étape et un <b>SMS</b> aux moments clés (commande confirmée, prête ou en route, annulée). Si un envoi échoue, le site réessaie automatiquement 6 fois sur plusieurs
        heures. Un même message n’est jamais envoyé deux fois.
      </Help>

      {preview && (
        <Card className="mb-6">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">{preview.subject}</div>
              <div className="text-sm text-muted">À : {preview.recipient}</div>
            </div>
            <Link href="/admin/emails" className={btnClass("outline", "sm")}>Fermer</Link>
          </div>
          {preview.channel === "sms" ? (
            <div className="mx-auto max-w-sm rounded-3xl bg-stone-100 p-4">
              <div className="rounded-2xl rounded-bl-sm bg-white p-3 text-[15px] shadow-sm">{preview.text}</div>
              <div className="mt-2 text-right text-xs text-muted">
                {preview.text.length} caractères · {preview.text.length <= 160 ? "1 SMS" : `${Math.ceil(preview.text.length / 153)} SMS`}
              </div>
            </div>
          ) : (
            <iframe title="Aperçu de l’email" srcDoc={preview.html} sandbox="" className="h-[600px] w-full rounded-xl ring-1 ring-sand-dark" />
          )}
        </Card>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {[null, "email", "sms"].map((k) => (
          <Link
            key={k ?? "tous-canaux"}
            href={`/admin/emails?${new URLSearchParams({ ...(k ? { canal: k } : {}), ...(filter ? { statut: filter } : {}) })}`}
            className={btnClass(canal === k ? "secondary" : "outline", "sm")}
          >
            {k === "email" ? "Emails" : k === "sms" ? "SMS" : "Emails + SMS"}
          </Link>
        ))}
        <span className="mx-1 h-6 w-px bg-sand-dark" />
        {[null, "sent", "simulated", "pending", "failed"].map((k) => (
          <Link key={k ?? "all"} href={`/admin/emails?${new URLSearchParams({ ...(k ? { statut: k } : {}), ...(canal ? { canal } : {}) })}`} className={btnClass(filter === k ? "secondary" : "outline", "sm")}>
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
              <div className="flex items-center gap-2 font-medium">
                {n.channel === "sms" ? <MessageSquare className="size-4 shrink-0 text-terracotta" /> : <Mail className="size-4 shrink-0 text-forest" />}
                <span className="truncate">{n.channel === "sms" ? n.text : n.subject}</span>
              </div>
              <div className="truncate text-sm text-muted">
                {n.recipient} · {formatDateTime(n.createdAt)}
                {n.attempts > 1 && ` · ${n.attempts} essais`}
              </div>
              {n.lastError && n.status !== "sent" && <div className="truncate text-xs text-red-700">{n.lastError}</div>}
            </div>
            <div className="flex items-center gap-2">
              <Badge className={STATUS[n.status]?.cls ?? ""}>{STATUS[n.status]?.label ?? n.status}</Badge>
              <Link href={`/admin/emails?${new URLSearchParams({ voir: String(n.id), ...(filter ? { statut: filter } : {}), ...(canal ? { canal } : {}) })}`} className={btnClass("ghost", "sm")}>
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
          <div className="rounded-2xl bg-terracotta-light/40 p-4 ring-1 ring-terracotta/15">
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <MessageSquare className="size-5 text-terracotta" /> SMS
            </div>
            <p className="mb-2 text-sm text-muted">Environ 0,045 € par SMS (Brevo). Seuls les numéros de mobile reçoivent les SMS.</p>
            <Check name="sms_enabled" defaultChecked={sms.enabled} label="Envoyer des SMS" />
            <div className="mt-1 font-medium">Aux clients, quand la commande est…</div>
            <div className="grid sm:grid-cols-4">
              <Check name="sms_order_confirmed" defaultChecked={sms.order_confirmed} label="Confirmée" />
              <Check name="sms_ready" defaultChecked={sms.ready} label="Prête" />
              <Check name="sms_out_for_delivery" defaultChecked={sms.out_for_delivery} label="En livraison" />
              <Check name="sms_cancelled" defaultChecked={sms.cancelled} label="Annulée" />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <Field label="Votre mobile pour les alertes SMS" hint="Laissez vide pour ne pas en recevoir.">
                <Input name="sms_adminPhone" type="tel" defaultValue={sms.adminPhone} placeholder="06 12 34 56 78" />
              </Field>
              <Check name="sms_adminNewOrder" defaultChecked={sms.adminNewOrder} label="Nouvelle commande" />
              <Check name="sms_adminIssues" defaultChecked={sms.adminIssues} label="Problème en cuisine" />
            </div>
          </div>
          <SubmitButton>Enregistrer</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
