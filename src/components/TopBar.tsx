import { BrandMark, BrandWordmark } from "@martinzachariassen/design";
import { profile } from "../data/profile";

// The header: the MLZ lockup (mark + wordmark) on the left, a blinking build
// status on the right. animate-rise gives it the staged entrance.
export function TopBar() {
  return (
    <header
      className="relative z-10 flex animate-rise items-center justify-between gap-4 px-[clamp(20px,5vw,48px)] pt-[max(28px,env(safe-area-inset-top))] pb-7 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground"
      style={{ animationDelay: "0.05s" }}
    >
      <a
        href="/"
        aria-label="MLZ home"
        className="group inline-flex items-center gap-2.5 text-foreground no-underline"
      >
        <BrandMark
          size={16}
          className="animate-pulse-soft transition-transform duration-300 group-hover:rotate-45"
        />
        <BrandWordmark size={15} />
      </a>
      <span className="inline-flex items-center gap-2.5 text-secondary-foreground">
        <span aria-hidden className="animate-blink text-accent-deep">
          ▮
        </span>
        {profile.since}
      </span>
    </header>
  );
}
