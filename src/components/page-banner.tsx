/** En-tête des pages intérieures : même dégradé animé que l'accueil, en plus compact. */
export function PageBanner({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden text-white">
      <div className="hero-gradient absolute inset-0 -z-20" />
      <div className="blob -z-10 left-[-8%] top-[-40%] size-72 bg-gold" />
      <div className="blob -z-10 right-[-6%] bottom-[-50%] size-80 bg-terracotta [animation-delay:-6s]" />
      <div className="pattern-african absolute inset-0 -z-10 opacity-50" />
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:pb-20 sm:pt-14">
        {eyebrow && <p className="animate-fade-up text-sm font-bold uppercase tracking-[0.2em] text-gold">{eyebrow}</p>}
        <h1 className="animate-fade-up mt-2 text-4xl font-bold sm:text-5xl" style={{ animationDelay: "100ms" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="animate-fade-up mt-3 max-w-2xl text-lg text-white/85" style={{ animationDelay: "200ms" }}>
            {subtitle}
          </p>
        )}
        {children && (
          <div className="animate-fade-up mt-6 flex flex-wrap gap-2" style={{ animationDelay: "300ms" }}>
            {children}
          </div>
        )}
      </div>
      <svg className="absolute -bottom-px left-0 h-10 w-full text-sand sm:h-14" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden>
        <path fill="currentColor" d="M0,50 C300,90 520,10 760,40 C1000,70 1220,20 1440,50 L1440,90 L0,90 Z" />
      </svg>
    </section>
  );
}

export function BannerChip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm font-semibold ring-1 ring-white/25 backdrop-blur">{children}</span>;
}

/** Titre de section avec petite barre d'accent aux couleurs de la marque. */
export function SectionTitle({ title, subtitle, count, id }: { title: string; subtitle?: string | null; count?: number; id?: string }) {
  return (
    <div id={id} className="mb-5 scroll-mt-36">
      <div className="flex items-center gap-3">
        <span className="h-8 w-1.5 rounded-full bg-gradient-to-b from-terracotta to-gold" />
        <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
        {count != null && <span className="rounded-full bg-terracotta-light px-2.5 py-0.5 text-sm font-bold text-terracotta-dark">{count}</span>}
      </div>
      {subtitle && <p className="ml-[18px] mt-1 text-muted">{subtitle}</p>}
    </div>
  );
}
