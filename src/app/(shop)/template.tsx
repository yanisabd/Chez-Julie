/** Rejoué à chaque changement de page : entrée en douceur du contenu. */
export default function ShopTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page">{children}</div>;
}
