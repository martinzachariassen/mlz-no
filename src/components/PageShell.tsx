import { FloatingMarks } from "@martinzachariassen/design";
import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { TopBar } from "./TopBar";

export function PageShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <FloatingMarks className="z-0" />
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
