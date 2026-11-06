import Link from "next/link";
import { desc } from "drizzle-orm";
import { Download, DatabaseBackup } from "lucide-react";
import { db, schema, isEmbeddedDb } from "@/db";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/format";
import { PageHeader, Help, Card, Table, Badge, btnClass } from "@/components/ui";
import { ActionButton } from "@/components/action";
import { acknowledgeErrors } from "../actions/settings";

export const metadata = { title: "Journal & sauvegardes" };

const TABS = [
  { k: "activite", label: "Journal d’activité" },
  { k: "erreurs", label: "Erreurs techniques" },
  { k: "sauvegardes", label: "Sauvegardes" },
];

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.k === sp.vue)?.k ?? "activite";

  return (
    <div>
      <PageHeader title="Journal & sauvegardes" subtitle="Qui a fait quoi, les erreurs éventuelles, et la sauvegarde de vos données." />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.k} href={`/admin/journal?vue=${t.k}`} className={btnClass(tab === t.k ? "secondary" : "outline", "sm")}>
            {t.label}
          </Link>
        ))}
      </div>
      {tab === "activite" && <Activity />}
      {tab === "erreurs" && <Errors />}
      {tab === "sauvegardes" && <Backups />}
    </div>
  );
}

async function Activity() {
  const rows = await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.id)).limit(200);
  return (
    <Table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Qui</th>
          <th>Action</th>
          <th>Détail</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="whitespace-nowrap text-sm text-muted">{formatDateTime(r.createdAt)}</td>
            <td className="text-sm">{r.actorLabel}</td>
            <td className="font-mono text-xs">{r.action}</td>
            <td className="max-w-md truncate text-xs text-muted">
              {r.entity === "order" && r.entityId ? (
                <Link href={`/admin/commandes/${r.entityId}`} className="underline">
                  voir la commande
                </Link>
              ) : null}{" "}
              {r.details ? JSON.stringify(r.details).slice(0, 160) : ""}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

async function Errors() {
  const rows = await db.select().from(schema.systemLogs).orderBy(desc(schema.systemLogs.id)).limit(200);
  const unread = rows.filter((r) => !r.acknowledged && r.level === "error").map((r) => r.id);
  return (
    <div>
      <Help>Les erreurs techniques sont enregistrées ici automatiquement. En cas de doute, transmettez cette page à votre prestataire technique. Aucune commande ni aucun paiement n’est perdu en cas d’erreur.</Help>
      {unread.length > 0 && (
        <ActionButton action={acknowledgeErrors.bind(null, unread)} className="mb-3">
          Marquer les {unread.length} erreur(s) comme lues
        </ActionButton>
      )}
      <div className="space-y-2">
        {rows.map((r) => (
          <details key={r.id} className={cn("rounded-xl bg-white p-3 ring-1", r.level === "error" && !r.acknowledged ? "ring-red-300" : "ring-black/5")}>
            <summary className="flex cursor-pointer items-center gap-2 text-[15px]">
              <Badge className={r.level === "error" ? "bg-red-100 text-red-800 ring-red-300" : r.level === "warn" ? "bg-amber-100 text-amber-900 ring-amber-300" : "bg-stone-100 text-stone-700 ring-stone-300"}>{r.level}</Badge>
              <span className="flex-1">{r.message}</span>
              <span className="text-xs text-muted">{formatDateTime(r.createdAt)}</span>
            </summary>
            {r.context != null && <pre className="mt-2 overflow-x-auto rounded-lg bg-stone-50 p-2 text-xs">{JSON.stringify(r.context, null, 2)}</pre>}
          </details>
        ))}
        {rows.length === 0 && <p className="text-muted">Aucune erreur enregistrée 🎉</p>}
      </div>
    </div>
  );
}

async function Backups() {
  const last = await db.select({ n: schema.orders.number }).from(schema.orders).orderBy(desc(schema.orders.number)).limit(1);
  const n = last[0]?.n ?? 0;
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="flex items-center gap-2 font-sans text-lg font-bold">
          <DatabaseBackup className="size-5" /> Sauvegarde manuelle
        </h2>
        <p className="mt-1 text-[15px] text-muted">
          Téléchargez une copie complète de vos données (commandes, plats, stocks, créneaux, réglages, photos). Conservez-la en lieu sûr (clé USB, Google Drive…). Dernier n° de commande : {n || "aucun"}.
        </p>
        <a href="/api/admin/backup" className={btnClass("secondary", "lg", "mt-4")}>
          <Download className="size-5" /> Télécharger une sauvegarde
        </a>
      </Card>
      <Card>
        <h2 className="font-sans text-lg font-bold">Sauvegardes automatiques</h2>
        {isEmbeddedDb() ? (
          <p className="mt-1 text-[15px] text-muted">
            Le site tourne actuellement sur la base de données locale de démonstration. En production, utilisez une base PostgreSQL hébergée (Supabase, Neon, Scaleway…) qui réalise des sauvegardes automatiques quotidiennes avec
            restauration à un instant précis. Voir le guide de mise en ligne (README).
          </p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-muted">
            <li>Votre hébergeur de base de données réalise des sauvegardes automatiques quotidiennes (vérifiez qu’elles sont activées dans son tableau de bord).</li>
            <li>Une sauvegarde JSON supplémentaire peut être planifiée chaque nuit avec la commande <code>npm run backup</code>.</li>
          </ul>
        )}
      </Card>
      <Card>
        <h2 className="font-sans text-lg font-bold">Restaurer des données</h2>
        <p className="mt-1 text-[15px] text-muted">
          La restauration remplace toutes les données actuelles : elle se fait par votre prestataire technique, avec la commande <code>npm run restore -- fichier.json</code>, selon la procédure décrite dans le README (section
          « Restauration »). Cette opération n’est volontairement pas disponible en un clic pour éviter toute erreur.
        </p>
      </Card>
    </div>
  );
}
