import { buttonVariants, cn, GlitchText } from "@martinzachariassen/design";
import { useState } from "react";
import { ArrowLeftIcon } from "./icons/ArrowLeftIcon";
import { PageShell } from "./PageShell";

// Slower glitch cadence, matching the identity on the home page, so the flicker
// stays a rare accent rather than constant noise.
const GLITCH_INTERVAL = [1600, 5200] as const;

// A shell "comment" printed under the fake `cd` error — one is picked at random
// per visit so a 404 has a little replay value. Kept short so it survives the
// terminal card's truncation on narrow screens.
const QUIPS = [
  "you wandered off the map",
  "that page pulled a vanishing act",
  "here be dragons",
  "just stray semicolons here",
  "this link had one job",
  "404 bytes of nothing",
  "the void says hi",
  "not the page you're looking for",
] as const;

// The shell prompt, reused across the terminal lines. aria-hidden: it's decorative
// chrome, so screen readers hear only the meaningful command output.
function Prompt() {
  return (
    <span aria-hidden>
      <span className="text-accent-deep">guest@mlz.no</span>
      <span className="text-muted-foreground">:~$ </span>
    </span>
  );
}

// The 404 page. Cloudflare serves dist/404.html with a real 404 status for any
// unknown path (wrangler.jsonc -> assets.not_found_handling: "404-page"). It
// mirrors the home page's identity block — glitchy numerals with the 0 in the
// accent colour — then has a little fun: a mock terminal that echoes the failed
// path as a `cd` error with a random shell-comment quip, plus a route home.
export function NotFound() {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const [quip] = useState(
    () => QUIPS[Math.floor(Math.random() * QUIPS.length)] ?? QUIPS[0],
  );

  return (
    <PageShell>
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-[clamp(16px,2.6vh,24px)] px-[clamp(20px,5vw,48px)] pb-[clamp(32px,7vh,70px)] pt-2.5 text-center">
        <h1
          className="m-0 animate-rise font-hand text-[clamp(72px,22vw,140px)] font-normal uppercase leading-[0.9] text-foreground"
          style={{ animationDelay: "0.15s" }}
        >
          <GlitchText text="4" interval={GLITCH_INTERVAL} />
          <GlitchText
            text="0"
            interval={GLITCH_INTERVAL}
            className="text-accent-deep"
          />
          <GlitchText text="4" interval={GLITCH_INTERVAL} />
        </h1>

        <div
          className="animate-rise font-mono text-[clamp(12px,1.4vw,13px)] uppercase tracking-[0.32em] text-secondary-foreground"
          style={{ animationDelay: "0.45s" }}
        >
          <GlitchText text="Page not found" interval={GLITCH_INTERVAL} />
        </div>

        <div
          className="w-full max-w-[min(440px,90vw)] animate-rise rounded-[var(--radius-sm)] border border-border px-4 py-3 text-left font-mono text-[clamp(11px,1.3vw,13px)] leading-[1.7] text-foreground"
          style={{ animationDelay: "0.55s" }}
        >
          <p className="truncate">
            <Prompt />
            {"cd "}
            {path || "/"}
          </p>
          <p className="text-muted-foreground">cd: no such file or directory</p>
          <p className="truncate text-secondary-foreground">
            {"# "}
            {quip}
          </p>
          <p aria-hidden>
            <Prompt />
            <span className="animate-blink text-accent-deep">▮</span>
          </p>
        </div>

        <nav
          className="mt-1.5 flex w-full max-w-[320px] animate-rise flex-col sm:w-auto"
          style={{ animationDelay: "0.7s" }}
        >
          <a
            href="/"
            data-umami-event="notfound-home"
            className={cn(
              buttonVariants(),
              "h-10 w-full px-4 text-[13px] no-underline sm:h-11 sm:w-auto sm:px-[22px] sm:text-xs",
            )}
          >
            <ArrowLeftIcon />
            Back home
          </a>
        </nav>
      </main>
    </PageShell>
  );
}
