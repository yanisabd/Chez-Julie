import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", "data/**", "drizzle/**", "backups/**", "e2e-screens/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
    },
  },
  // Images générées (next/og) : la balise <img> y est obligatoire
  { files: ["src/app/**/opengraph-image.tsx", "src/app/**/apple-icon.tsx", "src/lib/brand-icon.tsx"], rules: { "@next/next/no-img-element": "off", "jsx-a11y/alt-text": "off" } },
];
export default config;
