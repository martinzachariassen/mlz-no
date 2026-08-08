import {
  BrandMark,
  BrandWordmark,
  cn,
  containerVariants,
  Stack,
  Text,
  ThemeToggle,
} from "@martinzachariassen/design";
import { profile } from "../data/profile";

export function TopBar() {
  return (
    <header
      className={cn(
        containerVariants({ size: "full", gutter: "lg" }),
        "relative z-10 flex animate-rise items-center justify-between gap-4",
        // Bespoke and staying: viewport-fit=cover is set and the system has no
        // safe-area utilities, so this is what keeps the bar clear of a notch.
        "pt-[max(28px,env(safe-area-inset-top))] pb-7",
      )}
      style={{ animationDelay: "0.05s" }}
    >
      {/* BrandLockup would fold these two into one component, but it renders
          BrandMark internally with no way to reach it — which would drop the
          mark's breathing pulse and its hover rotation. */}
      <a
        href="/"
        aria-label="MLZ home"
        className="group inline-flex items-center gap-2.5 text-foreground"
      >
        <BrandMark
          size={16}
          className="animate-pulse-soft transition-transform duration-300 group-hover:rotate-45"
        />
        <BrandWordmark size={15} />
      </a>

      <Stack direction="row" align="center" gap="md">
        {/* Flavour, not information — the first thing to go when the bar gets
            tight, so the toggle always has room on a phone. */}
        <Text
          variant="eyebrow"
          className="hidden items-center gap-2.5 text-[12px] tracking-[0.2em] text-secondary-foreground sm:inline-flex"
        >
          <span aria-hidden className="animate-blink text-accent-deep">
            ▮
          </span>
          {profile.since}
        </Text>
        <ThemeToggle iconOnly />
      </Stack>
    </header>
  );
}
