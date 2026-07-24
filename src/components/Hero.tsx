import { FloatingMarks } from "@martinzachariassen/design";
import { Footer } from "./Footer";
import { Identity } from "./Identity";
import { TopBar } from "./TopBar";

// The whole page: a paper sheet that fills the viewport, with the design
// system's drifting FloatingMarks as the sole background layer behind the
// identity. It's aria-hidden, click-through, and reduced-motion aware, so the
// content stands on its own with JS or motion off.
export function Hero() {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <FloatingMarks className="z-0" />
      {/* Soft vignette for depth. React applies this inline gradient via the
          CSSOM on the client, which CSP style-src does not govern, so the
          server's strict no-inline-style policy still holds. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] animate-pulse-soft"
        style={{
          background:
            "radial-gradient(125% 125% at 50% 28%, transparent 56%, oklch(0 0 0 / 0.045) 100%)",
        }}
      />
      <TopBar />
      <Identity />
      <Footer />
    </div>
  );
}
