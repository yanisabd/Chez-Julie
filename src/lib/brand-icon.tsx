/** Logo dessiné pour les icônes générées (application, favicon Apple, image de partage). */
export const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1F4D3A"/><path d="M14 38h36a18 18 0 0 1-36 0z" fill="#B9532F"/><path d="M18 38a14 10 0 0 1 28 0z" fill="#E0A526"/><path d="M26 22c0-4 4-4 4-8M34 22c0-4 4-4 4-8" stroke="#F6EFE4" stroke-width="3" stroke-linecap="round" fill="none"/></svg>`;

export const ICON_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(ICON_SVG).toString("base64")}`;

export function IconImage({ size, maskable = false }: { size: number; maskable?: boolean }) {
  // Les icônes « maskable » (Android) ont une marge de sécurité de 20 %
  const inner = maskable ? Math.round(size * 0.72) : size;
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#1F4D3A" }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={ICON_DATA_URI} width={inner} height={inner} />
    </div>
  );
}
