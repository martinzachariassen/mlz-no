import { FloatingMarks } from "@martinzachariassen/design";
import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { TopBar } from "./TopBar";

// The shared page frame: a paper sheet that fills the viewport with the design
// system's drifting FloatingMarks as the sole background layer, framed by the
// TopBar and Footer. The home page and the 404 page each render their centre
// section as children, so the chrome and background stay identical across routes.
// FloatingMarks is aria-hidden, click-through and reduced-motion aware, so the
// content stands on its own with JS or motion off.
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <FloatingMarks className="z-0" />
      {/* Soft vignette for depth. React applies this inline gradient via the
          CSSOM on the client, which CSP style-src does not govern, so the
          strict no-inline-style policy in public/_headers still holds. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] animate-pulse-soft"
        style={{
          background:
            "radial-gradient(125% 125% at 50% 28%, transparent 56%, oklch(0 0 0 / 0.045) 100%)",
        }}
      />
      <TopBar />
      {children}
      <Footer />
    </div>
  );
}
