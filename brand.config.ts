// Brand-asset copy for mlz.no. Everything visual comes from the design system;
// this only supplies the strings. Regenerate the banner, social cards and
// favicons from the design-system repo:
//
//   bun run gen:assets --config ../mlz-no/brand.config.ts --out ../mlz-no
//
// The `defineBrandAssets` helper from "@martinzachariassen/design/brand-assets"
// is equivalent; a plain `satisfies` keeps this working before the dep is bumped
// to the version that exports it.
import type { BrandAssetsConfig } from "@martinzachariassen/design/brand-assets";

export default {
  banner: {
    project: "mlz.no",
    eyebrow: "MLZ · Personal Site",
    description:
      "Personal homepage — a small Vite + React + TypeScript app, served by a hardened Bun + Hono static server.",
    badges: ["React", "Vite", "Bun", "Hono", "TypeScript"],
    install: "bun run dev",
    footer: "github.com/martinzachariassen/mlz-no",
  },
  social: {
    title: "Senior Software Developer",
    eyebrow: "Martin Zachariassen",
    description:
      "Backend systems, distributed architecture, APIs, data pipelines, infrastructure.",
    footer: "mlz.no",
    tag: "Oslo, Norway",
    tagline: "Personal Site",
  },
} satisfies BrandAssetsConfig;
