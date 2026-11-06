export function LegalPage({ title, children, updated }: { title: string; children: React.ReactNode; updated?: string }) {
  return (
    <article className="mx-auto max-w-3xl px-4 pt-8">
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      {updated && <p className="mt-1 text-sm text-muted">Dernière mise à jour : {updated}</p>}
      <div className="mt-6 space-y-4 rounded-2xl bg-white p-6 text-[15px] leading-relaxed shadow-sm ring-1 ring-black/5 [&_h2]:mt-6 [&_h2]:font-sans [&_h2]:text-lg [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </article>
  );
}
