import { FloatingMarks, GridBackground } from "@martinzachariassen/design";
import { Footer } from "./Footer";
import { Identity } from "./Identity";
import { TopBar } from "./TopBar";

export function Hero() {
  return (
    <div className="hero">
      {/* Background layers from the design system: the cursor-following grid
          spotlight (with its accent glow) and the drifting sketch marks. Both are
          absolute, click-through, and honour prefers-reduced-motion / data-motion. */}
      <GridBackground interactive glow />
      <FloatingMarks />
      <TopBar />
      <Identity />
      <Footer />
    </div>
  );
}
