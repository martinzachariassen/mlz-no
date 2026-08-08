import {
  FloatingMarks,
  GridBackground,
  ThemeProvider,
} from "@martinzachariassen/design";
import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { TopBar } from "./TopBar";

export function PageShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // No props: ThemeProvider's defaults are the same storage keys and
    // attribute the build-time init script writes (see vite/theme-init.ts), so
    // React's first effect re-applies exactly what is already on <html>.
    <ThemeProvider>
      <div className="relative flex min-h-svh flex-col overflow-hidden">
        {/* Two decorative layers, both below the content. The grid is revealed
            only through a spotlight that follows the pointer; `glow` is off
            because its accent pool blends with `multiply`, which darkens rather
            than glows on the ink surface in dark mode. */}
        <GridBackground interactive glow={false} className="z-0" />
        <FloatingMarks className="z-0" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1] animate-pulse-soft"
          style={{
            // Mixed from --foreground rather than a fixed black: a black wash is
            // invisible on the dark theme's near-black background, and this
            // resolves to the same value as before in light mode.
            background:
              "radial-gradient(125% 125% at 50% 28%, transparent 56%, color-mix(in oklch, var(--foreground) 4.5%, transparent) 100%)",
          }}
        />
        <TopBar />
        {children}
        <Footer />
      </div>
    </ThemeProvider>
  );
}
